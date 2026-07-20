from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import os

from ..database import db
from ..middleware.auth import get_current_user, authorize
from ..models import serialize_doc

router = APIRouter()

# --- LIBRARY MANAGEMENT ---

# @route   GET /api/library/dashboard
@router.get("/library/dashboard")
async def get_library_dashboard(current_user: dict = Depends(authorize("librarian", "admin"))):
    total_books = await db.books.count_documents({})
    total_issued = await db.bookissues.count_documents({"status": "issued"})
    
    now = datetime.utcnow()
    overdue_books = await db.bookissues.count_documents({
        "status": "issued",
        "dueDate": {"$lt": now}
    })
    
    fine_agg = await db.bookissues.aggregate([
        {"$match": {"fine": {"$gt": 0}, "finePaid": True}},
        {"$group": {"_id": None, "total": {"$sum": "$fine"}}}
    ]).to_list(1)
    total_fine_collected = fine_agg[0]["total"] if fine_agg else 0
    
    recent_issues = await db.bookissues.find().sort("createdAt", -1).limit(10).to_list(10)
    for i in recent_issues:
        if i.get("book"):
            book = await db.books.find_one({"_id": ObjectId(i["book"])})
            i["book"] = serialize_doc(book)
        if i.get("student"):
            # student in bookissues references User object ID
            user = await db.users.find_one({"_id": ObjectId(i["student"])})
            i["student"] = serialize_doc(user)
            
    return {
        "success": True,
        "data": {
            "stats": {
                "totalBooks": total_books,
                "totalIssued": total_issued,
                "overdueBooks": overdue_books,
                "totalFineCollected": total_fine_collected
            },
            "recentIssues": serialize_doc(recent_issues)
        }
    }

# @route   GET /api/library/books
@router.get("/library/books")
async def get_books(search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"author": {"$regex": search, "$options": "i"}},
            {"isbn": {"$regex": search, "$options": "i"}}
        ]
    books = await db.books.find(query).to_list(100)
    return {"success": True, "data": serialize_doc(books)}

# @route   POST /api/library/books
@router.post("/library/books")
async def add_book(payload: Dict[str, Any], current_user: dict = Depends(authorize("librarian", "admin"))):
    title = payload.get("title")
    author = payload.get("author")
    isbn = payload.get("isbn")
    publisher = payload.get("publisher")
    rack_number = payload.get("rackNumber")
    total_copies = payload.get("totalCopies", 1)
    
    if not title or not author:
        raise HTTPException(status_code=400, detail="Title and author are required")
        
    doc = {
        "title": title,
        "author": author,
        "isbn": isbn,
        "publisher": publisher,
        "rackNumber": rack_number,
        "totalCopies": int(total_copies),
        "availableCopies": int(total_copies),
        "createdAt": datetime.utcnow()
    }
    res = await db.books.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   PUT /api/library/books/:id
@router.put("/library/books/{book_id}")
async def update_book(book_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("librarian", "admin"))):
    update_data = {}
    for f in ["title", "author", "isbn", "publisher", "rackNumber", "totalCopies"]:
        if f in payload:
            if f == "totalCopies":
                update_data[f] = int(payload[f])
            else:
                update_data[f] = payload[f]
                
    if update_data:
        await db.books.update_one({"_id": ObjectId(book_id)}, {"$set": update_data})
        
    updated = await db.books.find_one({"_id": ObjectId(book_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/library/books/:id
@router.delete("/library/books/{book_id}")
async def delete_book(book_id: str, current_user: dict = Depends(authorize("librarian", "admin"))):
    await db.books.delete_one({"_id": ObjectId(book_id)})
    return {"success": True, "message": "Book deleted successfully"}

# @route   GET /api/library/eligible-users
@router.get("/library/eligible-users")
async def get_library_eligible_users(current_user: dict = Depends(authorize("librarian", "admin"))):
    # Returns users with student/teacher roles
    users = await db.users.find({"role": {"$in": ["student", "teacher"]}}, {"password": 0}).to_list(200)
    return {"success": True, "data": serialize_doc(users)}

# @route   GET /api/library/issues
@router.get("/library/issues")
async def get_library_issues(current_user: dict = Depends(get_current_user)):
    # If librarian or admin, return all. If student, return only their own issues
    role = current_user.get("role")
    query = {}
    if role not in ["librarian", "admin", "super_admin"]:
        query["student"] = ObjectId(current_user["_id"])
        
    issues = await db.bookissues.find(query).sort("issueDate", -1).to_list(100)
    for i in issues:
        if i.get("book"):
            book = await db.books.find_one({"_id": ObjectId(i["book"])})
            i["book"] = serialize_doc(book)
        if i.get("student"):
            user = await db.users.find_one({"_id": ObjectId(i["student"])})
            i["student"] = serialize_doc(user)
            
    return {"success": True, "data": serialize_doc(issues)}

# @route   POST /api/library/issue
@router.post("/library/issue")
async def issue_book(payload: Dict[str, Any], current_user: dict = Depends(authorize("librarian", "admin"))):
    book_id = payload.get("bookId")
    student_user_id = payload.get("studentId")  # references User id in book issues schema
    due_date_str = payload.get("dueDate")
    
    if not book_id or not student_user_id or not due_date_str:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    book = await db.books.find_one({"_id": ObjectId(book_id)})
    if not book or book.get("availableCopies", 0) <= 0:
        raise HTTPException(status_code=400, detail="Book is out of stock / not available")
        
    try:
        due_date = datetime.fromisoformat(due_date_str.replace("Z", ""))
    except:
        due_date = datetime.utcnow() + timedelta(days=14)
        
    issue_doc = {
        "book": ObjectId(book_id),
        "student": ObjectId(student_user_id),
        "issueDate": datetime.utcnow(),
        "dueDate": due_date,
        "returnDate": None,
        "fine": 0.0,
        "status": "issued",
        "createdAt": datetime.utcnow()
    }
    
    res = await db.bookissues.insert_one(issue_doc)
    issue_doc["_id"] = res.inserted_id
    
    # Update copies
    await db.books.update_one(
        {"_id": ObjectId(book_id)},
        {"$inc": {"availableCopies": -1}}
    )
    
    return {"success": True, "data": serialize_doc(issue_doc)}

# @route   PUT /api/library/return/:issueId
@router.put("/library/return/{issue_id}")
async def return_book(issue_id: str, current_user: dict = Depends(authorize("librarian", "admin"))):
    issue = await db.bookissues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(status_code=404, detail="Book issue record not found")
        
    if issue.get("returnDate") is not None:
        raise HTTPException(status_code=400, detail="Book already returned")
        
    # Calculate fine (if overdue)
    now = datetime.utcnow()
    fine = 0.0
    due = issue.get("dueDate")
    if due and now > due:
        days_late = (now - due).days
        fine = float(days_late * 5)  # 5 INR per day
        
    await db.bookissues.update_one(
        {"_id": ObjectId(issue_id)},
        {"$set": {
            "returnDate": now,
            "fine": fine,
            "status": "returned"
        }}
    )
    
    # Update copies
    await db.books.update_one(
        {"_id": ObjectId(issue["book"])},
        {"$inc": {"availableCopies": 1}}
    )
    
    return {"success": True, "message": "Book returned successfully", "fine": fine}

# @route   DELETE /api/library/issue/:id
@router.delete("/library/issue/{issue_id}")
async def delete_issue(issue_id: str, current_user: dict = Depends(authorize("librarian", "admin"))):
    await db.bookissues.delete_one({"_id": ObjectId(issue_id)})
    return {"success": True, "message": "Issue record deleted successfully"}


# --- FRONT OFFICE ---

# @route   GET /api/front-office/dashboard
@router.get("/api/front-office/dashboard")
@router.get("/front-office/dashboard")
async def get_front_office_dashboard(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    today_entries = await db.frontoffices.count_documents({"createdAt": {"$gte": today, "$lt": tomorrow}})
    total_inquiries = await db.frontoffices.count_documents({"type": "admission_inquiry"})
    open_complaints = await db.frontoffices.count_documents({"type": "complaint", "status": {"$ne": "closed"}})
    today_visitors = await db.frontoffices.count_documents({"type": "visitor", "createdAt": {"$gte": today, "$lt": tomorrow}})
    
    recent_entries = await db.frontoffices.find().sort("createdAt", -1).limit(10).to_list(10)
    
    # Entries by type today
    entries_by_type = await db.frontoffices.aggregate([
        {"$match": {"createdAt": {"$gte": today, "$lt": tomorrow}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    return {
        "success": True,
        "data": {
            "stats": {
                "todayEntries": today_entries,
                "totalInquiries": total_inquiries,
                "openComplaints": open_complaints,
                "todayVisitors": today_visitors
            },
            "recentEntries": serialize_doc(recent_entries),
            "entriesByType": serialize_doc(entries_by_type)
        }
    }

# @route   GET /api/front-office
@router.get("/front-office")
async def get_front_office_entries(current_user: dict = Depends(get_current_user)):
    entries = await db.frontoffices.find().sort("createdAt", -1).to_list(100)
    return {"success": True, "data": serialize_doc(entries)}

# @route   POST /api/front-office
@router.post("/front-office")
async def create_front_office_entry(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    visitor = payload.get("visitorName")
    phone = payload.get("phone")
    purpose = payload.get("purpose")
    note = payload.get("note")
    in_time = payload.get("inTime", datetime.utcnow().strftime("%I:%M %p"))
    
    if not visitor or not phone or not purpose:
        raise HTTPException(status_code=400, detail="visitorName, phone and purpose are required")
        
    doc = {
        "visitorName": visitor,
        "phone": phone,
        "purpose": purpose,
        "note": note,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "inTime": in_time,
        "outTime": None,
        "createdAt": datetime.utcnow()
    }
    res = await db.frontoffices.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   PUT /api/front-office/:id
@router.put("/front-office/{entry_id}")
async def update_front_office_entry(entry_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    update_data = {}
    for f in ["visitorName", "phone", "purpose", "note", "inTime", "outTime"]:
        if f in payload:
            update_data[f] = payload[f]
            
    if update_data:
        await db.frontoffices.update_one({"_id": ObjectId(entry_id)}, {"$set": update_data})
        
    updated = await db.frontoffices.find_one({"_id": ObjectId(entry_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/front-office/:id
@router.delete("/front-office/{entry_id}")
async def delete_front_office_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    await db.frontoffices.delete_one({"_id": ObjectId(entry_id)})
    return {"success": True, "message": "Front office entry deleted successfully"}

# @route   PUT /api/front-office/:id/checkout
@router.put("/front-office/{entry_id}/checkout")
async def checkout_visitor(entry_id: str, current_user: dict = Depends(get_current_user)):
    out_time = datetime.utcnow().strftime("%I:%M %p")
    await db.frontoffices.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {"outTime": out_time}}
    )
    return {"success": True, "message": "Visitor checked out successfully", "outTime": out_time}


# --- GALLERY ROUTING ---

# @route   GET /api/gallery
@router.get("/gallery")
async def get_gallery(current_user: dict = Depends(get_current_user)):
    gallery = await db.collegegalleries.find().sort("createdAt", -1).to_list(100)
    return {"success": True, "data": serialize_doc(gallery)}

# @route   GET /api/gallery/carousel
@router.get("/gallery/carousel")
async def get_gallery_carousel(current_user: dict = Depends(get_current_user)):
    carousel = await db.collegegalleries.find({"isFeatured": True}).sort("createdAt", -1).limit(5).to_list(5)
    return {"success": True, "data": serialize_doc(carousel)}

# @route   POST /api/gallery
@router.post("/gallery")
async def upload_gallery_image(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    isFeatured: bool = Form(False),
    file: UploadFile = File(...),
    current_user: dict = Depends(authorize("admin"))
):
    upload_dir = "uploads/gallery"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{int(datetime.now().timestamp())}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    doc = {
        "title": title,
        "description": description,
        "imageUrl": "/" + file_path.replace("\\", "/"),
        "isFeatured": isFeatured,
        "uploadedBy": ObjectId(current_user["_id"]),
        "createdAt": datetime.utcnow()
    }
    res = await db.collegegalleries.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   PUT /api/gallery/:id
@router.put("/gallery/{image_id}")
async def update_gallery(image_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    update_data = {}
    for f in ["title", "description", "isFeatured"]:
        if f in payload:
            update_data[f] = payload[f]
            
    if update_data:
        await db.collegegalleries.update_one({"_id": ObjectId(image_id)}, {"$set": update_data})
        
    updated = await db.collegegalleries.find_one({"_id": ObjectId(image_id)})
    return {"success": True, "data": serialize_doc(updated)}

# @route   DELETE /api/gallery/:id
@router.delete("/gallery/{image_id}")
async def delete_gallery(image_id: str, current_user: dict = Depends(authorize("admin"))):
    await db.collegegalleries.delete_one({"_id": ObjectId(image_id)})
    return {"success": True, "message": "Gallery item deleted successfully"}


# --- GENERAL COLLEGE INFO ---

# @route   GET /api/college-info
@router.get("/college-info")
async def get_college_info(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "name": "Samarth Group of Institutions",
            "departments": ["Computer Engineering", "Mechanical Engineering", "Civil Engineering", "Electrical Engineering", "Electronics Engineering", "Information Technology", "Artificial Intelligence and Machine Learning"],
            "established": 2010,
            "address": "Belhe, Pune, Maharashtra",
            "placementRate": "95%",
            "website": "https://www.samarth.edu.in"
        }
    }
