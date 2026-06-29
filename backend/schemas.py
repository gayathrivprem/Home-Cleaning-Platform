from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# --- Auth Schemas ---

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    role: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# --- Review Schemas ---

class ReviewResponse(BaseModel):
    id: int
    appointment_id: int
    user_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        orm_mode = True
        from_attributes = True

class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int
    comment: Optional[str] = None


# --- Appointment Schemas ---

class AppointmentCreate(BaseModel):
    date: str  # YYYY-MM-DD
    time_slot: str  # Morning 8–12, Afternoon 12–5, Evening 5–8
    cleaning_type: str  # Standard, Deep Clean, Move-In/Move-Out
    address: str
    notes: Optional[str] = None
    num_rooms: Optional[int] = 1
    addon_ids: Optional[List[int]] = []

class AppointmentUpdate(BaseModel):
    status: str  # Pending, Confirmed, Completed, Cancelled

class AppointmentResponse(BaseModel):
    id: int
    user_id: int
    date: str
    time_slot: str
    cleaning_type: str
    address: str
    notes: Optional[str] = None
    status: str
    created_at: datetime
    customer: Optional[UserResponse] = None
    num_rooms: int
    selected_addons: str
    quoted_price: Optional[float] = None
    review: Optional[ReviewResponse] = None
    assigned_staff_id: Optional[int] = None
    recurring_schedule_id: Optional[int] = None
    is_recurring_instance: Optional[bool] = False
    assigned_staff: Optional[UserResponse] = None

    class Config:
        orm_mode = True
        from_attributes = True

# --- Admin Schemas ---

class AdminStatsResponse(BaseModel):
    total_bookings_today: int
    pending_count: int
    completed_this_week: int
    active_recurring_plans: int

# --- Chat Schemas ---

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []
    pending_booking: dict = {}   # partial booking state collected across turns

class ChatResponse(BaseModel):
    reply: str
    action_taken: str = "none"   # "none" | "booked" | "cancelled"
    appointment: Optional[dict] = None
    pending_booking: dict = {}

# --- Staff Job Action Schemas ---

class JobCompleteRequest(BaseModel):
    notes: Optional[str] = None

class JobNotesRequest(BaseModel):
    notes: str


# --- Availability Schemas ---

class AvailabilityBlockCreate(BaseModel):
    date: str  # YYYY-MM-DD
    time_slot: Optional[str] = None  # None = entire day blocked
    reason: Optional[str] = None

class AvailabilityBlockResponse(BaseModel):
    id: int
    date: str
    time_slot: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class SlotConfigUpdate(BaseModel):
    max_per_slot: int


# --- Pricing & Quote Schemas ---

class ServicePriceResponse(BaseModel):
    id: int
    cleaning_type: str
    base_price: float
    price_per_room: float
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class PriceAddonResponse(BaseModel):
    id: int
    name: str
    price: float
    is_active: bool

    class Config:
        orm_mode = True
        from_attributes = True

class PricingConfigResponse(BaseModel):
    services: List[ServicePriceResponse]
    addons: List[PriceAddonResponse]

class QuoteRequest(BaseModel):
    cleaning_type: str
    num_rooms: int
    addon_ids: List[int]

class QuoteBreakdownItem(BaseModel):
    name: str
    price: float

class QuoteResponse(BaseModel):
    base: float
    addons: float
    total: float
    breakdown: List[QuoteBreakdownItem]

class ServicePriceUpdate(BaseModel):
    base_price: float
    price_per_room: float
    description: Optional[str] = None

class PriceAddonCreate(BaseModel):
    name: str
    price: float

class PriceAddonUpdate(BaseModel):
    is_active: bool
    price: float


# --- Staff Schemas ---

class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str

class StaffUpdate(BaseModel):
    name: str
    phone: str
    is_active: bool

class StaffLeaveCreate(BaseModel):
    date: str  # YYYY-MM-DD
    reason: Optional[str] = None

class StaffLeaveResponse(BaseModel):
    id: int
    staff_id: int
    date: str
    reason: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class StaffResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    is_active: bool
    jobs_this_week: int
    jobs_today: int
    leaves: Optional[List[str]] = []

    class Config:
        orm_mode = True
        from_attributes = True

class StaffAppointmentResponse(BaseModel):
    id: int
    date: str
    time_slot: str
    cleaning_type: str
    address: str
    customer_first_name: str
    status: str

    class Config:
        orm_mode = True
        from_attributes = True


# --- Recurring Schedule Schemas ---

class RecurringScheduleCreate(BaseModel):
    frequency: str  # "weekly" | "biweekly" | "monthly"
    time_slot: str
    cleaning_type: str
    address: str
    num_rooms: int
    addon_ids: List[int]
    start_date: str  # YYYY-MM-DD
    end_date: Optional[str] = None  # YYYY-MM-DD or null

class RecurringScheduleResponse(BaseModel):
    id: int
    user_id: int
    frequency: str
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    time_slot: str
    cleaning_type: str
    address: str
    num_rooms: int
    selected_addons: str
    is_active: bool
    next_run_date: str
    end_date: Optional[str] = None
    created_at: datetime
    customer: Optional[UserResponse] = None

    class Config:
        orm_mode = True
        from_attributes = True


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    cleaning_notes: Optional[str] = None
    saved_addresses: Optional[List[str]] = None
    preferred_staff_id: Optional[int] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

