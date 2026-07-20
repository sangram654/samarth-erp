# 🎓 Samarth College ERP - Full-Stack College Management System

An **AI-Enhanced, Full-Stack College Management & ERP System** built using **FastAPI (Python)**, **React.js**, and **MongoDB**. The platform provides dedicated portals for Super Admins, Admins, Teachers, Students, Parents, and Accountants, featuring real-time online payment gateways, automated email credentials dispatch, virtual meetings, attendance tracking, and finance management.

---

## 🌟 Key Features & Role Portals

### 🔑 1. Super Admin Portal
* **User Lifecycle Management**: Create, view, update, and deactivate accounts across all roles (Students, Teachers, Parents, Admins, Accountants).
* **Automatic Email Dispatch**: Automatic Gmail SMTP email notifications sent to new users with login credentials and account updates.
* **Fee Structure Assignment**: Create global fee structures (Tuition, Exam, Hostel, Library) and assign them individually or in bulk.
* **System Reports & Audit**: Real-time financial reports, user stats, and system activity logs.

### 🏛️ 2. Admin Portal
* **Academic Operations**: Manage departments, courses, subjects, class sections, and faculty assignments.
* **Virtual Class Meetings**: Create, edit, and schedule Zoom/Google Meet virtual meetings targeted by role or department.
* **Notice Board Management**: Create notices with optional expiry dates. Expired notices automatically archive to logs.
* **Exams & Timetable**: Schedule semester exams, publish timetables, and monitor campus operations.

### 👩‍🏫 3. Teacher Portal
* **Attendance Tracking**: Mark daily student attendance with manual options and AI Face Recognition support.
* **Marks & Backlogs**: Enter unit test and semester marks, track open backlogs, and generate performance reports.
* **Study Material**: Upload lecture notes, syllabus sheets, and assignments for assigned classes.
* **Virtual Class Meetings**: Host online lectures and access SuperAdmin/Admin meetings.

### 💳 4. Accountant & Payment Management
* **Real-Time Paytm & UPI Gateway**: Integrated Paytm Merchant Payment Gateway and UPI VPA (`9561563002@ptsbi`).
* **Dynamic QR Code**: Real-time QR generation with custom amounts, presets (₹1,000 to ₹50,000), and mobile app deep links (GPay, PhonePe, Paytm, BHIM).
* **Income & Expense Tracking**: Log income entries, verify transaction UTR numbers, and monitor financial dashboards.
* **Printable Receipts**: 1-click digital receipt generation and printing for all fee collections.

### 🎓 5. Student Portal
* **Online Fee Payment**: View fee dues, pay online using Paytm UPI Gateway or QR Code, and download payment receipts.
* **Academic Dashboard**: Check attendance percentages, backlog statuses, subject marks, and class timetables.
* **Virtual Lectures**: Join live meetings created by teachers or college administration.

### 👨‍👩‍👦 6. Parent Portal
* **Ward Progress Monitoring**: Track attendance rates, exam performance, and backlog status for children.
* **Ward Fee Payments**: Pay outstanding college fees directly via online UPI gateway.
* **Parent-Teacher Meetings**: Attend scheduled virtual PTMs.

---

## 🛠️ Technology Stack

* **Backend Framework**: Python 3.10+ & FastAPI (Asynchronous REST API)
* **Async Database**: MongoDB (using Async Motor Driver)
* **Frontend Framework**: React 18 (React Router v6, Axios)
* **Security & Auth**: PyJWT, Bcrypt (offloaded to thread-pool for non-blocking performance)
* **Email Service**: Asynchronous Gmail SMTP with HTML Templates
* **Real-Time Gateway**: Paytm Merchant Gateway API & UPI VPA (`9561563002@ptsbi`), Razorpay SDK Support
* **UI Styling**: Vanilla CSS3, React Icons, Recharts, Chart.js, QRCode.react, React Toastify

---

## 📁 Directory Structure

```
FINAL_YEAR_PROJECT/
├── backend/
│   ├── app/
│   │   ├── middleware/        # JWT Authentication & Password Hashing
│   │   ├── routers/           # API Endpoints (Auth, Profiles, Academics, Finance, Operations, Chatbot)
│   │   ├── utils/             # Async Email Service & Utilities
│   │   ├── config.py          # Environment Settings
│   │   ├── database.py        # MongoDB Async Motor Client
│   │   ├── main.py            # FastAPI Route Registration & CORS
│   │   └── models.py          # Pydantic Models & Schemas
│   ├── main.py                # Server Startup Entry Point
│   ├── seed.py                # Database Initializer & Seeder
│   ├── requirements.txt       # Python Dependencies
│   └── .env.example           # Environment Configuration Template
├── frontend/
│   ├── public/                # Static HTML & Favicons
│   ├── src/
│   │   ├── components/        # Shared Components (Sidebar, Navbar, Modals)
│   │   ├── context/           # AuthContext & Global State
│   │   ├── pages/             # SuperAdmin, Admin, Teacher, Student, Parent, Accountant Portals
│   │   ├── services/          # Axios API Services
│   │   ├── App.js             # Route Registry & Protected Routes
│   │   └── index.js           # App Entrypoint
│   ├── package.json           # Frontend Dependencies
│   └── README.md
├── .gitignore
└── README.md
```

---

## 🚀 Setup & Installation Guide

### Prerequisites
* **Python**: 3.10 or higher
* **Node.js**: v16 or higher (npm)
* **MongoDB**: Running locally on `mongodb://127.0.0.1:27017` or MongoDB Atlas

---

### 1️⃣ Backend Setup

```bash
# Move to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Install required packages
pip install -r requirements.txt

# Copy .env.example to .env and configure settings
cp .env.example .env

# Seed initial database records (Users, Profiles, Fee Structures)
python seed.py

# Start Python FastAPI backend server
python main.py
```
*Backend server will start at `http://127.0.0.1:5000`.*

---

### 2️⃣ Frontend Setup

```bash
# Open a new terminal and move to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start React development server
npm start
```
*Frontend web app will open at `http://localhost:3000`.*

---

## 🔑 Demo Account Credentials

| Role | Email ID | Password |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin123@gmail.com` | `admin@123` |
| **Admin** | `admin123@gmail.com` | `admin@123` |
| **Teacher** | `ramkadam123@gmail.com` | `admin@123` |
| **Student** | `rahulpatil123@gmail.com` | `admin@123` |
| **Parent** | `sureshpatilparent123@gmail.com` | `admin@123` |
| **Accountant** | `accountant@gmail.com` | `admin@123` |

---

## 📜 License & Copyright

© 2026 **Samarth College ERP - College Management System**. All rights reserved.
