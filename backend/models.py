from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)

    bank: Mapped[str] = mapped_column(String)
    uid: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(String)

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