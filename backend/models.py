import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, default="customer")  # "customer" or "admin" or "staff"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    saved_addresses = Column(String, default="[]")
    preferred_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cleaning_notes = Column(String, nullable=True)
    bio = Column(String, nullable=True)

    # Relationships
    appointments = relationship("Appointment", back_populates="customer", cascade="all, delete-orphan", foreign_keys="[Appointment.user_id]")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # Stored as YYYY-MM-DD
    time_slot = Column(String, nullable=False)  # Morning 8–12, Afternoon 12–5, Evening 5–8
    cleaning_type = Column(String, nullable=False)  # Standard, Deep Clean, Move-In/Move-Out
    address = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    status = Column(String, default="Pending")  # Pending, Confirmed, Completed, Cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    num_rooms = Column(Integer, default=1)
    selected_addons = Column(String, default="[]")   # JSON array of addon IDs
    quoted_price = Column(Float, nullable=True)       # price locked at booking time

    assigned_staff_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    recurring_schedule_id = Column(Integer, ForeignKey("recurring_schedules.id", ondelete="SET NULL"), nullable=True)
    is_recurring_instance = Column(Boolean, default=False)
    completion_notes = Column(String, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    customer = relationship("User", back_populates="appointments", foreign_keys=[user_id])
    assigned_staff = relationship("User", foreign_keys=[assigned_staff_id])
    recurring_schedule = relationship("RecurringSchedule")
    review = relationship("Review", back_populates="appointment", uselist=False, cascade="all, delete-orphan")


class AvailabilityBlock(Base):
    __tablename__ = "availability_blocks"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False)          # YYYY-MM-DD
    time_slot = Column(String, nullable=True)       # None = entire day blocked
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SlotConfig(Base):
    __tablename__ = "slot_config"

    id = Column(Integer, primary_key=True, index=True)
    max_per_slot = Column(Integer, default=3)       # global cap per slot per day


class ServicePrice(Base):
    __tablename__ = "service_prices"
    
    id = Column(Integer, primary_key=True, index=True)
    cleaning_type = Column(String, nullable=False)   # "Standard", "Deep Clean", "Move-In/Out"
    base_price = Column(Float, nullable=False)
    price_per_room = Column(Float, default=0.0)      # optional room-based surcharge
    description = Column(String, nullable=True)       # shown to customer
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class PriceAddon(Base):
    __tablename__ = "price_addons"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)            # e.g. "Inside Fridge", "Laundry"
    price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    rating = Column(Integer, nullable=False)          # 1–5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    appointment = relationship("Appointment", back_populates="review")
    user = relationship("User")


class StaffLeave(Base):
    __tablename__ = "staff_leave"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)             # YYYY-MM-DD
    reason = Column(String, nullable=True)


class RecurringSchedule(Base):
    __tablename__ = "recurring_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    frequency = Column(String, nullable=False)        # "weekly", "biweekly", "monthly"
    day_of_week = Column(Integer, nullable=True)      # 0=Mon–6=Sun (for weekly/biweekly)
    day_of_month = Column(Integer, nullable=True)     # 1–28 (for monthly)
    time_slot = Column(String, nullable=False)
    cleaning_type = Column(String, nullable=False)
    address = Column(String, nullable=False)
    num_rooms = Column(Integer, default=1)
    selected_addons = Column(String, default="[]")    # JSON array of addon IDs
    is_active = Column(Boolean, default=True)
    next_run_date = Column(String, nullable=False)    # YYYY-MM-DD
    end_date = Column(String, nullable=True)          # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("User")
