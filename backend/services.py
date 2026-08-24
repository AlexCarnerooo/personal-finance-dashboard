from datetime import datetime

from sqlalchemy import select

from backend.database import SessionLocal
from backend.enable_banking import get_account_balances, get_session
from backend.models import Account, BankConnection, Transaction, Balance
from backend.enable_banking import (
    get_account_balances,
    get_account_transactions,
    get_session,
)
from decimal import Decimal


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
                status=tx.get("status"),
                transaction_type=bank_code.get("code"),
                category=None,
            )

            db.add(transaction)

        db.commit()

def sync_all_accounts():
    with SessionLocal() as db:
        accounts = db.query(Account).all()
        account_uids = [account.uid for account in accounts]

    for account_uid in account_uids:
        sync_account_transactions(account_uid)

def sync_account_balance(account_uid: str):
    data = get_account_balances(account_uid)
    balances = data.get("balances", [])

    if not balances:
        return

    balance_data = balances[0]
    amount_data = balance_data["balance_amount"]

    reference_date = balance_data.get("reference_date")
    if reference_date:
        reference_date = datetime.fromisoformat(reference_date)

    with SessionLocal() as db:
        existing_balance = db.scalar(
            select(Balance).where(
                Balance.account_uid == account_uid
            )
        )

        if existing_balance:
            existing_balance.amount = Decimal(amount_data["amount"])
            existing_balance.currency = amount_data["currency"]
            existing_balance.balance_type = balance_data.get("balance_type")
            existing_balance.reference_date = reference_date
        else:
            balance = Balance(
                account_uid=account_uid,
                amount=Decimal(amount_data["amount"]),
                currency=amount_data["currency"],
                balance_type=balance_data.get("balance_type"),
                reference_date=reference_date,
            )
            db.add(balance)

        db.commit()