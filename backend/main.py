from fastapi import FastAPI, Query
from backend.services import sync_all_accounts

from backend.database import SessionLocal
from backend.models import Account, Transaction

from backend.enable_banking import get_account_balances 

app = FastAPI()


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/auth/callback")
def auth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    return {
        "code": code,
        "state": state,
        "error": error,
        "error_description": error_description,
    }

@app.post("/api/sync")
def sync_all():
    sync_all_accounts()

    return {
        "status": "ok",
        "message": "All accounts synchronized",
    }

@app.get("/api/transactions")
def get_transactions():
    with SessionLocal() as db:
        transactions = (
            db.query(Transaction)
            .order_by(Transaction.booking_date.desc())
            .all()
        )

        return [
            {
                "id": tx.id,
                "account_uid": tx.account_uid,
                "date": tx.booking_date,
                "amount": float(tx.amount),
                "currency": tx.currency,
                "merchant": tx.merchant_name,
                "description": tx.description,
                "direction": tx.direction,
                "status": tx.status,
                "type": tx.transaction_type,
                "category": tx.category,
            }
            for tx in transactions
        ]

@app.get("/api/accounts")
def get_accounts():
    with SessionLocal() as db:
        accounts = db.query(Account).all()

        result = []

        for account in accounts:
            balance_data = get_account_balances(account.uid)
            balances = balance_data.get("balances", [])

            balance = None

            if balances:
                balance = float(
                    balances[0]["balance_amount"]["amount"]
                )

            result.append(
                {
                    "id": account.id,
                    "bank": account.bank,
                    "uid": account.uid,
                    "name": account.name,
                    "currency": account.currency,
                    "balance": balance,
                }
            )

        return result