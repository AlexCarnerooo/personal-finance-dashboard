from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from backend.services import (
    CATEGORIES,
    compute_stats,
    is_bizum,
    save_connection,
    sync_all_accounts,
    update_transaction,
)
from backend.enable_banking import create_session, start_authorization

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

@app.post("/api/banks/{bank_name}/authorize")
def authorize_bank(bank_name: str):
    return start_authorization(bank_name)


@app.get("/auth/callback")
def auth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    if error or not code:
        return {
            "code": code,
            "state": state,
            "error": error,
            "error_description": error_description,
        }

    session_data = create_session(code)
    session_id = session_data.get("session_id")

    if not session_id:
        return {
            "code": code,
            "state": state,
            "error": "missing_session_id",
            "error_description": (
                "La respuesta de create_session no incluyó session_id"
            ),
        }

    save_connection(session_id)

    return {
        "code": code,
        "state": state,
        "error": None,
        "error_description": None,
        "session_id": session_id,
        "status": "connected",
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
    return sync_all_accounts()
    
@app.get("/api/categories")
def get_categories():
    return list(CATEGORIES)


@app.get("/api/stats")
def get_stats():
    return compute_stats()


@app.get("/api/transactions")
def get_transactions():
    with SessionLocal() as db:
        transactions = (
            db.query(Transaction)
            .order_by(Transaction.booking_date.desc())
            .all()
        )

        bank_by_account_id = {
            account.id: account.bank for account in db.query(Account).all()
        }

        return [
            {
                "id": tx.id,
                "account_id": tx.account_id,
                "bank": bank_by_account_id.get(tx.account_id),
                "date": tx.booking_date,
                "amount": float(tx.amount),
                "currency": tx.currency,
                "merchant": tx.merchant_name,
                "description": tx.description,
                "direction": tx.direction,
                "status": tx.status,
                "type": tx.transaction_type,
                "category": tx.category,
                "category_source": tx.category_source,
                "flow_type": tx.flow_type,
                "is_bizum": is_bizum(tx),
            }
            for tx in transactions
        ]


class TransactionCategoryUpdate(BaseModel):
    category: str
    apply_to_similar: bool = False


@app.patch("/api/transactions/{transaction_id}/category")
def patch_transaction_category(
    transaction_id: int, payload: TransactionCategoryUpdate
):
    try:
        return update_transaction(
            transaction_id,
            category=payload.category,
            apply_to_similar=payload.apply_to_similar,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


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