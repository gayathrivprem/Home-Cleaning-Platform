import datetime
import os
import httpx
import json
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas
import auth
from routes.availability import public_router, admin_router, check_slot_availability
from routes.pricing import router as pricing_router
from routes.reviews import router as reviews_router
from routes.staff import router as staff_router
from routes.recurring import router as recurring_router
from routes.profile import router as profile_router
from routes.chat import router as chat_router
from apscheduler.schedulers.background import BackgroundScheduler


# Initialize database tables
Base.metadata.create_all(bind=engine)

# Database column migrations check
def run_migrations():
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            # 1. Update users table
            result = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [row[1] for row in result.fetchall()]
            if "is_active" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                print("Added column is_active to users table")
                
            if "saved_addresses" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN saved_addresses TEXT DEFAULT '[]'"))
                print("Added column saved_addresses to users table")
                
            if "preferred_staff_id" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN preferred_staff_id INTEGER"))
                print("Added column preferred_staff_id to users table")
                
            if "cleaning_notes" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN cleaning_notes TEXT"))
                print("Added column cleaning_notes to users table")
                
            if "bio" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
                print("Added column bio to users table")
                
            # 2. Update appointments table
            result = conn.execute(text("PRAGMA table_info(appointments)"))
            appt_cols = [row[1] for row in result.fetchall()]
            
            if "num_rooms" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN num_rooms INTEGER DEFAULT 1"))
                print("Added column num_rooms to appointments table")
                
            if "selected_addons" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN selected_addons TEXT DEFAULT '[]'"))
                print("Added column selected_addons to appointments table")
                
            if "quoted_price" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN quoted_price REAL"))
                print("Added column quoted_price to appointments table")
                
            if "assigned_staff_id" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN assigned_staff_id INTEGER"))
                print("Added column assigned_staff_id to appointments table")
                
            if "recurring_schedule_id" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN recurring_schedule_id INTEGER"))
                print("Added column recurring_schedule_id to appointments table")
                
            if "is_recurring_instance" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN is_recurring_instance BOOLEAN DEFAULT 0"))
                print("Added column is_recurring_instance to appointments table")
                
            if "completion_notes" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN completion_notes TEXT"))
                print("Added column completion_notes to appointments table")
                
            if "completed_at" not in appt_cols:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN completed_at DATETIME"))
                print("Added column completed_at to appointments table")
    except Exception as e:
        print(f"Migration error: {e}")

run_migrations()

app = FastAPI(title="CleanPro API", description="AI Scheduling & Appointment Management API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(public_router)
app.include_router(admin_router)
app.include_router(pricing_router)
app.include_router(reviews_router)
app.include_router(staff_router)
app.include_router(recurring_router)
app.include_router(profile_router, prefix="/profile", tags=["Profile"])
app.include_router(chat_router, prefix="/chat", tags=["Chat"])

# Scheduler definition
scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    from utils.scheduling import generate_recurring_appointments
    scheduler.add_job(
        lambda: generate_recurring_appointments(next(get_db())),
        "cron",
        hour=0,
        minute=0,
        id="generate_recurring_appointments_job"
    )
    scheduler.start()
    
    # Run once immediately on startup
    try:
        db = next(get_db())
        generate_recurring_appointments(db)
        db.close()
    except Exception as e:
        print(f"Error running initial generate_recurring_appointments: {e}")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()

# Seed admin and configuration on startup
@app.on_event("startup")
def seed_database():
    db = next(get_db())
    try:
        # Seed Admin user
        admin_email = "admin@cleanpro.com"
        admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin_user:
            hashed_password = auth.get_password_hash("admin123")
            admin_db = models.User(
                name="System Admin",
                email=admin_email,
                hashed_password=hashed_password,
                phone="123-456-7890",
                role="admin"
            )
            db.add(admin_db)
            db.commit()
            print("Admin user successfully seeded!")
            
        # Seed default SlotConfig
        slot_config = db.query(models.SlotConfig).first()
        if not slot_config:
            default_config = models.SlotConfig(max_per_slot=3)
            db.add(default_config)
            db.commit()
            print("Default SlotConfig (max_per_slot=3) successfully seeded!")

        # Seed default ServicePrices
        pricing_seeded = db.query(models.ServicePrice).first()
        if pricing_seeded and pricing_seeded.base_price < 150.0:
            print("Converting USD service prices to INR in DB...")
            db.query(models.ServicePrice).delete()
            db.query(models.PriceAddon).delete()
            db.commit()
            pricing_seeded = None
            
        if not pricing_seeded:
            defaults = [
                models.ServicePrice(cleaning_type="Standard", base_price=999.0, price_per_room=199.0, description="General home cleaning"),
                models.ServicePrice(cleaning_type="Deep Clean", base_price=1999.0, price_per_room=299.0, description="Thorough top-to-bottom clean"),
                models.ServicePrice(cleaning_type="Move-In/Out", base_price=2999.0, price_per_room=399.0, description="Full property clean for moving"),
            ]
            db.add_all(defaults)
            db.commit()
            print("Default INR service prices successfully seeded!")
            
        # Seed default PriceAddons
        addons_seeded = db.query(models.PriceAddon).first()
        if not addons_seeded:
            default_addons = [
                models.PriceAddon(name="Inside Fridge", price=299.0, is_active=True),
                models.PriceAddon(name="Laundry", price=399.0, is_active=True),
                models.PriceAddon(name="Inside Oven", price=499.0, is_active=True),
                models.PriceAddon(name="Windows", price=599.0, is_active=True),
            ]
            db.add_all(default_addons)
            db.commit()
            print("Default active INR price addons successfully seeded!")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()


# --- Auth Endpoints ---

@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
    
    hashed_password = auth.get_password_hash(user_in.password)
    new_user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_password,
        phone=user_in.phone,
        role="customer"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
        
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email
    }


# --- Appointment Endpoints ---

@app.get("/appointments/", response_model=List[schemas.AppointmentResponse])
def get_appointments(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        appointments = db.query(models.Appointment).order_by(models.Appointment.date.desc(), models.Appointment.time_slot.asc()).all()
    else:
        appointments = db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).order_by(models.Appointment.date.desc(), models.Appointment.time_slot.asc()).all()
    
    # Eagerly link customers for admin dashboard ease
    for apt in appointments:
        apt.customer = db.query(models.User).filter(models.User.id == apt.user_id).first()
        
    return appointments


@app.post("/appointments/", response_model=schemas.AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    appointment_in: schemas.AppointmentCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    from routes.pricing import calculate_quote
    addon_ids = appointment_in.addon_ids or []
    num_rooms = appointment_in.num_rooms if appointment_in.num_rooms is not None else 1
    quote = calculate_quote(db, appointment_in.cleaning_type, num_rooms, addon_ids)
    
    new_appt = models.Appointment(
        user_id=current_user.id,
        date=appointment_in.date,
        time_slot=appointment_in.time_slot,
        cleaning_type=appointment_in.cleaning_type,
        address=appointment_in.address,
        notes=appointment_in.notes,
        status="Pending",
        num_rooms=num_rooms,
        selected_addons=json.dumps(addon_ids),
        quoted_price=quote["total"]
    )
    db.add(new_appt)
    db.commit()
    db.refresh(new_appt)
    new_appt.customer = current_user
    return new_appt


@app.patch("/appointments/{id}", response_model=schemas.AppointmentResponse)
def update_appointment(
    id: int,
    appointment_update: schemas.AppointmentUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    appointment = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Permissions check
    if current_user.role != "admin" and appointment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this appointment"
        )
    
    # Validation logic for Customer cancelling
    if current_user.role != "admin":
        if appointment_update.status != "Cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customers can only cancel appointments"
            )
        if appointment.status in ["Cancelled", "Completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel appointment with status {appointment.status}"
            )
    
    # Update appointment status
    appointment.status = appointment_update.status
    db.commit()
    db.refresh(appointment)
    
    appointment.customer = db.query(models.User).filter(models.User.id == appointment.user_id).first()
    return appointment


# --- Admin Dashboard Endpoints ---

@app.get("/admin/customers", response_model=List[schemas.UserResponse])
def get_customers(admin_user: models.User = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    customers = db.query(models.User).filter(models.User.role == "customer").order_by(models.User.created_at.desc()).all()
    return customers


@app.get("/admin/stats", response_model=schemas.AdminStatsResponse)
def get_stats(admin_user: models.User = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    today_str = datetime.date.today().isoformat()
    seven_days_ago = datetime.date.today() - datetime.timedelta(days=7)
    seven_days_ago_str = seven_days_ago.isoformat()
    
    total_bookings_today = db.query(models.Appointment).filter(models.Appointment.date == today_str).count()
    pending_count = db.query(models.Appointment).filter(models.Appointment.status == "Pending").count()
    completed_this_week = db.query(models.Appointment).filter(
        models.Appointment.status == "Completed",
        models.Appointment.date >= seven_days_ago_str,
        models.Appointment.date <= today_str
    ).count()
    active_recurring_plans = db.query(models.RecurringSchedule).filter(models.RecurringSchedule.is_active == True).count()
    
    return {
        "total_bookings_today": total_bookings_today,
        "pending_count": pending_count,
        "completed_this_week": completed_this_week,
        "active_recurring_plans": active_recurring_plans
    }

