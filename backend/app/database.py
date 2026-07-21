# pyrefly: ignore [missing-import]
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Initialize Async MongoDB client safely with SSL certifi support
try:
    if "mongodb+srv://" in settings.MONGODB_URI:
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=10000
        )
    else:
        client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)

    raw_name = settings.MONGODB_URI.split("/")[-1].split("?")[0]
    db_name = raw_name if raw_name else "ERP_System"
    db = client[db_name]
    if "127.0.0.1" in settings.MONGODB_URI or "localhost" in settings.MONGODB_URI:
        print(f"⚠️ [DATABASE NOTICE]: MONGODB_URI is set to localhost ({db_name}). Set 'MONGODB_URI' in Railway Variables to Cloud MongoDB URL.")
    else:
        print(f"Connected to MongoDB Cloud Database: {db_name}")
except Exception as err:
    print(f"⚠️ Failed to parse MONGODB_URI ({err}). Using fallback MongoDB client.")
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017/ERP_System", serverSelectionTimeoutMS=2000)
    db = client["ERP_System"]

async def get_db():
    return db