import os
from pathlib import Path

from dotenv import load_dotenv

from datetime import datetime, timedelta, timezone

import jwt

import requests


load_dotenv()

APPLICATION_ID = os.getenv("ENABLE_BANKING_APPLICATION_ID")
PRIVATE_KEY_PATH = os.getenv("ENABLE_BANKING_PRIVATE_KEY_PATH")

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