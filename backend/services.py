from datetime import datetime
from decimal import Decimal

from sqlalchemy import select

from backend.database import SessionLocal
from backend.enable_banking import (
    get_account_balances,
    get_account_transactions,
    get_session,
)
from backend.models import Account, BankConnection, Transaction

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

            existing_account = db.scalar(
                select(Account).where(
                    Account.uid == account_uid
                )
            )

            if not existing_account:
                account = Account(
                    bank=bank_name,
                    uid=account_uid,
                    name=None,
                    currency=currency,
                )
                db.add(account)
            else:
                existing_account.bank = bank_name
                existing_account.currency = currency

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


def sync_account_transactions(account_uid: str):
    data = get_account_transactions(account_uid)
    transactions = data.get("transactions", [])

    with SessionLocal() as db:
        for tx in transactions:
            external_id = tx.get("entry_reference")

            if not external_id:
                continue

            existing = db.scalar(
                select(Transaction).where(
                    Transaction.external_id == external_id
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

def sync_all_accounts():
    results = []

    with SessionLocal() as db:
        accounts = db.query(Account).all()
        account_uids = [account.uid for account in accounts]

    for account_uid in account_uids:
        account_result = {
            "account_uid": account_uid,
            "transactions": "pending",
            "balance": "pending",
        }

        try:
            sync_account_transactions(account_uid)
            account_result["transactions"] = "ok"
        except HTTPError as error:
            status_code = error.response.status_code if error.response else None

            if status_code == 429:
                account_result["transactions"] = "rate_limited"
            else:
                account_result["transactions"] = "error"

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

                account_result["balance"] = "ok"
            else:
                account_result["balance"] = "no_data"

        except HTTPError as error:
            status_code = error.response.status_code if error.response else None

            if status_code == 429:
                account_result["balance"] = "rate_limited"
            else:
                account_result["balance"] = "error"

        results.append(account_result)

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