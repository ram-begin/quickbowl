from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ── Menu Item ─────────────────────────────────────────
class MenuItem(BaseModel):
    item_id:      Optional[str] = None
    name:         str
    description:  Optional[str] = None
    base_price:   float
    category:     str
    # Time availability
    available_from: Optional[str] = None  # "07:00"
    available_to:   Optional[str] = None  # "11:00"
    meal_type:    Optional[str] = None    # breakfast/lunch/dinner/allday
    is_available: bool = True
    image_url:    Optional[str] = None

# ── Boost ─────────────────────────────────────────────
class BoostRequest(BaseModel):
    restaurant_id: str

# ── Restaurant Create ─────────────────────────────────
class RestaurantCreate(BaseModel):
    name:          str
    description:   Optional[str] = None
    cuisine:       str
    address:       str
    city:          str
    phone:         str
    email:         str
    image_url:     Optional[str] = None
    menu:          List[MenuItem] = []
    opening_time:  str = "09:00"
    closing_time:  str = "23:00"
    owner_id:      Optional[str] = None  # user_id from user service
# ── Discount Tier (conditional) ───────────────────────
class DiscountTier(BaseModel):
    min_order: float
    percent:   int
    label:     Optional[str] = None
# ── Restaurant Update ─────────────────────────────────
class RestaurantUpdate(BaseModel):
    name:             Optional[str] = None
    description:      Optional[str] = None
    cuisine:          Optional[str] = None
    address:          Optional[str] = None
    city:             Optional[str] = None
    phone:            Optional[str] = None
    image_url:        Optional[str] = None
    opening_time:     Optional[str] = None
    closing_time:     Optional[str] = None
    is_active:        Optional[bool] = None
    is_verified:      Optional[bool] = None
    is_surge:         Optional[bool] = None
    surge_multiplier: Optional[float] = None
    boost_active:     Optional[bool] = None
    boost_start:      Optional[str] = None
    boost_end:        Optional[str] = None
    discount_active:  Optional[bool] = None
    discount_percent: Optional[int] = None
    owner_discount_active: Optional[bool] = None
    owner_discount_percent: Optional[int] = None
    admin_discount_active:  Optional[bool] = None
    admin_discount_percent: Optional[int] = None
    admin_discount_tiers:   Optional[List[DiscountTier]] = None
    auto_schedule:          Optional[bool] = None

# ── Menu Item Add ─────────────────────────────────────
class MenuItemAdd(BaseModel):
    name:           str
    description:    Optional[str] = None
    base_price:     float
    category:       str
    available_from: Optional[str] = None
    available_to:   Optional[str] = None
    meal_type:      Optional[str] = "allday"
    is_available:   bool = True
    image_url:      Optional[str] = None

# ── Discount Tier (conditional) ───────────────────────
class DiscountTier(BaseModel):
    min_order: float   # minimum cart value to unlock
    percent:   int     # discount percentage
    label:     Optional[str] = None  # e.g. "10% OFF above ₹100"

# ── Discount Config ───────────────────────────────────
class DiscountConfig(BaseModel):
    discount_day:    str    # e.g. "monday"
    discount_week:   int    # week number of year
    discount_year:   int
    start_hour:      int = 12
    end_hour:        int = 15
    percent:         int = 30
    max_orders:      int = 100
    orders_used:     int = 0
    is_active:       bool = True
    created_at:      Optional[datetime] = None

# ── Boost Payment ─────────────────────────────────────
class BoostPayment(BaseModel):
    restaurant_id:   str
    restaurant_name: str
    amount:          float = 19.0
    boost_start:     Optional[datetime] = None
    boost_end:       Optional[datetime] = None
    is_active:       bool = True
    created_at:      Optional[datetime] = None