from datetime import datetime

from sqlalchemy import select

from backend.database import SessionLocal
from backend.enable_banking import get_account_balances, get_session
from backend.models import Account, BankConnection


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