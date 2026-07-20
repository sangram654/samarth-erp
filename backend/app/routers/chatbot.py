import json
import httpx
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List, Optional

from ..database import db
from ..middleware.auth import get_optional_user, get_current_user
from ..models import ChatBotRequest, serialize_doc
from ..config import settings

router = APIRouter()

def clean_markdown(text: str) -> str:
    # Remove asterisks, underscores, backticks, header hash characters, links, and squeeze spaces
    t = re.sub(r'\*{1,3}([^*\n]*?)\*{1,3}', r'\1', text)
    t = re.sub(r'_{1,2}([^_\n]*?)_{1,2}', r'\1', t)
    t = re.sub(r'`([^`\n]*?)`', r'\1', t)
    t = re.sub(r'#{1,6}\s*', '', t)
    t = re.sub(r'^\s*[\*\-\+]\s+', '- ', t, flags=re.MULTILINE)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'\n\s*\n\s*\n+', '\n\n', t)
    return t.strip()

TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'get_my_attendance',
            'description': "Get the current logged-in student's attendance summary including percentage and subject-wise breakdown. Use this when user asks about their attendance, hajeri, or presence.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_my_fees',
            'description': "Get the current logged-in student's fee status: total fees, paid amount, pending amount, and payment history.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_my_marks',
            'description': "Get the current logged-in student's marks and grades for all subjects.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_leave_status',
            'description': "Get the current user's leave applications and their approval status.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_notice_board',
            'description': "Get the latest notices/announcements from the college notice board.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_library_status',
            'description': "Get the current user's issued library books and any overdue fines.",
            'parameters': {'type': 'object', 'properties': {}, 'required': []}
        }
    },
]

async def execute_tool(tool_name: str, user_id: str, role: str) -> dict:
    try:
        u_id = ObjectId(user_id)
        if tool_name == 'get_my_attendance':
            student = await db.students.find_one({"user": u_id})
            if not student:
                return {'error': 'Student profile not found.'}
                
            records = await db.attendances.find({"student": student["_id"]}).sort("date", -1).limit(60).to_list(60)
            total = len(records)
            present = sum(1 for r in records if r.get("status") in ['Present', 'Late'])
            percentage = round((present / total * 100), 1) if total > 0 else 0
            
            return {
                'overall_percentage': f"{percentage}%",
                'classes_attended': present,
                'total_classes': total,
                'status': 'Good - above 75% threshold' if percentage >= 75 else 'Low - below 75%, attendance shortage risk'
            }
            
        elif tool_name == 'get_my_fees':
            student = await db.students.find_one({"user": u_id})
            if not student:
                return {'error': 'Student profile not found.'}
                
            fees = await db.fees.find({"student": student["_id"]}).to_list(100)
            total_fees = sum(f.get("totalAmount", 0) for f in fees)
            paid_fees = sum(f.get("paidAmount", 0) for f in fees)
            pending = sum(f.get("dueAmount", 0) for f in fees)
            
            return {
                'total_fees': f"INR {total_fees}",
                'paid_amount': f"INR {paid_fees}",
                'pending_amount': f"INR {pending}",
                'status': 'All fees paid - No dues!' if pending <= 0 else f"INR {pending} still pending",
                'fee_records': len(fees)
            }
            
        elif tool_name == 'get_my_marks':
            student = await db.students.find_one({"user": u_id})
            if not student:
                return {'error': 'Student profile not found.'}
                
            marks_raw = await db.marks.find({"student": student["_id"]}).sort("createdAt", -1).limit(20).to_list(20)
            if not marks_raw:
                return {'message': 'No marks records found yet.'}
                
            subject_ids = [m["subject"] for m in marks_raw if m.get("subject")]
            subjects = await db.subjects.find({"_id": {"$in": subject_ids}}).to_list(100)
            subj_dict = {str(s["_id"]): s for s in subjects}
            
            subjects_list = []
            for m in marks_raw:
                subj_name = "Unknown"
                if m.get("subject") and str(m["subject"]) in subj_dict:
                    subj_name = subj_dict[str(m["subject"])].get("name", "Unknown")
                    
                obtained = m.get("obtainedMarks", 0)
                max_m = m.get("maxMarks", 100)
                percentage = f"{round((obtained / max_m * 100), 1)}%" if max_m else "N/A"
                
                subjects_list.append({
                    'subject': subj_name,
                    'marks_obtained': obtained,
                    'total_marks': max_m,
                    'percentage': percentage,
                    'grade': m.get("grade", "N/A"),
                    'exam_type': m.get("examType", "Exam"),
                    'status': m.get("status", "Pass")
                })
                
            return {'marks': subjects_list, 'total_subjects': len(subjects_list)}
            
        elif tool_name == 'get_leave_status':
            leaves = await db.leaveapplications.find({"applicant": u_id}).sort("createdAt", -1).limit(5).to_list(5)
            if not leaves:
                return {'message': 'No leave applications found.'}
                
            apps = []
            for l in leaves:
                from_date = l.get("fromDate").strftime('%d/%m/%Y') if isinstance(l.get("fromDate"), datetime) else str(l.get("fromDate", "N/A"))
                to_date = l.get("toDate").strftime('%d/%m/%Y') if isinstance(l.get("toDate"), datetime) else str(l.get("toDate", "N/A"))
                apps.append({
                    'from': from_date,
                    'to': to_date,
                    'reason': l.get("reason", "N/A"),
                    'status': l.get("status", "Pending"),
                    'type': l.get("leaveType", "Leave")
                })
                
            return {'total_applications': len(leaves), 'applications': apps}
            
        elif tool_name == 'get_notice_board':
            notices = await db.notices.find({"isActive": True}).sort("createdAt", -1).limit(5).to_list(5)
            if not notices:
                return {'message': 'No active notices at the moment.'}
                
            notice_list = []
            for n in notices:
                dt = n.get("createdAt").strftime('%d/%m/%Y') if isinstance(n.get("createdAt"), datetime) else "N/A"
                desc = n.get("description", "")
                summary = desc[:120] + "..." if len(desc) > 120 else desc
                notice_list.append({
                    'title': n.get("title"),
                    'summary': summary,
                    'date': dt
                })
            return {'notices': notice_list}
            
        elif tool_name == 'get_library_status':
            # Book issues
            issued = await db.bookissues.find({
                "student": u_id,
                "returnDate": None,
                "status": {"$in": ["issued", "overdue"]}
            }).to_list(100)
            
            if not issued:
                return {'message': 'No books currently issued to you.'}
                
            book_ids = [i["book"] for i in issued if i.get("book")]
            books = await db.books.find({"_id": {"$in": book_ids}}).to_list(100)
            book_dict = {str(b["_id"]): b for b in books}
            
            books_list = []
            for i in issued:
                book_name = "Unknown"
                author = "Unknown"
                if i.get("book") and str(i["book"]) in book_dict:
                    book_name = book_dict[str(i["book"])].get("title", "Unknown")
                    author = book_dict[str(i["book"])].get("author", "Unknown")
                    
                issue_date = i.get("issueDate").strftime('%d/%m/%Y') if isinstance(i.get("issueDate"), datetime) else "N/A"
                due_date = i.get("dueDate").strftime('%d/%m/%Y') if isinstance(i.get("dueDate"), datetime) else "N/A"
                
                books_list.append({
                    'title': book_name,
                    'author': author,
                    'issue_date': issue_date,
                    'due_date': due_date,
                    'fine': f"INR {i.get('fine')}" if i.get("fine") else 'No fine'
                })
            return {'books_issued': len(issued), 'books': books_list}
            
        return {'error': f"Unknown tool: {tool_name}"}
    except Exception as e:
        return {'error': f"Could not retrieve data: {str(e)}"}

def build_system_prompt(user: Optional[dict]) -> str:
    role_label = user.get("role", "user").replace('_', ' ') if user else "user"
    first_name = user.get("firstName", "a user") if user else "a user"
    
    return f"""You are Sammy, a smart AI assistant for Samarth College of Engineering & Management ERP System.

You are speaking with {first_name} ({role_label}).

College Info: 7 departments (Computer Engineering, Mechanical, Civil, Electrical, Electronics, IT, AI & ML), 2500+ students, 15+ years of excellence, 95% placement rate, located in Belhe, Pune.

You have access to tools that let you fetch REAL live data from the ERP:
- get_my_attendance: student attendance data
- get_my_fees: student fee status
- get_my_marks: student marks
- get_leave_status: leave applications
- get_notice_board: latest notices
- get_library_status: issued books

RULES:
1. If the user asks about their data (attendance, fees, marks, leaves, library, notices), ALWAYS call the appropriate tool first to get real data.
2. Use the real data in your answer — include actual numbers, percentages, and amounts.
3. After getting tool results, give a clear, friendly, conversational response.
4. For unrelated questions (general knowledge, coding, etc.), answer normally without tools.
5. Keep answers concise and friendly. Use plain text only — no markdown, bold, asterisks.
6. Write in a natural, helpful tone. Use "you" and "your" to be personal."""

def get_local_fallback(msg: str = "") -> str:
    t = msg.lower()
    if 'attendance' in t or 'hajeri' in t:
        return "To check attendance: Student -> Attendance page. Teachers mark it from Teacher Portal -> Attendance. Ask me again when I'm connected to get your live data!"
    if 'marks' in t or 'result' in t:
        return "Marks are in Student -> Marks & Results. Teachers enter marks from Teacher -> Marks Entry."
    if 'fees' in t or 'payment' in t:
        return "For fees, open Student/Parent -> Fees. You can view paid, pending, and due details there."
    if 'leave' in t:
        return "Submit leave applications from Student -> Leave. Admin approves from Admin -> Leave Approvals."
    if 'library' in t or 'book' in t:
        return "Check issued books in Student -> Library. The librarian manages books from the Librarian portal."
    return "I can help with ERP features like attendance, marks, fees, library, and general questions. What would you like to know?"

# @route   POST /api/chatbot/chat
@router.post("/chatbot/chat")
async def send_chat_message(payload: ChatBotRequest, user: Optional[dict] = Depends(get_optional_user)):
    msg = payload.message
    history = payload.conversationHistory or []
    
    if not msg or len(msg.strip()) == 0:
        raise HTTPException(status_code=400, detail="Message is required")
    if len(msg) > 1000:
        raise HTTPException(status_code=400, detail="Message is too long.")
        
    groq_api_key = settings.GROQ_API_KEY
    groq_api_url = 'https://api.groq.com/openai/v1/chat/completions'
    
    if not groq_api_key:
        return {
            "success": True,
            "data": {
                "message": get_local_fallback(msg),
                "timestamp": datetime.utcnow().isoformat(),
                "source": "local-fallback"
            }
        }
        
    try:
        # Build initial message list
        messages = [
            {"role": "system", "content": build_system_prompt(user)}
        ]
        # Inject up to last 6 turns of history
        for h in history[-6:]:
            messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": msg})
        
        final_response = None
        tool_call_log = []
        max_rounds = 3
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for round_idx in range(max_rounds):
                req_body = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 800,
                    "stream": False
                }
                # Expose tools only to authenticated users
                if user:
                    req_body["tools"] = TOOLS
                    req_body["tool_choice"] = "auto"
                else:
                    req_body["tool_choice"] = "none"
                    
                resp = await client.post(
                    groq_api_url,
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {groq_api_key}"},
                    json=req_body
                )
                
                if resp.status_code != 200:
                    raise Exception(f"Groq API status {resp.status_code}: {resp.text}")
                    
                resp_json = resp.json()
                choice = resp_json.get("choices", [{}])[0]
                choice_msg = choice.get("message", {})
                
                # Check if LLM requested tools
                if choice.get("finish_reason") == 'tool_calls' or choice_msg.get("tool_calls"):
                    # Add assistant message with tool calls to history
                    messages.append(choice_msg)
                    
                    tool_calls = choice_msg.get("tool_calls", [])
                    for tc in tool_calls:
                        func = tc.get("function", {})
                        tool_name = func.get("name")
                        tool_call_log.append(tool_name)
                        
                        tool_result = await execute_tool(tool_name, user["_id"], user.get("role"))
                        
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "content": json.dumps(tool_result)
                        })
                    continue
                    
                if choice_msg.get("content"):
                    final_response = clean_markdown(choice_msg["content"])
                    break
                    
        if not final_response:
            final_response = get_local_fallback(msg)
            
        return {
            "success": True,
            "data": {
                "message": final_response,
                "timestamp": datetime.utcnow().isoformat(),
                "source": "groq-agent" if tool_call_log else "groq-api",
                "toolsUsed": tool_call_log
            }
        }
    except Exception as e:
        print(f"Chatbot agent error: {str(e)}")
        return {
            "success": True,
            "data": {
                "message": get_local_fallback(msg),
                "timestamp": datetime.utcnow().isoformat(),
                "source": "local-fallback"
            }
        }
