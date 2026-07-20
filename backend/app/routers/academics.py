from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
# pyrefly: ignore [missing-import]
from bson import ObjectId
from datetime import datetime
from typing import Optional, List, Dict, Any
import os

from ..database import db
from ..middleware.auth import get_current_user, authorize
from ..models import (
    CreateAssignment, SubmitAssignment, CreateMarkRecord, 
    CreateVirtualMeeting, CreateNote, serialize_doc
)

router = APIRouter()

# --- CLASSES CRUD ---

# @route   GET /api/classes
@router.get("/classes")
async def get_classes(current_user: dict = Depends(get_current_user)):
    classes = await db.classes.find().to_list(100)
    for c in classes:
        # Populate teacher
        if c.get("classTeacher"):
            teacher = await db.teachers.find_one({"_id": ObjectId(c["classTeacher"])})
            if teacher:
                user = await db.users.find_one({"_id": ObjectId(teacher["user"])})
                teacher["user"] = serialize_doc(user)
                c["classTeacher"] = serialize_doc(teacher)
    return {"success": True, "data": serialize_doc(classes)}

# @route   POST /api/classes
@router.post("/classes")
async def create_class(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    name = payload.get("name")
    department = payload.get("department")
    semester = payload.get("semester")
    section = payload.get("section", "A")
    class_teacher = payload.get("classTeacher")
    
    if not name or not department or not semester:
        raise HTTPException(status_code=400, detail="Missing required class fields")
        
    doc = {
        "name": name,
        "department": department,
        "semester": int(semester),
        "section": section,
        "classTeacher": ObjectId(class_teacher) if class_teacher else None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = await db.classes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/classes/:id
@router.get("/classes/{class_id}")
async def get_class(class_id: str, current_user: dict = Depends(get_current_user)):
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    if c.get("classTeacher"):
        teacher = await db.teachers.find_one({"_id": ObjectId(c["classTeacher"])})
        if teacher:
            user = await db.users.find_one({"_id": ObjectId(teacher["user"])})
            teacher["user"] = serialize_doc(user)
            c["classTeacher"] = serialize_doc(teacher)
    return {"success": True, "data": serialize_doc(c)}

# @route   PUT /api/classes/:id
@router.put("/classes/{class_id}")
async def update_class(class_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    update_data = {}
    for f in ["name", "department", "semester", "section"]:
        if f in payload:
            if f == "semester":
                update_data[f] = int(payload[f])
            else:
                update_data[f] = payload[f]
                
    if "classTeacher" in payload:
        update_data["classTeacher"] = ObjectId(payload["classTeacher"]) if payload["classTeacher"] else None
        
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.classes.update_one({"_id": ObjectId(class_id)}, {"$set": update_data})
        
    updated = await db.classes.find_one({"_id": ObjectId(class_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/classes/:id
@router.delete("/classes/{class_id}")
async def delete_class(class_id: str, current_user: dict = Depends(authorize("admin"))):
    await db.classes.delete_one({"_id": ObjectId(class_id)})
    return {"success": True, "message": "Class deleted successfully"}

# @route   GET /api/classes/:id/students
@router.get("/classes/{class_id}/students")
async def get_class_students(class_id: str, current_user: dict = Depends(get_current_user)):
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
        
    students = await db.students.find({
        "department": c.get("department"),
        "semester": c.get("semester"),
        "section": c.get("section")
    }).to_list(100)
    
    for s in students:
        user = await db.users.find_one({"_id": ObjectId(s["user"])})
        s["user"] = serialize_doc(user)
        
    return {"success": True, "data": serialize_doc(students)}


# --- SUBJECTS & TEACHING ASSIGNMENTS ---

# @route   GET /api/admin/subjects or /api/subjects
@router.get("/admin/subjects")
@router.get("/subjects")
async def get_subjects(current_user: dict = Depends(get_current_user)):
    subjects = await db.subjects.find().to_list(100)
    return {"success": True, "data": serialize_doc(subjects)}

# @route   POST /api/admin/subjects or /api/subjects
@router.post("/admin/subjects")
@router.post("/subjects")
async def create_subject(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    name = payload.get("name")
    code = payload.get("code")
    department = payload.get("department")
    semester = payload.get("semester")
    credits = payload.get("credits", 3)
    
    if not name or not code or not department or not semester:
        raise HTTPException(status_code=400, detail="Missing required subject fields")
        
    doc = {
        "name": name,
        "code": code.upper(),
        "department": department,
        "semester": int(semester),
        "credits": int(credits),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = await db.subjects.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "data": serialize_doc(doc)}

# @route   PUT /api/admin/subjects/:id or /api/subjects/:id
@router.put("/admin/subjects/{subject_id}")
@router.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    update_data = {}
    for f in ["name", "code", "department", "semester", "credits"]:
        if f in payload:
            if f in ["semester", "credits"]:
                update_data[f] = int(payload[f])
            else:
                update_data[f] = payload[f]
                
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.subjects.update_one({"_id": ObjectId(subject_id)}, {"$set": update_data})
        
    updated = await db.subjects.find_one({"_id": ObjectId(subject_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/admin/subjects/:id or /api/subjects/:id
@router.delete("/admin/subjects/{subject_id}")
@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user: dict = Depends(authorize("admin"))):
    await db.subjects.delete_one({"_id": ObjectId(subject_id)})
    return {"success": True, "message": "Subject deleted successfully"}


# --- TEACHING ASSIGNMENTS ---

async def populate_teaching_assignment(ta: dict) -> dict:
    if not ta:
        return ta
    if ta.get("teacherId"):
        teacher = await db.teachers.find_one({"_id": ObjectId(ta["teacherId"])})
        if teacher:
            t_user = await db.users.find_one({"_id": ObjectId(teacher["user"])}, {"password": 0})
            teacher["user"] = serialize_doc(t_user) if t_user else None
            ta["teacherId"] = serialize_doc(teacher)
    if ta.get("subjectId"):
        sub = await db.subjects.find_one({"_id": ObjectId(ta["subjectId"])})
        ta["subjectId"] = serialize_doc(sub) if sub else None
    if ta.get("classId"):
        cls = await db.classes.find_one({"_id": ObjectId(ta["classId"])})
        ta["classId"] = serialize_doc(cls) if cls else None
    return ta

# @route   GET /api/teaching-assignments/my-assignments
@router.get("/teaching-assignments/my-assignments")
async def get_my_teaching_assignments(current_user: dict = Depends(get_current_user)):
    teacher = await db.teachers.find_one({"user": ObjectId(current_user["_id"])})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
        
    assignments = await db.teachingassignments.find({
        "teacherId": teacher["_id"],
        "isActive": True
    }).to_list(100)
    
    populated = []
    for ta in assignments:
        populated.append(await populate_teaching_assignment(ta))
        
    return {
        "success": True,
        "count": len(populated),
        "data": serialize_doc(populated)
    }

# @route   GET /api/teaching-assignments/:id/students
@router.get("/teaching-assignments/{ta_id}/students")
async def get_assignment_students(ta_id: str, current_user: dict = Depends(get_current_user)):
    ta = await db.teachingassignments.find_one({"_id": ObjectId(ta_id)})
    if not ta:
        raise HTTPException(status_code=404, detail="Teaching assignment not found")
        
    if current_user.get("role") == "teacher":
        teacher = await db.teachers.find_one({"user": ObjectId(current_user["_id"])})
        if not teacher or str(ta.get("teacherId")) != str(teacher["_id"]):
            raise HTTPException(status_code=403, detail="Not authorized to access this assignment")
            
    class_doc = await db.classes.find_one({"_id": ObjectId(ta.get("classId"))})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found for this assignment")
        
    students = await db.students.find({
        "department": class_doc.get("department"),
        "semester": class_doc.get("semester"),
        "section": class_doc.get("section"),
        "isActive": True
    }).to_list(500)
    
    for s in students:
        s_user = await db.users.find_one({"_id": ObjectId(s["user"])}, {"password": 0})
        s["user"] = serialize_doc(s_user) if s_user else None
        
    ta_populated = await populate_teaching_assignment(ta)
    
    return {
        "success": True,
        "count": len(students),
        "assignment": {
            "_id": str(ta_populated["_id"]),
            "subject": ta_populated.get("subjectId"),
            "class": ta_populated.get("classId"),
            "semester": ta_populated.get("semester")
        },
        "data": serialize_doc(students)
    }

# @route   GET /api/teaching-assignments
@router.get("/teaching-assignments")
async def get_all_teaching_assignments(
    department: Optional[str] = None,
    semester: Optional[int] = None,
    teacherId: Optional[str] = None,
    classId: Optional[str] = None,
    isActive: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if teacherId:
        query["teacherId"] = ObjectId(teacherId)
    if classId:
        query["classId"] = ObjectId(classId)
    if semester:
        query["semester"] = int(semester)
    if isActive is not None:
        query["isActive"] = isActive.lower() == "true"
        
    assignments = await db.teachingassignments.find(query).to_list(500)
    populated = []
    for ta in assignments:
        ta_pop = await populate_teaching_assignment(ta)
        if department:
            class_val = ta_pop.get("classId")
            if not class_val or class_val.get("department") != department:
                continue
        populated.append(ta_pop)
        
    return {
        "success": True,
        "count": len(populated),
        "data": serialize_doc(populated)
    }

# @route   POST /api/teaching-assignments
@router.post("/teaching-assignments")
async def create_teaching_assignment(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    teacher_id = payload.get("teacherId")
    class_id = payload.get("classId")
    subject_id = payload.get("subjectId")
    academic_year = payload.get("academicYear")
    semester = payload.get("semester")
    
    teacher = await db.teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    class_doc = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
        
    subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    existing = await db.teachingassignments.find_one({
        "teacherId": ObjectId(teacher_id),
        "classId": ObjectId(class_id),
        "subjectId": ObjectId(subject_id)
    })
    if existing:
        raise HTTPException(status_code=400, detail="This teaching assignment already exists")
        
    doc = {
        "teacherId": ObjectId(teacher_id),
        "classId": ObjectId(class_id),
        "subjectId": ObjectId(subject_id),
        "academicYear": academic_year or class_doc.get("academicYear"),
        "semester": int(semester or class_doc.get("semester") or 1),
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    res = await db.teachingassignments.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    populated = await populate_teaching_assignment(doc)
    return {"success": True, "message": "Teaching assignment created successfully", "data": serialize_doc(populated)}

# @route   GET /api/teaching-assignments/:id
@router.get("/teaching-assignments/{ta_id}")
async def get_teaching_assignment(ta_id: str, current_user: dict = Depends(get_current_user)):
    ta = await db.teachingassignments.find_one({"_id": ObjectId(ta_id)})
    if not ta:
        raise HTTPException(status_code=404, detail="Teaching assignment not found")
    populated = await populate_teaching_assignment(ta)
    return {"success": True, "data": serialize_doc(populated)}

# @route   PUT /api/teaching-assignments/:id
@router.put("/teaching-assignments/{ta_id}")
async def update_teaching_assignment(ta_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    is_active = payload.get("isActive")
    ta = await db.teachingassignments.find_one({"_id": ObjectId(ta_id)})
    if not ta:
        raise HTTPException(status_code=404, detail="Teaching assignment not found")
        
    update_data = {}
    if is_active is not None:
        update_data["isActive"] = is_active
        
    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.teachingassignments.update_one({"_id": ObjectId(ta_id)}, {"$set": update_data})
        
    updated = await db.teachingassignments.find_one({"_id": ObjectId(ta_id)})
    populated = await populate_teaching_assignment(updated)
    return {"success": True, "message": "Teaching assignment updated successfully", "data": serialize_doc(populated)}

# @route   DELETE /api/teaching-assignments/:id
@router.delete("/teaching-assignments/{ta_id}")
async def delete_teaching_assignment(ta_id: str, current_user: dict = Depends(authorize("admin"))):
    ta = await db.teachingassignments.find_one({"_id": ObjectId(ta_id)})
    if not ta:
        raise HTTPException(status_code=404, detail="Teaching assignment not found")
        
    await db.teachingassignments.update_one({"_id": ObjectId(ta_id)}, {"$set": {"isActive": False, "updatedAt": datetime.utcnow()}})
    return {"success": True, "message": "Teaching assignment deactivated successfully"}


# --- MARKS ---

# @route   POST /api/marks
@router.post("/marks")
async def enter_marks(payload: CreateMarkRecord, current_user: dict = Depends(authorize("teacher", "admin"))):
    status_val = "Pass" if payload.obtainedMarks >= (payload.maxMarks * 0.4) else "Fail"
    grade = "F"
    pct = (payload.obtainedMarks / payload.maxMarks * 100) if payload.maxMarks > 0 else 0
    if pct >= 90: grade = "O"
    elif pct >= 80: grade = "A+"
    elif pct >= 70: grade = "A"
    elif pct >= 60: grade = "B+"
    elif pct >= 50: grade = "B"
    elif pct >= 40: grade = "C"
    
    doc = {
        "student": ObjectId(payload.studentId),
        "subject": ObjectId(payload.subjectId),
        "obtainedMarks": payload.obtainedMarks,
        "maxMarks": payload.maxMarks,
        "grade": grade,
        "status": status_val,
        "examType": payload.examType,
        "academicYear": payload.academicYear,
        "semester": payload.semester,
        "remarks": payload.remarks,
        "createdAt": datetime.utcnow()
    }
    
    res = await db.marks.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    # If fail, create backlog entry
    if status_val == "Fail":
        await db.backlogs.update_one(
            {"student": ObjectId(payload.studentId), "subject": ObjectId(payload.subjectId)},
            {"$set": {
                "student": ObjectId(payload.studentId),
                "subject": ObjectId(payload.subjectId),
                "status": "active",
                "examType": payload.examType,
                "semester": payload.semester,
                "updatedAt": datetime.utcnow()
            }},
            upsert=True
        )
        
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/marks/student/:studentId
@router.get("/marks/student/{student_id}")
async def get_student_marks(student_id: str, current_user: dict = Depends(get_current_user)):
    marks = await db.marks.find({"student": ObjectId(student_id)}).sort("createdAt", -1).to_list(100)
    for m in marks:
        if m.get("subject"):
            subject = await db.subjects.find_one({"_id": ObjectId(m["subject"])})
            m["subject"] = serialize_doc(subject)
    return {"success": True, "data": serialize_doc(marks)}

# @route   GET /api/marks/class
@router.get("/marks/class")
async def get_class_marks(subjectId: str, examType: str, semester: int, current_user: dict = Depends(get_current_user)):
    marks = await db.marks.find({
        "subject": ObjectId(subjectId),
        "examType": examType,
        "semester": int(semester)
    }).to_list(200)
    
    for m in marks:
        student = await db.students.find_one({"_id": ObjectId(m["student"])})
        if student:
            user = await db.users.find_one({"_id": ObjectId(student["user"])})
            student["user"] = serialize_doc(user)
            m["student"] = serialize_doc(student)
            
    return {"success": True, "data": serialize_doc(marks)}

# @route   GET /api/marks/backlogs/:studentId
@router.get("/marks/backlogs/{student_id}")
async def get_student_backlogs(student_id: str, current_user: dict = Depends(get_current_user)):
    backlogs = await db.backlogs.find({"student": ObjectId(student_id), "status": "active"}).to_list(100)
    for b in backlogs:
        if b.get("subject"):
            subject = await db.subjects.find_one({"_id": ObjectId(b["subject"])})
            b["subject"] = serialize_doc(subject)
    return {"success": True, "data": serialize_doc(backlogs)}

# @route   GET /api/marks/analytics
@router.get("/marks/analytics")
async def get_marks_analytics(subjectId: str, semester: int, current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"subject": ObjectId(subjectId), "semester": int(semester)}},
        {"$group": {
            "_id": "$grade",
            "count": {"$sum": 1}
        }}
    ]
    grade_dist = await db.marks.aggregate(pipeline).to_list(100)
    
    pass_fail_pipeline = [
        {"$match": {"subject": ObjectId(subjectId), "semester": int(semester)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    pass_fail_dist = await db.marks.aggregate(pass_fail_pipeline).to_list(10)
    
    return {
        "success": True,
        "data": {
            "gradeDistribution": {item["_id"] or "N/A": item["count"] for item in grade_dist},
            "passFailDistribution": {item["_id"]: item["count"] for item in pass_fail_dist}
        }
    }


# --- NOTES / ONLINE MATERIAL ---

# @route   GET /api/notes
@router.get("/notes")
async def get_notes(classId: Optional[str] = None, subjectId: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if classId: query["classId"] = ObjectId(classId)
    if subjectId: query["subjectId"] = ObjectId(subjectId)
    
    notes = await db.notes.find(query).to_list(100)
    for n in notes:
        # Populate subject & teacher
        if n.get("subjectId"):
            subj = await db.subjects.find_one({"_id": ObjectId(n["subjectId"])})
            n["subject"] = serialize_doc(subj)
        if n.get("uploadedBy"):
            teacher = await db.teachers.find_one({"user": ObjectId(n["uploadedBy"])})
            if teacher:
                user = await db.users.find_one({"_id": ObjectId(teacher["user"])})
                teacher["user"] = serialize_doc(user)
                n["uploadedBy"] = serialize_doc(teacher)
    return {"success": True, "data": serialize_doc(notes)}

# @route   POST /api/notes
@router.post("/notes")
async def upload_note(
    title: str = Form(...),
    description: str = Form(...),
    classId: str = Form(...),
    subjectId: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(authorize("teacher", "admin"))
):
    upload_dir = "uploads/notes"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"{int(datetime.now().timestamp())}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    doc = {
        "title": title,
        "description": description,
        "classId": ObjectId(classId),
        "subjectId": ObjectId(subjectId),
        "attachmentUrl": "/" + file_path.replace("\\", "/"),
        "uploadedBy": ObjectId(current_user["_id"]),
        "createdAt": datetime.utcnow()
    }
    
    res = await db.notes.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/notes/my-notes  ← MUST be before /{note_id}
@router.get("/notes/my-notes")
async def get_my_notes(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role == 'student':
        # Find enrolled subjects from student profile
        student = await db.students.find_one({"user": ObjectId(current_user["_id"])})
        if not student:
            return {"success": True, "data": []}
        enrolled = student.get("enrolledSubjects") or []
        # Also find notes by student's class/department/semester
        notes = await db.notes.find({
            "$or": [
                {"subjectId": {"$in": [ObjectId(x) for x in enrolled]}} if enrolled else {"_id": None},
                {"classId": {"$exists": True}}
            ]
        }).sort("createdAt", -1).to_list(100)
    elif role in ['teacher', 'admin']:
        notes = await db.notes.find({"uploadedBy": ObjectId(current_user["_id"])}).sort("createdAt", -1).to_list(100)
    else:
        notes = []

    for n in notes:
        if n.get("subjectId"):
            subj = await db.subjects.find_one({"_id": ObjectId(n["subjectId"])})
            n["subject"] = serialize_doc(subj)
        if n.get("classId"):
            cls = await db.classes.find_one({"_id": ObjectId(n["classId"])})
            n["class"] = serialize_doc(cls)

    return {"success": True, "data": serialize_doc(notes)}

# @route   GET /api/notes/:id  ← MUST be after /my-notes
@router.get("/notes/{note_id}")
async def get_note_by_id(note_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")
    note = await db.notes.find_one({"_id": obj_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "data": serialize_doc(note)}

# @route   GET /api/notes/:id/download
@router.get("/notes/{note_id}/download")
async def download_note(note_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID")
    note = await db.notes.find_one({"_id": obj_id})
    if not note or not note.get("attachmentUrl"):
        raise HTTPException(status_code=404, detail="Note attachment not found")
    rel_path = note["attachmentUrl"].lstrip("/")
    abs_path = os.path.abspath(rel_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File does not exist on disk")
    return FileResponse(abs_path, filename=os.path.basename(abs_path))


# --- MEETINGS ---

async def populate_meeting(m: dict) -> dict:
    if not m:
        return m
    # createdBy
    if m.get("createdBy"):
        user = await db.users.find_one({"_id": ObjectId(m["createdBy"])}, {"password": 0})
        m["createdBy"] = serialize_doc(user) if user else None
    # host (Teacher)
    if m.get("host"):
        teacher = await db.teachers.find_one({"_id": ObjectId(m["host"])})
        if teacher:
            t_user = await db.users.find_one({"_id": ObjectId(teacher["user"])}, {"password": 0})
            teacher["user"] = serialize_doc(t_user) if t_user else None
            m["host"] = serialize_doc(teacher)
        else:
            # Fallback if host references user ID directly
            t_user = await db.users.find_one({"_id": ObjectId(m["host"])}, {"password": 0})
            m["host"] = {"user": serialize_doc(t_user)} if t_user else None
    # subject
    if m.get("subject"):
        sub = await db.subjects.find_one({"_id": ObjectId(m["subject"])})
        m["subject"] = serialize_doc(sub) if sub else None
    return m

# @route   GET /api/meetings
@router.get("/meetings")
async def get_meetings(
    status: Optional[str] = None,
    department: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"isActive": True}
    if status:
        query["status"] = status
    if department:
        query["classDetails.department"] = department
    if startDate and endDate:
        try:
            from datetime import timedelta
            start_dt = datetime.fromisoformat(startDate.replace("Z", ""))
            end_dt = datetime.fromisoformat(endDate.replace("Z", ""))
            query["scheduledDate"] = {"$gte": start_dt, "$lte": end_dt}
        except:
            pass

    meetings = await db.virtualmeetings.find(query).sort([("scheduledDate", -1), ("scheduledTime", -1)]).to_list(100)
    populated = []
    for m in meetings:
        populated.append(await populate_meeting(m))
        
    return {"success": True, "data": serialize_doc(populated)}

# @route   POST /api/meetings
@router.post("/meetings")
async def create_meeting(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    scheduled_date_val = payload.get("scheduledDate")
    if isinstance(scheduled_date_val, str):
        try:
            scheduled_date = datetime.fromisoformat(scheduled_date_val.replace("Z", ""))
        except:
            scheduled_date = datetime.utcnow()
    else:
        scheduled_date = datetime.utcnow()

    # Find teacher host
    teacher_host = payload.get("host")
    if not teacher_host and current_user.get("role") == "teacher":
        teacher_profile = await db.teachers.find_one({"user": ObjectId(current_user["_id"])})
        if teacher_profile:
            teacher_host = str(teacher_profile["_id"])

    # If user is admin, restrict target roles to lower panels only (teacher, student, parent)
    roles_targeted = payload.get("roles", [])
    if current_user.get("role") == "admin":
        roles_targeted = [r for r in roles_targeted if r in ["teacher", "student", "parent"]]

    doc = {
        "title": payload.get("title"),
        "description": payload.get("description"),
        "meetingLink": payload.get("meetingLink"),
        "platform": payload.get("platform", "Google Meet"),
        "scheduledDate": scheduled_date,
        "scheduledTime": payload.get("scheduledTime"),
        "duration": int(payload.get("duration") or 60),
        "createdBy": ObjectId(current_user["_id"]),
        "host": ObjectId(teacher_host) if teacher_host else None,
        "targetingType": payload.get("targetingType", "class"),
        "classDetails": payload.get("classDetails"),
        "departments": payload.get("departments", []),
        "roles": roles_targeted,
        "individuals": [ObjectId(x) for x in payload.get("individuals", [])],
        "isRecurring": payload.get("isRecurring", False),
        "recurringPattern": payload.get("recurringPattern"),
        "status": "Scheduled",
        "attendees": [],
        "totalTargeted": 0,
        "totalAttended": 0,
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    subject = payload.get("subject")
    if subject:
        doc["subject"] = ObjectId(subject)

    # Calculate total targeted
    targeted_count = 0
    targeting_type = doc["targetingType"]
    class_details = doc["classDetails"]
    
    if targeting_type == 'class' and class_details:
        targeted_count = await db.students.count_documents({
            "department": class_details.get("department"),
            "semester": int(class_details.get("semester") or 1),
            "section": class_details.get("section"),
            "isActive": True
        })
    elif targeting_type == 'department':
        targeted_count = await db.students.count_documents({
            "department": {"$in": doc["departments"]},
            "isActive": True
        })
    elif targeting_type == 'role':
        targeted_count = await db.users.count_documents({
            "role": {"$in": doc["roles"]},
            "isActive": True
        })
    elif targeting_type == 'individuals':
        targeted_count = len(doc["individuals"])

    doc["totalTargeted"] = targeted_count

    res = await db.virtualmeetings.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/meetings/my-meetings  ← MUST be before /{meeting_id}
@router.get("/meetings/my-meetings")
async def get_my_meetings(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    
    if role == 'teacher':
        teacher = await db.teachers.find_one({"user": ObjectId(current_user["_id"])})
        teacher_id = teacher["_id"] if teacher else None
        teacher_dept = teacher.get("department") if teacher else None

        or_conditions = [
            {"createdBy": ObjectId(current_user["_id"])},
            {"roles": "teacher"},
            {"roles": {"$in": ["teacher"]}},
            {"targetingType": "class"},
            {"targetingType": "role", "roles": "teacher"},
            {"individuals": ObjectId(current_user["_id"])}
        ]
        if teacher_id:
            or_conditions.append({"host": teacher_id})
        if teacher_dept:
            or_conditions.append({"departments": teacher_dept})
            or_conditions.append({"classDetails.department": teacher_dept})

        meetings = await db.virtualmeetings.find({
            "isActive": True,
            "$or": or_conditions
        }).sort([("scheduledDate", -1), ("scheduledTime", -1)]).to_list(100)
    elif role in ['superadmin', 'super_admin', 'admin']:
        meetings = await db.virtualmeetings.find({
            "isActive": True
        }).sort([("scheduledDate", -1), ("scheduledTime", -1)]).to_list(100)
    else:
        meetings = await db.virtualmeetings.find({
            "$or": [
                {"createdBy": ObjectId(current_user["_id"])},
                {"roles": role},
                {"roles": {"$in": [role]}},
                {"individuals": ObjectId(current_user["_id"])}
            ],
            "isActive": True
        }).sort([("scheduledDate", -1), ("scheduledTime", -1)]).to_list(100)

    populated = []
    for m in meetings:
        populated.append(await populate_meeting(m))
        
    return {"success": True, "data": serialize_doc(populated)}

# @route   GET /api/meetings/my-class-meetings  ← MUST be before /{meeting_id}
@router.get("/meetings/my-class-meetings")
async def get_my_class_meetings(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    
    if role == 'teacher':
        teacher = await db.teachers.find_one({"user": ObjectId(current_user["_id"])})
        teacher_dept = teacher.get("department") if teacher else None
        
        or_conditions = [
            {"targetingType": "class"},
            {"targetingType": "role", "roles": "teacher"},
            {"roles": "teacher"},
            {"roles": {"$in": ["teacher"]}}
        ]
        if teacher_dept:
            or_conditions.append({"departments": teacher_dept})
            or_conditions.append({"classDetails.department": teacher_dept})

        meetings = await db.virtualmeetings.find({
            "isActive": True,
            "$or": or_conditions
        }).sort([("scheduledDate", 1), ("scheduledTime", 1)]).to_list(100)
    else:
        meetings = await db.virtualmeetings.find({
            "isActive": True
        }).sort([("scheduledDate", 1), ("scheduledTime", 1)]).to_list(100)

    populated = []
    for m in meetings:
        populated.append(await populate_meeting(m))
        
    return {"success": True, "data": serialize_doc(populated)}

# @route   GET /api/meetings/analytics  ← MUST be before /{meeting_id}
@router.get("/meetings/analytics")
async def get_meetings_analytics(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"isActive": True}
    if startDate and endDate:
        try:
            from datetime import timedelta
            start_dt = datetime.fromisoformat(startDate.replace("Z", ""))
            end_dt = datetime.fromisoformat(endDate.replace("Z", ""))
            query["scheduledDate"] = {"$gte": start_dt, "$lte": end_dt}
        except:
            pass
    total = await db.virtualmeetings.count_documents(query)
    completed = await db.virtualmeetings.count_documents({**query, "status": "Completed"})
    ongoing = await db.virtualmeetings.count_documents({**query, "status": "Ongoing"})
    scheduled = await db.virtualmeetings.count_documents({**query, "status": "Scheduled"})
    cancelled = await db.virtualmeetings.count_documents({**query, "status": "Cancelled"})
    pipeline = [{"$group": {"_id": None, "totalAttended": {"$sum": "$totalAttended"}, "totalTargeted": {"$sum": "$totalTargeted"}}}]
    agg = await db.virtualmeetings.aggregate(pipeline).to_list(1)
    agg_data = agg[0] if agg else {"totalAttended": 0, "totalTargeted": 0}
    attendance_rate = round(
        (agg_data["totalAttended"] / agg_data["totalTargeted"] * 100)
        if agg_data.get("totalTargeted", 0) > 0 else 0, 1
    )
    return {
        "success": True,
        "data": {
            "total": total,
            "completed": completed,
            "ongoing": ongoing,
            "scheduled": scheduled,
            "cancelled": cancelled,
            "totalAttended": agg_data["totalAttended"],
            "totalTargeted": agg_data["totalTargeted"],
            "attendanceRate": attendance_rate
        }
    }

# @route   GET /api/meetings/upcoming  ← MUST be before /{meeting_id}
@router.get("/meetings/upcoming")
async def get_upcoming_meetings(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    base_query = {
        "scheduledDate": {"$gte": today},
        "status": {"$in": ["Scheduled", "Ongoing"]},
        "isActive": True
    }
    
    role = current_user.get("role")
    targeting_query = []
    
    if role == 'student':
        student = await db.students.find_one({"user": ObjectId(current_user["_id"])})
        if not student:
            return {"success": False, "message": "Student profile not found"}
            
        targeting_query = [
            {
                "targetingType": "class",
                "classDetails.department": student.get("department"),
                "classDetails.semester": student.get("semester"),
                "classDetails.section": student.get("section")
            },
            {
                "targetingType": "department",
                "departments": student.get("department")
            },
            {
                "targetingType": "role",
                "roles": "student"
            },
            {
                "targetingType": "individuals",
                "individuals": ObjectId(current_user["_id"])
            }
        ]
    elif role == 'parent':
        parent = await db.parents.find_one({"user": ObjectId(current_user["_id"])})
        if not parent:
            return {"success": False, "message": "Parent profile not found"}
            
        wards_ids = parent.get("students", [])
        if wards_ids:
            wards = await db.students.find({"_id": {"$in": [ObjectId(wid) for wid in wards_ids]}, "isActive": True}).to_list(20)
            ward_queries = []
            for w in wards:
                ward_queries.extend([
                    {
                        "targetingType": "class",
                        "classDetails.department": w.get("department"),
                        "classDetails.semester": w.get("semester"),
                        "classDetails.section": w.get("section")
                    },
                    {
                        "targetingType": "department",
                        "departments": w.get("department")
                    }
                ])
            targeting_query = ward_queries + [
                {"targetingType": "role", "roles": "parent"},
                {"targetingType": "individuals", "individuals": ObjectId(current_user["_id"])}
            ]
        else:
            targeting_query = [
                {"targetingType": "role", "roles": "parent"},
                {"targetingType": "individuals", "individuals": ObjectId(current_user["_id"])}
            ]
    elif role in ['teacher', 'admin', 'super_admin']:
        meetings = await db.virtualmeetings.find(base_query).sort([("scheduledDate", 1), ("scheduledTime", 1)]).to_list(100)
        populated = []
        for m in meetings:
            populated.append(await populate_meeting(m))
        return {"success": True, "data": serialize_doc(populated)}
    else:
        return {"success": True, "data": []}
        
    if targeting_query:
        query = {
            "$and": [
                base_query,
                {"$or": targeting_query}
            ]
        }
    else:
        query = base_query

    meetings = await db.virtualmeetings.find(query).sort([("scheduledDate", 1), ("scheduledTime", 1)]).to_list(100)
    populated = []
    for m in meetings:
        populated.append(await populate_meeting(m))
        
    return {"success": True, "data": serialize_doc(populated)}

# @route   GET /api/meetings/:id  ← AFTER all static routes
@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")
    m = await db.virtualmeetings.find_one({"_id": obj_id})
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"success": True, "data": serialize_doc(await populate_meeting(m))}

# @route   PUT /api/meetings/:id
@router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")

    existing_meeting = await db.virtualmeetings.find_one({"_id": obj_id})
    if not existing_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    user_role = current_user.get("role")
    creator_id = str(existing_meeting.get("createdBy")) if existing_meeting.get("createdBy") else None

    # Fetch creator user details to check creator's role
    creator_user = await db.users.find_one({"_id": existing_meeting.get("createdBy")}) if existing_meeting.get("createdBy") else None
    creator_role = creator_user.get("role") if creator_user else None

    # Permission check:
    # 1. SuperAdmin meeting can only be updated by SuperAdmin
    if creator_role in ["superadmin", "super_admin"] and user_role not in ["superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only SuperAdmin can edit meetings created by SuperAdmin")

    # 2. Teacher can only edit meetings created by themselves
    if user_role == "teacher" and creator_id != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Teachers can only edit their own meetings")

    update_data = {}
    for f in ["title", "description", "meetingLink", "duration", "isActive", "status", "platform", "scheduledTime"]:
        if f in payload:
            update_data[f] = payload[f]
    if "scheduledDate" in payload:
        try:
            update_data["scheduledDate"] = datetime.fromisoformat(payload["scheduledDate"].replace("Z", ""))
        except:
            pass
    if update_data:
        await db.virtualmeetings.update_one({"_id": obj_id}, {"$set": update_data})
    updated = await db.virtualmeetings.find_one({"_id": obj_id})
    return {"success": True, "data": serialize_doc(await populate_meeting(updated))}

# @route   DELETE /api/meetings/:id
@router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")

    existing_meeting = await db.virtualmeetings.find_one({"_id": obj_id})
    if not existing_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    user_role = current_user.get("role")
    creator_id = str(existing_meeting.get("createdBy")) if existing_meeting.get("createdBy") else None

    creator_user = await db.users.find_one({"_id": existing_meeting.get("createdBy")}) if existing_meeting.get("createdBy") else None
    creator_role = creator_user.get("role") if creator_user else None

    # Permission check:
    # 1. SuperAdmin meeting can only be cancelled/deleted by SuperAdmin
    if creator_role in ["superadmin", "super_admin"] and user_role not in ["superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only SuperAdmin can cancel meetings created by SuperAdmin")

    # 2. Teacher can only cancel meetings created by themselves
    if user_role == "teacher" and creator_id != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Teachers can only cancel their own meetings")

    await db.virtualmeetings.update_one({"_id": obj_id}, {"$set": {"isActive": False, "status": "Cancelled"}})
    return {"success": True, "message": "Meeting cancelled successfully"}

# @route   POST /api/meetings/:id/join
@router.post("/meetings/{meeting_id}/join")
async def join_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)):
    m = await db.virtualmeetings.find_one({"_id": ObjectId(meeting_id)})
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    attendees = m.get("attendees", [])
    already_joined = False
    for a in attendees:
        if str(a.get("user")) == current_user["_id"]:
            already_joined = True
            break
            
    if not already_joined:
        attendees.append({
            "user": ObjectId(current_user["_id"]),
            "joinedAt": datetime.utcnow()
        })
        status_val = m.get("status", "Scheduled")
        if status_val == "Scheduled":
            status_val = "Ongoing"
        await db.virtualmeetings.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "attendees": attendees,
                "totalAttended": len(attendees),
                "status": status_val
            }}
        )
        
    return {"success": True, "message": "Attendance marked successfully", "meetingLink": m.get("meetingLink")}
