from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base

 
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)

    bank: Mapped[str] = mapped_column(String)
    uid: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(String)

    identification_hash: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        unique=True,
    )

    current_balance: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
    )

    balance_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

class BankConnection(Base):
    __tablename__ = "bank_connections"

    id: Mapped[int] = mapped_column(primary_key=True)

    bank: Mapped[str] = mapped_column(String)
    session_id: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


class AccountExternalId(Base):
    __tablename__ = "account_external_ids"

    id: Mapped[int] = mapped_column(primary_key=True)

    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id"),
        index=True,
    )
    external_uid: Mapped[str] = mapped_column(String, unique=True)

    first_seen: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint(
            "account_id",
            "external_id",
            name="uq_transactions_account_id_external_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # Identidad lógica estable (sobrevive a reautorizaciones). Ver Account.
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id"),
        index=True,
    )
    # UID de Enable Banking con el que se recibió esta transacción.
    # Solo trazabilidad: NO es identidad, cambia entre reautorizaciones.
    account_uid: Mapped[str] = mapped_column(String, index=True)
    external_id: Mapped[str] = mapped_column(String)

    booking_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String)

    merchant_name: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    direction: Mapped[str] = mapped_column(String)
    flow_type: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    transaction_type: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)

    # "manual" | "rule" | None. Protege una categoría puesta a mano de que
    # una regla automática la sobrescriba.
    category_source: Mapped[str | None] = mapped_column(String, nullable=True)

    # "manual" | None. flow_type normalmente lo calcula get_flow_type(); si
    # la heurística se equivoca (p. ej. una nómina que llega con el propio
    # nombre del titular), se corrige a mano y queda protegida aquí.
    flow_type_source: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


class CategoryRule(Base):
    __tablename__ = "category_rules"

    id: Mapped[int] = mapped_column(primary_key=True)

    pattern: Mapped[str] = mapped_column(String)
    match_type: Mapped[str] = mapped_column(String)  # contains|exact|starts_with
    field: Mapped[str] = mapped_column(String)  # merchant_name|description|any
    category: Mapped[str] = mapped_column(String, index=True)
    priority: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


'''class Balance(Base):
    __tablename__ = "balances"

    id: Mapped[int] = mapped_column(primary_key=True)

    account_uid: Mapped[str] = mapped_column(String, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String)
    balance_type: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )'''