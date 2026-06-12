from datetime import datetime
import httpx
import os

# ── Indian Festival Dates (add every year) ────────────
FESTIVAL_DATES = {
    "2026": [
        "2026-01-14",  # Makar Sankranti
        "2026-01-26",  # Republic Day
        "2026-03-20",  # Holi
        "2026-04-14",  # Baisakhi
        "2026-08-15",  # Independence Day
        "2026-10-02",  # Gandhi Jayanti
        "2026-10-20",  # Diwali (approximate)
        "2026-10-21",  # Diwali
        "2026-10-22",  # Diwali
        "2026-12-25",  # Christmas
    ]
}

# ── Weather based surge ───────────────────────────────
async def get_weather_surge(city: str) -> float:
    """
    Returns extra surge based on weather.
    Rainy/stormy = higher surge (more orders, fewer delivery partners)
    """
    try:
        # Using open-meteo — completely free, no API key needed
        # First get coordinates for city
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
        async with httpx.AsyncClient(timeout=3.0) as client:
            geo_resp = await client.get(geo_url)
            geo_data = geo_resp.json()

            if not geo_data.get("results"):
                return 0.0

            lat = geo_data["results"][0]["latitude"]
            lon = geo_data["results"][0]["longitude"]

            # Get current weather
            weather_url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=precipitation,weathercode"
                f"&timezone=Asia/Kolkata"
            )
            weather_resp = await client.get(weather_url)
            weather_data  = weather_resp.json()

            current       = weather_data.get("current", {})
            precipitation = current.get("precipitation", 0)
            weathercode   = current.get("weathercode", 0)

            # weathercode 51-67 = rain, 71-77 = snow, 80-99 = storms
            if weathercode >= 80:
                return 0.4   # Heavy storm → +0.4x
            elif weathercode >= 51 or precipitation > 2:
                return 0.2   # Rain → +0.2x
            elif precipitation > 0:
                return 0.1   # Light drizzle → +0.1x
            return 0.0

    except Exception:
        return 0.0  # If weather API fails, no surge

# ── Festival surge ────────────────────────────────────
def get_festival_surge() -> float:
    today = datetime.now().strftime("%Y-%m-%d")
    year  = str(datetime.now().year)
    dates = FESTIVAL_DATES.get(year, [])
    if today in dates:
        return 0.3  # Festival day → +0.3x
    return 0.0

# ── Day of week surge ─────────────────────────────────
def get_day_surge() -> float:
    day = datetime.now().weekday()  # 0=Mon, 4=Fri, 5=Sat, 6=Sun
    if day in [4, 5]:   # Friday, Saturday
        return 0.2
    elif day == 6:       # Sunday
        return 0.1
    return 0.0

# ── Peak hour surge ───────────────────────────────────
def get_peak_hour_surge() -> float:
    hour = datetime.now().hour
    if 12 <= hour <= 14:   # Lunch rush
        return 0.3
    elif 19 <= hour <= 21: # Dinner rush
        return 0.3
    elif 8 <= hour <= 9:   # Breakfast rush
        return 0.1
    return 0.0

# ── Order volume surge ────────────────────────────────
def get_order_volume_surge(total_orders: int) -> float:
    if total_orders > 500:
        return 0.5
    elif total_orders > 200:
        return 0.3
    elif total_orders > 100:
        return 0.1
    return 0.0

# ── Master surge calculator ───────────────────────────
async def calculate_surge(total_orders: int, city: str) -> dict:
    """
    Combines all surge factors and returns
    final multiplier + breakdown for transparency
    """
    peak_surge    = get_peak_hour_surge()
    order_surge   = get_order_volume_surge(total_orders)
    festival_surge = get_festival_surge()
    day_surge     = get_day_surge()
    weather_surge = await get_weather_surge(city)

    total_surge = 1.0 + peak_surge + order_surge + festival_surge + day_surge + weather_surge

    # Cap at 2.5x
    total_surge = round(min(total_surge, 2.5), 2)

    # Build reason string for UI
    reasons = []
    if peak_surge:
        hour = datetime.now().hour
        reasons.append("Lunch rush" if 12 <= hour <= 14 else "Dinner rush" if 19 <= hour <= 21 else "Breakfast rush")
    if weather_surge:
        reasons.append("Rainy weather" if weather_surge >= 0.2 else "Light rain")
    if festival_surge:
        reasons.append("Festival day")
    if day_surge:
        reasons.append("Weekend")
    if order_surge:
        reasons.append("High demand")

    return {
        "multiplier":  total_surge,
        "is_surge":    total_surge > 1.0,
        "reasons":     reasons,
        "breakdown": {
            "peak_hour":  peak_surge,
            "weather":    weather_surge,
            "festival":   festival_surge,
            "weekend":    day_surge,
            "high_demand": order_surge
        }
    }