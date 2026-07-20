# 🎓 College Management System (Samarth College ERP)

> **Comprehensive Full-Stack Educational ERP & Campus Management System**
> **SAMARTH COLLEGE OF ENGINEERING & MANAGEMENT**

A state-of-the-art, enterprise-grade **College Management System** providing a centralized platform to manage academic, administrative, financial, library, and front-office operations with role-based access across **8 distinct user portals**, real-time Paytm & UPI Payment Gateways, automated Gmail email notifications, virtual meetings, biometric attendance, and an integrated AI Chatbot.

---

## 🌟 Key Features & Role-Based Portals

### 👥 8 Specialized User Portals
| Portal | Key Capabilities |
| :--- | :--- |
| 🛡️ **Super Admin** | Full system control, user creation/editing with automated welcome emails, Notice history/logs, global system settings. |
| 👨‍💼 **Admin** | Department administration, student/teacher/parent profiles, class & fee management, virtual meeting scheduling. |
| 👨‍🏫 **Teacher** | Class attendance logging, marks entry, syllabus/study material uploads, virtual meetings participation. |
| 🎓 **Student** | Live attendance monitoring, online fee payment with dynamic Paytm/UPI QR Code, exam results, timetable & notes. |
| 👨‍👩‍👧 **Parent** | Ward monitoring, child's live attendance percentage, exam grades, and instant online fee payment portal. |
| 💰 **Accountant** | Financial ledger, college income & expense management, Paytm Merchant & UPI payment gateway, printable receipts. |
| 📚 **Librarian** | Cataloging, book issue/return tracking, fine management, and library inventory logs. |
| 🏢 **Receptionist** | Campus visitor log, admission inquiries, follow-up calls, and complaint tracking. |

---

### 💳 Real-Time Payment Gateway & UPI Integration
- 📱 **Paytm Merchant Gateway Integration**: Directly connects to Paytm Merchant VPA **`9561563002@ptsbi`** and Paytm Merchant ID.
- ⚡ **Dynamic Instant UPI QR Code**: Live QR Code generation for custom payment amounts (`upi://pay?pa=9561563002@ptsbi&pn=...&am=...`).
- 📲 **Mobile App Deep Linking**: One-click direct app launch for Paytm, Google Pay, PhonePe, and BHIM UPI.
- 💳 **Razorpay & NetBanking Gateway**: Integrated Razorpay Checkout SDK supporting Debit/Credit Cards and all major Indian Banks.
- 🧾 **Instant Verified Receipts**: Auto-generated transaction invoice numbers (`PAYTM-...` / `RZP-...`) with printable/downloadable official receipts.

---

### ✉️ Automatic Gmail Email Notification Service
- 🚀 **Welcome Credentials Email**: Automatically dispatches HTML welcome emails containing login credentials, assigned role, and portal URL upon user creation.
- 🔄 **Account Update Email**: Automatically emails updated account details and password resets to users when profiles are updated by Super Admin.
- ⚡ **Non-blocking Dispatch**: Async thread-offloaded email delivery ensuring smooth background execution without blocking API endpoints.

---

### 📹 Virtual Meetings & Permission Matrix
- 🛡️ **Role-Based Meeting Controls**: Meetings created by Super Admin are read-only for lower admin panels (Admin, Teacher, Student).
- 🎓 **Targeted Meetings Query**: Auto-fetches class-level, department-level, or role-targeted virtual meetings for Teachers, Students, and Parents.

---

### 📢 Notice Management with Expiry & Logs
- ⏰ **Auto-Expiring Notices**: Notices automatically disappear from active feeds after their configured end time.
- 📜 **Notice History Logs**: Complete historical log with creator info, start time, and end time.

---

### 🤖 AI Agentic Chatbot (Sammy)
- 💬 **Multi-turn Assistant**: Powered by LLM for answering student, teacher, and admin queries regarding fees, attendance, timetable, and campus rules.

---

## 🛠️ Tech Stack

### **Backend (Python FastAPI Framework)**
- **Python 3.10+** & **FastAPI** (High-performance Async ASGI framework)
- **MongoDB** & **Motor** (Async MongoDB driver)
- **Uvicorn** (Lightning-fast ASGI web server)
- **aiosmtplib & smtplib** (SSL 465 / TLS 587 Gmail SMTP service)
- **Bcrypt & PyJWT** (Async thread-offloaded password hashing and JWT authentication)
- **Socket.io** (Real-time WebSocket communication)

### **Frontend (React Single Page Application)**
- **React 18** & **React Router v6** (Protected Route Access Control)
- **qrcode.react** (Dynamic SVG & Canvas UPI QR Code Renderer)
- **React Icons & Toastify** (Modern notification and UI icons)
- **Recharts & Chart.js** (Data analytics and financial report charts)
- **Vanilla CSS** (Dark mode glassmorphism UI design system)

---

## 📁 Repository Directory Structure

```
FINAL_YEAR_PROJECT/
├── backend/
│   ├── app/
│   │   ├── middleware/        # JWT Authentication & Async Bcrypt verification
│   │   ├── routers/           # Auth, Academics, Finance, Operations, Profiles, Chatbot
│   │   ├── utils/             # Email Service (Welcome & Update Emails)
│   │   ├── config.py          # Environment settings loader
│   │   ├── database.py        # Async MongoDB Motor connection
│   │   ├── main.py            # FastAPI main application entry point
│   │   └── models.py          # Pydantic data schemas
│   ├── uploads/               # Profile images, notices, and documents
│   ├── .env.example           # Environment variables template
│   ├── main.py                # Server launcher script
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── public/                # Static assets & index.html
│   ├── src/
│   │   ├── components/        # Reusable UI components & Navbar
│   │   ├── context/           # AuthContext & state management
│   │   ├── pages/             # Admin, SuperAdmin, Teacher, Student, Parent, Accountant pages
│   │   │   └── accountant/    # Paytm Payment QR & Income Management
│   │   ├── services/          # Axios API client
│   │   └── App.js             # Router & app entry point
│   └── package.json           # React dependencies & scripts
├── .gitignore                 # Configured git ignore file
└── README.md                  # Project documentation
```

---

## ⚡ Setup & Installation Instructions

### 1. Prerequisites
- **Node.js** (v16.x or higher)
- **Python** (v3.10 or higher)
- **MongoDB** (Local instance running on `mongodb://127.0.0.1:27017` or MongoDB Atlas)

---

### 2. Backend Setup (Python FastAPI)

```bash
# Navigate to backend folder
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Create .env configuration from template
cp .env.example .env
```

Edit your `backend/.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ERP_System

JWT_SECRET=mysupersecretkey123@erp
JWT_EXPIRE=365d

EMAIL_USER=samarthcollege29@gmail.com
EMAIL_PASS=wxprgbceefjdmumu

COLLEGE_UPI_ID=9561563002@ptsbi
COLLEGE_NAME=Samarth College of Engineering & Management
RAZORPAY_KEY_ID=rzp_test_your_key
PAYTM_MID=SAMARTH_COLLEGE_PAYTM_MID_9561563002
```

Start Python FastAPI backend server:
```bash
python main.py
```
*Backend API will run at:* `http://localhost:5000`

---

### 3. Frontend Setup (React.js)

```bash
# Open a new terminal and navigate to frontend folder
cd frontend

# Install node dependencies
npm install

# Start React development server
npm start
```
*Frontend Application will run at:* `http://localhost:3000`

---

## 🔑 Default Credentials for Testing

| Role | Email ID | Password |
| :--- | :--- | :--- |
| 🛡️ **Super Admin** | `superadmin123@gmail.com` | `superadmin@123` |
| 👨‍💼 **Admin** | `admin123@gmail.com` | `admin@123` |
| 👨‍🏫 **Teacher** | `ramkadam123@gmail.com` | `teacher@123` |
| 🎓 **Student** | `rahulpatil123@gmail.com` | `student@123` |
| 👨‍👩‍👧 **Parent** | `sureshpatilparent123@gmail.com` | `parent@123` |
| 💰 **Accountant** | `accountant@gmail.com` | `admin@123` |

---

## 📜 License & Copyright
© 2026 **Samarth College of Engineering & Management**. All rights reserved.
Developed for Final Year Project & Educational ERP Management.
