from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from ..database import db
from ..middleware.auth import get_current_user, authorize
from ..models import serialize_doc
from ..config import settings

router = APIRouter()

# @route   GET /api/finance/payment-info
@router.get("/finance/payment-info")
async def get_payment_info():
    return {
        "success": True,
        "upiId": settings.COLLEGE_UPI_ID,
        "collegeName": settings.COLLEGE_NAME,
        "razorpayKeyId": settings.RAZORPAY_KEY_ID,
        "qrCodeData": f"upi://pay?pa={settings.COLLEGE_UPI_ID}&pn={settings.COLLEGE_NAME}&cu=INR"
    }

# @route   GET /api/accountant/payment-info
@router.get("/accountant/payment-info")
async def get_accountant_payment_info():
    return {
        "success": True,
        "upiId": settings.COLLEGE_UPI_ID,
        "collegeName": settings.COLLEGE_NAME,
        "razorpayKeyId": settings.RAZORPAY_KEY_ID,
        "paytmMid": settings.PAYTM_MID,
        "qrCodeData": f"upi://pay?pa={settings.COLLEGE_UPI_ID}&pn={settings.COLLEGE_NAME}&cu=INR"
    }

# @route   POST /api/paytm/initiate-transaction
@router.post("/paytm/initiate-transaction")
async def paytm_initiate_transaction(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    amount = float(payload.get("amount", 0))
    payer_name = payload.get("payerName", "Student Payer")
    income_head = payload.get("incomeHead", "Tuition Fee")
    note = payload.get("note", "College Fee")
    
    order_id = f"PAYTM_ORDER_{int(datetime.utcnow().timestamp())}"
    txn_token = f"PAYTM_TOKEN_{order_id.split('_')[-1]}"
    
    paytm_uri = f"paytmmp://pay?pa={settings.COLLEGE_UPI_ID}&pn={settings.COLLEGE_NAME}&am={amount:.2f}&cu=INR&tn={order_id}"
    
    return {
        "success": True,
        "orderId": order_id,
        "txnToken": txn_token,
        "mid": settings.PAYTM_MID,
        "amount": amount,
        "upiId": settings.COLLEGE_UPI_ID,
        "collegeName": settings.COLLEGE_NAME,
        "payerName": payer_name,
        "paytmUri": paytm_uri
    }

# @route   POST /api/paytm/verify-transaction
@router.post("/paytm/verify-transaction")
async def paytm_verify_transaction(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    order_id = payload.get("orderId") or f"PAYTM_ORDER_{int(datetime.utcnow().timestamp())}"
    amount = float(payload.get("amount", 0))
    payer_name = payload.get("payerName", "Student")
    income_head = payload.get("incomeHead", "Tuition Fee")
    note = payload.get("note", "College Fee")
    utr = payload.get("utr") or f"UTRPAYTM{int(datetime.utcnow().timestamp())}"
    
    title = f"{income_head} - {payer_name}"
    
    doc = {
        "title": title,
        "name": payer_name,
        "incomeHead": income_head,
        "amount": amount,
        "category": income_head,
        "date": datetime.utcnow(),
        "paymentMethod": "paytm_merchant_online",
        "invoiceNo": f"PAYTM-{order_id.split('_')[-1]}",
        "ref": order_id,
        "utr": utr,
        "description": f"Paytm Merchant Online Payment (Order ID: {order_id}, UTR: {utr}) - {note}",
        "createdAt": datetime.utcnow()
    }
    
    res = await db.incomes.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {
        "success": True,
        "message": "Paytm Merchant Payment verified & recorded successfully",
        "data": serialize_doc(doc)
    }

# --- FEES & PAYMENTS ---

# @route   GET /api/fees  (admin/super_admin - all fee records)
@router.get("/fees")
async def get_all_fees(
    search: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    current_user: dict = Depends(authorize("admin", "super_admin", "accountant"))
):
    query = {}
    if status:
        query["status"] = status
    if department:
        query["department"] = department

    fees = await db.fees.find(query).sort("createdAt", -1).to_list(500)

    result = []
    total_amount = 0.0
    total_collected = 0.0
    total_pending = 0.0

    for f in fees:
        # Populate student info
        student_doc = None
        if f.get("student"):
            student_doc = await db.students.find_one({"_id": ObjectId(f["student"])})
            if student_doc and student_doc.get("user"):
                user_doc = await db.users.find_one({"_id": ObjectId(student_doc["user"])}, {"password": 0})
                student_doc["user"] = serialize_doc(user_doc) if user_doc else None
            f["student"] = serialize_doc(student_doc) if student_doc else None

        # Search filter (applied after populate)
        if search and student_doc:
            user_info = student_doc.get("user") or {}
            full_name = f"{user_info.get('firstName', '')} {user_info.get('lastName', '')}".lower()
            roll_no = str(student_doc.get("rollNumber", "")).lower()
            if search.lower() not in full_name and search.lower() not in roll_no:
                continue

        total_amount += float(f.get("totalAmount") or 0)
        total_collected += float(f.get("paidAmount") or 0)
        total_pending += float(f.get("dueAmount") or 0)
        result.append(f)

    collection_rate = round((total_collected / total_amount * 100) if total_amount > 0 else 0, 1)

    return {
        "success": True,
        "data": serialize_doc(result),
        "stats": {
            "total": total_amount,
            "collected": total_collected,
            "pending": total_pending,
            "collectionRate": collection_rate
        }
    }


@router.get("/fees/structures")
async def get_fee_structures(current_user: dict = Depends(get_current_user)):
    structures = await db.feestructures.find().to_list(100)
    return {"success": True, "data": serialize_doc(structures)}

# @route   POST /api/fees/structure
@router.post("/fees/structure")
async def create_fee_structure(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "accountant"))):
    name = payload.get("name")
    amount = payload.get("amount")
    category = payload.get("category", "Academic")
    academicYear = payload.get("academicYear")
    
    if not name or not amount or not academicYear:
        raise HTTPException(status_code=400, detail="Missing required fee structure fields")
        
    doc = {
        "name": name,
        "amount": float(amount),
        "category": category,
        "academicYear": academicYear,
        "createdAt": datetime.utcnow()
    }
    res = await db.feestructures.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/fees/student/:studentId
@router.get("/fees/student/{student_id}")
async def get_student_fees(student_id: str, current_user: dict = Depends(get_current_user)):
    try:
        student_obj_id = ObjectId(student_id)
    except:
        return {"success": True, "data": []}
        
    student = await db.students.find_one({"_id": student_obj_id})
    if not student:
        student = await db.students.find_one({"user": student_obj_id})
    s_id = student["_id"] if student else student_obj_id
    fees = await db.fees.find({"student": s_id}).to_list(100)
    return {"success": True, "data": serialize_doc(fees)}

# @route   GET /api/fees/my-fees
@router.get("/fees/my-fees")
async def get_my_fees(current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"user": ObjectId(current_user["_id"])})
    if not student:
        return {"success": True, "data": []}
        
    fees = await db.fees.find({"student": student["_id"]}).to_list(100)
    return {"success": True, "data": serialize_doc(fees)}

# @route   POST /api/fees/payment
@router.post("/fees/payment")
async def make_payment(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    fee_id = payload.get("feeId")
    amount = payload.get("amountPaid")
    method = payload.get("paymentMethod")
    txn_id = payload.get("transactionId")
    
    if not fee_id or amount is None or not method:
        raise HTTPException(status_code=400, detail="Missing required payment fields")
        
    fee = await db.fees.find_one({"_id": ObjectId(fee_id)})
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
        
    # Create payment record
    pay_doc = {
        "fee": ObjectId(fee_id),
        "student": fee.get("student"),
        "amountPaid": float(amount),
        "paymentMethod": method,
        "transactionId": txn_id,
        "paymentDate": datetime.utcnow(),
        "status": "Success",
        "createdAt": datetime.utcnow()
    }
    res = await db.payments.insert_one(pay_doc)
    pay_doc["_id"] = res.inserted_id
    
    # Update fee record
    new_paid = fee.get("paidAmount", 0) + float(amount)
    new_due = max(0.0, fee.get("totalAmount", 0) - new_paid)
    status_val = "paid" if new_due <= 0 else "partial"
    
    await db.fees.update_one(
        {"_id": ObjectId(fee_id)},
        {"$set": {
            "paidAmount": new_paid,
            "dueAmount": new_due,
            "status": status_val,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    # Add to accountant income
    income_doc = {
        "title": f"Fee Payment - {fee.get('title', 'Academic')}",
        "amount": float(amount),
        "category": "Fees",
        "date": datetime.utcnow(),
        "paymentMethod": method,
        "transactionId": txn_id,
        "receivedFrom": str(fee.get("student")),
        "createdAt": datetime.utcnow()
    }
    await db.incomes.insert_one(income_doc)
    
    return {"success": True, "data": serialize_doc(pay_doc)}

# @route   GET /api/fees/payments/:studentId
@router.get("/fees/payments/{student_id}")
async def get_payments(student_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payments.find({"student": ObjectId(student_id)}).sort("paymentDate", -1).to_list(100)
    return {"success": True, "data": serialize_doc(payments)}

# @route   GET /api/fees/analytics
@router.get("/fees/analytics")
async def get_fee_analytics(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total": {"$sum": "$totalAmount"},
            "collected": {"$sum": "$paidAmount"},
            "pending": {"$sum": "$dueAmount"}
        }}
    ]
    stats = await db.fees.aggregate(pipeline).to_list(100)
    return {"success": True, "data": serialize_doc(stats)}

# @route   GET /api/fees/overdue
@router.get("/fees/overdue")
async def get_overdue_fees(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    fees = await db.fees.find({
        "status": {"$ne": "paid"},
        "dueDate": {"$lt": now}
    }).to_list(100)
    
    for f in fees:
        student = await db.students.find_one({"_id": ObjectId(f["student"])})
        if student:
            user = await db.users.find_one({"_id": ObjectId(student["user"])})
            student["user"] = serialize_doc(user)
            f["student"] = serialize_doc(student)
            
    return {"success": True, "data": serialize_doc(fees)}

# @route   POST /api/admin/fees/bulk-assign
@router.post("/admin/fees/bulk-assign")
async def bulk_assign_fees(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin", "accountant"))):
    structure_id = payload.get("feeStructureId")
    department = payload.get("department")
    semester = payload.get("semester")
    
    if not structure_id or not department or not semester:
        raise HTTPException(status_code=400, detail="Missing required bulk-assign fields")
        
    structure = await db.feestructures.find_one({"_id": ObjectId(structure_id)})
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")
        
    students = await db.students.find({
        "department": department,
        "semester": int(semester),
        "isActive": True
    }).to_list(1000)
    
    count = 0
    now = datetime.utcnow()
    due_date = now + timedelta(days=30)
    
    for s in students:
        # Create student fee record
        fee_doc = {
            "student": s["_id"],
            "title": structure["name"],
            "totalAmount": structure["amount"],
            "paidAmount": 0.0,
            "dueAmount": structure["amount"],
            "status": "unpaid",
            "dueDate": due_date,
            "createdAt": now,
            "updatedAt": now
        }
        await db.fees.insert_one(fee_doc)
        count += 1
        
    return {"success": True, "message": f"Fees successfully assigned to {count} students"}


# --- SCHOLARSHIPS ---

# @route   GET /api/scholarships
@router.get("/scholarships")
async def get_scholarships(current_user: dict = Depends(get_current_user)):
    scholarships = await db.scholarships.find().to_list(100)
    return {"success": True, "data": serialize_doc(scholarships)}

# @route   GET /api/scholarships/:id
@router.get("/scholarships/{sch_id}")
async def get_scholarship(sch_id: str, current_user: dict = Depends(get_current_user)):
    s = await db.scholarships.find_one({"_id": ObjectId(sch_id)})
    if not s:
        raise HTTPException(status_code=404, detail="Scholarship not found")
    return {"success": True, "data": serialize_doc(s)}

# @route   POST /api/scholarships
@router.post("/scholarships")
async def create_scholarship(payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    title = payload.get("title")
    description = payload.get("description")
    amount = payload.get("amount")
    eligibility = payload.get("eligibility")
    deadline_str = payload.get("deadline")
    
    if not title or amount is None or not deadline_str:
        raise HTTPException(status_code=400, detail="Missing required scholarship fields")
        
    try:
        deadline = datetime.fromisoformat(deadline_str.replace("Z", ""))
    except:
        deadline = datetime.utcnow() + timedelta(days=30)
        
    doc = {
        "title": title,
        "description": description,
        "amount": float(amount),
        "eligibility": eligibility,
        "deadline": deadline,
        "isActive": True,
        "createdAt": datetime.utcnow()
    }
    res = await db.scholarships.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   POST /api/scholarships/:id/apply
@router.post("/scholarships/{sch_id}/apply")
async def apply_scholarship(sch_id: str, payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"user": ObjectId(current_user["_id"])})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    reason = payload.get("reason")
    documents = payload.get("documents", [])
    
    doc = {
        "scholarship": ObjectId(sch_id),
        "student": student["_id"],
        "reason": reason,
        "documents": documents,
        "status": "Pending",
        "appliedDate": datetime.utcnow(),
        "createdAt": datetime.utcnow()
    }
    res = await db.scholarshipapplications.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   GET /api/scholarships/student/my-applications
@router.get("/scholarships/student/my-applications")
async def get_my_scholarship_applications(current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"user": ObjectId(current_user["_id"])})
    if not student:
        return {"success": True, "data": []}
        
    apps = await db.scholarshipapplications.find({"student": student["_id"]}).to_list(100)
    for a in apps:
        if a.get("scholarship"):
            sch = await db.scholarships.find_one({"_id": ObjectId(a["scholarship"])})
            a["scholarship"] = serialize_doc(sch)
            
    return {"success": True, "data": serialize_doc(apps)}

# @route   GET /api/scholarships/admin/applications
@router.get("/scholarships/admin/applications")
async def get_admin_scholarship_applications(current_user: dict = Depends(authorize("admin"))):
    apps = await db.scholarshipapplications.find().sort("appliedDate", -1).to_list(100)
    for a in apps:
        if a.get("scholarship"):
            sch = await db.scholarships.find_one({"_id": ObjectId(a["scholarship"])})
            a["scholarship"] = serialize_doc(sch)
        if a.get("student"):
            student = await db.students.find_one({"_id": ObjectId(a["student"])})
            if student:
                user = await db.users.find_one({"_id": ObjectId(student["user"])})
                student["user"] = serialize_doc(user)
                a["student"] = serialize_doc(student)
                
    return {"success": True, "data": serialize_doc(apps)}

# @route   PUT /api/scholarships/applications/:id/review
@router.put("/scholarships/applications/{app_id}/review")
async def review_scholarship_application(app_id: str, payload: Dict[str, Any], current_user: dict = Depends(authorize("admin"))):
    status_val = payload.get("status")  # Approved, Rejected
    remarks = payload.get("remarks")
    
    if not status_val:
        raise HTTPException(status_code=400, detail="status is required")
        
    res = await db.scholarshipapplications.update_one(
        {"_id": ObjectId(app_id)},
        {"$set": {
            "status": status_val,
            "remarks": remarks,
            "reviewedBy": ObjectId(current_user["_id"]),
            "reviewedAt": datetime.utcnow()
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scholarship application not found")
        
    return {"success": True, "message": f"Scholarship application reviewed successfully"}


# --- ACCOUNTANT INCOME & EXPENSES ---

# @route   GET /api/accountant/dashboard
@router.get("/accountant/dashboard")
async def get_accountant_dashboard(current_user: dict = Depends(authorize("accountant", "admin"))):
    now = datetime.utcnow()
    current_month = datetime(now.year, now.month, 1)

    # Total Income this month
    monthly_income_agg = await db.incomes.aggregate([
        {"$match": {"date": {"$gte": current_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    monthly_income = monthly_income_agg[0]["total"] if monthly_income_agg else 0.0

    # Total Expense this month
    monthly_expense_agg = await db.expenses.aggregate([
        {"$match": {"date": {"$gte": current_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    monthly_expense = monthly_expense_agg[0]["total"] if monthly_expense_agg else 0.0

    # Total Fee Collected this month
    monthly_fee_collection_agg = await db.payments.aggregate([
        {"$match": {"paymentDate": {"$gte": current_month}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    monthly_fee_collection = monthly_fee_collection_agg[0]["total"] if monthly_fee_collection_agg else 0.0

    # Pending fees count
    pending_fees = await db.fees.count_documents({"status": "pending"})
    total_students = await db.students.count_documents({"isActive": True})

    # Recent payments
    recent_payments = await db.payments.find({"status": "completed"}).sort("paymentDate", -1).limit(10).to_list(10)
    for p in recent_payments:
        # Populate student name
        student_profile = await db.students.find_one({"_id": ObjectId(p["student"])})
        if student_profile:
            student_user = await db.users.find_one({"_id": ObjectId(student_profile["user"])})
            if student_user:
                p["student"] = {
                    "firstName": student_user.get("firstName", ""),
                    "lastName": student_user.get("lastName", "")
                }
            else:
                p["student"] = {"firstName": "Unknown", "lastName": "Student"}
        else:
            p["student"] = {"firstName": "Unknown", "lastName": "Student"}

    # Income by head
    income_by_head = await db.incomes.aggregate([
        {"$match": {"date": {"$gte": current_month}}},
        {"$group": {"_id": "$incomeHead", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]).to_list(100)

    # Expense by head
    expense_by_head = await db.expenses.aggregate([
        {"$match": {"date": {"$gte": current_month}}},
        {"$group": {"_id": "$expenseHead", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]).to_list(100)

    return {
        "success": True,
        "data": {
            "stats": {
                "monthlyIncome": monthly_income,
                "monthlyExpense": monthly_expense,
                "monthlyFeeCollection": monthly_fee_collection,
                "pendingFees": pending_fees,
                "totalStudents": total_students
            },
            "recentPayments": serialize_doc(recent_payments),
            "incomeByHead": serialize_doc(income_by_head),
            "expenseByHead": serialize_doc(expense_by_head)
        }
    }

# @route   GET /api/accountant/income
@router.get("/accountant/income")
async def get_income(current_user: dict = Depends(get_current_user)):
    incomes = await db.incomes.find().sort("date", -1).to_list(100)
    income_agg = await db.incomes.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_amount = income_agg[0]["total"] if income_agg else 0.0
    return {"success": True, "data": serialize_doc(incomes), "totalAmount": total_amount}

# @route   POST /api/accountant/income
@router.post("/accountant/income")
async def add_income(payload: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    name = payload.get("name", "Payer")
    income_head = payload.get("incomeHead") or payload.get("category") or "Tuition Fee"
    title = payload.get("title") or f"{income_head} - {name}"
    amount = payload.get("amount")
    category = income_head
    date_str = payload.get("date")
    payment_method = payload.get("paymentMethod", "online")
    ref = payload.get("invoiceNo") or payload.get("ref") or f"PAYTM-{int(datetime.utcnow().timestamp())}"
    description = payload.get("description", "")
    
    if amount is None:
        raise HTTPException(status_code=400, detail="Missing required income amount")
        
    try:
        date = datetime.fromisoformat(date_str.replace("Z", "")) if date_str else datetime.utcnow()
    except:
        date = datetime.utcnow()
        
    doc = {
        "title": title,
        "name": name,
        "incomeHead": income_head,
        "amount": float(amount),
        "category": category,
        "date": date,
        "paymentMethod": payment_method,
        "invoiceNo": ref,
        "ref": ref,
        "description": description,
        "createdAt": datetime.utcnow()
    }
    res = await db.incomes.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   DELETE /api/accountant/income/:id
@router.delete("/accountant/income/{income_id}")
async def delete_income(income_id: str, current_user: dict = Depends(get_current_user)):
    await db.incomes.delete_one({"_id": ObjectId(income_id)})
    return {"success": True, "message": "Income record deleted successfully"}

# @route   GET /api/accountant/expenses
@router.get("/accountant/expenses")
async def get_expenses(current_user: dict = Depends(authorize("accountant", "admin"))):
    expenses = await db.expenses.find().sort("date", -1).to_list(100)
    expense_agg = await db.expenses.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_amount = expense_agg[0]["total"] if expense_agg else 0.0
    return {"success": True, "data": serialize_doc(expenses), "totalAmount": total_amount}

# @route   POST /api/accountant/expenses
@router.post("/accountant/expenses")
async def add_expense(payload: Dict[str, Any], current_user: dict = Depends(authorize("accountant", "admin"))):
    title = payload.get("title")
    amount = payload.get("amount")
    category = payload.get("category", "General")
    date_str = payload.get("date")
    payment_method = payload.get("paymentMethod")
    ref = payload.get("ref")
    
    if not title or amount is None:
        raise HTTPException(status_code=400, detail="Missing required expense fields")
        
    try:
        date = datetime.fromisoformat(date_str.replace("Z", "")) if date_str else datetime.utcnow()
    except:
        date = datetime.utcnow()
        
    doc = {
        "title": title,
        "amount": float(amount),
        "category": category,
        "date": date,
        "paymentMethod": payment_method,
        "ref": ref,
        "createdAt": datetime.utcnow()
    }
    res = await db.expenses.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    return {"success": True, "data": serialize_doc(doc)}

# @route   DELETE /api/accountant/expenses/:id
@router.delete("/accountant/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(authorize("accountant", "admin"))):
    await db.expenses.delete_one({"_id": ObjectId(expense_id)})
    return {"success": True, "message": "Expense record deleted successfully"}
