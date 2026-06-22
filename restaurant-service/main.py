from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import os
from dotenv import load_dotenv

from src.config.database import connect_db, close_db
from src.routes.restaurant_routes import router as restaurant_router
from src.services.discount_service import (
    get_or_create_discount_day,
    send_discount_whatsapp_alert
)

load_dotenv()

# ── Scheduler ─────────────────────────────────────────
scheduler = AsyncIOScheduler()

# ── Scheduled Jobs ────────────────────────────────────
async def job_create_weekly_discount():
    """Every Monday at midnight — pick random discount day for the week"""
    print("🎲 Picking random discount day for this week...")
    config = await get_or_create_discount_day()
    print(f"✅ Discount day set: {config['discount_day'].upper()}")

async def job_send_discount_alert():
    """Every day at 9am — send WhatsApp if today is discount day"""
    print("📱 Checking if today is discount day for WhatsApp alert...")
    await send_discount_whatsapp_alert()

async def job_expire_boosts():
    """Every hour — expire any boosts that have ended"""
    from src.config.database import get_db
    from datetime import datetime
    db = get_db()
    if db is None:
        return
    result = await db.restaurants.update_many(
        {
            "boost_active": True,
            "boost_end":    {"$lt": datetime.now()}
        },
        {"$set": {"boost_active": False}}
    )
    if result.modified_count > 0:
        print(f"⏰ Expired {result.modified_count} restaurant boost(s)")


async def job_auto_schedule():
    """Every minute — auto activate/deactivate restaurants based on opening/closing time"""
    from src.config.database import get_db
    from datetime import datetime, timezone, timedelta
    db = get_db()
    if db is None:
        return
    # Use IST (UTC+5:30)
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist)
    current_minutes = now.hour * 60 + now.minute

    restaurants = await db.restaurants.find({"auto_schedule": True}).to_list(length=1000)
    for r in restaurants:
        opening = r.get("opening_time", "09:00")
        closing = r.get("closing_time", "23:00")
        try:
            oh, om = map(int, opening.split(":"))
            ch, cm = map(int, closing.split(":"))
        except:
            continue
        open_min  = oh * 60 + om
        close_min = ch * 60 + cm
        should_be_active = open_min <= current_minutes < close_min
        if r.get("is_active") != should_be_active:
            await db.restaurants.update_one(
                {"_id": r["_id"]},
                {"$set": {"is_active": should_be_active}}
            )
            status = "activated" if should_be_active else "deactivated"
            print(f"⏰ Auto-schedule: {r.get('name')} {status}")

# ── Lifespan ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to MongoDB
    await connect_db()

    # Create this week's discount day on startup
    await get_or_create_discount_day()

    # Start scheduler
    # Every Monday at midnight → pick discount day
    scheduler.add_job(
        job_create_weekly_discount,
        CronTrigger(day_of_week="mon", hour=0, minute=0)
    )

    # Every day at 9am → send WhatsApp if discount day
    scheduler.add_job(
        job_send_discount_alert,
        CronTrigger(hour=9, minute=0)
    )

    # Every hour → expire boosts
    scheduler.add_job(
        job_expire_boosts,
        CronTrigger(minute=0)
    )

    # Every minute → auto schedule restaurants
    scheduler.add_job(
        job_auto_schedule,
        CronTrigger(minute="*")
    )

    scheduler.start()
    print("✅ Scheduler started")
    print("   → Discount day picker: Every Monday midnight")
    print("   → WhatsApp alert:      Every day 9am")
    print("   → Boost expiry:        Every hour")
    print("   → Auto schedule:       Every minute")
    yield

    # Shutdown
    scheduler.shutdown()
    await close_db()

# ── App ───────────────────────────────────────────────
app = FastAPI(
    title="QuickBowl — Restaurant Service",
    description=(
        "Manages restaurants, menus, surge pricing, "
        "tiered commission, weekly flash discount, "
        "mood score, boost listing and analytics"
    ),
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────
app.include_router(
    restaurant_router,
    prefix="/api/restaurants",
    tags=["Restaurants"]
)

# ── Health Check ──────────────────────────────────────
@app.get("/health")
async def health():
    from src.services.discount_service import get_discount_info
    discount = await get_discount_info()
    return {
        "success":  True,
        "service":  "restaurant-service",
        "status":   "running",
        "discount": {
            "this_week_day": discount["this_week_day"],
            "status":        discount["status"]["active"]
        }
    }

# ── Serve Frontend ────────────────────────────────────
if os.path.exists("frontend"):
    app.mount(
        "/static",
        StaticFiles(directory="frontend"),
        name="static"
    )

@app.get("/")
async def root():
    index = os.path.join("frontend", "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {
        "message": "QuickBowl Restaurant Service",
        "port":    8001,
        "docs":    "http://localhost:8001/docs"
    }