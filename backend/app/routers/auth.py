from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
# pyrefly: ignore [missing-import]
from bson import ObjectId
from datetime import datetime
from typing import Optional

from ..database import db
from ..middleware.auth import (
    hash_password, verify_password, verify_password_async, generate_token, 
    get_current_user, get_optional_user
)
from ..models import UserRegister, UserLogin, UpdateProfile, ChangePassword, serialize_doc
from ..utils.email_service import trigger_welcome_email

router = APIRouter()

# Helper to ensure role-specific profile document exists
async def ensure_user_profile(user: dict) -> Optional[dict]:
    role = user.get("role")
    user_id = ObjectId(user.get("_id") or user.get("id"))
    profile = None
    
    if role == 'student':
        student_profile_id = user.get("studentProfile")
        if student_profile_id:
            profile = await db.students.find_one({"_id": ObjectId(student_profile_id)})
        if not profile:
            profile = await db.students.find_one({"user": user_id})
        if not profile:
            roll_number = 'STU_' + str(int(datetime.now().timestamp()))[-6:]
            profile = {
                "user": user_id,
                "rollNumber": roll_number,
                "department": "Computer Engineering",
                "course": "B.E.",
                "semester": 1,
                "batch": str(datetime.now().year),
                "dateOfBirth": datetime(2004, 1, 1),
                "gender": "Male",
                "isActive": True
            }
            res = await db.students.insert_one(profile)
            profile["_id"] = res.inserted_id
            
        if not student_profile_id or str(student_profile_id) != str(profile["_id"]):
            await db.users.update_one({"_id": user_id}, {"$set": {"studentProfile": profile["_id"]}})
            
    elif role in ['teacher', 'admin']:
        teacher_profile_id = user.get("teacherProfile")
        if teacher_profile_id:
            profile = await db.teachers.find_one({"_id": ObjectId(teacher_profile_id)})
        if not profile:
            profile = await db.teachers.find_one({"user": user_id})
        if not profile:
            employee_id = 'EMP_' + str(int(datetime.now().timestamp()))[-6:]
            profile = {
                "user": user_id,
                "employeeId": employee_id,
                "department": "Computer Engineering",
                "designation": "Lecturer",
                "qualification": "B.E. / M.E.",
                "experience": 1
            }
            res = await db.teachers.insert_one(profile)
            profile["_id"] = res.inserted_id
            
        if not teacher_profile_id or str(teacher_profile_id) != str(profile["_id"]):
            await db.users.update_one({"_id": user_id}, {"$set": {"teacherProfile": profile["_id"]}})
            
    elif role == 'parent':
        parent_profile_id = user.get("parentProfile")
        if parent_profile_id:
            profile = await db.parents.find_one({"_id": ObjectId(parent_profile_id)})
        if not profile:
            profile = await db.parents.find_one({"user": user_id})
        if not profile:
            profile = {
                "user": user_id,
                "relation": "Father",
                "students": []
            }
            res = await db.parents.insert_one(profile)
            profile["_id"] = res.inserted_id
            
        if not parent_profile_id or str(parent_profile_id) != str(profile["_id"]):
            await db.users.update_one({"_id": user_id}, {"$set": {"parentProfile": profile["_id"]}})
            
    return serialize_doc(profile)

# @route   POST /api/auth/register
@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    # Check if user exists
    user_exists = await db.users.find_one({"email": payload.email.lower()})
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this email"
        )
        
    hashed_pwd = hash_password(payload.password)
    
    # Create user document
    user_doc = {
        "email": payload.email.lower(),
        "password": hashed_pwd,
        "role": payload.role,
        "firstName": payload.firstName,
        "lastName": payload.lastName,
        "phone": payload.phone,
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "studentProfile": None,
        "teacherProfile": None,
        "parentProfile": None
    }
    
    res = await db.users.insert_one(user_doc)
    user_id = res.inserted_id
    user_doc["_id"] = user_id
    
    # Create role-specific profile if details provided
    profile = None
    if payload.role == 'student' and payload.studentData:
        s_data = payload.studentData.dict()
        s_data["user"] = user_id
        # Convert dateOfBirth string to datetime
        try:
            s_data["dateOfBirth"] = datetime.fromisoformat(s_data["dateOfBirth"].replace("Z", ""))
        except:
            s_data["dateOfBirth"] = datetime(2004, 1, 1)
        if s_data.get("students"):
             s_data["students"] = [ObjectId(x) for x in s_data["students"]]
        s_data["isActive"] = True
        s_res = await db.students.insert_one(s_data)
        profile = s_data
        profile["_id"] = s_res.inserted_id
        await db.users.update_one({"_id": user_id}, {"$set": {"studentProfile": s_res.inserted_id}})
        
    elif payload.role == 'teacher' and payload.teacherData:
        t_data = payload.teacherData.dict()
        t_data["user"] = user_id
        t_res = await db.teachers.insert_one(t_data)
        profile = t_data
        profile["_id"] = t_res.inserted_id
        await db.users.update_one({"_id": user_id}, {"$set": {"teacherProfile": t_res.inserted_id}})
        
    elif payload.role == 'parent' and payload.parentData:
        p_data = payload.parentData.dict()
        p_data["user"] = user_id
        if p_data.get("students"):
            p_data["students"] = [ObjectId(x) for x in p_data["students"]]
        p_res = await db.parents.insert_one(p_data)
        profile = p_data
        profile["_id"] = p_res.inserted_id
        await db.users.update_one({"_id": user_id}, {"$set": {"parentProfile": p_res.inserted_id}})
        
    token = generate_token(user_id, payload.role, payload.email)
    
    user_info = {
        "id": str(user_id),
        "email": user_doc["email"],
        "role": user_doc["role"],
        "firstName": user_doc["firstName"],
        "lastName": user_doc["lastName"],
        "fullName": f"{user_doc['firstName']} {user_doc['lastName']}"
    }
    
    trigger_welcome_email(payload.email.lower(), f"{payload.firstName} {payload.lastName}", payload.role, payload.password)

    return {
        "success": True,
        "message": "Registration successful",
        "data": {
            "user": user_info,
            "profile": serialize_doc(profile),
            "token": token
        }
    }

# @route   POST /api/auth/login
@router.post("/auth/login")
async def login(payload: UserLogin):
    print(f"[LOGIN DEBUG] Attempting login for email: {payload.email}")
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        print(f"[LOGIN DEBUG] User not found in database for email: {payload.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    if not user.get("isActive", True):
        print(f"[LOGIN DEBUG] User {payload.email} is inactive.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact admin."
        )
        
    is_correct = await verify_password_async(payload.password, user["password"])
    print(f"[LOGIN DEBUG] Password verification result for {payload.email}: {is_correct}")
    if not is_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    # Update last login
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.utcnow()}})
    
    # Ensure profile exists
    user_serialized = serialize_doc(user)
    profile = await ensure_user_profile(user_serialized)
    
    token = generate_token(user["_id"], user["role"], user["email"])
    
    user_info = {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "firstName": user["firstName"],
        "lastName": user["lastName"],
        "fullName": f"{user['firstName']} {user['lastName']}",
        "profileImage": user.get("profileImage")
    }
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "user": user_info,
            "profile": profile,
            "token": token
        }
    }

# @route   GET /api/auth/me
@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    profile = await ensure_user_profile(current_user)
    
    # Populate extra profiles if matching
    role = current_user.get("role")
    if role == 'student' and profile:
        # Populate enrolledSubjects and parentGuardian
        enrolled_ids = [ObjectId(x) for x in (profile.get("enrolledSubjects") or []) if x]
        subjects = await db.subjects.find({"_id": {"$in": enrolled_ids}}).to_list(100)
        profile["enrolledSubjects"] = serialize_doc(subjects)
        
        parent_id = profile.get("parentGuardian")
        if parent_id:
            parent = await db.parents.find_one({"_id": ObjectId(parent_id)})
            profile["parentGuardian"] = serialize_doc(parent)
            
    elif role in ['teacher', 'admin'] and profile:
        subject_ids = [ObjectId(x) for x in (profile.get("subjects") or []) if x]
        subjects = await db.subjects.find({"_id": {"$in": subject_ids}}).to_list(100)
        profile["subjects"] = serialize_doc(subjects)
        
    elif role == 'parent' and profile:
        student_ids = [ObjectId(x) for x in (profile.get("students") or []) if x]
        students = await db.students.find({"_id": {"$in": student_ids}}).to_list(100)
        profile["students"] = serialize_doc(students)
        
    user_info = {
        "id": current_user["_id"],
        "email": current_user["email"],
        "role": current_user["role"],
        "firstName": current_user["firstName"],
        "lastName": current_user["lastName"],
        "fullName": f"{current_user['firstName']} {current_user['lastName']}",
        "phone": current_user.get("phone"),
        "address": current_user.get("address"),
        "profileImage": current_user.get("profileImage"),
        "isActive": current_user.get("isActive", True),
        "lastLogin": current_user.get("lastLogin"),
        "createdAt": current_user.get("createdAt")
    }
    
    return {
        "success": True,
        "data": {
            "user": user_info,
            "profile": profile
        }
    }

# @route   PUT /api/auth/profile
@router.put("/auth/profile")
async def update_profile(payload: UpdateProfile, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if payload.firstName is not None:
        update_data["firstName"] = payload.firstName
    if payload.lastName is not None:
        update_data["lastName"] = payload.lastName
    if payload.phone is not None:
        update_data["phone"] = payload.phone
    if payload.address is not None:
        update_data["address"] = payload.address
        
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$set": update_data})
        
    updated_user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    
    user_info = {
        "id": str(updated_user["_id"]),
        "email": updated_user["email"],
        "role": updated_user["role"],
        "firstName": updated_user["firstName"],
        "lastName": updated_user["lastName"],
        "fullName": f"{updated_user['firstName']} {updated_user['lastName']}",
        "phone": updated_user.get("phone"),
        "address": updated_user.get("address"),
        "profileImage": updated_user.get("profileImage")
    }
    
    return {
        "success": True,
        "message": "Profile updated successfully",
        "data": {
            "user": user_info
        }
    }

# @route   PUT /api/auth/password
@router.put("/auth/password")
async def change_password(payload: ChangePassword, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    # compare current password
    if not await verify_password_async(payload.currentPassword, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
        
    hashed_new_pwd = hash_password(payload.newPassword)
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])}, 
        {"$set": {"password": hashed_new_pwd, "updatedAt": datetime.utcnow()}}
    )
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }

# @route   POST /api/auth/logout
@router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "message": "Logged out successfully"
    }

# --- PORTING /api/users ROUTES ---

# @route   POST /api/users/register
@router.post("/users/register", status_code=status.HTTP_201_CREATED)
async def users_register(firstName: str, lastName: str, email: str, password: str, role: str):
    # Check if user exists
    user_exists = await db.users.find_one({"email": email.lower()})
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )
    
    hashed_pwd = hash_password(password)
    user_doc = {
        "firstName": firstName,
        "lastName": lastName,
        "email": email.lower(),
        "password": hashed_pwd,
        "role": role,
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    await db.users.insert_one(user_doc)
    
    trigger_welcome_email(email.lower(), f"{firstName} {lastName}", role, password)

    return {
        "success": True,
        "message": "User Registered Successfully"
    }

# @route   POST /api/users/login
@router.post("/users/login")
async def users_login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Credentials"
        )
        
    if not await verify_password_async(payload.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Credentials"
        )
        
    token = generate_token(user["_id"], user["role"], user["email"])
    
    return {
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "email": user["email"],
            "role": user["role"]
        }
    }

# @route   GET /api/users/profile
@router.get("/users/profile")
async def users_profile(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "message": "Profile data fetched",
        "user": serialize_doc(current_user)
    }
