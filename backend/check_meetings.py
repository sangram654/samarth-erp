import asyncio
from app.database import db

async def main():
    roles = await db.users.distinct("role")
    print("User Roles in DB:", roles)
    meetings = await db.meetings.find().to_list(20)
    for mt in meetings:
        c_id = mt.get("createdBy")
        user = await db.users.find_one({"_id": c_id}) if c_id else None
        print(f"Meeting: {mt.get('title')} | CreatedBy ID: {c_id} | User Role: {user.get('role') if user else 'NONE'}")

if __name__ == "__main__":
    asyncio.run(main())