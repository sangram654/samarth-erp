import os
import uvicorn
import fastapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
import socketio
# pyrefly: ignore [missing-import]
from bson import ObjectId

from .config import settings
from .database import db
from .routers import auth, chatbot, ai_insights, profiles, academics, operations, finance, amenities

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/profiles", exist_ok=True)
os.makedirs("uploads/notes", exist_ok=True)
os.makedirs("uploads/notices", exist_ok=True)
os.makedirs("uploads/gallery", exist_ok=True)
os.makedirs("uploads/faces", exist_ok=True)
os.makedirs("uploads/attendance", exist_ok=True)

# Create Socket.io async server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio)

app = fastapi.FastAPI(title="🎓 SAMARTH COLLEGE ERP SYSTEM")

# Enable CORS for all origins, headers, and HTTP methods
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/db-status")
async def db_status():
    try:
        res = await db.command("ping")
        user_count = await db.users.count_documents({})
        return {
            "success": True,
            "status": "connected",
            "database": db.name,
            "users_count": user_count,
            "is_cloud_db": "127.0.0.1" not in settings.MONGODB_URI
        }
    except Exception as e:
        return {
            "success": False,
            "status": "connection_error",
            "error": str(e),
            "is_cloud_db": "127.0.0.1" not in settings.MONGODB_URI
        }

@app.on_event("startup")
async def auto_seed_db():
    try:
        from datetime import datetime
        from .middleware.auth import hash_password

        demo_users = [
            {
                "email": "superadmin@samarthcollege.edu.in",
                "password": hash_password("superadmin@123"),
                "role": "super_admin",
                "firstName": "Super",
                "lastName": "Admin",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "superadmin123@gmail.com",
                "password": hash_password("superadmin@123"),
                "role": "super_admin",
                "firstName": "Super",
                "lastName": "Admin",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "admin@samarthcollege.edu.in",
                "password": hash_password("admin@123"),
                "role": "admin",
                "firstName": "College",
                "lastName": "Admin",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "admin123@gmail.com",
                "password": hash_password("admin@123"),
                "role": "admin",
                "firstName": "College",
                "lastName": "Admin",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "teacher@samarthcollege.edu.in",
                "password": hash_password("teacher@123"),
                "role": "teacher",
                "firstName": "Rajesh",
                "lastName": "Patil",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "ramkadam123@gmail.com",
                "password": hash_password("ramkadam@123"),
                "role": "teacher",
                "firstName": "Ram",
                "lastName": "Kadam",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "rahulpatil123@gmail.com",
                "password": hash_password("rahulpatil@123"),
                "role": "student",
                "firstName": "Rahul",
                "lastName": "Patil",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "student@samarthcollege.edu.in",
                "password": hash_password("student@123"),
                "role": "student",
                "firstName": "Rahul",
                "lastName": "Patil",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "sureshpatilparent123@gmail.com",
                "password": hash_password("sureshpatil@123"),
                "role": "parent",
                "firstName": "Suresh",
                "lastName": "Patil",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "parent@samarthcollege.edu.in",
                "password": hash_password("parent@123"),
                "role": "parent",
                "firstName": "Suresh",
                "lastName": "Patil",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "accountant@gmail.com",
                "password": hash_password("accountant@123"),
                "role": "accountant",
                "firstName": "Rohan",
                "lastName": "Jadhav",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "librarian@gmail.com",
                "password": hash_password("librarian@123"),
                "role": "librarian",
                "firstName": "Amit",
                "lastName": "Kadam",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "email": "receptionist@gmail.com",
                "password": hash_password("receptionist@123"),
                "role": "receptionist",
                "firstName": "Sneha",
                "lastName": "Shinde",
                "isActive": True,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
        ]

        for u in demo_users:
            existing = await db.users.find_one({"email": u["email"]})
            if not existing:
                await db.users.insert_one(u)
            else:
                await db.users.update_one(
                    {"email": u["email"]},
                    {"$set": {"password": u["password"], "isActive": True}}
                )
        print("✅ Demo accounts verified and active in MongoDB Database!")
    except Exception as e:
        print(f"⚠️ Auto-seed warning: {e}")

# Mount Static Uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount APIRouters
app.include_router(auth.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")
app.include_router(ai_insights.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(academics.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(amenities.router, prefix="/api")

# Mount Socket.io ASGI app to FastAPI
app.mount("/socket.io", socket_app)

from fastapi.responses import FileResponse

# Serve React Frontend static files if build exists
possible_paths = [
    os.path.abspath("./static_frontend"),
    os.path.abspath("static_frontend"),
    os.path.abspath("../frontend/build"),
    os.path.abspath("frontend/build"),
]

frontend_build_path = None
for p in possible_paths:
    if os.path.exists(p):
        frontend_build_path = p
        break

if frontend_build_path:
    print(f"Serving frontend from: {frontend_build_path}")
    static_dir = os.path.join(frontend_build_path, "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="frontend-static")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Ignore API and socket routes
        if catchall.startswith("api") or catchall.startswith("socket.io"):
            raise fastapi.HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(frontend_build_path, catchall)
        if catchall and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        index_file = os.path.join(frontend_build_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"status": "online", "message": "SAMARTH ERP Python Backend is running."}
else:
    @app.get("/")
    async def root():
        return {
            "status": "online",
            "message": "SAMARTH ERP Python Backend is running. Frontend build not found."
        }

# Socket.io Events
@sio.event
async def connect(sid, environ):
    print(f"User connected to Socket: {sid}")

@sio.event
async def disconnect(sid):
    print(f"User disconnected: {sid}")

@sio.event
async def register_user(sid, data):
    user_id = data.get("userId")
    role = data.get("role")
    if not user_id:
        return
        
    print(f"Registering socket {sid} for user {user_id} with role {role}")
    
    # Join user-specific room
    await sio.enter_room(sid, f"user:{user_id}")
    
    if role:
        await sio.enter_room(sid, f"role:{role}")
        
        if role == 'student':
            await sio.enter_room(sid, f"student:{user_id}")
            
        if role == 'parent':
            try:
                parent = await db.parents.find_one({"user": ObjectId(user_id)})
                if parent and parent.get("students"):
                    for student_id in parent["students"]:
                        student = await db.students.find_one({"_id": ObjectId(student_id)})
                        if student and student.get("user"):
                            student_user_id = str(student["user"])
                            await sio.enter_room(sid, f"parent_of:{student_user_id}")
                            print(f"Parent socket {sid} joined room parent_of:{student_user_id}")
            except Exception as e:
                print(f"Error joining parent rooms on register-user: {e}")

@sio.event
async def join_parent_rooms(sid, student_user_ids):
    if isinstance(student_user_ids, list):
        for uid in student_user_ids:
            await sio.enter_room(sid, f"parent_of:{uid}")
            print(f"Parent socket {sid} explicitly joined room parent_of:{uid}")

if __name__ == "__main__":
    port = int(settings.PORT)
    print(f"Starting Samarth College ERP Python Backend on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)