import asyncio
import bcrypt
from datetime import datetime
from pymongo import MongoClient

MONGO_URI = "mongodb://127.0.0.1:27017/ERP_System"

def get_db():
    client = MongoClient(MONGO_URI)
    return client.get_default_database()

def hash_pwd(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')

def seed():
    db = get_db()
    print("Connected to MongoDB")
    
    # 1. Clear existing database
    print("Clearing database...")
    db.client.drop_database(db.name)
    print("Database dropped successfully")

    # 2. Define Departments
    departments = [
        {"name": "Computer Engineering", "code": "CO"},
        {"name": "Mechanical Engineering", "code": "ME"},
        {"name": "Civil Engineering", "code": "CE"},
        {"name": "Electrical Engineering", "code": "EE"},
        {"name": "Electronics Engineering", "code": "EX"},
        {"name": "Information Technology", "code": "IT"},
        {"name": "Artificial Intelligence and Machine Learning", "code": "AI"}
    ]

    # 3. Create Seed Users for testing
    print("Creating seed users...")
    
    # Super Admin
    super_admin_id = db.users.insert_one({
        "email": "superadmin@samarthcollege.edu.in",
        "password": hash_pwd("superadmin@123"),
        "role": "super_admin",
        "firstName": "Super",
        "lastName": "Admin",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }).inserted_id
    
    # Alternate Super Admin (matching old seedData)
    db.users.insert_one({
        "email": "superadmin123@gmail.com",
        "password": hash_pwd("superadmin@123"),
        "role": "super_admin",
        "firstName": "Super",
        "lastName": "Admin",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    
    # Admin
    admin_id = db.users.insert_one({
        "email": "admin@samarthcollege.edu.in",
        "password": hash_pwd("admin@123"),
        "role": "admin",
        "firstName": "College",
        "lastName": "Admin",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }).inserted_id
    
    # Alternate Admin (matching old seedData)
    db.users.insert_one({
        "email": "admin123@gmail.com",
        "password": hash_pwd("admin@123"),
        "role": "admin",
        "firstName": "College",
        "lastName": "Admin",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    
    # Teacher
    teacher_id = db.users.insert_one({
        "email": "teacher@samarthcollege.edu.in",
        "password": hash_pwd("teacher@123"),
        "role": "teacher",
        "firstName": "Rajesh",
        "lastName": "Patil",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }).inserted_id
    
    # Alternate Teacher
    db.users.insert_one({
        "email": "ramkadam123@gmail.com",
        "password": hash_pwd("ramkadam@123"),
        "role": "teacher",
        "firstName": "Ram",
        "lastName": "Kadam",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    
    # Student
    student_id = db.users.insert_one({
        "email": "student@samarthcollege.edu.in",
        "password": hash_pwd("student@123"),
        "role": "student",
        "firstName": "Rahul",
        "lastName": "Patil",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }).inserted_id
    
    # Parent
    parent_id = db.users.insert_one({
        "email": "parent@samarthcollege.edu.in",
        "password": hash_pwd("parent@123"),
        "role": "parent",
        "firstName": "Suresh",
        "lastName": "Patil",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }).inserted_id
    
    # Accountant
    db.users.insert_one({
        "email": "accountant@samarthcollege.edu.in",
        "password": hash_pwd("accountant@123"),
        "role": "accountant",
        "firstName": "Rohan",
        "lastName": "Jadhav",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    db.users.insert_one({
        "email": "accountant@gmail.com",
        "password": hash_pwd("accountant@123"),
        "role": "accountant",
        "firstName": "Rohan",
        "lastName": "Jadhav",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    # Librarian
    db.users.insert_one({
        "email": "librarian@samarthcollege.edu.in",
        "password": hash_pwd("librarian@123"),
        "role": "librarian",
        "firstName": "Amit",
        "lastName": "Kadam",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    db.users.insert_one({
        "email": "librarian@gmail.com",
        "password": hash_pwd("librarian@123"),
        "role": "librarian",
        "firstName": "Amit",
        "lastName": "Kadam",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    # Receptionist
    db.users.insert_one({
        "email": "receptionist@samarthcollege.edu.in",
        "password": hash_pwd("receptionist@123"),
        "role": "receptionist",
        "firstName": "Sneha",
        "lastName": "Shinde",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })
    db.users.insert_one({
        "email": "receptionist@gmail.com",
        "password": hash_pwd("receptionist@123"),
        "role": "receptionist",
        "firstName": "Sneha",
        "lastName": "Shinde",
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    # 4. Create Profiles linked to main users
    print("Creating profiles...")
    
    # Teacher Profile
    db.teachers.insert_one({
        "user": teacher_id,
        "employeeId": "EMP_001234",
        "department": "Computer Engineering",
        "designation": "Professor & HOD",
        "qualification": "Ph.D in CSE",
        "experience": 10
    })
    
    # Student Profile
    db.students.insert_one({
        "user": student_id,
        "rollNumber": "STU_100200",
        "department": "Computer Engineering",
        "course": "B.E.",
        "semester": 3,
        "batch": "2026",
        "dateOfBirth": datetime(2005, 5, 20),
        "gender": "Male",
        "isActive": True
    })
    
    # Parent Profile
    db.parents.insert_one({
        "user": parent_id,
        "relation": "Father",
        "students": [student_id]
    })
    
    # 5. Create subjects and classes
    print("Seeding classes & subjects...")
    db.classes.insert_one({
        "name": "Class A",
        "department": "Computer Engineering",
        "semester": 3,
        "section": "A",
        "isActive": True
    })
    db.subjects.insert_one({
        "code": "CO201",
        "name": "Data Structures & Algorithms",
        "department": "Computer Engineering",
        "semester": 3,
        "credits": 4,
        "type": "Theory + Practical"
    })
    
    # 6. Create gallery item
    db.college_galleries.insert_one({
        "title": "College Main Entrance",
        "description": "Welcome to Samarth College campus",
        "category": "Campus",
        "image": {"name": "clg_maindoor.jpg", "url": "/uploads/gallery/clg_maindoor.jpg"},
        "showOnHomePage": True,
        "displayOrder": 1
    })

    print("DATABASE SEEDING COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    seed()
