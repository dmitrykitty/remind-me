from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------


class Person(Base):
    __tablename__ = "people"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_label: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    photos: Mapped[list[PersonPhoto]] = relationship(
        back_populates="person", cascade="all, delete-orphan"
    )


class PersonPhoto(Base):
    __tablename__ = "person_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    person_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("people.id", ondelete="CASCADE"), nullable=False
    )
    photo_path: Mapped[str] = mapped_column(String(512), nullable=False)
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sample_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    person: Mapped[Person] = relationship(back_populates="photos")


# ---------------------------------------------------------------------------
# Known Objects / Items
# ---------------------------------------------------------------------------


class KnownObject(Base):
    __tablename__ = "known_objects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    photos: Mapped[list[KnownObjectPhoto]] = relationship(
        back_populates="known_object", cascade="all, delete-orphan"
    )


class KnownObjectPhoto(Base):
    __tablename__ = "known_object_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    object_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("known_objects.id", ondelete="CASCADE"), nullable=False
    )
    photo_path: Mapped[str] = mapped_column(String(512), nullable=False)
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sample_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    known_object: Mapped[KnownObject] = relationship(back_populates="photos")


# ---------------------------------------------------------------------------
# App Settings (single-row table)
# ---------------------------------------------------------------------------


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    face_distance_threshold: Mapped[float] = mapped_column(Float, default=0.35)
    object_distance_threshold: Mapped[float] = mapped_column(Float, default=0.40)
    frame_interval_ms: Mapped[int] = mapped_column(Integer, default=1500)
    face_recognition_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    object_recognition_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Tasks (short reminders like "take medicine")
# ---------------------------------------------------------------------------


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


# ---------------------------------------------------------------------------
# History log (activity + conversation summaries)
# ---------------------------------------------------------------------------


class HistoryEntry(Base):
    __tablename__ = "history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    # kind values: "voice_command", "volunteer_call", "person_added",
    #              "object_added", "task_added", "task_done", etc.
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    transcript: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
