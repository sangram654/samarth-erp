from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

# Serialize MongoDB Document to Python Dict / JSON
def serialize_doc(doc: Any) -> Any:
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(x) for x in doc]
    if isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if k == "_id":
                new_doc["id"] = str(v)
                new_doc["_id"] = str(v)
            elif isinstance(v, ObjectId):
                new_doc[k] = str(v)
            else:
                new_doc[k] = serialize_doc(v)
        return new_doc
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc

# User Authentication Schemas
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class StudentRegisterData(BaseModel):
    rollNumber: str
    department: str
    course: str
    semester: int
    batch: str
    dateOfBirth: str
    gender: str
    bloodGroup: Optional[str] = None
    enrollmentNumber: Optional[str] = None
    category: Optional[str] = "General"
    aadharNumber: Optional[str] = None

class TeacherRegisterData(BaseModel):
    employeeId: str
    department: str
    designation: str
    qualification: str
    experience: int

class ParentRegisterData(BaseModel):
    relation: str
    students: Optional[List[str]] = []

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: str
    firstName: str
    lastName: str
    phone: Optional[str] = None
    studentData: Optional[StudentRegisterData] = None
    teacherData: Optional[TeacherRegisterData] = None
    parentData: Optional[ParentRegisterData] = None

class UpdateProfile(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Dict[str, str]] = None

class ChangePassword(BaseModel):
    currentPassword: str
    newPassword: str

# ERP Schemas
class CreateLeaveApplication(BaseModel):
    fromDate: str
    toDate: str
    reason: str
    leaveType: str

class UpdateLeaveStatus(BaseModel):
    status: str  # Approved, Rejected

class ChatMessagePayload(BaseModel):
    role: str
    content: str

class ChatBotRequest(BaseModel):
    message: str
    conversationHistory: Optional[List[ChatMessagePayload]] = []

class CreateNotice(BaseModel):
    title: str
    description: str
    targetAudience: Optional[List[str]] = ["all"]
    department: Optional[str] = None
    attachments: Optional[List[Dict[str, str]]] = []

class CreateAssignment(BaseModel):
    title: str
    description: str
    dueDate: str
    subject: str
    classId: str  # maps to Class ID
    points: Optional[int] = 100

class SubmitAssignment(BaseModel):
    fileUrl: str
    remarks: Optional[str] = None

class CreateMarkRecord(BaseModel):
    studentId: str  # student _id
    subjectId: str  # subject _id
    obtainedMarks: float
    maxMarks: float
    examType: str
    academicYear: str
    semester: int
    remarks: Optional[str] = None

class CreateVirtualMeeting(BaseModel):
    title: str
    description: Optional[str] = None
    startTime: str
    duration: int
    meetingLink: str
    classId: str
    subjectId: str

class CreateNote(BaseModel):
    title: str
    description: str
    classId: str
    subjectId: str
    attachmentUrl: Optional[str] = None

class CreateFeeRecord(BaseModel):
    studentId: str
    title: str
    totalAmount: float
    dueDate: str
    category: Optional[str] = "Academic"
    description: Optional[str] = None

class RecordPayment(BaseModel):
    feeId: str
    amountPaid: float
    paymentMethod: str  # Cash, Online, Bank Transfer
    transactionId: Optional[str] = None

class ApplyScholarship(BaseModel):
    scholarshipId: str
    reason: str
    documents: Optional[List[Dict[str, str]]] = []

class CreateFrontOffice(BaseModel):
    visitorName: str
    phone: str
    purpose: str
    date: str
    inTime: str
    outTime: Optional[str] = None
    note: Optional[str] = None

class AddBook(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    rackNumber: Optional[str] = None
    totalCopies: int

class IssueBook(BaseModel):
    bookId: str
    studentId: str  # User ID
    dueDate: str
