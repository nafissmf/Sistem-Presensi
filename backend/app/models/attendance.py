import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import UTCDateTime
from .base import TimestampMixin


class Participant(Base, TimestampMixin):
    __tablename__ = "participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(64), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="active", server_default="active")
    printed_at = Column(UTCDateTime, nullable=True)

    attendances = relationship("Attendance", back_populates="participant")


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    event_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    location = Column(String(255), nullable=True)
    status = Column(String(32), nullable=False, default="draft", server_default="draft")
    audience = Column(String(16), nullable=False, default="all", server_default="all")
    scan_open_before_min = Column(Integer, nullable=True)
    scan_close_after_min = Column(Integer, nullable=True)
    allow_duplicate = Column(Boolean, nullable=False, default=False, server_default="0")
    color = Column(String(16), nullable=False, default="#4F46E5", server_default="#4F46E5")

    attendances = relationship("Attendance", back_populates="event")
    event_participants = relationship(
        "EventParticipant",
        back_populates="event",
        cascade="all, delete-orphan",
    )


class EventParticipant(Base):
    __tablename__ = "event_participants"

    event_id = Column(
        String(36),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    participant_id = Column(
        String(36),
        ForeignKey("participants.id", ondelete="CASCADE"),
        primary_key=True,
    )

    event = relationship("Event", back_populates="event_participants")
    participant = relationship("Participant")


class Attendance(Base):
    __tablename__ = "attendances"
    __table_args__ = (
        UniqueConstraint("event_id", "participant_id", name="uq_attendance_event_participant"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), ForeignKey("events.id", ondelete="RESTRICT"), nullable=False, index=True)
    participant_id = Column(
        String(36),
        ForeignKey("participants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    scanned_at = Column(UTCDateTime, nullable=False)
    scanned_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    device = Column(String(255), nullable=True)
    method = Column(String(16), nullable=False, default="scanner")

    event = relationship("Event", back_populates="attendances")
    participant = relationship("Participant", back_populates="attendances")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(64), nullable=False)
    entity = Column(String(64), nullable=False)
    entity_id = Column(String(36), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(UTCDateTime, nullable=False)
