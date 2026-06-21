from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime, timedelta
from src.config.database import get_db
from src.models.restaurant import RestaurantCreate, RestaurantUpdate, MenuItemAdd
from src.services.surge_service import calculate_surge
from src.services.mood_service import calculate_mood_score, get_commission_tier, calculate_commission
from src.services.discount_service import is_discount_active, get_discount_info
import uuid
import os

# ── Helper: MongoDB doc to dict ───────────────────────
def restaurant_helper(r) -> dict:
    return {
        "id":                  str(r["_id"]),
        "name":                r["name"],
        "description":         r.get("description", ""),
        "cuisine":             r["cuisine"],
        "address":             r["address"],
        "city":                r["city"],
        "phone":               r["phone"],
        "email":               r["email"],
        "image_url":           r.get("image_url", ""),
        "menu":                r.get("menu", []),
        "rating":              r.get("rating", 0.0),
        "total_orders":        r.get("total_orders", 0),
        "completed_orders":    r.get("completed_orders", 0),
        "cancelled_orders":    r.get("cancelled_orders", 0),
        "avg_delivery_minutes": r.get("avg_delivery_minutes", 30.0),
        "peak_hour_orders":    r.get("peak_hour_orders", 0),
        "peak_hour_completed": r.get("peak_hour_completed", 0),
        "is_active":           r.get("is_active", False),
        "is_verified":         r.get("is_verified", False),
        "surge_multiplier":    r.get("surge_multiplier", 1.0),
        "surge_reasons":       r.get("surge_reasons", []),
        "opening_time":        r.get("opening_time", "09:00"),
        "closing_time":        r.get("closing_time", "23:00"),
        "owner_id":            r.get("owner_id", ""),
        "boost_active":        r.get("boost_active", False),
        "boost_start":         r.get("boost_start"),
        "boost_end":           r.get("boost_end"),
        "mood":                r.get("mood", {}),
        "commission":          r.get("commission", {}),
        "total_revenue":       r.get("total_revenue", 0.0),
        "created_at":          r.get("created_at", datetime.now()),
        "is_surge":            r.get("is_surge", False),
        "discount_active":        r.get("discount_active", False),
        "discount_percent":       r.get("discount_percent", 0),
        "owner_discount_active":  r.get("owner_discount_active", False),
        "owner_discount_percent": r.get("owner_discount_percent", 0),
        "admin_discount_active":  r.get("admin_discount_active", False),
        "admin_discount_percent": r.get("admin_discount_percent", 0),
        "admin_discount_tiers":   r.get("admin_discount_tiers", []),
    }

# ── Check if restaurant is open ───────────────────────
def is_restaurant_open(opening_time: str, closing_time: str) -> bool:
    try:
        now   = datetime.now()
        open  = datetime.strptime(opening_time, "%H:%M").replace(
            year=now.year, month=now.month, day=now.day)
        close = datetime.strptime(closing_time, "%H:%M").replace(
            year=now.year, month=now.month, day=now.day)
        return open <= now <= close
    except Exception:
        return True

# ── Filter menu by current time ───────────────────────
def filter_menu_by_time(menu: list) -> list:
    now          = datetime.now()
    current_time = now.strftime("%H:%M")
    available    = []

    for item in menu:
        meal_type      = item.get("meal_type", "allday")
        available_from = item.get("available_from")
        available_to   = item.get("available_to")

        # allday items always available
        if meal_type == "allday" or not available_from or not available_to:
            available.append({**item, "is_available": item.get("is_available", True)})
            continue

        # Time based availability
        if available_from <= current_time <= available_to:
            available.append({**item, "is_available": True})
        else:
            # Still show item but mark unavailable with reason
            available.append({
                **item,
                "is_available": False,
                "unavailable_reason": f"Available {available_from} - {available_to} only"
            })

    return available

# ── Get all restaurants ───────────────────────────────
async def get_all_restaurants(city: str = None, cuisine: str = None) -> list:
    db    = get_db()
    query = {"is_active": True}

    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if cuisine:
        query["cuisine"] = {"$regex": cuisine, "$options": "i"}

    boosted  = []
    normal   = []

    cursor = db.restaurants.find(query)
    async for r in cursor:
        data = restaurant_helper(r)

        # Calculate live surge
        surge_data             = await calculate_surge(data["total_orders"], data["city"])
        data["surge_multiplier"] = surge_data["multiplier"]
        data["surge_reasons"]  = surge_data["reasons"]
        data["is_surge"]       = surge_data["is_surge"]

        # Calculate mood score
        mood = calculate_mood_score(
            data["total_orders"],
            data["completed_orders"],
            data["cancelled_orders"],
            data["avg_delivery_minutes"],
            data["peak_hour_orders"],
            data["peak_hour_completed"]
        )
        data["mood"] = mood

        # Commission tier
        data["commission"] = get_commission_tier(data["total_orders"])

        # Is open right now
        data["is_open"] = is_restaurant_open(data["opening_time"], data["closing_time"])

        # Filter menu by time
        data["menu"] = filter_menu_by_time(data["menu"])

        # Check boost — expire if needed
        if data["boost_active"] and data["boost_end"]:
            boost_end = data["boost_end"]
            if isinstance(boost_end, str):
                boost_end = datetime.fromisoformat(boost_end.replace('Z', '+00:00'))
            # Make both naive for comparison
            if hasattr(boost_end, 'tzinfo') and boost_end.tzinfo is not None:
                boost_end = boost_end.replace(tzinfo=None)
            if datetime.now() > boost_end:
                # Boost expired — update in DB
                await db.restaurants.update_one(
                    {"_id": r["_id"]},
                    {"$set": {"boost_active": False}}
                )
                data["boost_active"] = False

        # Separate boosted vs normal
        if data["boost_active"]:
            boosted.append(data)
        else:
            normal.append(data)

    # Sort boosted by boost_start (earliest first = highest position)
    boosted.sort(key=lambda x: x["boost_start"] or datetime.min)

    # Sort normal by mood score then rating
    normal.sort(key=lambda x: (x["mood"].get("score", 0), x["rating"]), reverse=True)

    return boosted + normal

# ── Get single restaurant ─────────────────────────────
async def get_restaurant(id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    r = await db.restaurants.find_one({"_id": ObjectId(id)})
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    data = restaurant_helper(r)

    # Live surge
    surge_data             = await calculate_surge(data["total_orders"], data["city"])
    data["surge_multiplier"] = surge_data["multiplier"]
    data["surge_reasons"]  = surge_data["reasons"]
    data["is_surge"]       = surge_data["is_surge"]

    # Mood score
    data["mood"] = calculate_mood_score(
        data["total_orders"],
        data["completed_orders"],
        data["cancelled_orders"],
        data["avg_delivery_minutes"],
        data["peak_hour_orders"],
        data["peak_hour_completed"]
    )

    # Commission
    data["commission"] = get_commission_tier(data["total_orders"])

    # Is open
    data["is_open"] = is_restaurant_open(data["opening_time"], data["closing_time"])

    # Menu filtered by time
    data["menu"] = filter_menu_by_time(data["menu"])

    # Discount info
    data["discount"] = await is_discount_active()

    return data

# ── Create restaurant ─────────────────────────────────
async def create_restaurant(data: RestaurantCreate) -> dict:
    db = get_db()

    existing = await db.restaurants.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=409, detail="Restaurant with this email already exists")

    # Assign item_ids to menu items
    menu = []
    for item in data.menu:
        item_dict = item.model_dump()
        item_dict["item_id"] = str(uuid.uuid4())
        menu.append(item_dict)

    restaurant = {
        **data.model_dump(exclude={"menu"}),
        "menu":                menu,
        "rating":              0.0,
        "total_orders":        0,
        "completed_orders":    0,
        "cancelled_orders":    0,
        "avg_delivery_minutes": 30.0,
        "peak_hour_orders":    0,
        "peak_hour_completed": 0,
        "is_active":           False,
        "is_verified":         False,
        "surge_multiplier":    1.0,
        "surge_reasons":       [],
        "boost_active":        False,
        "boost_start":         None,
        "boost_end":           None,
        "total_revenue":       0.0,
        "created_at":          datetime.now(),
        "updated_at":          datetime.now()
    }

    result = await db.restaurants.insert_one(restaurant)
    new    = await db.restaurants.find_one({"_id": result.inserted_id})
    return restaurant_helper(new)

# ── Update restaurant ─────────────────────────────────
async def update_restaurant(id: str, data: RestaurantUpdate) -> dict:
    db = get_db()
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    raw = data.model_dump()
    update_data = {}
    for k, v in raw.items():
        if k == 'admin_discount_tiers':
            if v is not None:
                update_data[k] = v
        elif v is not None:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    update_data["updated_at"] = datetime.now()

    result = await db.restaurants.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return await get_restaurant(id)

# ── Delete restaurant ─────────────────────────────────
async def delete_restaurant(id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    result = await db.restaurants.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return {"message": "Restaurant deleted successfully"}

# ── Search restaurants ────────────────────────────────
async def search_restaurants(query: str) -> list:
    db      = get_db()
    results = []

    cursor = db.restaurants.find({
        "$or": [
            {"name":    {"$regex": query, "$options": "i"}},
            {"cuisine": {"$regex": query, "$options": "i"}},
            {"city":    {"$regex": query, "$options": "i"}},
            {"menu":    {"$elemMatch": {"name": {"$regex": query, "$options": "i"}}}}
        ],
        "is_active": True
    })

    async for r in cursor:
        data       = restaurant_helper(r)
        surge_data = await calculate_surge(data["total_orders"], data["city"])
        data["surge_multiplier"] = surge_data["multiplier"]
        data["surge_reasons"]    = surge_data["reasons"]
        data["mood"]             = calculate_mood_score(
            data["total_orders"], data["completed_orders"],
            data["cancelled_orders"], data["avg_delivery_minutes"],
            data["peak_hour_orders"], data["peak_hour_completed"]
        )
        data["is_open"] = is_restaurant_open(data["opening_time"], data["closing_time"])
        results.append(data)

    return results

# ── Add menu item ─────────────────────────────────────
async def add_menu_item(restaurant_id: str, item: MenuItemAdd) -> dict:
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    item_dict            = item.model_dump()
    item_dict["item_id"] = str(uuid.uuid4())

    result = await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$push": {"menu": item_dict}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return await get_restaurant(restaurant_id)

# ── Remove menu item ──────────────────────────────────
async def remove_menu_item(restaurant_id: str, item_id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    result = await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$pull": {"menu": {"item_id": item_id}}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return await get_restaurant(restaurant_id)

# ── Boost restaurant ──────────────────────────────────
async def boost_restaurant(restaurant_id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    r = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Check if already boosted
    if r.get("boost_active"):
        boost_end = r.get("boost_end")
        if isinstance(boost_end, str):
            boost_end = datetime.fromisoformat(boost_end)
        if boost_end and datetime.now() < boost_end:
            raise HTTPException(
                status_code=400,
                detail=f"Already boosted until {boost_end.strftime('%d %b %Y %I:%M %p')}. Pay ₹19 after expiry to re-boost."
            )

    boost_start = datetime.now()
    boost_end   = boost_start + timedelta(hours=36)

    await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$set": {
            "boost_active": True,
            "boost_start":  boost_start,
            "boost_end":    boost_end
        }}
    )

    # Log boost payment
    await db.boost_payments.insert_one({
        "restaurant_id":   restaurant_id,
        "restaurant_name": r["name"],
        "amount":          float(os.getenv("BOOST_PRICE", 19)),
        "boost_start":     boost_start,
        "boost_end":       boost_end,
        "is_active":       True,
        "created_at":      datetime.now()
    })

    return {
        "message":     "Restaurant is now featured as Customer Favourite!",
        "boost_start": boost_start.isoformat(),
        "boost_end":   boost_end.isoformat(),
        "amount_paid": float(os.getenv("BOOST_PRICE", 19))
    }

# ── Restaurant analytics ──────────────────────────────
async def get_analytics(restaurant_id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    r = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    data = restaurant_helper(r)

    # Mood score
    mood = calculate_mood_score(
        data["total_orders"],
        data["completed_orders"],
        data["cancelled_orders"],
        data["avg_delivery_minutes"],
        data["peak_hour_orders"],
        data["peak_hour_completed"]
    )

    # Commission info
    commission = get_commission_tier(data["total_orders"])

    # Boost history
    boost_history = []
    cursor = db.boost_payments.find(
        {"restaurant_id": restaurant_id}
    ).sort("created_at", -1).limit(10)
    async for b in cursor:
        b["_id"] = str(b["_id"])
        boost_history.append(b)

    # Total boost spend
    total_boost_spend = len(boost_history) * float(os.getenv("BOOST_PRICE", 19))

    # Next day settlement calculation
    commission_rate   = commission["rate"]
    gross_revenue     = data["total_revenue"]
    commission_amount = round(gross_revenue * commission_rate / 100, 2)
    net_revenue       = round(gross_revenue - commission_amount, 2)

    return {
        "restaurant_id":   restaurant_id,
        "restaurant_name": data["name"],
        "overview": {
            "total_orders":      data["total_orders"],
            "completed_orders":  data["completed_orders"],
            "cancelled_orders":  data["cancelled_orders"],
            "completion_rate":   round(
                data["completed_orders"] / data["total_orders"] * 100, 1
            ) if data["total_orders"] > 0 else 0,
        },
        "mood":       mood,
        "commission": commission,
        "revenue": {
            "gross_revenue":     gross_revenue,
            "commission_rate":   commission_rate,
            "commission_amount": commission_amount,
            "net_revenue":       net_revenue,
            "boost_spend":       total_boost_spend,
            "final_settlement":  round(net_revenue - total_boost_spend, 2)
        },
        "performance": {
            "avg_delivery_minutes": data["avg_delivery_minutes"],
            "peak_hour_orders":     data["peak_hour_orders"],
            "peak_completion_rate": round(
                data["peak_hour_completed"] / data["peak_hour_orders"] * 100, 1
            ) if data["peak_hour_orders"] > 0 else 100,
        },
        "boost_history": boost_history
    }

# ── Update menu item ──────────────────────────────────
async def update_menu_item(restaurant_id: str, item_id: str, item: MenuItemAdd) -> dict:
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    item_dict = item.model_dump()
    update_fields = {f"menu.$.{k}": v for k, v in item_dict.items() if v is not None}

    result = await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id), "menu.item_id": item_id},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    return await get_restaurant(restaurant_id)

# ── Update order stats (called by Order Service) ──────
async def update_order_stats(restaurant_id: str, stats: dict) -> dict:
    """
    Called by Order Service when order status changes.
    Updates restaurant analytics.
    """
    db = get_db()
    if not ObjectId.is_valid(restaurant_id):
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")

    update = {}

    if stats.get("order_completed"):
        update["$inc"] = {
            "total_orders":     1,
            "completed_orders": 1,
            "total_revenue":    stats.get("order_amount", 0)
        }

    elif stats.get("order_cancelled"):
        update["$inc"] = {
            "total_orders":    1,
            "cancelled_orders": 1
        }

    if stats.get("is_peak_hour"):
        update.setdefault("$inc", {})
        update["$inc"]["peak_hour_orders"] = 1
        if stats.get("order_completed"):
            update["$inc"]["peak_hour_completed"] = 1

    if stats.get("delivery_minutes"):
        # Running average for delivery time
        r = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
        if r:
            total    = r.get("total_orders", 1)
            old_avg  = r.get("avg_delivery_minutes", 30.0)
            new_avg  = ((old_avg * (total - 1)) + stats["delivery_minutes"]) / total
            update.setdefault("$set", {})
            update["$set"]["avg_delivery_minutes"] = round(new_avg, 1)

    if update:
        await db.restaurants.update_one(
            {"_id": ObjectId(restaurant_id)},
            update
        )

    return {"message": "Stats updated"}