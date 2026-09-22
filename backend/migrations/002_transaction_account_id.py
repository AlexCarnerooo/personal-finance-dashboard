"""Fase 1b — Transaction pertenece a la Account logica estable.

Añade transactions.account_id (FK -> accounts.id), resuelto a partir de
transactions.account_uid -> account_external_ids.external_uid -> account_id.

account_uid se conserva tal cual (trazabilidad del UID de Enable Banking
usado en cada sync); deja de ser identidad, account_id pasa a serlo.

SQLite no permite eliminar un UNIQUE de tabla ni añadir una columna con
NOT NULL/REFERENCES sobre una tabla con filas via ALTER TABLE, así que la
tabla se recrea siguiendo el procedimiento estándar de SQLite (crear tabla
nueva, copiar filas, borrar la vieja, renombrar). No se pierde ninguna
fila: el propio script aborta sin escribir nada si detecta una sola
transacción que no se pueda resolver a un account_id.

Idempotente: si transactions.account_id ya existe, no hace nada.
"""

import sqlite3

from backend.database import DATABASE_PATH


def _column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def upgrade():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    if _column_exists(cursor, "transactions", "account_id"):
        print("transactions.account_id: ya existía, se omite migración completa")
        conn.close()
        return

    cursor.execute("SELECT COUNT(*) FROM transactions")
    total_transactions = cursor.fetchone()[0]

    cursor.execute(
        """
        SELECT COUNT(*)
        FROM transactions t
        JOIN account_external_ids e ON e.external_uid = t.account_uid
        """
    )
    resolvable_transactions = cursor.fetchone()[0]

    if resolvable_transactions != total_transactions:
        conn.close()
        raise RuntimeError(
            "Abortando migración 002: "
            f"{total_transactions - resolvable_transactions} de "
            f"{total_transactions} transacciones no resuelven un "
            "account_id vía account_external_ids. No se ha modificado "
            "ninguna tabla."
        )

    print(
        f"Verificación previa OK: {total_transactions}/{total_transactions} "
        "transacciones resuelven a un account_id único."
    )

    cursor.execute("BEGIN")

    cursor.execute(
        """
        CREATE TABLE transactions_new (
            id INTEGER NOT NULL,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            account_uid VARCHAR NOT NULL,
            external_id VARCHAR NOT NULL,
            booking_date DATETIME,
            amount NUMERIC(14, 2) NOT NULL,
            currency VARCHAR NOT NULL,
            merchant_name VARCHAR,
            description VARCHAR,
            direction VARCHAR NOT NULL,
            status VARCHAR,
            transaction_type VARCHAR,
            category VARCHAR,
            created_at DATETIME NOT NULL,
            flow_type VARCHAR,
            PRIMARY KEY (id),
            CONSTRAINT uq_transactions_account_id_external_id
                UNIQUE (account_id, external_id)
        )
        """
    )

    cursor.execute(
        """
        INSERT INTO transactions_new (
            id, account_id, account_uid, external_id, booking_date,
            amount, currency, merchant_name, description, direction,
            status, transaction_type, category, created_at, flow_type
        )
        SELECT
            t.id, e.account_id, t.account_uid, t.external_id, t.booking_date,
            t.amount, t.currency, t.merchant_name, t.description, t.direction,
            t.status, t.transaction_type, t.category, t.created_at, t.flow_type
        FROM transactions t
        JOIN account_external_ids e ON e.external_uid = t.account_uid
        """
    )

    cursor.execute("SELECT COUNT(*) FROM transactions_new")
    copied = cursor.fetchone()[0]

    if copied != total_transactions:
        conn.rollback()
        conn.close()
        raise RuntimeError(
            f"Abortando migración 002: se copiaron {copied} filas de "
            f"{total_transactions} esperadas. Rollback ejecutado, "
            "transactions original intacta."
        )

    cursor.execute("DROP TABLE transactions")
    cursor.execute("ALTER TABLE transactions_new RENAME TO transactions")

    cursor.execute(
        "CREATE INDEX ix_transactions_account_uid "
        "ON transactions (account_uid)"
    )
    cursor.execute(
        "CREATE INDEX ix_transactions_account_id "
        "ON transactions (account_id)"
    )

    conn.commit()
    conn.close()

    print(f"transactions recreada con account_id: {copied} filas migradas.")
    print(
        "Constraint UNIQUE(external_id) global eliminado; "
        "UNIQUE(account_id, external_id) creado como "
        "uq_transactions_account_id_external_id."
    )


if __name__ == "__main__":
    upgrade()
