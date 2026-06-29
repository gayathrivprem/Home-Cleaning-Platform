from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import auth
from database import get_db

router = APIRouter()

# --- Utility Functions ---

def calculate_quote(db: Session, cleaning_type: str, num_rooms: int, addon_ids: List[int]):
    # Normalize cleaning type to match seeded DB records
    norm_type = "Standard"
    if "deep" in cleaning_type.lower():
        norm_type = "Deep Clean"
    elif "move" in cleaning_type.lower():
        norm_type = "Move-In/Out"
        
    service = db.query(models.ServicePrice).filter_by(cleaning_type=norm_type).first()
    if not service:
        # Fallback to standard if not found
        service = db.query(models.ServicePrice).filter_by(cleaning_type="Standard").first()
        if not service:
            # Absolute fallback if DB is completely empty before seeding
            base_price = 999.0
            price_per_room = 199.0
            if norm_type == "Deep Clean":
                base_price = 1999.0
                price_per_room = 299.0
            elif norm_type == "Move-In/Out":
                base_price = 2999.0
                price_per_room = 399.0
            base = base_price + (price_per_room * max(0, num_rooms - 1))
            return {
                "base": round(base, 2),
                "addons": 0.0,
                "total": round(base, 2),
                "breakdown": []
            }
            
    base = service.base_price + (service.price_per_room * max(0, num_rooms - 1))
    
    addons = []
    if addon_ids:
        addons = db.query(models.PriceAddon).filter(
            models.PriceAddon.id.in_(addon_ids),
            models.PriceAddon.is_active == True
        ).all()
        
    addon_total = sum(a.price for a in addons)
    
    return {
        "base": round(base, 2),
        "addons": round(addon_total, 2),
        "total": round(base + addon_total, 2),
        "breakdown": [{"name": a.name, "price": a.price} for a in addons]
    }


def match_addons(db: Session, addon_names: List[str]) -> List[models.PriceAddon]:
    if not addon_names:
        return []
    db_addons = db.query(models.PriceAddon).filter(models.PriceAddon.is_active == True).all()
    matched = []
    for name in addon_names:
        name_lower = name.lower().strip()
        for addon in db_addons:
            addon_lower = addon.name.lower().strip()
            # Simple substring matching
            if name_lower in addon_lower or addon_lower in name_lower:
                if addon not in matched:
                    matched.append(addon)
                    break
    return matched


# --- Public Pricing Endpoints ---

@router.get("/pricing", response_model=schemas.PricingConfigResponse)
def get_pricing(db: Session = Depends(get_db)):
    services = db.query(models.ServicePrice).all()
    addons = db.query(models.PriceAddon).filter(models.PriceAddon.is_active == True).all()
    return {
        "services": services,
        "addons": addons
    }


@router.post("/pricing/quote", response_model=schemas.QuoteResponse)
def get_quote(payload: schemas.QuoteRequest, db: Session = Depends(get_db)):
    try:
        quote = calculate_quote(db, payload.cleaning_type, payload.num_rooms, payload.addon_ids)
        return quote
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to calculate quote: {str(e)}"
        )


# --- Admin Configuration Pricing Endpoints ---

@router.patch("/admin/pricing/{service_price_id}", response_model=schemas.ServicePriceResponse)
def update_service_price(
    service_price_id: int,
    payload: schemas.ServicePriceUpdate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    service = db.query(models.ServicePrice).filter(models.ServicePrice.id == service_price_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service price configuration not found"
        )
    service.base_price = payload.base_price
    service.price_per_room = payload.price_per_room
    if payload.description is not None:
        service.description = payload.description
    db.commit()
    db.refresh(service)
    return service


@router.post("/admin/pricing/addons", response_model=schemas.PriceAddonResponse, status_code=status.HTTP_201_CREATED)
def create_price_addon(
    payload: schemas.PriceAddonCreate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    addon = models.PriceAddon(
        name=payload.name,
        price=payload.price,
        is_active=True
    )
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon


@router.patch("/admin/pricing/addons/{id}", response_model=schemas.PriceAddonResponse)
def update_price_addon(
    id: int,
    payload: schemas.PriceAddonUpdate,
    admin_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    addon = db.query(models.PriceAddon).filter(models.PriceAddon.id == id).first()
    if not addon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price addon not found"
        )
    addon.is_active = payload.is_active
    addon.price = payload.price
    db.commit()
    db.refresh(addon)
    return addon
