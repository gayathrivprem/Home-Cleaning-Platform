from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import datetime
import calendar

import models
import schemas
import auth
from database import get_db
from utils.scheduling import generate_recurring_appointments

router = APIRouter()

# --- Customer Endpoints ---

@router.get("/recurring", response_model=List[schemas.RecurringScheduleResponse])
def list_my_recurring(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    schedules = db.query(models.RecurringSchedule).filter(
        models.RecurringSchedule.user_id == current_user.id
    ).order_by(models.RecurringSchedule.created_at.desc()).all()
    
    for s in schedules:
        s.customer = current_user
    return schedules


@router.post("/recurring", response_model=schemas.RecurringScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(
    payload: schemas.RecurringScheduleCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        start_date_obj = datetime.date.fromisoformat(payload.start_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid start_date format. Use YYYY-MM-DD."
        )
        
    day_of_week = start_date_obj.weekday()
    day_of_month = min(28, start_date_obj.day)
    
    new_schedule = models.RecurringSchedule(
        user_id=current_user.id,
        frequency=payload.frequency,
        day_of_week=day_of_week,
        day_of_month=day_of_month,
        time_slot=payload.time_slot,
        cleaning_type=payload.cleaning_type,
        address=payload.address,
        num_rooms=payload.num_rooms,
        selected_addons=json.dumps(payload.addon_ids),
        is_active=True,
        next_run_date=payload.start_date,
        end_date=payload.end_date
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    
    # Generate the initial bookings (up to 14 days)
    generate_recurring_appointments(db)
    
    db.refresh(new_schedule)
    new_schedule.customer = current_user
    return new_schedule


@router.patch("/recurring/{id}", response_model=schemas.RecurringScheduleResponse)
def toggle_recurring(
    id: int,
    payload: dict, # Expecting { "is_active": bool }
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    schedule = db.query(models.RecurringSchedule).filter_by(id=id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring schedule not found"
        )
        
    # Permission check
    if current_user.role != "admin" and schedule.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this recurring schedule"
        )
        
    is_active_val = payload.get("is_active")
    if is_active_val is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing is_active boolean field."
        )
        
    schedule.is_active = is_active_val
    
    # Recalculate next_run_date if resuming
    if schedule.is_active:
        today = datetime.date.today()
        today_str = today.isoformat()
        
        # If the next_run_date is in the past, align it to today or a future run date
        if schedule.next_run_date < today_str:
            next_date = today
            if schedule.frequency == "weekly":
                while next_date.weekday() != schedule.day_of_week:
                    next_date += datetime.timedelta(days=1)
            elif schedule.frequency == "biweekly":
                while next_date.weekday() != schedule.day_of_week:
                    next_date += datetime.timedelta(days=1)
            elif schedule.frequency == "monthly":
                year = next_date.year
                month = next_date.month
                if next_date.day > schedule.day_of_month:
                    month += 1
                    if month > 12:
                        month = 1
                        year += 1
                _, last_day = calendar.monthrange(year, month)
                day = min(schedule.day_of_month, last_day)
                next_date = datetime.date(year, month, day)
                
            schedule.next_run_date = next_date.isoformat()
            
            if schedule.end_date and schedule.next_run_date > schedule.end_date:
                schedule.is_active = False
                
    db.commit()
    db.refresh(schedule)
    
    if schedule.is_active:
        # Re-generate rolling bookings
        generate_recurring_appointments(db)
        db.refresh(schedule)
        
    schedule.customer = db.query(models.User).filter_by(id=schedule.user_id).first()
    return schedule


@router.delete("/recurring/{id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_recurring_series(
    id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    schedule = db.query(models.RecurringSchedule).filter_by(id=id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring schedule not found"
        )
        
    # Permission check
    if current_user.role != "admin" and schedule.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this recurring schedule"
        )
        
    schedule.is_active = False
    
    # Cancel all future pending appointments in this series
    today_str = datetime.date.today().isoformat()
    db.query(models.Appointment).filter(
        models.Appointment.recurring_schedule_id == id,
        models.Appointment.date >= today_str,
        models.Appointment.status == "Pending"
    ).update({models.Appointment.status: "Cancelled"}, synchronize_session=False)
    
    db.commit()
    return


# --- Admin Endpoints ---

@router.get("/admin/recurring", response_model=List[schemas.RecurringScheduleResponse])
def admin_list_recurring(
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    schedules = db.query(models.RecurringSchedule).filter(
        models.RecurringSchedule.is_active == True
    ).order_by(models.RecurringSchedule.created_at.desc()).all()
    
    for s in schedules:
        s.customer = db.query(models.User).filter_by(id=s.user_id).first()
    return schedules
