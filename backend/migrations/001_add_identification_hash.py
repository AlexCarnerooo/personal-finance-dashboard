"""Fase 1 de identidad estable de cuentas.

Añade accounts.identification_hash (nullable) y crea account_external_ids.
No modifica ni elimina filas existentes de accounts, bank_connections ni
transactions. Idempotente: se puede ejecutar varias veces sin error.
"""

import sqlite3

from backend.database import DATABASE_PATH


def _column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def _table_exists(cursor, table):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    return cursor.fetchone() is not None


def _index_exists(cursor, index_name):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,),
    )
    return cursor.fetchone() is not None


def upgrade():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    if not _column_exists(cursor, "accounts", "identification_hash"):
        cursor.execute(
            "ALTER TABLE accounts ADD COLUMN identification_hash VARCHAR"
        )
        print("accounts.identification_hash: añadida")
    else:
        print("accounts.identification_hash: ya existía, se omite")

    # UNIQUE no se puede añadir vía ALTER TABLE ADD COLUMN en SQLite,
    # así que se crea como índice único parcial (permite múltiples NULL).
    if not _index_exists(cursor, "ix_accounts_identification_hash"):
        cursor.execute(
            "CREATE UNIQUE INDEX ix_accounts_identification_hash "
            "ON accounts (identification_hash) "
            "WHERE identification_hash IS NOT NULL"
        )
        print("ix_accounts_identification_hash: creado")
    else:
        print("ix_accounts_identification_hash: ya existía, se omite")

    if not _table_exists(cursor, "account_external_ids"):
        cursor.execute(
            """
            CREATE TABLE account_external_ids (
                id INTEGER PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id),
                external_uid VARCHAR NOT NULL UNIQUE,
                first_seen DATETIME NOT NULL,
                last_seen DATETIME NOT NULL
            )
            """
        )
        cursor.execute(
            "CREATE INDEX ix_account_external_ids_account_id "
            "ON account_external_ids (account_id)"
        )
        print("account_external_ids: creada")
    else:
        print("account_external_ids: ya existía, se omite")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    upgrade()
