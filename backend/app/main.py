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

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
frontend_build_path = os.path.abspath("../frontend/build")
if os.path.exists(frontend_build_path):
    print(f"Serving frontend from: {frontend_build_path}")
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_build_path, "static")), name="frontend-static")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Ignore API and socket routes
        if catchall.startswith("api") or catchall.startswith("socket.io"):
            raise fastapi.HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(frontend_build_path, catchall)
        if catchall and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        index_file = os.path.join(frontend_build_path, "index.html")
        return FileResponse(index_file)
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