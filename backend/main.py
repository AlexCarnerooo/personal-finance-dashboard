from fastapi import FastAPI, Query
from backend.services import sync_all_accounts

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