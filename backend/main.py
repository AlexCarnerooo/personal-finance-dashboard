from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/auth/callback")
def auth_callback():
    return {"message": "Enable Banking callback received"}