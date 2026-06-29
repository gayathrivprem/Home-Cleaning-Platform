from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
import models
import schemas
import auth
from database import get_db

router = APIRouter()

@router.get("/")
def get_profile(user: models.User = Depends(auth.get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "saved_addresses": json.loads(user.saved_addresses or "[]"),
        "preferred_staff_id": user.preferred_staff_id,
        "cleaning_notes": user.cleaning_notes,
        "bio": user.bio,
        "created_at": user.created_at
    }

@router.patch("/")
def update_profile(
    body: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user)
):
    if body.name is not None:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
    if body.cleaning_notes is not None:
        user.cleaning_notes = body.cleaning_notes
    if body.saved_addresses is not None:
        user.saved_addresses = json.dumps(body.saved_addresses)
    if body.preferred_staff_id is not None:
        user.preferred_staff_id = body.preferred_staff_id
    if body.bio is not None:
        user.bio = body.bio
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated"}

@router.patch("/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user)
):
    if not auth.verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = auth.get_password_hash(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
