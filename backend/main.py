from fastapi import FastAPI, Query
from backend.services import sync_all_accounts

from backend.database import SessionLocal
from backend.models import Account, Transaction


from datetime import datetime

from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/accounts")
def get_accounts():
    with SessionLocal() as db:
        accounts = db.query(Account).all()

        return [
            {
                "id": account.id,
                "bank": account.bank,
                "uid": account.uid,
                "name": account.name,
                "currency": account.currency,
                "balance": (
                    float(account.current_balance)
                    if account.current_balance is not None
                    else None
                ),
                "balance_updated_at": account.balance_updated_at,
            }
            for account in accounts
        ]

@app.post("/api/sync")
def sync_all():
    results = sync_all_accounts()

    return {
        "status": "ok",
        "results": results,
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


@app.get("/api/dashboard")
def get_dashboard():
    now = datetime.now()
    current_year = now.year
    current_month = now.month

    with SessionLocal() as db:
        accounts = db.query(Account).all()

        total_balance_eur = sum(
            float(account.current_balance)
            for account in accounts
            if account.currency == "EUR"
            and account.current_balance is not None
        )

        transactions = db.query(Transaction).all()

        monthly_transactions = [
            tx
            for tx in transactions
            if tx.booking_date
            and tx.booking_date.year == current_year
            and tx.booking_date.month == current_month
            and tx.currency == "EUR"
        ]

        total_income = sum(
            float(tx.amount)
            for tx in monthly_transactions
            if tx.flow_type == "income"
        )

        total_expenses = abs(
            sum(
                float(tx.amount)
                for tx in monthly_transactions
                if tx.flow_type == "expense"
            )
        )

        recent_transactions = (
            db.query(Transaction)
            .order_by(Transaction.booking_date.desc())
            .limit(5)
            .all()
        )

        return {
            "total_balance_eur": total_balance_eur,
            "month": now.strftime("%Y-%m"),
            "monthly_income": total_income,
            "monthly_expenses": total_expenses,
            "monthly_net": total_income - total_expenses,
            "recent_transactions": [
                {
                    "date": tx.booking_date,
                    "amount": float(tx.amount),
                    "currency": tx.currency,
                    "merchant": tx.merchant_name,
                    "type": tx.transaction_type,
                    "flow_type": tx.flow_type,
                    "status": tx.status,
                }
                for tx in recent_transactions
            ],
        }