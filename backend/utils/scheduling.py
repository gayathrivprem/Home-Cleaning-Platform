import datetime
from datetime import timedelta
import calendar
import json
from sqlalchemy.orm import Session
import models
from routes.availability import check_slot_availability
from routes.pricing import calculate_quote

def get_staff_workload(db: Session, staff_id: int, date: str) -> int:
    """Returns count of confirmed+pending jobs assigned to staff on a given date."""
    return db.query(models.Appointment).filter(
        models.Appointment.assigned_staff_id == staff_id,
        models.Appointment.date == date,
        models.Appointment.status.in_(["Pending", "Confirmed"])
    ).count()

def is_staff_available(db: Session, staff_id: int, date: str, time_slot: str) -> bool:
    """True if staff is active, not on leave, and not already booked in this slot."""
    staff = db.query(models.User).filter_by(id=staff_id, role="staff").first()
    if not staff or not staff.is_active:
        return False
        
    on_leave = db.query(models.StaffLeave).filter_by(staff_id=staff_id, date=date).first()
    if on_leave:
        return False
        
    slot_conflict = db.query(models.Appointment).filter_by(
        assigned_staff_id=staff_id, date=date, time_slot=time_slot
    ).filter(models.Appointment.status.in_(["Pending", "Confirmed"])).first()
    
    return slot_conflict is None

def compute_next_date(schedule) -> str:
    current = datetime.date.fromisoformat(schedule.next_run_date)
    if schedule.frequency == "weekly":
        return (current + timedelta(weeks=1)).isoformat()
    elif schedule.frequency == "biweekly":
        return (current + timedelta(weeks=2)).isoformat()
    elif schedule.frequency == "monthly":
        year = current.year
        month = current.month + 1
        if month > 12:
            month = 1
            year += 1
        
        _, last_day = calendar.monthrange(year, month)
        day = min(schedule.day_of_month, last_day)
        return datetime.date(year, month, day).isoformat()
    return schedule.next_run_date

def generate_recurring_appointments(db: Session):
    """
    Run nightly. For each active RecurringSchedule where next_run_date <= today + 14 days,
    generate the next appointment if it doesn't already exist.
    Always keep a 14-day rolling window of pre-generated appointments.
    """
    today = datetime.date.today()
    horizon = today + timedelta(days=14)
    
    schedules = db.query(models.RecurringSchedule).filter(
        models.RecurringSchedule.is_active == True,
        models.RecurringSchedule.next_run_date <= horizon.isoformat()
    ).all()
    
    for schedule in schedules:
        while schedule.is_active and schedule.next_run_date <= horizon.isoformat():
            status = check_slot_availability(db, schedule.next_run_date, schedule.time_slot)
            if status != "available":
                # Skip and advance next_run_date anyway to prevent infinite loop or deadlock, log details
                print(f"Skipping recurring booking for schedule {schedule.id} on {schedule.next_run_date}: slot is {status}")
            else:
                try:
                    addon_ids = json.loads(schedule.selected_addons)
                except Exception:
                    addon_ids = []
                
                quoted = calculate_quote(db, schedule.cleaning_type, schedule.num_rooms, addon_ids)
                
                appt = models.Appointment(
                    user_id=schedule.user_id,
                    date=schedule.next_run_date,
                    time_slot=schedule.time_slot,
                    cleaning_type=schedule.cleaning_type,
                    address=schedule.address,
                    num_rooms=schedule.num_rooms,
                    selected_addons=schedule.selected_addons,
                    quoted_price=quoted["total"],
                    status="Pending",
                    recurring_schedule_id=schedule.id,
                    is_recurring_instance=True
                )
                db.add(appt)
                
            # Advance next_run_date
            schedule.next_run_date = compute_next_date(schedule)
            
            # Deactivate if past end_date
            if schedule.end_date and schedule.next_run_date > schedule.end_date:
                schedule.is_active = False
                break
                
    db.commit()
