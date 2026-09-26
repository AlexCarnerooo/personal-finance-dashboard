import threading
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from backend.database import SessionLocal
from backend.enable_banking import (
    get_account_balances,
    get_account_transactions,
    get_session,
)
from backend.models import Account, AccountExternalId, BankConnection, Transaction

from requests import HTTPError

def save_connection(session_id: str):
    session_data = get_session(session_id)

    bank_name = session_data["aspsp"]["name"]
    status = session_data["status"]

    valid_until = session_data.get("access", {}).get("valid_until")
    if valid_until:
        valid_until = datetime.fromisoformat(
            valid_until.replace("Z", "+00:00")
        )

    accounts_data = session_data.get("accounts_data", [])
    identification_hash_by_uid = {
        entry["uid"]: entry.get("identification_hash")
        for entry in accounts_data
        if entry.get("uid")
    }

    with SessionLocal() as db:
        existing_connection = db.scalar(
            select(BankConnection).where(
                BankConnection.session_id == session_id
            )
        )

        if not existing_connection:
            connection = BankConnection(
                bank=bank_name,
                session_id=session_id,
                status=status,
                valid_until=valid_until,
            )
            db.add(connection)

        for account_uid in session_data["accounts"]:
            balances = get_account_balances(account_uid)
            balance_list = balances.get("balances", [])

            currency = "UNKNOWN"

            if balance_list:
                currency = balance_list[0]["balance_amount"]["currency"]

            identification_hash = identification_hash_by_uid.get(account_uid)

            # Identidad estable primero (sobrevive a reautorizaciones);
            # el uid de sesión solo como fallback para cuentas antiguas
            # que todavía no tengan identification_hash guardado.
            account = None

            if identification_hash:
                account = db.scalar(
                    select(Account).where(
                        Account.identification_hash == identification_hash
                    )
                )

            if not account:
                account = db.scalar(
                    select(Account).where(Account.uid == account_uid)
                )

            if not account:
                account = Account(
                    bank=bank_name,
                    uid=account_uid,
                    name=None,
                    currency=currency,
                    identification_hash=identification_hash,
                )
                db.add(account)
                db.flush()
            else:
                account.bank = bank_name
                account.currency = currency
                account.uid = account_uid
                if identification_hash:
                    account.identification_hash = identification_hash

            now = datetime.utcnow()

            external_id_link = db.scalar(
                select(AccountExternalId).where(
                    AccountExternalId.external_uid == account_uid
                )
            )

            if not external_id_link:
                db.add(
                    AccountExternalId(
                        account_id=account.id,
                        external_uid=account_uid,
                        first_seen=now,
                        last_seen=now,
                    )
                )
            else:
                external_id_link.last_seen = now

        db.commit()

def get_flow_type(amount, merchant_name, description):
    merchant = (merchant_name or "").lower()
    description = (description or "").lower()

    is_self_transfer = (
        "alexandre carnero" in merchant
        or "alexandre carnero" in description
    )

    if is_self_transfer:
        return "internal_transfer"

    if amount < 0:
        return "expense"

    if amount > 0:
        return "income"

    return None


class UnresolvedAccountError(Exception):
    """account_uid no tiene una Account lógica asociada en
    account_external_ids. No se debe sincronizar a ciegas: forzaría
    transacciones huérfanas sin account_id resoluble."""


def resolve_account_id(account_uid: str) -> int:
    with SessionLocal() as db:
        link = db.scalar(
            select(AccountExternalId).where(
                AccountExternalId.external_uid == account_uid
            )
        )

    if not link:
        raise UnresolvedAccountError(
            f"account_uid '{account_uid}' no está registrado en "
            "account_external_ids; no se puede resolver una Account "
            "lógica estable para sincronizar sus transacciones."
        )

    return link.account_id


def sync_account_transactions(account_uid: str):
    account_id = resolve_account_id(account_uid)

    data = get_account_transactions(account_uid)
    transactions = data.get("transactions", [])

    with SessionLocal() as db:
        for tx in transactions:
            external_id = tx.get("entry_reference")

            if not external_id:
                continue

            existing = db.scalar(
                select(Transaction).where(
                    Transaction.account_id == account_id,
                    Transaction.external_id == external_id,
                )
            )

            if existing:
                continue

            amount_data = tx.get("transaction_amount", {})
            amount = Decimal(amount_data["amount"])

            direction = tx.get("credit_debit_indicator")

            if direction == "DBIT":
                amount = -abs(amount)
            elif direction == "CRDT":
                amount = abs(amount)

            creditor = tx.get("creditor") or {}
            debtor = tx.get("debtor") or {}

            if direction == "DBIT":
                merchant_name = creditor.get("name")
            else:
                merchant_name = debtor.get("name")

            remittance = tx.get("remittance_information") or []
            description = " ".join(remittance) if remittance else None
            flow_type = get_flow_type(
                amount,
                merchant_name,
                description,
            )

            bank_code = tx.get("bank_transaction_code") or {}

            booking_date = tx.get("booking_date")
            if booking_date:
                booking_date = datetime.fromisoformat(booking_date)

            transaction = Transaction(
                account_id=account_id,
                account_uid=account_uid,
                external_id=external_id,
                booking_date=booking_date,
                amount=amount,
                currency=amount_data["currency"],
                merchant_name=merchant_name,
                description=description,
                direction=direction,
                flow_type=flow_type,
                status=tx.get("status"),
                transaction_type=bank_code.get("code"),
                category=None,
            )

            db.add(transaction)

        db.commit()

# Revolut HUF comparte consentimiento con Revolut EUR, tiene saldo 0 y no
# se muestra en el dashboard: se excluye del sync automático/manual para
# no gastar accesos del consentimiento compartido en una cuenta que no se
# usa. No se borra ni dejamos de tener su histórico.
CURRENCIES_EXCLUDED_FROM_SYNC = {"HUF"}

SYNC_COOLDOWN = timedelta(minutes=30)

_last_sync_attempt_at: datetime | None = None
_sync_lock = threading.Lock()

# Categorías de error que Enable Banking nos ha devuelto realmente en este
# proyecto. No se inventan otros codigos.
_RATE_LIMIT_ERROR_CODE = "ASPSP_RATE_LIMIT_EXCEEDED"
_CLOSED_SESSION_ERROR_CODE = "CLOSED_SESSION"

FAILURE_STATUSES = {
    "rate_limited",
    "closed_session",
    "http_error",
    "unexpected_error",
    "unresolved_account",
}


def _classify_http_error(error: HTTPError):
    """Devuelve (categoria, status_code, error_code) a partir de un
    HTTPError real de Enable Banking, inspeccionando status_code y el
    cuerpo JSON cuando esté disponible."""

    status_code = error.response.status_code if error.response is not None else None

    error_code = None
    if error.response is not None:
        try:
            body = error.response.json()
        except ValueError:
            body = {}

        if isinstance(body, dict):
            error_code = body.get("error") or body.get("error_name")

    if error_code == _RATE_LIMIT_ERROR_CODE or status_code == 429:
        category = "rate_limited"
    elif error_code == _CLOSED_SESSION_ERROR_CODE or status_code == 401:
        category = "closed_session"
    else:
        category = "http_error"

    return category, status_code, error_code


def sync_all_accounts():
    global _last_sync_attempt_at

    with _sync_lock:
        now = datetime.utcnow()

        if _last_sync_attempt_at is not None:
            elapsed = (now - _last_sync_attempt_at).total_seconds()

            if elapsed < SYNC_COOLDOWN.total_seconds():
                retry_after_seconds = int(
                    SYNC_COOLDOWN.total_seconds() - elapsed
                )
                return {
                    "status": "cooldown",
                    "retry_after_seconds": retry_after_seconds,
                    "results": [],
                }

        # El cooldown empieza aquí: en el momento en que realmente se
        # intenta sincronizar con los bancos, no cuando se carga el
        # dashboard (que nunca llama a esta función).
        _last_sync_attempt_at = now

    results = []

    with SessionLocal() as db:
        accounts = db.query(Account).all()
        account_refs = [
            (account.id, account.uid, account.bank, account.currency)
            for account in accounts
            if account.currency not in CURRENCIES_EXCLUDED_FROM_SYNC
        ]

    for account_id, account_uid, bank, currency in account_refs:
        account_result = {
            "account_id": account_id,
            "bank": bank,
            "currency": currency,
            "transactions": "pending",
            "balance": "pending",
        }

        try:
            sync_account_transactions(account_uid)
            account_result["transactions"] = "success"
        except UnresolvedAccountError:
            # account_uid no resuelve a una Account lógica: no tocamos
            # transacciones ni pedimos balance para él, y seguimos con
            # el resto de cuentas.
            account_result["transactions"] = "unresolved_account"
            account_result["balance"] = "unresolved_account"
            results.append(account_result)
            continue
        except HTTPError as error:
            category, status_code, error_code = _classify_http_error(error)
            account_result["transactions"] = category
            account_result["transactions_status_code"] = status_code
            account_result["transactions_error_code"] = error_code
        except Exception:
            account_result["transactions"] = "unexpected_error"

        try:
            balance_data = get_account_balances(account_uid)
            balances = balance_data.get("balances", [])

            if balances:
                balance = balances[0]
                amount = Decimal(
                    balance["balance_amount"]["amount"]
                )

                with SessionLocal() as db:
                    account = db.scalar(
                        select(Account).where(
                            Account.uid == account_uid
                        )
                    )

                    if account:
                        account.current_balance = amount
                        account.balance_updated_at = datetime.utcnow()

                    db.commit()

                account_result["balance"] = "success"
            else:
                account_result["balance"] = "no_data"

        except HTTPError as error:
            category, status_code, error_code = _classify_http_error(error)
            account_result["balance"] = category
            account_result["balance_status_code"] = status_code
            account_result["balance_error_code"] = error_code
        except Exception:
            account_result["balance"] = "unexpected_error"

        results.append(account_result)

    sub_statuses = [r["transactions"] for r in results] + [
        r["balance"] for r in results
    ]

    if not any(status in FAILURE_STATUSES for status in sub_statuses):
        overall_status = "success"
    elif all(status in FAILURE_STATUSES for status in sub_statuses):
        overall_status = "failed"
    else:
        overall_status = "partial"

    return {
        "status": overall_status,
        "results": results,
    }



def backfill_identification_hashes():
    """Rellena identification_hash y account_external_ids para cuentas
    creadas antes de que existiera esta identidad estable, usando
    accounts_data de las BankConnection ya guardadas (incluidas las
    cerradas). No toca Transaction en ningún caso."""

    with SessionLocal() as db:
        connections = [
            (connection.session_id, connection.bank)
            for connection in db.query(BankConnection).all()
        ]

    results = []

    for session_id, bank in connections:
        try:
            session_data = get_session(session_id)
        except HTTPError as error:
            status_code = error.response.status_code if error.response else None
            results.append({
                "session_id": session_id,
                "bank": bank,
                "uid": None,
                "status": f"session_fetch_error_{status_code}",
            })
            continue

        accounts_data = session_data.get("accounts_data", [])

        with SessionLocal() as db:
            for entry in accounts_data:
                uid = entry.get("uid")
                identification_hash = entry.get("identification_hash")

                if not uid or not identification_hash:
                    results.append({
                        "session_id": session_id,
                        "bank": bank,
                        "uid": uid,
                        "status": "missing_uid_or_hash",
                    })
                    continue

                account = db.scalar(
                    select(Account).where(Account.uid == uid)
                )

                if not account:
                    results.append({
                        "session_id": session_id,
                        "bank": bank,
                        "uid": uid,
                        "status": "account_not_found",
                    })
                    continue

                account.identification_hash = identification_hash

                now = datetime.utcnow()

                external_id_link = db.scalar(
                    select(AccountExternalId).where(
                        AccountExternalId.external_uid == uid
                    )
                )

                if not external_id_link:
                    db.add(
                        AccountExternalId(
                            account_id=account.id,
                            external_uid=uid,
                            first_seen=now,
                            last_seen=now,
                        )
                    )
                else:
                    external_id_link.last_seen = now

                results.append({
                    "session_id": session_id,
                    "bank": bank,
                    "uid": uid,
                    "account_id": account.id,
                    "status": "ok",
                })

            db.commit()

    return results


def classify_transactions():
    with SessionLocal() as db:
        transactions = db.query(Transaction).all()

        for tx in transactions:
            tx.flow_type = get_flow_type(
                tx.amount,
                tx.merchant_name,
                tx.description,
            )

        db.commit()