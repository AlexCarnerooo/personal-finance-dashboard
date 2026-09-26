"""Fase de categorización.

Añade transactions.category_source y transactions.flow_type_source
(nullable), y crea la tabla category_rules. No modifica ni elimina
ninguna fila existente de transactions/accounts/bank_connections.
Idempotente: se puede ejecutar varias veces sin error.
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


def upgrade():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    if not _column_exists(cursor, "transactions", "category_source"):
        cursor.execute(
            "ALTER TABLE transactions ADD COLUMN category_source VARCHAR"
        )
        print("transactions.category_source: añadida")
    else:
        print("transactions.category_source: ya existía, se omite")

    if not _column_exists(cursor, "transactions", "flow_type_source"):
        cursor.execute(
            "ALTER TABLE transactions ADD COLUMN flow_type_source VARCHAR"
        )
        print("transactions.flow_type_source: añadida")
    else:
        print("transactions.flow_type_source: ya existía, se omite")

    if not _table_exists(cursor, "category_rules"):
        cursor.execute(
            """
            CREATE TABLE category_rules (
                id INTEGER PRIMARY KEY,
                pattern VARCHAR NOT NULL,
                match_type VARCHAR NOT NULL,
                field VARCHAR NOT NULL,
                category VARCHAR NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL
            )
            """
        )
        cursor.execute(
            "CREATE INDEX ix_category_rules_category "
            "ON category_rules (category)"
        )
        print("category_rules: creada")
    else:
        print("category_rules: ya existía, se omite")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    upgrade()
