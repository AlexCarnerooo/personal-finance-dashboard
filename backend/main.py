from fastapi import FastAPI, Query

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