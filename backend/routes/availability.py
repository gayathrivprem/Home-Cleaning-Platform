from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import sys
import os

# Adjust path to import models, database, auth and schemas from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import models
import schemas
import auth
from database import get_db

public_router = APIRouter()
admin_router = APIRouter(prefix="/admin")

# --- Helper Function for Availability Checking ---

def check_slot_availability(db: Session, date: str, time_slot: str) -> str:
    """
    Checks if a given time slot is blocked, full, or available.
    Returns: "blocked" | "full" | "available"
    """
    # 1. Check if the entire day or the specific time slot is blocked
    block = db.query(models.AvailabilityBlock).filter(
        models.AvailabilityBlock.date == date,
        (models.AvailabilityBlock.time_slot == None) | (models.AvailabilityBlock.time_slot == time_slot)
    ).first()
    if block:
        return "blocked"
        
    # 2. Check current booked slots count (excluding Cancelled appointments)
    max_limit = 3  # Default fallback limit
    config = db.query(models.SlotConfig).first()
    if config:
        max_limit = config.max_per_slot
        
    count = db.query(models.Appointment).filter(
        models.Appointment.date == date,
        models.Appointment.time_slot == time_slot,
        models.Appointment.status != "Cancelled"
    ).count()
    
    if count >= max_limit:
        return "full"
        
    return "available"


# --- Public Availability Endpoints ---

@public_router.get("/availability", response_model=Dict[str, Dict[str, str]])
def get_availability(start: str, end: str, db: Session = Depends(get_db)):
    """
    Returns a dictionary mapping: YYYY-MM-DD -> { slot_name: "available" | "full" | "blocked" }
    """
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD."
        )
        
    if (end_date - start_date).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Availability check range cannot exceed 90 days."
        )
        
    slots = ["Morning 8–12", "Afternoon 12–5", "Evening 5–8"]
    result = {}
    
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.isoformat()
        result[date_str] = {}
        for slot in slots:
            result[date_str][slot] = check_slot_availability(db, date_str, slot)
        current_date += timedelta(days=1)
        
    return result


# --- Admin Availability Endpoints ---

@admin_router.get("/availability/blocks", response_model=List[schemas.AvailabilityBlockResponse])
def get_blocks(
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns all locked slot blocks.
    """
    blocks = db.query(models.AvailabilityBlock).order_by(models.AvailabilityBlock.date.desc()).all()
    return blocks


@admin_router.post("/availability/block", response_model=schemas.AvailabilityBlockResponse)
def create_block(
    block_in: schemas.AvailabilityBlockCreate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Adds a lock block onto a slot or full date.
    """
    # Normalize time_slot (if empty or "All Day", store as None representing full-day block)
    slot_val = block_in.time_slot
    if not slot_val or slot_val.strip() == "" or slot_val.lower() == "all day":
        slot_val = None
        
    db_block = models.AvailabilityBlock(
        date=block_in.date,
        time_slot=slot_val,
        reason=block_in.reason
    )
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return db_block


@admin_router.delete("/availability/block/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    id: int,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Removes a block lock.
    """
    db_block = db.query(models.AvailabilityBlock).filter(models.AvailabilityBlock.id == id).first()
    if not db_block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found."
        )
    db.delete(db_block)
    db.commit()
    return


@admin_router.get("/slot-config", response_model=schemas.SlotConfigUpdate)
def get_slot_config(
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves the current max appointments limit per slot per day.
    """
    config = db.query(models.SlotConfig).first()
    if not config:
        config = models.SlotConfig(max_per_slot=3)
    return config


@admin_router.patch("/slot-config", response_model=schemas.SlotConfigUpdate)
def update_slot_config(
    config_in: schemas.SlotConfigUpdate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Updates the default max appointments limit per slot per day.
    """
    config = db.query(models.SlotConfig).first()
    if not config:
        config = models.SlotConfig(max_per_slot=config_in.max_per_slot)
        db.add(config)
    else:
        config.max_per_slot = config_in.max_per_slot
        
    db.commit()
    return config
