# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Initialize Async MongoDB client
client = AsyncIOMotorClient(settings.MONGODB_URI)

# Get the database (defaults to ERP_System if not specified in URI)
db_name = settings.MONGODB_URI.split("/")[-1]
if not db_name or "?" in db_name:
    db_name = "ERP_System"
db = client[db_name]

print(f"Connected to MongoDB Database: {db_name}")

async def get_db():
    return db