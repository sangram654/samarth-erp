from fastapi import APIRouter, Depends, HTTPException, status, Query
# pyrefly: ignore [missing-import]
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from ..database import db
from ..middleware.auth import get_current_user, authorize, hash_password
from ..models import serialize_doc
from ..utils.email_service import trigger_welcome_email, trigger_update_email
router = APIRouter()

# --- SUPER ADMIN ROUTING ---

# @route   GET /api/super-admin/dashboard
@router.get("/super-admin/dashboard")
async def get_super_admin_dashboard(current_user: dict = Depends(authorize("super_admin"))):
    user_counts = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    counts_map = {item["_id"]: item["count"] for item in user_counts}
    
    recent_users = await db.users.find({}, {"password": 0})\
        .sort("createdAt", -1).limit(15).to_list(15)
        
    active_users = await db.users.count_documents({"isActive": True})
    inactive_users = await db.users.count_documents({"isActive": False})
    
    return {
        "success": True,
        "data": {
            "userCounts": counts_map,
            "totalUsers": active_users + inactive_users,
            "activeUsers": active_users,
            "inactiveUsers": inactive_users,
            "recentUsers": serialize_doc(recent_users)
        }
    }

# @route   GET /api/super-admin/users
@router.get("/super-admin/users")
async def super_admin_get_users(
    role: Optional[str] = None,
    isActive: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(authorize("super_admin"))
):
    query = {}
    if role:
        query["role"] = role
    if isActive is not None:
        query["isActive"] = isActive

    if search:
        query["$or"] = [
            {"firstName": {"$regex": search, "$options": "i"}},
            {"lastName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    users = await db.users.find(query, {"password": 0}).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    pages = max(1, (total + limit - 1) // limit)

    return {
        "success": True,
        "data": serialize_doc(users),
        "pagination": {
            "page": page,
            "pages": pages,
            "total": total,
            "limit": limit,
            "hasNextPage": page < pages,
            "hasPrevPage": page > 1
        }
    }

# @route   POST /api/super-admin/users
@router.post("/super-admin/users")
async def super_admin_create_user(payload: Dict[str, Any], current_user: dict = Depends(authorize("super_admin"))):
    email = payload.get("email")
    password = payload.get("password", "Samarth@123")
    role = payload.get("role")
    first_name = payload.get("firstName")
    last_name = payload.get("lastName")
    phone = payload.get("phone")
    
    if not email or not role or not first_name or not last_name:
        raise HTTPException(status_code=400, detail="Missing required fields: email, role, firstName, and lastName are required.")
        
    user_exists = await db.users.find_one({"email": email.strip().lower()})
    if user_exists:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")
        
    hashed_pwd = hash_password(password)
    user_doc = {
        "email": email.strip().lower(),
        "password": hashed_pwd,
        "role": role,
        "firstName": first_name,
        "lastName": last_name,
        "phone": phone,
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    res = await db.users.insert_one(user_doc)
    user_id = res.inserted_id
    user_doc["id"] = str(user_id)
    user_doc["_id"] = user_id

    # Create associated profile based on role
    if role == "student":
        student_doc = {
            "user": user_id,
            "rollNumber": f"STU{str(user_id)[-6:].upper()}",
            "department": payload.get("department", "Computer Engineering"),
            "admissionStatus": payload.get("admissionStatus", "First Year"),
            "enrollId": payload.get("enrollId"),
            "course": "B.Tech",
            "semester": 1,
            "batch": "2024-2028",
            "dateOfBirth": datetime(2004, 1, 1),
            "gender": "Male",
            "isActive": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await db.students.insert_one(student_doc)

    elif role == "teacher":
        teacher_doc = {
            "user": user_id,
            "employeeId": f"EMP{str(user_id)[-6:].upper()}",
            "department": payload.get("department", "Computer Engineering"),
            "designation": "Assistant Professor",
            "qualification": "M.Tech",
            "joiningDate": datetime.utcnow(),
            "isActive": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await db.teachers.insert_one(teacher_doc)

    elif role == "parent":
        student_id_val = payload.get("studentId")
        student_obj_id = ObjectId(student_id_val) if student_id_val else None
        parent_doc = {
            "user": user_id,
            "student": student_obj_id,
            "students": [student_obj_id] if student_obj_id else [],
            "occupation": "Self Employed",
            "relationship": "Parent",
            "isActive": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await db.parents.insert_one(parent_doc)

    # Trigger real welcome email in background task
    recipient_full_name = f"{first_name} {last_name}".strip()
    trigger_welcome_email(email.strip().lower(), recipient_full_name, role, password)

    return {"success": True, "message": "User created successfully", "data": serialize_doc(user_doc)}

# @route   PUT /api/super-admin/users/:id/role
@router.put("/super-admin/users/{user_id}/role")
async def super_admin_update_role(user_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("super_admin"))):
    role = payload.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Role is required")
        
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": role, "updatedAt": datetime.utcnow()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"success": True, "message": "User role updated successfully"}

# @route   PUT /api/super-admin/users/:id/status
@router.put("/super-admin/users/{user_id}/status")
async def super_admin_toggle_status(user_id: str, current_user: dict = Depends(authorize("super_admin"))):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_status = not user.get("isActive", True)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"isActive": new_status, "updatedAt": datetime.utcnow()}})
    
    return {"success": True, "message": f"User status updated to {'Active' if new_status else 'Inactive'}"}

# @route   PUT /api/super-admin/users/:id
@router.put("/super-admin/users/{user_id}")
async def super_admin_update_user(user_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("super_admin"))):
    existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}
    for field in ["firstName", "lastName", "phone", "email", "role"]:
        if field in payload and payload[field] is not None:
            if field == "email":
                update_data[field] = str(payload[field]).strip().lower()
            else:
                update_data[field] = payload[field]

    raw_pwd = payload.get("password")
    new_password_sent = None
    if raw_pwd and isinstance(raw_pwd, str) and raw_pwd.strip():
        new_password_sent = raw_pwd.strip()
        update_data["password"] = hash_password(new_password_sent)

    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    # Update role-specific profile details if present
    effective_role = payload.get("role") or existing_user.get("role")
    if effective_role == "student":
        student_update = {}
        if "department" in payload:
            student_update["department"] = payload["department"]
        if "admissionStatus" in payload:
            student_update["admissionStatus"] = payload["admissionStatus"]
        if "enrollId" in payload:
            student_update["enrollId"] = payload["enrollId"]
        if student_update:
            await db.students.update_one({"user": ObjectId(user_id)}, {"$set": student_update}, upsert=True)
    elif effective_role == "teacher":
        if "department" in payload:
            await db.teachers.update_one({"user": ObjectId(user_id)}, {"$set": {"department": payload["department"]}}, upsert=True)
    elif effective_role == "parent" and payload.get("studentId"):
        student_obj_id = ObjectId(payload["studentId"])
        await db.parents.update_one(
            {"user": ObjectId(user_id)},
            {"$set": {"student": student_obj_id, "students": [student_obj_id]}},
            upsert=True
        )

    # Fetch updated user details
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    to_email = updated_user.get("email")
    full_name = f"{updated_user.get('firstName', '')} {updated_user.get('lastName', '')}".strip()

    extra_details = {}
    if payload.get("department"):
        extra_details["Department"] = payload["department"]
    if payload.get("admissionStatus"):
        extra_details["Admission Status"] = payload["admissionStatus"]
    if payload.get("enrollId"):
        extra_details["Biometric Enroll ID"] = payload["enrollId"]
    if payload.get("phone"):
        extra_details["Phone Number"] = payload["phone"]

    # Trigger update email notification in background
    trigger_update_email(
        to_email=to_email,
        recipient_name=full_name,
        role=effective_role,
        password=new_password_sent,
        extra_details=extra_details
    )

    return {"success": True, "message": "User updated successfully and notification email sent.", "data": serialize_doc(updated_user)}

# @route   DELETE /api/super-admin/users/:id
@router.delete("/super-admin/users/{user_id}")
async def super_admin_delete_user(user_id: str, current_user: dict = Depends(authorize("super_admin"))):
    # Check if user exists
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    role = user.get("role")
    # Delete profile links
    if role == 'student':
        await db.students.delete_many({"user": ObjectId(user_id)})
    elif role == 'teacher':
        await db.teachers.delete_many({"user": ObjectId(user_id)})
    elif role == 'parent':
        await db.parents.delete_many({"user": ObjectId(user_id)})
        
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"success": True, "message": "User deleted successfully"}

# @route   GET /api/super-admin/roles
@router.get("/super-admin/roles")
async def super_admin_get_roles(current_user: dict = Depends(authorize("super_admin"))):
    # Return simple roles config mock
    from ..middleware.auth import ROLE_PERMISSIONS
    return {"success": True, "data": ROLE_PERMISSIONS}


# --- ADMIN ROUTING ---

# @route   GET /api/admin/dashboard
@router.get("/admin/dashboard")
async def get_admin_dashboard(current_user: dict = Depends(authorize("admin", "super_admin"))):
    total_students = await db.students.count_documents({"isActive": True})
    total_teachers = await db.teachers.count_documents({"isActive": True})
    total_parents = await db.parents.count_documents({"isActive": True})
    
    fee_stats = await db.fees.aggregate([
        {"$group": {
            "_id": None,
            "totalFees": {"$sum": "$totalAmount"},
            "collected": {"$sum": "$paidAmount"},
            "pending": {"$sum": "$dueAmount"}
        }}
    ]).to_list(1)
    
    # Today's attendance
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    today_attendance = await db.attendances.aggregate([
        {"$match": {"date": {"$gte": today, "$lt": tomorrow}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "present": {"$sum": {"$cond": [{"$in": ["$status", ["Present", "Late"]]}, 1, 0]}}
        }}
    ]).to_list(1)
    
    pending_leaves = await db.leaveapplications.count_documents({"status": "Pending"})
    pending_scholarships = await db.scholarshipapplications.count_documents({"status": "Pending"})
    
    dept_distribution = await db.students.aggregate([
        {"$match": {"isActive": True}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    recent_payments = await db.payments.find().sort("createdAt", -1).limit(5).to_list(5)
    for p in recent_payments:
        if p.get("student"):
            student = await db.students.find_one({"_id": ObjectId(p["student"])})
            if student:
                user = await db.users.find_one({"_id": ObjectId(student["user"])})
                p["student"] = serialize_doc(student)
                if user:
                    p["student"]["user"] = serialize_doc(user)
                    
    recent_registrations = await db.users.find({}, {"password": 0}).sort("createdAt", -1).limit(5).to_list(5)
    
    attendance_data = today_attendance[0] if today_attendance else {"total": 0, "present": 0}
    percentage = round((attendance_data["present"] / attendance_data["total"] * 100)) if attendance_data["total"] > 0 else 0
    
    return {
        "success": True,
        "data": {
            "counts": {
                "students": total_students,
                "teachers": total_teachers,
                "parents": total_parents
            },
            "fees": fee_stats[0] if fee_stats else {"totalFees": 0, "collected": 0, "pending": 0},
            "attendance": {
                "today": attendance_data,
                "percentage": percentage
            },
            "pending": {
                "leaves": pending_leaves,
                "scholarships": pending_scholarships
            },
            "departmentDistribution": dept_distribution,
            "recent": {
                "payments": serialize_doc(recent_payments),
                "registrations": serialize_doc(recent_registrations)
            }
        }
    }

# @route   GET /api/admin/users
@router.get("/admin/users")
async def admin_get_users(
    role: Optional[str] = None, 
    isActive: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(authorize("admin", "super_admin"))
):
    query = {}
    if role:
        query["role"] = role
    if isActive is not None:
        query["isActive"] = isActive
        
    if search:
        query["$or"] = [
            {"firstName": {"$regex": search, "$options": "i"}},
            {"lastName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
        
    users = await db.users.find(query, {"password": 0}).sort("createdAt", -1).to_list(100)
    return {"success": True, "data": serialize_doc(users)}

# @route   PUT /api/admin/users/:id/status
@router.put("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "super_admin"))):
    isActive = payload.get("isActive")
    if isActive is None:
        raise HTTPException(status_code=400, detail="isActive is required")
        
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"isActive": isActive, "updatedAt": datetime.utcnow()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"success": True, "message": "User status updated successfully"}


# --- STUDENTS CRUD ---

# @route   GET /api/students
@router.get("/students")
async def get_students(department: Optional[str] = None, semester: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if department:
        query["department"] = department
    if semester:
        query["semester"] = semester
        
    students = await db.students.find(query).to_list(100)
    for s in students:
        # Populate User
        user = await db.users.find_one({"_id": ObjectId(s["user"])})
        if user:
            s["user"] = serialize_doc(user)
            
    return {"success": True, "data": serialize_doc(students)}

# @route   GET /api/students/:id
@router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    user = await db.users.find_one({"_id": ObjectId(student["user"])})
    if user:
        student["user"] = serialize_doc(user)
        
    return {"success": True, "data": serialize_doc(student)}

# @route   POST /api/students
@router.post("/students")
async def create_student(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "super_admin"))):
    user_id = payload.get("user")
    roll_number = payload.get("rollNumber")
    department = payload.get("department")
    course = payload.get("course")
    semester = payload.get("semester")
    batch = payload.get("batch")
    dob = payload.get("dateOfBirth")
    gender = payload.get("gender")
    
    if not user_id or not roll_number or not department or not course or not semester or not batch or not dob or not gender:
        raise HTTPException(status_code=400, detail="Missing required student fields")
        
    # Convert DOB string to date
    try:
        parsed_dob = datetime.fromisoformat(dob.replace("Z", ""))
    except:
        parsed_dob = datetime(2004, 1, 1)
        
    student_doc = {
        "user": ObjectId(user_id),
        "rollNumber": roll_number,
        "department": department,
        "course": course,
        "semester": int(semester),
        "batch": batch,
        "dateOfBirth": parsed_dob,
        "gender": gender,
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    res = await db.students.insert_one(student_doc)
    student_doc["_id"] = res.inserted_id
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"studentProfile": res.inserted_id}})
    
    return {"success": True, "data": serialize_doc(student_doc)}

# @route   PUT /api/students/:id
@router.put("/students/{student_id}")
async def update_student(student_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "super_admin"))):
    update_data = {}
    for field in ["rollNumber", "department", "course", "semester", "batch", "gender", "bloodGroup", "aadharNumber", "enrollmentNumber"]:
        if field in payload:
            if field == "semester":
                update_data[field] = int(payload[field])
            else:
                update_data[field] = payload[field]
                
    if "dateOfBirth" in payload:
        try:
            update_data["dateOfBirth"] = datetime.fromisoformat(payload["dateOfBirth"].replace("Z", ""))
        except:
            pass
            
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.students.update_one({"_id": ObjectId(student_id)}, {"$set": update_data})
        
    updated = await db.students.find_one({"_id": ObjectId(student_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/students/:id
@router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(authorize("admin", "super_admin"))):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    user_id = student.get("user")
    await db.students.delete_one({"_id": ObjectId(student_id)})
    if user_id:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"studentProfile": None}})
        
    return {"success": True, "message": "Student profile deleted successfully"}

# @route   GET /api/students/class/:department/:semester/:section
@router.get("/students/class/{department}/{semester}/{section}")
async def get_students_by_class(department: str, semester: int, section: str, current_user: dict = Depends(get_current_user)):
    students = await db.students.find({
        "department": department,
        "semester": semester,
        "section": section
    }).to_list(100)
    
    for s in students:
        user = await db.users.find_one({"_id": ObjectId(s["user"])})
        if user:
            s["user"] = serialize_doc(user)
            
    return {"success": True, "data": serialize_doc(students)}


# --- TEACHERS CRUD ---

# @route   GET /api/teachers
@router.get("/teachers")
async def get_teachers(department: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if department:
        query["department"] = department
        
    teachers = await db.teachers.find(query).to_list(100)
    for t in teachers:
        user = await db.users.find_one({"_id": ObjectId(t["user"])})
        if user:
            t["user"] = serialize_doc(user)
            
    return {"success": True, "data": serialize_doc(teachers)}

# @route   GET /api/teachers/:id
@router.get("/teachers/{teacher_id}")
async def get_teacher(teacher_id: str, current_user: dict = Depends(get_current_user)):
    teacher = await db.teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    user = await db.users.find_one({"_id": ObjectId(teacher["user"])})
    if user:
        teacher["user"] = serialize_doc(user)
        
    return {"success": True, "data": serialize_doc(teacher)}

# @route   POST /api/teachers
@router.post("/teachers")
async def create_teacher(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "super_admin"))):
    user_id = payload.get("user")
    employee_id = payload.get("employeeId")
    department = payload.get("department")
    designation = payload.get("designation")
    qualification = payload.get("qualification")
    experience = payload.get("experience")
    
    if not user_id or not employee_id or not department or not designation or not qualification:
        raise HTTPException(status_code=400, detail="Missing required teacher fields")
        
    teacher_doc = {
        "user": ObjectId(user_id),
        "employeeId": employee_id,
        "department": department,
        "designation": designation,
        "qualification": qualification,
        "experience": int(experience) if experience else 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    res = await db.teachers.insert_one(teacher_doc)
    teacher_doc["_id"] = res.inserted_id
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"teacherProfile": res.inserted_id}})
    
    return {"success": True, "data": serialize_doc(teacher_doc)}

# @route   PUT /api/teachers/:id
@router.put("/teachers/{teacher_id}")
async def update_teacher(teacher_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "super_admin"))):
    update_data = {}
    for field in ["employeeId", "department", "designation", "qualification", "experience"]:
        if field in payload:
            if field == "experience":
                update_data[field] = int(payload[field])
            else:
                update_data[field] = payload[field]
                
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.teachers.update_one({"_id": ObjectId(teacher_id)}, {"$set": update_data})
        
    updated = await db.teachers.find_one({"_id": ObjectId(teacher_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/teachers/:id
@router.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, current_user: dict = Depends(authorize("admin", "super_admin"))):
    teacher = await db.teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    user_id = teacher.get("user")
    await db.teachers.delete_one({"_id": ObjectId(teacher_id)})
    if user_id:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"teacherProfile": None}})
        
    return {"success": True, "message": "Teacher profile deleted successfully"}


# --- PARENTS CRUD & Linkage ---

# @route   GET /api/parents
@router.get("/parents")
async def get_parents(current_user: dict = Depends(authorize("admin"))):
    parents = await db.parents.find().to_list(100)
    for p in parents:
        user = await db.users.find_one({"_id": ObjectId(p["user"])})
        if user:
            p["user"] = serialize_doc(user)
            
    return {"success": True, "data": serialize_doc(parents)}

# @route   POST /api/parents
@router.post("/parents")
async def create_parent(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    user_id = payload.get("user")
    relation = payload.get("relation", "Father")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")
        
    parent_doc = {
        "user": ObjectId(user_id),
        "relation": relation,
        "students": [],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    res = await db.parents.insert_one(parent_doc)
    parent_doc["_id"] = res.inserted_id
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"parentProfile": res.inserted_id}})
    
    return {"success": True, "data": serialize_doc(parent_doc)}

# @route   GET /api/parents/ward-dashboard  ← MUST be before /{parent_id}
@router.get("/parents/ward-dashboard")
async def get_ward_dashboard(current_user: dict = Depends(authorize("parent"))):
    parent_id = current_user.get("parentProfile")
    if not parent_id:
        # Try to find parent profile by user id
        parent_doc = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if parent_doc:
            parent_id = str(parent_doc["_id"])
        else:
            return {"success": True, "data": []}

    parent = await db.parents.find_one({"_id": ObjectId(parent_id)})
    if not parent or not parent.get("students"):
        return {"success": True, "data": []}

    student_ids = [ObjectId(x) for x in parent.get("students")]
    students = await db.students.find({"_id": {"$in": student_ids}}).to_list(10)

    wards_data = []
    for s in students:
        s_user = await db.users.find_one({"_id": ObjectId(s["user"])}, {"password": 0})
        s["user"] = serialize_doc(s_user)

        # Recent attendance rate (last 30 records)
        att_records = await db.attendances.find({"student": s["_id"]}).sort("date", -1).limit(30).to_list(30)
        total_att = len(att_records)
        present_att = sum(1 for r in att_records if r.get("status") in ['Present', 'Late'])
        att_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0

        # Pending fees
        pending_fee_count = await db.fees.count_documents({"student": s["_id"], "status": {"$in": ["unpaid", "pending", "partial"]}})
        due_fees = await db.fees.find({"student": s["_id"], "status": {"$in": ["unpaid", "pending", "partial"]}}).to_list(50)
        total_due = sum(f.get("dueAmount", 0) or 0 for f in due_fees)

        # Recent marks
        recent_marks = await db.marks.find({"student": s["_id"]}).sort("createdAt", -1).limit(5).to_list(5)
        marks_list = serialize_doc(recent_marks)

        # Attendance summary
        att_summary = {
            "total": total_att,
            "present": present_att,
            "absent": total_att - present_att,
            "percentage": att_rate
        }

        student_data = serialize_doc(s)
        wards_data.append({
            "student": {
                "id": str(s["_id"]),
                "name": f"{s_user.get('firstName', '')} {s_user.get('lastName', '')}" if s_user else "Unknown",
                "rollNumber": s.get("rollNumber", ""),
                "department": s.get("department", ""),
                "semester": s.get("semester", ""),
                "section": s.get("section", ""),
                "email": s_user.get("email", "") if s_user else ""
            },
            "attendance": {"summary": att_summary},
            "marks": marks_list,
            "fees": {"due": total_due, "pendingCount": pending_fee_count},
            "attendanceRate": f"{att_rate}%",
            "pendingFeesCount": pending_fee_count
        })

    return {"success": True, "data": wards_data}

# @route   GET /api/parents/ward/:studentId/attendance  ← MUST be before /{parent_id}
@router.get("/parents/ward/{student_id}/attendance")
async def get_ward_attendance(student_id: str, current_user: dict = Depends(authorize("parent"))):
    parent_id = current_user.get("parentProfile")
    if not parent_id:
        parent_doc = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if not parent_doc:
            raise HTTPException(status_code=403, detail="Parent profile not found")
        parent_id = str(parent_doc["_id"])
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "students": ObjectId(student_id)})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied. Student is not your ward.")
    records = await db.attendances.find({"student": ObjectId(student_id)}).sort("date", -1).limit(60).to_list(60)
    return {"success": True, "data": serialize_doc(records)}

# @route   GET /api/parents/ward/:studentId/fees  ← MUST be before /{parent_id}
@router.get("/parents/ward/{student_id}/fees")
async def get_ward_fees(student_id: str, current_user: dict = Depends(authorize("parent"))):
    parent_id = current_user.get("parentProfile")
    if not parent_id:
        parent_doc = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if not parent_doc:
            raise HTTPException(status_code=403, detail="Parent profile not found")
        parent_id = str(parent_doc["_id"])
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "students": ObjectId(student_id)})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied. Student is not your ward.")
    fees = await db.fees.find({"student": ObjectId(student_id)}).sort("dueDate", 1).to_list(100)
    return {"success": True, "data": serialize_doc(fees)}

# @route   GET /api/parents/ward/:studentId/marks  ← MUST be before /{parent_id}
@router.get("/parents/ward/{student_id}/marks")
async def get_ward_marks(student_id: str, current_user: dict = Depends(authorize("parent"))):
    parent_id = current_user.get("parentProfile")
    if not parent_id:
        parent_doc = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if not parent_doc:
            raise HTTPException(status_code=403, detail="Parent profile not found")
        parent_id = str(parent_doc["_id"])
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "students": ObjectId(student_id)})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied. Student is not your ward.")
    marks = await db.marks.find({"student": ObjectId(student_id)}).sort("createdAt", -1).to_list(100)
    for m in marks:
        if m.get("subject"):
            subject = await db.subjects.find_one({"_id": ObjectId(m["subject"])})
            m["subject"] = serialize_doc(subject)
    return {"success": True, "data": serialize_doc(marks)}

# @route   GET /api/parents/ward/:studentId/leaves  ← MUST be before /{parent_id}
@router.get("/parents/ward/{student_id}/leaves")
async def get_ward_leaves(student_id: str, current_user: dict = Depends(authorize("parent"))):
    parent_id = current_user.get("parentProfile")
    if not parent_id:
        parent_doc = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if not parent_doc:
            raise HTTPException(status_code=403, detail="Parent profile not found")
        parent_id = str(parent_doc["_id"])
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "students": ObjectId(student_id)})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied. Student is not your ward.")
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    leaves = await db.leaveapplications.find({"applicant": ObjectId(student["user"])}).sort("createdAt", -1).to_list(100)
    return {"success": True, "data": serialize_doc(leaves)}

# @route   GET /api/parents/:id  ← dynamic - MUST be AFTER all ward routes
@router.get("/parents/{parent_id}")
async def get_parent(parent_id: str, current_user: dict = Depends(get_current_user)):
    # Check authorization: parent can access their own profile, admin/super admin can access any
    role = current_user.get("role")
    if role == 'parent':
        parent_profile_id = current_user.get("parentProfile")
        if str(parent_profile_id) != parent_id:
            raise HTTPException(status_code=403, detail="Access denied")
            
    parent = await db.parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent profile not found")
        
    user = await db.users.find_one({"_id": ObjectId(parent["user"])})
    if user:
        parent["user"] = serialize_doc(user)
        
    # Populate students
    student_ids = [ObjectId(x) for x in (parent.get("students") or [])]
    students = await db.students.find({"_id": {"$in": student_ids}}).to_list(100)
    for s in students:
        s_user = await db.users.find_one({"_id": ObjectId(s["user"])})
        if s_user:
            s["user"] = serialize_doc(s_user)
            
    parent["students"] = serialize_doc(students)
    
    return {"success": True, "data": serialize_doc(parent)}

# @route   PUT /api/parents/:id
@router.put("/parents/{parent_id}")
async def update_parent(parent_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role == 'parent':
        parent_profile_id = current_user.get("parentProfile")
        if str(parent_profile_id) != parent_id:
            raise HTTPException(status_code=403, detail="Access denied")
            
    update_data = {}
    if "relation" in payload:
        update_data["relation"] = payload["relation"]
        
    if "students" in payload:
        # Convert student strings to ObjectIds
        update_data["students"] = [ObjectId(x) for x in payload["students"]]
        
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.parents.update_one({"_id": ObjectId(parent_id)}, {"$set": update_data})
        
    updated = await db.parents.find_one({"_id": ObjectId(parent_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   POST /api/parents/:id/link-student
@router.post("/parents/{parent_id}/link-student")
async def link_student(parent_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    student_id = payload.get("studentId")
    if not student_id:
        raise HTTPException(status_code=400, detail="studentId is required")
        
    # Check student
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Check parent
    parent = await db.parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
        
    # Link student to parent
    await db.parents.update_one(
        {"_id": ObjectId(parent_id)},
        {"$addToSet": {"students": ObjectId(student_id)}}
    )
    
    # Link parent to student
    await db.students.update_one(
        {"_id": ObjectId(student_id)},
        {"$set": {"parentGuardian": ObjectId(parent_id)}}
    )
    

    return {"success": True, "message": "Student linked to Parent successfully"}
