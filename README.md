# Samarth College ERP System

### Educational ERP System for Samarth Rural Educational Institute
**SAMARTH COLLEGE OF ENGINEERING & MANAGEMENT, BELHE**

A state-of-the-art, comprehensive full-stack Educational ERP System providing a centralized platform for managing academic, administrative, financial, library, and front-office operations — with role-based access for 8 different user types and integrated AI/agentic pipelines.

---

## 🌟 Features

### 👥 User Roles (8 Roles)
| Role | Description |
|------|-------------|
| 🛡️ **Super Admin** | Full system control — manage users, shift assignments, biometric terminal logs, and system configurations. |
| 👨‍💼 **Admin** | Department administration — students, teachers, parents, class management, fee assignments, and leave approvals. |
| 👨‍🏫 **Teacher** | Academic logs — traditional class attendance, student marks entry, study notes/syllabus uploads. |
| 🎓 **Student** | Personal log — track attendance (biometric + manual), fee invoices, academic marks, and download study notes. |
| 👨‍👩‍👧 **Parent** | Ward monitoring — check child's live attendance percentage, marks/grades, and outstanding fees. |
| 💰 **Accountant** | Financial ledger — manage college income, expenses, check fee structures, record payments, and view logs. |
| 📚 **Librarian** | Cataloging — issue and return library books, track book status, and calculate fine logs. |
| 🏢 **Receptionist** | Front office — log campus visitors, record admission inquiries, follow-up calls, and complaints. |

### 🤖 AI & Agentic Features (NEW)
- 🤖 **Agentic ERP Chatbot (Sammy):** Multi-turn tool-calling assistant powered by Groq LLaMA-3.3-70b. It dynamically reads live Mongo database parameters (user attendance, pending fees, exam marks, leave status, library loans) and responds with real numbers.
- 📊 **AI Insights Dashboard:** Admin & SuperAdmin dashboard executing live aggregation on ERP data (monthly attendance, fee collection %, grade distribution, overdue books) combined with LLM analysis to produce a detailed health score, anomaly alerts, and actionable recommendations.
- 💬 **Smart Chatbot Widget:** Dynamic floating glassmorphism chat bubble appearing on all dashboard panels with role-aware quick-action triggers (e.g., student attendance checks, admin notice checks).

### ⚙️ Hardware & Biometric Integrations
- 📟 **ESP32 Biometric Terminal:** Integrates with physical fingerprint scanner modules to post live logs of main-gate check-ins and classroom sessions.
- 📸 **Face Registration:** Built-in face profile registration utilizing client-side TensorFlow/FaceAPI model shards.

---

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Groq API** utilizing `llama-3.3-70b-versatile` for tool-use agent logic
- **JWT** Authentication + Role-Based Access Control (RBAC) middleware
- **Multer** for file and profile uploads
- **PDFKit** for automated fee receipt generation

### Frontend
- **React 18** & **React Router v6** (with Protected Route guard)
- **Chart.js / Recharts** for dashboard data visualization
- **Vanilla CSS** with a dark-theme glassmorphism design system

---

## 📁 Project Structure

```
FINAL_YEAR_PROJECT/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── roles.js              # RBAC config (roles, permissions)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   ├── chatbotController.js  # Agentic tool-calling loop (Groq API)
│   │   ├── aiInsightsController.js# live data aggregation & LLM insights
│   │   ├── attendanceController.js# traditional classroom attendance
│   │   ├── attendanceController2.js# biometric terminal logs
│   │   ├── faceController.js     # User face registration
│   │   ├── feeController.js
│   │   ├── libraryController.js
│   │   └── frontOfficeController.js
│   ├── middleware/
│   │   ├── auth.js               # protect, authorize, and optionalAuth
│   │   └── errorHandler.js       # Global error handler
│   ├── models/
│   │   ├── User.js               # Core schema with roll-based references
│   │   ├── Student.js
│   │   ├── Teacher.js
│   │   ├── Parent.js
│   │   ├── Book.js               # Book & BookIssue schemas
│   │   ├── Attendance.js         # Manual attendance
│   │   ├── Attendance2.js        # Biometric attendance log
│   │   ├── Fee.js                # Fee & FeeStructure schemas
│   │   └── Marks.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatbotRoutes.js      # /api/chatbot/chat
│   │   ├── aiInsightsRoutes.js   # /api/ai/insights
│   │   ├── faceRoutes.js
│   │   └── ...more
│   ├── seeders/
│   │   └── seedData.js           # Database seeder (cleans & inserts all data)
│   └── server.js                 # App entry point
│
├── frontend/
│   ├── public/
│   │   └── models/               # Face recognition model shards
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatbotWidget/    # Chat widget (JS & CSS)
│   │   │   └── Layout/           # DashboardLayout & MainLayout
│   │   ├── context/
│   │   │   └── AuthContext.js    # Global session & routing context
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   └── AdminAIInsights.js # AI insights dashboard
│   │   │   ├── student/
│   │   │   ├── superadmin/
│   │   │   └── ...other role pages
│   │   ├── services/
│   │   │   └── api.js            # Axios client instance
│   │   └── App.js                # Frontend routes configuration
│
└── BIOMETRIC_CODE_WEBSITE_2.ino  # ESP32 micro-controller source code
```

---

## 🚀 Getting Started

### 1. Backend Configuration
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```
Create a `.env` file inside the `backend` folder:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ERP_System
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
GROQ_API_KEY=your_groq_api_key_here
```
> Get a free Groq API key at [console.groq.com](https://console.groq.com)

Seed the database with default clean data (overwrites existing collections for consistency):
```bash
node seeders/seedData.js
```

Start the development server:
```bash
npm run dev
```

### 2. Frontend Configuration
Navigate to the frontend directory and install dependencies:
```bash
cd ../frontend
npm install
```
Start the React application:
```bash
npm start
```
The web app will open automatically at `http://localhost:3000`.

---

## 🔐 Demo Login Credentials

> These accounts are created during the `node seeders/seedData.js` seeding run:

| Role | Email | Password |
|------|-------|----------|
| 🛡️ **Super Admin** | `superadmin123@gmail.com` | `superadmin@123` |
| 👨‍💼 **Admin** | `admin123@gmail.com` | `admin@123` |
| 👨‍🏫 **Teacher (EE)** | `rajeshpatil123@gmail.com` | `rajeshpatil@123` |
| 🎓 **Student (EE)** | `amitjadhav123@gmail.com` | `amitjadhav@123` |
| 🎓 **Student (CO)** | `rahulpatil123@gmail.com` | `rahulpatil@123` |
| 👨‍👩‍👧 **Parent** | `sureshpatil.parent@gmail.com` | `sureshpatil@123` |
| 💰 **Accountant** | `accountant@gmail.com` | `accountant@123` |
| 📚 **Librarian** | `librarian@gmail.com` | `librarian@123` |
| 🏢 **Receptionist** | `receptionist@gmail.com` | `receptionist@123` |

---

## 📡 Key AI API Endpoints

### 🤖 Agentic Chatbot
- `POST /api/chatbot/chat`
  - **Access:** Public (anonymous Q&A) or Private (executes live data tools when sent with a valid JWT Authorization header)
  - **Body:** `{ "message": "string", "conversationHistory": [] }`

### 📊 AI Insights Analytics
- `GET /api/ai/insights`
  - **Access:** Private (Admin and SuperAdmin only)
  - **Description:** Returns aggregated ERP analytics combined with structured LLaMA-3.3 analysis.

---

## 📄 License
This project is proprietary software for Samarth Rural Educational Institute.

---

## 👨‍💻 Developer
Built with ❤️ for **Samarth College of Engineering & Management, Belhe**.
