# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Initialize Async MongoDB client with 5-second timeout
client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)

# Get the database name
try:
    raw_name = settings.MONGODB_URI.split("/")[-1].split("?")[0]
    db_name = raw_name if raw_name else "ERP_System"
except Exception:
    db_name = "ERP_System"

db = client[db_name]

if "127.0.0.1" in settings.MONGODB_URI or "localhost" in settings.MONGODB_URI:
    print(f"⚠️ [DATABASE NOTICE]: MONGODB_URI is set to localhost ({db_name}). For Railway production, set 'MONGODB_URI' in Railway Variables to MongoDB Atlas or Railway MongoDB URL.")
else:
    print(f"Connected to MongoDB Cloud Database: {db_name}")

async def get_db():
    return db