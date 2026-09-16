import os
from pathlib import Path

from dotenv import load_dotenv

from datetime import datetime, timedelta, timezone



import jwt

import requests


load_dotenv()

APPLICATION_ID = os.getenv("ENABLE_BANKING_APPLICATION_ID")
PRIVATE_KEY_PATH = os.getenv("ENABLE_BANKING_PRIVATE_KEY_PATH")
REDIRECT_URL = os.getenv("ENABLE_BANKING_REDIRECT_URL")

private_key = Path(PRIVATE_KEY_PATH).read_text()

def create_jwt():
    now = datetime.now(timezone.utc)

    payload = {
        "iss": "enablebanking.com",
        "aud": "api.enablebanking.com",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=1)).timestamp()),
    }

    token = jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={
            "kid": APPLICATION_ID,
        },
    )

    return token

def get_application():
    token = create_jwt()

    response = requests.get(
        "https://api.enablebanking.com/application",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_spanish_banks():
    token = create_jwt()

    response = requests.get(
        "https://api.enablebanking.com/aspsps",
        params={"country": "ES"},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def get_max_consent_validity_seconds(bank_name: str) -> int:
    banks = get_spanish_banks()
    aspsps = banks.get("aspsps", banks) if isinstance(banks, dict) else banks

    for aspsp in aspsps:
        if aspsp.get("name") == bank_name:
            max_validity = aspsp.get("maximum_consent_validity")

            if max_validity:
                return int(max_validity)

    raise ValueError(
        f"No se encontró maximum_consent_validity para el ASPSP '{bank_name}'"
    )


def start_authorization(bank_name: str):
    token = create_jwt()

    max_validity_seconds = get_max_consent_validity_seconds(bank_name)

    payload = {
        "access": {
            "valid_until": (
                datetime.now(timezone.utc)
                + timedelta(seconds=max_validity_seconds)
            ).isoformat()
        },
        "aspsp": {
            "name": bank_name,
            "country": "ES"
        },
        "state": "personal-finance-dashboard",
        "redirect_url": REDIRECT_URL,
        "psu_type": "personal"
    }

    response = requests.post(
        "https://api.enablebanking.com/auth",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def create_session(code: str):
    token = create_jwt()

    response = requests.post(
        "https://api.enablebanking.com/sessions",
        json={"code": code},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_account_balances(account_uid: str):
    token = create_jwt()

    response = requests.get(
        f"https://api.enablebanking.com/accounts/{account_uid}/balances",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_account_transactions(account_uid: str):
    token = create_jwt()

    response = requests.get(
        f"https://api.enablebanking.com/accounts/{account_uid}/transactions",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_session(session_id: str):
    token = create_jwt()

    response = requests.get(
        f"https://api.enablebanking.com/sessions/{session_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()
