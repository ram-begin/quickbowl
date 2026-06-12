from datetime import datetime, timedelta
import random
from src.config.database import get_db
import os
import httpx

DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# ── Get current week number ───────────────────────────
def get_week_number():
    return datetime.now().isocalendar()[1]

def get_year():
    return datetime.now().year

# ── Pick random discount day for this week ────────────
async def get_or_create_discount_day() -> dict:
    """
    Every week a new random day is picked.
    Stored in MongoDB so it's consistent across restarts.
    Returns the discount config for this week.
    """
    db = get_db()
    week = get_week_number()
    year = get_year()

    # Check if discount day already set for this week
    existing = await db.discount_config.find_one({
        "discount_week": week,
        "discount_year": year
    })

    if existing:
        existing["_id"] = str(existing["_id"])
        return existing

    # Pick a random day for this week — avoid Sunday (low orders)
    available_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    chosen_day = random.choice(available_days)

    config = {
        "discount_day":   chosen_day,
        "discount_week":  week,
        "discount_year":  year,
        "start_hour":     int(os.getenv("DISCOUNT_START_HOUR", 12)),
        "end_hour":       int(os.getenv("DISCOUNT_END_HOUR", 15)),
        "percent":        int(os.getenv("DISCOUNT_PERCENT", 30)),
        "max_orders":     int(os.getenv("DISCOUNT_MAX_ORDERS", 100)),
        "orders_used":    0,
        "is_active":      True,
        "whatsapp_sent":  False,
        "created_at":     datetime.now()
    }

    await db.discount_config.insert_one(config)
    config["_id"] = str(config["_id"])
    return config

# ── Check if today is discount day ───────────────────
async def is_discount_active() -> dict:
    """
    Returns discount info if today is discount day
    and within active hours and orders not exhausted.
    """
    config = await get_or_create_discount_day()

    today_name = datetime.now().strftime("%A").lower()
    current_hour = datetime.now().hour

    if today_name != config["discount_day"]:
        return {"active": False, "reason": "Not discount day today"}

    if current_hour < config["start_hour"]:
        return {
            "active": False,
            "reason": f"Discount starts at {config['start_hour']}:00",
            "starts_at": f"{config['start_hour']}:00"
        }

    if current_hour >= config["end_hour"]:
        return {"active": False, "reason": "Discount ended for today"}

    if config["orders_used"] >= config["max_orders"]:
        return {
            "active": False,
            "reason": "All discount slots used up for today",
            "orders_used": config["orders_used"],
            "max_orders":  config["max_orders"]
        }

    remaining = config["max_orders"] - config["orders_used"]

    return {
        "active":        True,
        "percent":       config["percent"],
        "remaining":     remaining,
        "max_orders":    config["max_orders"],
        "orders_used":   config["orders_used"],
        "ends_at":       f"{config['end_hour']}:00",
        "discount_day":  config["discount_day"]
    }

# ── Use one discount slot ─────────────────────────────
async def use_discount_slot() -> bool:
    """
    Called when an order uses the discount.
    Returns False if no slots left.
    """
    db = get_db()
    week = get_week_number()
    year = get_year()

    config = await get_or_create_discount_day()

    if config["orders_used"] >= config["max_orders"]:
        return False

    # Atomic increment to avoid race conditions
    result = await db.discount_config.update_one(
        {
            "discount_week": week,
            "discount_year": year,
            "orders_used":   {"$lt": config["max_orders"]}
        },
        {"$inc": {"orders_used": 1}}
    )

    return result.modified_count > 0

# ── Apply discount to price ───────────────────────────
def apply_discount(price: float, percent: int) -> dict:
    discount_amount = round(price * percent / 100, 2)
    final_price     = round(price - discount_amount, 2)
    return {
        "original_price":  price,
        "discount_percent": percent,
        "discount_amount":  discount_amount,
        "final_price":      final_price
    }

# ── Send WhatsApp alert to all users ─────────────────
async def send_discount_whatsapp_alert():
    """
    Called at 9am on discount day — 3 hours before discount.
    Sends WhatsApp to all users via User Service.
    """
    db = get_db()
    week = get_week_number()
    year = get_year()

    config = await get_or_create_discount_day()

    # Don't send twice
    if config.get("whatsapp_sent"):
        return

    today_name = datetime.now().strftime("%A").lower()
    if today_name != config["discount_day"]:
        return

    try:
        user_service_url = os.getenv("USER_SERVICE_URL", "http://localhost:3001")
        message = (
            f"🎉 QuickBowl Flash Sale TODAY!\n"
            f"Get {config['percent']}% OFF on all orders\n"
            f"⏰ {config['start_hour']}:00 PM - {config['end_hour']}:00 PM only\n"
            f"🔥 Only {config['max_orders']} orders at this price!\n"
            f"Order now on QuickBowl 🍜"
        )

        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{user_service_url}/api/notifications/whatsapp-blast",
                json={"message": message, "type": "discount_alert"}
            )

        # Mark as sent
        await db.discount_config.update_one(
            {"discount_week": week, "discount_year": year},
            {"$set": {"whatsapp_sent": True}}
        )
        print("✅ Discount WhatsApp alert sent to all users")

    except Exception as e:
        print(f"❌ WhatsApp alert failed: {e}")

# ── Get discount info for frontend ───────────────────
async def get_discount_info() -> dict:
    """Returns full discount info including next discount day"""
    config = await get_or_create_discount_day()
    status = await is_discount_active()

    return {
        "this_week_day":  config["discount_day"],
        "status":         status,
        "percent":        config["percent"],
        "max_orders":     config["max_orders"],
        "orders_used":    config["orders_used"],
        "time_window":    f"{config['start_hour']}:00 - {config['end_hour']}:00",
        "week_number":    config["discount_week"]
    }