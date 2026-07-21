import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
import json
from typing import Optional

from ..database import db
from ..middleware.auth import get_current_user, authorize
from ..models import serialize_doc
from ..config import settings

router = APIRouter()

async def call_groq(system_prompt: str, user_prompt: str) -> str:
    groq_api_key = settings.GROQ_API_KEY
    if not groq_api_key:
        raise Exception("GROQ_API_KEY not configured")
        
    groq_api_url = 'https://api.groq.com/openai/v1/chat/completions'
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            groq_api_url,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {groq_api_key}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.4,
                "max_tokens": 1200,
                "stream": False,
                "response_format": {"type": "json_object"}
            }
        )
        if resp.status_code != 200:
            raise Exception(f"Groq API {resp.status_code}: {resp.text}")
        return resp.json()["choices"][0]["message"]["content"]

async def gather_insight_data() -> dict:
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)
    
    # 1. Total active students
    total_students = await db.students.count_documents({"isActive": True})
    
    # 2. Overall attendance last 30 days
    att_pipeline_overall = [
        {"$match": {"date": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "present": {"$sum": {"$cond": [{"$in": ["$status", ["Present", "Late"]]}, 1, 0]}}
        }}
    ]
    total_attendance = await db.attendances.aggregate(att_pipeline_overall).to_list(10)
    
    # 3. Current 30 days attendance by department
    att_pipeline_recent = [
        {"$match": {"date": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": "$department",
            "total": {"$sum": 1},
            "present": {"$sum": {"$cond": [{"$in": ["$status", ["Present", "Late"]]}, 1, 0]}}
        }}
    ]
    recent_attendance = await db.attendances.aggregate(att_pipeline_recent).to_list(100)
    
    # 4. Previous 30 days attendance by department
    att_pipeline_prev = [
        {"$match": {"date": {"$gte": sixty_days_ago, "$lt": thirty_days_ago}}},
        {"$group": {
            "_id": "$department",
            "total": {"$sum": 1},
            "present": {"$sum": {"$cond": [{"$in": ["$status", ["Present", "Late"]]}, 1, 0]}}
        }}
    ]
    prev_attendance = await db.attendances.aggregate(att_pipeline_prev).to_list(100)
    
    # 5. Fee collection summary
    fee_pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "totalAmount": {"$sum": "$totalAmount"},
            "paidAmount": {"$sum": "$paidAmount"},
            "dueAmount": {"$sum": "$dueAmount"}
        }}
    ]
    fee_data = await db.fees.aggregate(fee_pipeline).to_list(100)
    
    # 6. Marks grade distribution
    marks_pipeline = [
        {"$group": {"_id": "$grade", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    marks_data = await db.marks.aggregate(marks_pipeline).to_list(100)
    
    # 7. Overdue books
    overdue_books = await db.bookissues.count_documents({"status": "overdue"})
    
    # Parse Attendance Rates
    att_summary = total_attendance[0] if total_attendance else {"total": 0, "present": 0}
    overall_rate = f"{round((att_summary['present'] / att_summary['total'] * 100), 1)}%" if att_summary["total"] > 0 else 'N/A'
    
    prev_map = {}
    for d in prev_attendance:
        prev_map[d["_id"]] = (d["present"] / d["total"] * 100) if d["total"] > 0 else 0
        
    dept_attendance = []
    for d in recent_attendance:
        curr = (d["present"] / d["total"] * 100) if d["total"] > 0 else 0
        prev = prev_map.get(d["_id"], curr)
        change = round((curr - prev), 1)
        
        dept_attendance.append({
            "department": d["_id"] or 'Unknown',
            "attendance_rate": f"{round(curr, 1)}%",
            "change_vs_last_month": f"{'+' if change > 0 else ''}{change}%",
            "flag": "LOW" if curr < 75 else ("WATCH" if curr < 80 else "OK")
        })
    dept_attendance.sort(key=lambda x: float(x["attendance_rate"].replace("%", "")) if x["attendance_rate"] != 'N/A' else 0)
    
    # Parse Fee Summary
    fee_groups = {}
    total_fee_amount = 0
    total_paid = 0
    total_due = 0
    for f in fee_data:
        fee_groups[f["_id"]] = {"count": f["count"], "total": f["totalAmount"]}
        total_fee_amount += f.get("totalAmount", 0)
        total_paid += f.get("paidAmount", 0)
        total_due += f.get("dueAmount", 0)
        
    collection_rate = f"{round((total_paid / total_fee_amount * 100), 1)}%" if total_fee_amount > 0 else 'N/A'
    
    # Parse Grade Distribution
    grade_breakdown = {}
    for g in marks_data:
        grade_breakdown[g["_id"] or "Ungraded"] = g["count"]
        
    return {
        "summary_date": now.strftime("%d/%m/%Y"),
        "total_active_students": total_students,
        "attendance": {
            "overall_rate_last_30_days": overall_rate,
            "total_records": att_summary["total"],
            "by_department": dept_attendance
        },
        "fees": {
            "collection_rate": collection_rate,
            "total_amount": f"INR {total_fee_amount}",
            "paid_amount": f"INR {total_paid}",
            "due_amount": f"INR {total_due}",
            "by_status": fee_groups
        },
        "marks": {
            "grade_distribution": grade_breakdown
        },
        "library": {
            "overdue_books": overdue_books
        }
    }

# @route   GET /api/ai/insights
@router.get("/ai/insights")
async def get_insights(current_user: dict = Depends(get_current_user)):
    # Check permissions
    role = current_user.get("role")
    if role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only Admins can access insights."
        )
        
    try:
        erp_data = await gather_insight_data()
    except Exception as db_err:
        print("AI Insights DB error:", str(db_err))
        raise HTTPException(status_code=500, detail="Failed to gather ERP data for analysis.")
        
    system_prompt = """You are an expert educational analytics AI for Samarth College of Engineering & Management.
Analyze the provided ERP data and return a JSON response with EXACTLY these keys:
{
  "summary": "2-3 sentence overall academic health summary",
  "anomalies": ["array of strings, each is a specific concern or anomaly detected from the data"],
  "recommendations": ["array of strings, each is a concrete actionable recommendation for the admin"],
  "health_score": <integer 0-100 representing overall institutional health>,
  "health_label": "Excellent|Good|Fair|Needs Attention|Critical"
}
Be specific with numbers and department names. Keep tone professional but accessible. Max 5 anomalies, max 5 recommendations."""

    user_prompt = f"Here is the current ERP data snapshot for Samarth College:\n{json.dumps(erp_data, indent=2)}\n\nPlease analyze this data and provide insights."
    
    try:
        raw_json = await call_groq(system_prompt, user_prompt)
        insights = json.loads(raw_json)
    except Exception as ai_err:
        print("AI Insights LLM error:", str(ai_err))
        # Data-only fallback
        return {
            "success": True,
            "data": {
                "erpData": erp_data,
                "insights": {
                    "summary": "AI analysis is currently unavailable. Review the ERP data below directly.",
                    "anomalies": [],
                    "recommendations": [],
                    "health_score": None,
                    "health_label": "N/A"
                },
                "generated_at": datetime.utcnow().isoformat(),
                "source": "data-only-fallback"
            }
        }
        
    return {
        "success": True,
        "data": {
            "erpData": erp_data,
            "insights": insights,
            "generated_at": datetime.utcnow().isoformat(),
            "source": "groq-agent"
        }
    }
