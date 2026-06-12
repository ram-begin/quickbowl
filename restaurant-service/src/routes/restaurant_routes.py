from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from src.models.restaurant import RestaurantCreate, RestaurantUpdate, MenuItemAdd
from src.controllers.restaurant_controller import (
    get_all_restaurants,
    get_restaurant,
    create_restaurant,
    update_restaurant,
    delete_restaurant,
    search_restaurants,
    add_menu_item,
    remove_menu_item,
    boost_restaurant,
    get_analytics,
    update_order_stats
)
from src.services.discount_service import (
    get_discount_info,
    is_discount_active
)

router = APIRouter()

# ── Get all restaurants ───────────────────────────────
# GET /api/restaurants
@router.get("/")
async def list_restaurants(
    city:    Optional[str] = Query(None, description="Filter by city"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine")
):
    restaurants = await get_all_restaurants(city=city, cuisine=cuisine)

    # Separate boosted and normal for response
    boosted = [r for r in restaurants if r.get("boost_active")]
    normal  = [r for r in restaurants if not r.get("boost_active")]

    return {
        "success": True,
        "count":   len(restaurants),
        "customer_favourites": {
            "count": len(boosted),
            "data":  boosted
        },
        "all_restaurants": {
            "count": len(normal),
            "data":  normal
        }
    }

# ── Search ────────────────────────────────────────────
# GET /api/restaurants/search?q=biryani
@router.get("/search")
async def search(
    q: str = Query(..., description="Search by name, cuisine, city or food item")
):
    results = await search_restaurants(q)
    return {
        "success": True,
        "query":   q,
        "count":   len(results),
        "data":    results
    }

# ── Discount info ─────────────────────────────────────
# GET /api/restaurants/discount
@router.get("/discount")
async def discount_info():
    info = await get_discount_info()
    return {
        "success": True,
        "data":    info
    }

# ── Check if discount active right now ────────────────
# GET /api/restaurants/discount/active
@router.get("/discount/active")
async def discount_active():
    status = await is_discount_active()
    return {
        "success": True,
        "data":    status
    }

# ── Get single restaurant ─────────────────────────────
# GET /api/restaurants/{id}
@router.get("/{id}")
async def get_one(id: str):
    restaurant = await get_restaurant(id)
    return {
        "success": True,
        "data":    restaurant
    }

# ── Create restaurant ─────────────────────────────────
# POST /api/restaurants
@router.post("/")
async def create(data: RestaurantCreate):
    restaurant = await create_restaurant(data)
    return {
        "success": True,
        "message": "Restaurant created successfully",
        "data":    restaurant
    }

# ── Update restaurant ─────────────────────────────────
# PUT /api/restaurants/{id}
@router.put("/{id}")
async def update(id: str, data: RestaurantUpdate):
    restaurant = await update_restaurant(id, data)
    return {
        "success": True,
        "message": "Restaurant updated successfully",
        "data":    restaurant
    }

# ── Delete restaurant ─────────────────────────────────
# DELETE /api/restaurants/{id}
@router.delete("/{id}")
async def delete(id: str):
    result = await delete_restaurant(id)
    return {
        "success": True,
        "message": result["message"]
    }

# ── Add menu item ─────────────────────────────────────
# POST /api/restaurants/{id}/menu
@router.post("/{id}/menu")
async def add_item(id: str, item: MenuItemAdd):
    restaurant = await add_menu_item(id, item)
    return {
        "success": True,
        "message": "Menu item added successfully",
        "data":    restaurant
    }

# ── Remove menu item ──────────────────────────────────
# DELETE /api/restaurants/{id}/menu/{item_id}
@router.delete("/{id}/menu/{item_id}")
async def remove_item(id: str, item_id: str):
    restaurant = await remove_menu_item(id, item_id)
    return {
        "success": True,
        "message": "Menu item removed successfully",
        "data":    restaurant
    }

# ── Boost restaurant (Customer Favourite) ────────────
# POST /api/restaurants/{id}/boost
@router.post("/{id}/boost")
async def boost(id: str):
    result = await boost_restaurant(id)
    return {
        "success": True,
        "data":    result
    }

# ── Restaurant analytics ──────────────────────────────
# GET /api/restaurants/{id}/analytics
@router.get("/{id}/analytics")
async def analytics(id: str):
    data = await get_analytics(id)
    return {
        "success": True,
        "data":    data
    }

# ── Update order stats (called by Order Service) ──────
# POST /api/restaurants/{id}/stats
@router.post("/{id}/stats")
async def update_stats(id: str, stats: dict):
    result = await update_order_stats(id, stats)
    return {
        "success": True,
        "data":    result
    }