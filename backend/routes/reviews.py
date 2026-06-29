from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import models
import schemas
import auth
from database import get_db

router = APIRouter()

# --- Customer review creation ---

@router.post("/reviews", response_model=schemas.ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: schemas.ReviewCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch appointment
    appointment = db.query(models.Appointment).filter(models.Appointment.id == payload.appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment not found"
        )
    
    # 2. Check ownership
    if appointment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This appointment does not belong to your account"
        )
        
    # 3. Check status is Completed
    if appointment.status != "Completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review completed appointments"
        )
        
    # 4. Check if review already exists
    existing_review = db.query(models.Review).filter(models.Review.appointment_id == payload.appointment_id).first()
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A review has already been submitted for this appointment"
        )
        
    # 5. Check rating is between 1 and 5
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be an integer between 1 and 5"
        )
        
    # Create the review
    review = models.Review(
        appointment_id=payload.appointment_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    review.user = current_user
    review.appointment = appointment
    return review


@router.get("/reviews/my")
def get_my_reviews(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    reviews = db.query(models.Review).filter(models.Review.user_id == current_user.id).order_by(models.Review.created_at.desc()).all()
    results = []
    for r in reviews:
        results.append({
            "id": r.id,
            "appointment_id": r.appointment_id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "appointment_date": r.appointment.date if r.appointment else "N/A",
            "service_type": r.appointment.cleaning_type if r.appointment else "N/A"
        })
    return results


@router.get("/admin/reviews")
def get_admin_reviews(
    rating: Optional[int] = None,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.Review)
    if rating is not None:
        query = query.filter(models.Review.rating == rating)
        
    reviews = query.order_by(models.Review.created_at.desc()).all()
    results = []
    for r in reviews:
        results.append({
            "id": r.id,
            "appointment_id": r.appointment_id,
            "customer_name": r.user.name if r.user else "Unknown Customer",
            "appointment_date": r.appointment.date if r.appointment else "N/A",
            "service_type": r.appointment.cleaning_type if r.appointment else "N/A",
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at
        })
    return results


@router.get("/admin/reviews/stats")
def get_admin_review_stats(
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    total_reviews = db.query(models.Review).count()
    if total_reviews == 0:
        return {
            "average_rating": 0.0,
            "total_reviews": 0,
            "distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        }
        
    avg_rating = db.query(func.avg(models.Review.rating)).scalar() or 0.0
    
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    dist_query = db.query(models.Review.rating, func.count(models.Review.id)).group_by(models.Review.rating).all()
    for rating, count in dist_query:
        distribution[rating] = count
        
    return {
        "average_rating": round(float(avg_rating), 1),
        "total_reviews": total_reviews,
        "distribution": distribution
    }
