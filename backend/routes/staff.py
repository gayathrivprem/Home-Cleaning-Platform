from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

import models
import schemas
import auth
from database import get_db
from utils.scheduling import is_staff_available, get_staff_workload

router = APIRouter()

# --- Admin Staff CRUD ---

@router.get("/admin/staff", response_model=List[schemas.StaffResponse])
def list_staff(
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    staff_list = db.query(models.User).filter(models.User.role == "staff").all()
    today = datetime.date.today()
    today_str = today.isoformat()
    start_of_week = today - datetime.timedelta(days=today.weekday())
    end_of_week = start_of_week + datetime.timedelta(days=6)
    
    results = []
    for staff in staff_list:
        jobs_today = db.query(models.Appointment).filter(
            models.Appointment.assigned_staff_id == staff.id,
            models.Appointment.date == today_str,
            models.Appointment.status != "Cancelled"
        ).count()
        
        jobs_this_week = db.query(models.Appointment).filter(
            models.Appointment.assigned_staff_id == staff.id,
            models.Appointment.date >= start_of_week.isoformat(),
            models.Appointment.date <= end_of_week.isoformat(),
            models.Appointment.status != "Cancelled"
        ).count()
        
        leaves = db.query(models.StaffLeave).filter_by(staff_id=staff.id).all()
        leave_dates = [l.date for l in leaves]
        
        results.append({
            "id": staff.id,
            "name": staff.name,
            "email": staff.email,
            "phone": staff.phone,
            "is_active": staff.is_active,
            "jobs_today": jobs_today,
            "jobs_this_week": jobs_this_week,
            "leaves": leave_dates
        })
        
    return results


@router.post("/admin/staff", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: schemas.StaffCreate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user or staff member with this email is already registered."
        )
        
    hashed_password = auth.get_password_hash(payload.password)
    new_staff = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hashed_password,
        phone=payload.phone,
        role="staff",
        is_active=True
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.patch("/admin/staff/{id}", response_model=schemas.UserResponse)
def update_staff(
    id: int,
    payload: schemas.StaffUpdate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    staff = db.query(models.User).filter(models.User.id == id, models.User.role == "staff").first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
        
    staff.name = payload.name
    staff.phone = payload.phone
    staff.is_active = payload.is_active
    db.commit()
    db.refresh(staff)
    
    # If deactivated, unassign from future appointments
    if not staff.is_active:
        today_str = datetime.date.today().isoformat()
        db.query(models.Appointment).filter(
            models.Appointment.assigned_staff_id == id,
            models.Appointment.date >= today_str,
            models.Appointment.status.in_(["Pending", "Confirmed"])
        ).update({models.Appointment.assigned_staff_id: None}, synchronize_session=False)
        db.commit()
        
    return staff


@router.delete("/admin/staff/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    id: int,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    staff = db.query(models.User).filter(models.User.id == id, models.User.role == "staff").first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
        
    staff.is_active = False
    today_str = datetime.date.today().isoformat()
    db.query(models.Appointment).filter(
        models.Appointment.assigned_staff_id == id,
        models.Appointment.date >= today_str,
        models.Appointment.status.in_(["Pending", "Confirmed"])
    ).update({models.Appointment.assigned_staff_id: None}, synchronize_session=False)
    db.commit()
    return


# --- Leave Management ---

@router.get("/admin/staff/{id}/leave", response_model=List[schemas.StaffLeaveResponse])
def get_staff_leave(
    id: int,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    # Verify staff exists
    staff = db.query(models.User).filter(models.User.id == id, models.User.role == "staff").first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
    leaves = db.query(models.StaffLeave).filter(models.StaffLeave.staff_id == id).order_by(models.StaffLeave.date.asc()).all()
    return leaves


@router.post("/admin/staff/{id}/leave", response_model=schemas.StaffLeaveResponse)
def add_staff_leave(
    id: int,
    payload: schemas.StaffLeaveCreate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    staff = db.query(models.User).filter(models.User.id == id, models.User.role == "staff").first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
    if not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add leave for an inactive staff member."
        )
        
    # Check if leave already exists for this date
    existing = db.query(models.StaffLeave).filter_by(staff_id=id, date=payload.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave is already recorded for this staff member on this date."
        )
        
    leave = models.StaffLeave(
        staff_id=id,
        date=payload.date,
        reason=payload.reason
    )
    db.add(leave)
    
    # Unassign staff from appointments scheduled on that date
    db.query(models.Appointment).filter(
        models.Appointment.assigned_staff_id == id,
        models.Appointment.date == payload.date,
        models.Appointment.status.in_(["Pending", "Confirmed"])
    ).update({models.Appointment.assigned_staff_id: None}, synchronize_session=False)
    
    db.commit()
    db.refresh(leave)
    return leave


@router.delete("/admin/staff/{id}/leave/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_staff_leave(
    id: int,
    leave_id: int,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    leave = db.query(models.StaffLeave).filter_by(id=leave_id, staff_id=id).first()
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave entry not found"
        )
    db.delete(leave)
    db.commit()
    return


# --- Assignment & Schedule ---

@router.patch("/admin/appointments/{id}/assign", response_model=schemas.AppointmentResponse)
def assign_appointment(
    id: int,
    payload: dict, # Expecting { "staff_id": int } or { "staff_id": null }
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    appointment = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
        
    staff_id = payload.get("staff_id")
    if staff_id is None:
        # Unassign
        appointment.assigned_staff_id = None
        db.commit()
        db.refresh(appointment)
        return appointment
        
    # Validate staff availability
    if not is_staff_available(db, staff_id, appointment.date, appointment.time_slot):
        # Determine exact reason for detailed HTTP exception
        staff = db.query(models.User).filter_by(id=staff_id, role="staff").first()
        if not staff:
            raise HTTPException(status_code=400, detail="Invalid staff member ID.")
        if not staff.is_active:
            raise HTTPException(status_code=400, detail="Cleaner is inactive.")
            
        on_leave = db.query(models.StaffLeave).filter_by(staff_id=staff_id, date=appointment.date).first()
        if on_leave:
            raise HTTPException(status_code=400, detail=f"Cleaner is on leave that day: {on_leave.reason or 'No reason specified'}")
            
        raise HTTPException(status_code=400, detail="Cleaner is already booked with a conflicting appointment in this time slot.")
        
    appointment.assigned_staff_id = staff_id
    db.commit()
    db.refresh(appointment)
    
    # Eagerly bind customer and assigned staff details
    appointment.customer = db.query(models.User).filter_by(id=appointment.user_id).first()
    appointment.assigned_staff = db.query(models.User).filter_by(id=staff_id).first()
    return appointment


@router.get("/admin/staff/{id}/schedule", response_model=List[schemas.AppointmentResponse])
def get_staff_schedule(
    id: int,
    start: str,
    end: str,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    staff = db.query(models.User).filter(models.User.id == id, models.User.role == "staff").first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )
    appointments = db.query(models.Appointment).filter(
        models.Appointment.assigned_staff_id == id,
        models.Appointment.date >= start,
        models.Appointment.date <= end,
        models.Appointment.status != "Cancelled"
    ).order_by(models.Appointment.date.asc(), models.Appointment.time_slot.asc()).all()
    
    for appt in appointments:
        appt.customer = db.query(models.User).filter_by(id=appt.user_id).first()
    return appointments


# --- Staff Self-View (My Schedule) ---

@router.get("/staff/my-schedule")
def my_schedule(db: Session = Depends(get_db),
                user: models.User = Depends(auth.get_current_user)):
    if user.role != "staff":
        raise HTTPException(403, "Staff only")
    today = str(datetime.date.today())
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))

    all_jobs = db.query(models.Appointment).filter(
        models.Appointment.assigned_staff_id == user.id,
        models.Appointment.status.in_(["Pending", "Confirmed", "Completed"]),
        models.Appointment.date >= today
    ).order_by(models.Appointment.date, models.Appointment.time_slot).all()

    result = []
    for appt in all_jobs:
        customer = db.query(models.User).filter_by(id=appt.user_id).first()
        result.append({
            "id": appt.id,
            "date": appt.date,
            "time_slot": appt.time_slot,
            "cleaning_type": appt.cleaning_type,
            "address": appt.address,
            "status": appt.status,
            "num_rooms": appt.num_rooms,
            "notes": appt.notes,
            "completion_notes": appt.completion_notes,
            "customer_first_name": customer.name.split()[0] if customer else "Customer",
            "is_today": appt.date == today,
            "is_tomorrow": appt.date == tomorrow,
        })
    return result

@router.patch("/staff/my-schedule/{appt_id}/complete")
def complete_job(appt_id: int, body: schemas.JobCompleteRequest,
                 db: Session = Depends(get_db),
                 user: models.User = Depends(auth.get_current_user)):
    if user.role != "staff":
        raise HTTPException(403, "Staff only")
    appt = db.query(models.Appointment).filter_by(
        id=appt_id, assigned_staff_id=user.id).first()
    if not appt:
        raise HTTPException(404, "Job not found")
    if appt.status == "Completed":
        raise HTTPException(400, "Already completed")
    appt.status = "Completed"
    appt.completion_notes = body.notes
    appt.completed_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Job marked as completed"}

@router.patch("/staff/my-schedule/{appt_id}/notes")
def update_job_notes(appt_id: int, body: schemas.JobNotesRequest,
                     db: Session = Depends(get_db),
                     user: models.User = Depends(auth.get_current_user)):
    if user.role != "staff":
        raise HTTPException(403, "Staff only")
    appt = db.query(models.Appointment).filter_by(
        id=appt_id, assigned_staff_id=user.id).first()
    if not appt:
        raise HTTPException(404, "Job not found")
    appt.completion_notes = body.notes
    db.commit()
    return {"message": "Notes saved"}


@router.get("/active", response_model=List[schemas.UserResponse])
def get_active_staff(
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.User).filter_by(role="staff", is_active=True).all()
