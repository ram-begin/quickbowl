from datetime import datetime

# ── Mood Score Calculator ─────────────────────────────
"""
Mood Score is calculated from 4 factors:
1. Order completion rate (did orders get delivered?)
2. Average delivery time (how fast?)
3. Cancellation rate (how many cancelled?)
4. Peak hour performance (do they handle rush well?)

Score is 0-100 → maps to emoji label
🔥 Hot      → 80-100
😊 Good     → 60-79
😐 Average  → 40-59
😴 Slow     → 0-39
"""

def calculate_mood_score(
    total_orders: int,
    completed_orders: int,
    cancelled_orders: int,
    avg_delivery_minutes: float,
    peak_hour_orders: int,
    peak_hour_completed: int
) -> dict:

    # Edge case — new restaurant with no orders
    if total_orders == 0:
        return {
            "score":       75,
            "label":       "😊 Good",
            "color":       "#22c55e",
            "description": "New restaurant — building reputation",
            "protected":   False
        }

    # ── Factor 1: Completion rate (40% weight) ────────
    completion_rate = (completed_orders / total_orders) * 100 if total_orders > 0 else 0
    completion_score = min(completion_rate, 100) * 0.4

    # ── Factor 2: Delivery speed (30% weight) ─────────
    # Ideal delivery time is 30 mins
    # 0-30 mins   → full score
    # 30-45 mins  → partial
    # 45-60 mins  → low
    # 60+ mins    → very low
    if avg_delivery_minutes <= 30:
        speed_score = 100
    elif avg_delivery_minutes <= 45:
        speed_score = 75
    elif avg_delivery_minutes <= 60:
        speed_score = 50
    else:
        speed_score = 25
    speed_score = speed_score * 0.3

    # ── Factor 3: Cancellation rate (20% weight) ──────
    cancel_rate = (cancelled_orders / total_orders) * 100 if total_orders > 0 else 0
    if cancel_rate <= 5:
        cancel_score = 100
    elif cancel_rate <= 10:
        cancel_score = 75
    elif cancel_rate <= 20:
        cancel_score = 50
    else:
        cancel_score = 25
    cancel_score = cancel_score * 0.2

    # ── Factor 4: Peak hour performance (10% weight) ──
    if peak_hour_orders > 0:
        peak_rate = (peak_hour_completed / peak_hour_orders) * 100
    else:
        peak_rate = 100  # No peak orders = not penalized

    peak_score = min(peak_rate, 100) * 0.1

    # ── Total score ───────────────────────────────────
    total = completion_score + speed_score + cancel_score + peak_score
    total = round(min(total, 100), 1)

    # ── Is surge active? Protect score ────────────────
    hour = datetime.now().hour
    is_peak = (12 <= hour <= 14) or (19 <= hour <= 21)

    # During peak hours, score can't drop below 40
    # (restaurants handle more orders so delivery time increases)
    if is_peak and total < 40:
        total    = 40
        protected = True
    else:
        protected = False

    # ── Map to label ──────────────────────────────────
    if total >= 80:
        label = "🔥 Hot"
        color = "#ef4444"
        description = "Excellent! Customers love this place"
    elif total >= 60:
        label = "😊 Good"
        color = "#22c55e"
        description = "Performing well"
    elif total >= 40:
        label = "😐 Average"
        color = "#f59e0b"
        description = "Room for improvement"
    else:
        label = "😴 Slow"
        color = "#6b7280"
        description = "Needs attention"

    return {
        "score":       total,
        "label":       label,
        "color":       color,
        "description": description,
        "protected":   protected,
        "breakdown": {
            "completion_rate":     round(completion_rate, 1),
            "avg_delivery_mins":   round(avg_delivery_minutes, 1),
            "cancellation_rate":   round(cancel_rate, 1),
            "peak_performance":    round(peak_rate, 1)
        }
    }

# ── Commission tier calculator ────────────────────────
def get_commission_tier(total_orders: int) -> dict:
    """
    Tiered commission based on order volume.
    New restaurants pay less — grow first, monetize later.
    """
    if total_orders <= 50:
        return {
            "tier":       "New",
            "rate":       12,
            "label":      "🌱 New Partner",
            "next_tier":  "Growing (51+ orders)",
            "next_rate":  16
        }
    elif total_orders <= 200:
        return {
            "tier":       "Growing",
            "rate":       16,
            "label":      "📈 Growing Partner",
            "next_tier":  "Established (201+ orders)",
            "next_rate":  20
        }
    elif total_orders <= 500:
        return {
            "tier":       "Established",
            "rate":       20,
            "label":      "⭐ Established Partner",
            "next_tier":  "Premium (500+ orders)",
            "next_rate":  22
        }
    else:
        return {
            "tier":       "Premium",
            "rate":       22,
            "label":      "👑 Premium Partner",
            "next_tier":  None,
            "next_rate":  None
        }

# ── Calculate commission amount ───────────────────────
def calculate_commission(order_amount: float, total_orders: int) -> dict:
    tier            = get_commission_tier(total_orders)
    rate            = tier["rate"]
    commission      = round(order_amount * rate / 100, 2)
    restaurant_gets = round(order_amount - commission, 2)

    return {
        "order_amount":     order_amount,
        "commission_rate":  rate,
        "commission_amount": commission,
        "restaurant_gets":  restaurant_gets,
        "tier":             tier
    }