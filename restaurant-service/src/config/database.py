from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME     = os.getenv("DB_NAME", "quickbowl_restaurants")

client = None
db     = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL)
    db     = client[DB_NAME]
    print("✅ Connected to MongoDB")
    return db

async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

def get_db():
    return db