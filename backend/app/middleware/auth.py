import jwt
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# pyrefly: ignore [missing-import]
import bcrypt
# pyrefly: ignore [missing-import]
from bson import ObjectId
from ..config import settings
from ..database import db

# Password hashing

import asyncio

def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Non-blocking async wrapper for CPU-bound bcrypt verification."""
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)

# JWT helpers
def generate_token(user_id: str, role: str, email: str) -> str:
    # Use 365 days as specified in Node .env or default to 7 days
    days = 365
    if "d" in settings.JWT_EXPIRE:
        try:
            days = int(settings.JWT_EXPIRE.replace("d", ""))
        except:
            pass
    
    payload = {
        "id": str(user_id),
        "role": role,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=days)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None

# HTTP Bearer Security scheme
security = HTTPBearer(auto_error=False)

# Role and Permission Configurations
ROLES = {
    'SUPER_ADMIN': 'super_admin',
    'ADMIN': 'admin',
    'TEACHER': 'teacher',
    'STUDENT': 'student',
    'PARENT': 'parent',
    'ACCOUNTANT': 'accountant',
    'LIBRARIAN': 'librarian',
    'RECEPTIONIST': 'receptionist',
}

MODULES = {
    'FRONT_OFFICE': 'front_office',
    'STUDENT_INFO': 'student_info',
    'FEES': 'fees',
    'INCOME': 'income',
    'EXPENSE': 'expense',
    'ATTENDANCE': 'attendance',
    'ACADEMIC': 'academic',
    'HUMAN_RESOURCES': 'human_resources',
    'COMMUNICATION': 'communication',
    'DOWNLOAD_CENTER': 'download_center',
    'LIBRARY': 'library',
    'INVENTORY': 'inventory',
    'CERTIFICATE': 'certificate',
    'FRONT_CMS': 'front_cms',
    'ONLINE_NOTES': 'online_notes',
    'MARKS': 'marks',
    'LEAVE': 'leave',
    'SCHOLARSHIP': 'scholarship',
    'GALLERY': 'gallery',
    'REPORTS': 'reports',
    'USER_MANAGEMENT': 'user_management',
    'SYSTEM_SETTINGS': 'system_settings',
}

ROLE_PERMISSIONS = {
    'super_admin': {m: ['create', 'read', 'update', 'delete'] for m in MODULES.values()},
    'admin': {m: ['create', 'read', 'update', 'delete'] for m in MODULES.values() if m != 'system_settings'},
    'teacher': {
        'attendance': ['create', 'read', 'update', 'delete'],
        'academic': ['read', 'update'],
        'communication': ['read', 'create'],
        'download_center': ['create', 'read', 'update', 'delete'],
        'library': ['read'],
        'certificate': ['read'],
        'online_notes': ['create', 'read', 'update', 'delete'],
        'marks': ['create', 'read', 'update', 'delete'],
        'leave': ['read', 'update'],
        'student_info': ['read'],
        'fees': ['read'],
    },
    'student': {
        'attendance': ['read'],
        'fees': ['read'],
        'academic': ['read'],
        'communication': ['read'],
        'download_center': ['read'],
        'library': ['read'],
        'online_notes': ['read'],
        'marks': ['read'],
        'leave': ['create', 'read'],
        'scholarship': ['create', 'read'],
    },
    'parent': {
        'attendance': ['read'],
        'fees': ['read'],
        'marks': ['read'],
        'leave': ['create', 'read'],
        'communication': ['read'],
    },
    'accountant': {
        'fees': ['create', 'read', 'update', 'delete'],
        'income': ['create', 'read', 'update', 'delete'],
        'expense': ['create', 'read', 'update', 'delete'],
        'student_info': ['read'],
        'reports': ['read', 'create'],
    },
    'librarian': {
        'library': ['create', 'read', 'update', 'delete'],
        'student_info': ['read'],
    },
    'receptionist': {
        'front_office': ['create', 'read', 'update', 'delete'],
        'student_info': ['read'],
        'communication': ['create', 'read', 'update', 'delete'],
        'front_cms': ['read', 'create', 'update'],
    },
}

def has_permission(role: str, module: str, action: str) -> bool:
    if role == 'super_admin':
        return True
    role_perms = ROLE_PERMISSIONS.get(role)
    if not role_perms:
        return False
    module_perms = role_perms.get(module)
    if not module_perms:
        return False
    return action in module_perms

# Auth dependencies
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized to access this route. Please login."
        )
    
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized. Token is invalid or expired."
        )
    
    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is invalid."
        )
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format."
        )
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please login again."
        )
        
    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact admin."
        )
    
    # Store token info inside the user dict for utility
    user["_id"] = str(user["_id"])
    return user

def authorize(*allowed_roles):
    async def dependency(current_user: dict = Depends(get_current_user)):
        role = current_user.get("role")
        if role in ['super_admin', 'superadmin']:
            return current_user
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{role}' is not authorized to access this resource."
            )
        return current_user
    return dependency

def check_permission(module: str, action: str):
    async def dependency(current_user: dict = Depends(get_current_user)):
        role = current_user.get("role")
        if not has_permission(role, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You do not have '{action}' permission for '{module}'."
            )
        return current_user
    return dependency

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("id")
    if not user_id:
        return None
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
            return user
    except:
        pass
    return None
