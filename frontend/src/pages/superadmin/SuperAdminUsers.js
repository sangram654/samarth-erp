import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiUsers, FiSearch, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight, FiEdit, FiCamera } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import * as faceapi from 'face-api.js';
import '../student/StudentPages.css';

const SuperAdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [studentProfiles, setStudentProfiles] = useState([]);

    // --- FACE REGISTRATION STATES ---
    const [faceModal, setFaceModal] = useState(false);
    const [tempFaceDescriptor, setTempFaceDescriptor] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);

    // Form States
    const [newUser, setNewUser] = useState({
        firstName: '', lastName: '', email: '', password: '',
        role: 'student', phone: '', department: '', admissionStatus: '',
        enrollId: '',
        childGender: '',
        childDepartment: '',
        childAdmissionStatus: '',
        selectedChildId: ''
    });

    const [editUser, setEditUser] = useState({
        _id: '', firstName: '', lastName: '', email: '', password: '',
        role: 'student', phone: '', department: '', admissionStatus: '',
        enrollId: '',
        childGender: '',
        childDepartment: '',
        childAdmissionStatus: '',
        selectedChildId: ''
    });

    const allRoles = ['super_admin', 'admin', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'receptionist'];

    const departments = [
        'Computer Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Electrical Engineering',
        'Electronics Engineering',
        'Information Technology',
        'Artificial Intelligence and Machine Learning',
    ];

    // --- RESOLVED MODEL LOADING LOGIC ---
    useEffect(() => {
        const loadModels = async () => {
            try {
                // process.env.PUBLIC_URL ensures the path is correct in both dev and production
                const MODEL_URL = process.env.PUBLIC_URL + '/models';

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);

                setModelsLoaded(true);
                console.log("Face-API models loaded successfully");
            } catch (error) {
                console.error("Error loading face models:", error);
                toast.error("Failed to load face detection models. Please check if /public/models folder exists.");
            }
        };
        loadModels();
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page: pagination.page, limit: 100 };
            if (roleFilter) params.role = roleFilter;
            if (search) params.search = search;

            const res = await api.get('/super-admin/users', { params });
            if (res.data.success) {
                setUsers(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        setLoading(false);
    }, [roleFilter, pagination.page, search]);

    const fetchStudentProfiles = useCallback(async () => {
        try {
            const res = await api.get('/students', { params: { limit: 1000 } });
            if (res.data.success) {
                setStudentProfiles(res.data.data || []);
            }
        } catch (error) {
            console.error("Error fetching student profiles:", error);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchStudentProfiles();
    }, [fetchUsers, fetchStudentProfiles]);

    const matchSemester = (studentSemester, status) => {
        if (!status) return true;
        if (status === 'First Year') return studentSemester === 1 || studentSemester === 2;
        if (status === 'Second Year' || status === 'Direct Second Year') return studentSemester === 3 || studentSemester === 4;
        if (status === 'Third Year') return studentSemester === 5 || studentSemester === 6;
        if (status === 'Last Year') return studentSemester === 7 || studentSemester === 8;
        return true;
    };

    const getFilteredChildren = (gender, dept, admissionStatus) => {
        return studentProfiles.filter(s => {
            const matchesGender = !gender || (s.gender && s.gender.toLowerCase() === gender.toLowerCase());
            const matchesDept = !dept || s.department === dept;
            const matchesSemester = matchSemester(s.semester, admissionStatus);
            return matchesGender && matchesDept && matchesSemester;
        });
    };

    // --- FACE CAPTURE LOGIC ---
    const startCamera = async () => {
        if (!modelsLoaded) {
            toast.warn("Models are still loading, please wait...");
            return;
        }
        setFaceModal(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            setTimeout(() => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            }, 100);
        } catch (err) {
            toast.error("Camera access denied");
            setFaceModal(false);
        }
    };

    const handleVideoPlay = () => {
        if (!canvasRef.current || !videoRef.current) return;
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);

        const interval = setInterval(async () => {
            if (videoRef.current && faceModal && modelsLoaded) {
                try {
                    const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    const context = canvasRef.current.getContext('2d');
                    context.clearRect(0, 0, displaySize.width, displaySize.height);
                    faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                } catch (err) {
                    console.error("Detection error:", err);
                }
            } else {
                clearInterval(interval);
            }
        }, 100);
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setFaceModal(false);
    };

    const captureFace = async () => {
        if (!videoRef.current || !modelsLoaded) return;

        try {
            const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                setTempFaceDescriptor(Array.from(detection.descriptor));
                toast.success("Face spatial features captured ✅");
                stopCamera();
            } else {
                toast.error("Face not detected. Keep your face clear in the box.");
            }
        } catch (err) {
            console.error("Capture error:", err);
            toast.error("Error processing face data.");
        }
    };

    const uploadFaceData = async (userId, descriptor) => {
        try {
            await api.post('/face/register-face', { userId, faceFeatures: descriptor });
            setTempFaceDescriptor(null);
        } catch (err) {
            console.error("Face registration failed:", err);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers();
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            // --- BADLAV YAHAN HAI ---
            // Hum newUser ki copy banakar enrollId ko number mein convert kar rahe hain, aur studentId include kar rahe hain
            const userData = {
                ...newUser,
                enrollId: newUser.enrollId ? Number(newUser.enrollId) : null,
                studentId: newUser.role === 'parent' ? newUser.selectedChildId : undefined
            };

            const res = await api.post('/super-admin/users', userData); // userData bhejein, newUser nahi

            if (res.data.success) {
                if (tempFaceDescriptor) await uploadFaceData(res.data.data._id, tempFaceDescriptor);
                toast.success(res.data.message);
                setShowCreateModal(false);

                // Reset state - enrollId ko empty string set karein
                setNewUser({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    role: 'student',
                    phone: '',
                    department: '',
                    admissionStatus: '',
                    enrollId: '',
                    childGender: '',
                    childDepartment: '',
                    childAdmissionStatus: '',
                    selectedChildId: ''
                });

                setTempFaceDescriptor(null);
                fetchUsers();
                fetchStudentProfiles(); // reload student profiles
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || error.response?.data?.message || 'Failed to create user');
        }
    };

    const handleEditClick = (user) => {
        let childGender = '';
        let childDepartment = '';
        let childAdmissionStatus = '';
        let selectedChildId = '';

        if (user.role === 'parent' && user.parentProfile && user.parentProfile.students && user.parentProfile.students.length > 0) {
            const childId = String(user.parentProfile.students[0]);
            selectedChildId = childId;
            const student = studentProfiles.find(s => String(s._id) === childId);
            if (student) {
                childGender = student.gender || '';
                childDepartment = student.department || '';
                
                // match semester to year
                if (student.semester === 1 || student.semester === 2) childAdmissionStatus = 'First Year';
                else if (student.semester === 3 || student.semester === 4) childAdmissionStatus = 'Second Year';
                else if (student.semester === 5 || student.semester === 6) childAdmissionStatus = 'Third Year';
                else if (student.semester === 7 || student.semester === 8) childAdmissionStatus = 'Last Year';
            }
        }

        setEditUser({
            _id: user._id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            role: user.role || '',
            phone: user.phone || '',
            department: user.department || '',
            admissionStatus: user.admissionStatus || '',
            password: '',
            enrollId: user.enrollId || '',
            childGender,
            childDepartment,
            childAdmissionStatus,
            selectedChildId
        });
        setTempFaceDescriptor(null);
        setShowEditModal(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            // editUser ki copy banayein aur enrollId ko number mein convert karein
            const updateData = {
                ...editUser,
                enrollId: editUser.enrollId ? Number(editUser.enrollId) : null,
                studentId: editUser.role === 'parent' ? editUser.selectedChildId : undefined
            };

            // Agar password empty hai toh use delete kar dein taaki purana password na badle
            if (!updateData.password) delete updateData.password;

            const res = await api.put(`/super-admin/users/${editUser._id}`, updateData);

            if (res.data.success) {
                // Agar naya face scan kiya hai toh use upload karein
                if (tempFaceDescriptor) {
                    await uploadFaceData(editUser._id, tempFaceDescriptor);
                }

                toast.success('User updated successfully');
                setShowEditModal(false);
                fetchUsers(); // Table refresh karein taaki nayi ID dikhne lage
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await api.put(`/super-admin/users/${id}/status`);
            if (res.data.success) { toast.success(res.data.message); fetchUsers(); }
        } catch (error) { toast.error('Failed to update status'); }
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            const res = await api.delete(`/super-admin/users/${id}`);
            if (res.data.success) { toast.success(res.data.message); fetchUsers(); }
        } catch (error) { toast.error('Failed to delete user'); }
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            super_admin: '#e74c3c', admin: '#8e44ad', teacher: '#2980b9',
            student: '#27ae60', parent: '#f39c12', accountant: '#1abc9c',
            librarian: '#e67e22', receptionist: '#3498db',
        };
        return colors[role] || '#95a5a6';
    };

    return (
        <div className="student-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1><FiUsers style={{ marginRight: 8 }} /> User Management</h1>
                    <p>Manage all system users, roles, and permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setNewUser({
                        firstName: '',
                        lastName: '',
                        email: '',
                        password: '',
                        role: 'student',
                        phone: '',
                        department: '',
                        admissionStatus: '',
                        enrollId: '',
                        childGender: '',
                        childDepartment: '',
                        childAdmissionStatus: '',
                        selectedChildId: ''
                    });
                    setTempFaceDescriptor(null);
                    setShowCreateModal(true);
                }}>
                    <FiPlus /> Create User
                </button>
            </div>

            <div className="section-card" style={{ marginBottom: 'var(--spacing-4)' }}>
                <div style={{ padding: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--spacing-2)', flex: 1, minWidth: 200 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                style={{ paddingLeft: 36 }}
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary">Search</button>
                    </form>
                    <select
                        className="form-input"
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        style={{ width: 180 }}
                    >
                        <option value="">All Roles</option>
                        {allRoles.map(r => (
                            <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="section-card">
                <div className="table-container">
                    {loading ? (
                        <div className="page-loading"><div className="spinner"></div></div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Enroll ID</th>
                                    <th>Status</th>
                                    <th>Last Login</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u._id}>
                                        <td><strong>{u.firstName} {u.lastName}</strong></td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{u.email}</td>
                                        <td>
                                            <span style={{
                                                background: getRoleBadgeColor(u.role),
                                                color: '#fff',
                                                borderRadius: 12,
                                                padding: '4px 12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                            }}>
                                                {u.role.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        {/* --- NAYA ENROLL ID COLUMN --- */}
                                        <td style={{ fontWeight: 'bold', color: '#3b82f6', textAlign: 'center' }}>
                                            {u.enrollId || <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>--</span>}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleToggleStatus(u._id)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: u.isActive ? '#27ae60' : '#e74c3c',
                                                    display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
                                                }}
                                            >
                                                {u.isActive ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                                                {u.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button onClick={() => handleEditClick(u)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                                    <FiEdit />
                                                </button>
                                                <button onClick={() => handleDeleteUser(u._id, `${u.firstName} ${u.lastName}`)} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {!loading && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-4)',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        borderBottomLeftRadius: 'var(--radius-xl)',
                        borderBottomRightRadius: 'var(--radius-xl)',
                        flexWrap: 'wrap',
                        gap: 'var(--spacing-3)'
                    }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Showing {users.length} of {pagination.total} users
                        </div>
                        {pagination.pages > 1 && (
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                    style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                                >
                                    Previous
                                </button>
                                <span style={{ fontSize: '0.875rem', padding: '0 var(--spacing-2)', color: 'var(--text-main)', fontWeight: 500 }}>
                                    Page {pagination.page} of {pagination.pages}
                                </span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                                    style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--spacing-6)', width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-4)' }}>Create New User</h2>
                        <form onSubmit={handleCreateUser}>
                            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                                    <div>
                                        <label className="form-label">First Name</label>
                                        <input className="form-input" required value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="form-label">Last Name</label>
                                        <input className="form-input" required value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Password</label>
                                    <input className="form-input" type="password" required minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Role</label>
                                    <select className="form-input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                                        {allRoles.map(r => (
                                            <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                                        ))}
                                    </select>
                                </div>
                                {newUser.role === 'parent' && (
                                    <div style={{
                                        marginTop: 'var(--spacing-2)',
                                        padding: 'var(--spacing-4)',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        display: 'grid',
                                        gap: 'var(--spacing-3)'
                                    }}>
                                        <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>Children Information</h4>
                                        <div>
                                            <label className="form-label">Child Gender</label>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                                {['Male', 'Female', 'Other'].map(g => (
                                                    <button
                                                        key={g}
                                                        type="button"
                                                        className={`btn ${newUser.childGender === g ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setNewUser({
                                                            ...newUser,
                                                            childGender: g,
                                                            childDepartment: '',
                                                            childAdmissionStatus: '',
                                                            selectedChildId: ''
                                                        })}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 12px',
                                                            fontSize: '0.85rem',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: newUser.childGender === g ? 'none' : '1px solid var(--border-color)',
                                                            fontWeight: newUser.childGender === g ? 600 : 400
                                                        }}
                                                    >
                                                        {g}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {newUser.childGender && (
                                            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                                                <div>
                                                    <label className="form-label">Child Department</label>
                                                    <select
                                                        className="form-input"
                                                        value={newUser.childDepartment}
                                                        onChange={(e) => setNewUser({
                                                            ...newUser,
                                                            childDepartment: e.target.value,
                                                            selectedChildId: ''
                                                        })}
                                                    >
                                                        <option value="">Select Department (Optional)</option>
                                                        {departments.map(dept => (
                                                            <option key={dept} value={dept}>{dept}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Child Admission Status (Year)</label>
                                                    <select
                                                        className="form-input"
                                                        value={newUser.childAdmissionStatus}
                                                        onChange={(e) => setNewUser({
                                                            ...newUser,
                                                            childAdmissionStatus: e.target.value,
                                                            selectedChildId: ''
                                                        })}
                                                    >
                                                        <option value="">Select Year (Optional)</option>
                                                        <option value="First Year">First Year</option>
                                                        <option value="Second Year">Second Year</option>
                                                        <option value="Direct Second Year">Direct Second Year</option>
                                                        <option value="Third Year">Third Year</option>
                                                        <option value="Last Year">Last Year</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Choose Child (Student Name) *</label>
                                                    <select
                                                        className="form-input"
                                                        required
                                                        value={newUser.selectedChildId}
                                                        onChange={(e) => setNewUser({ ...newUser, selectedChildId: e.target.value })}
                                                    >
                                                        <option value="">Choose Child</option>
                                                        {getFilteredChildren(newUser.childGender, newUser.childDepartment, newUser.childAdmissionStatus).map(s => (
                                                            <option key={s._id} value={s._id}>
                                                                {s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown Student'} ({s.rollNumber || 'No Roll#'} - {s.department})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {getFilteredChildren(newUser.childGender, newUser.childDepartment, newUser.childAdmissionStatus).length === 0 && (
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#e74c3c' }}>
                                                            No students found matching the selected filters.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {newUser.role === 'student' && (
                                    <div>
                                        <label className="form-label">Admission Status</label>
                                        <select className="form-input" value={newUser.admissionStatus} onChange={(e) => setNewUser({ ...newUser, admissionStatus: e.target.value })}>
                                            <option value="">Select Year</option>
                                            <option value="First Year">First Year</option>
                                            <option value="Second Year">Second Year</option>
                                            <option value="Direct Second Year">Direct Second Year</option>
                                            <option value="Third Year">Third Year</option>
                                            <option value="Last Year">Last Year</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="form-label">Department</label>
                                    <select
                                        className="form-input"
                                        required={newUser.role !== 'parent' && newUser.role !== 'super_admin'}
                                        disabled={newUser.role === 'parent' || newUser.role === 'super_admin'}
                                        value={(newUser.role === 'parent' || newUser.role === 'super_admin') ? '' : newUser.department}
                                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* SuperAdminUsers.js ke Create User Form mein Password field ke baad ise lagayein */}
                                <div>
                                    <label className="form-label">Biometric Enroll ID</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder={newUser.role === 'parent' ? "Not applicable for parents" : "Assign Fingerprint ID"}
                                        disabled={newUser.role === 'parent'}
                                        value={newUser.role === 'parent' ? '' : newUser.enrollId}
                                        onChange={(e) => setNewUser({ ...newUser, enrollId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowCreateModal(false);
                                    setNewUser({
                                        firstName: '',
                                        lastName: '',
                                        email: '',
                                        password: '',
                                        role: 'student',
                                        phone: '',
                                        department: '',
                                        admissionStatus: '',
                                        enrollId: '',
                                        childGender: '',
                                        childDepartment: '',
                                        childAdmissionStatus: '',
                                        selectedChildId: ''
                                    });
                                }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--spacing-6)', width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-4)' }}>Edit User</h2>
                        <form onSubmit={handleUpdateUser}>
                            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                                    <div>
                                        <label className="form-label">First Name</label>
                                        <input className="form-input" required value={editUser.firstName} onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="form-label">Last Name</label>
                                        <input className="form-input" required value={editUser.lastName} onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" required value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">New Password</label>
                                    <input className="form-input" type="password" minLength={6} value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} placeholder="Leave blank to keep same" />
                                </div>
                                <div>
                                    <label className="form-label">Role</label>
                                    <select className="form-input" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                                        {allRoles.map(r => (
                                            <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                                        ))}
                                    </select>
                                </div>
                                {editUser.role === 'parent' && (
                                    <div style={{
                                        marginTop: 'var(--spacing-2)',
                                        padding: 'var(--spacing-4)',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        display: 'grid',
                                        gap: 'var(--spacing-3)'
                                    }}>
                                        <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>Children Information</h4>
                                        <div>
                                            <label className="form-label">Child Gender</label>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                                {['Male', 'Female', 'Other'].map(g => (
                                                    <button
                                                        key={g}
                                                        type="button"
                                                        className={`btn ${editUser.childGender === g ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setEditUser({
                                                            ...editUser,
                                                            childGender: g,
                                                            childDepartment: '',
                                                            childAdmissionStatus: '',
                                                            selectedChildId: ''
                                                        })}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 12px',
                                                            fontSize: '0.85rem',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: editUser.childGender === g ? 'none' : '1px solid var(--border-color)',
                                                            fontWeight: editUser.childGender === g ? 600 : 400
                                                        }}
                                                    >
                                                        {g}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {editUser.childGender && (
                                            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                                                <div>
                                                    <label className="form-label">Child Department</label>
                                                    <select
                                                        className="form-input"
                                                        value={editUser.childDepartment}
                                                        onChange={(e) => setEditUser({
                                                            ...editUser,
                                                            childDepartment: e.target.value,
                                                            selectedChildId: ''
                                                        })}
                                                    >
                                                        <option value="">Select Department (Optional)</option>
                                                        {departments.map(dept => (
                                                            <option key={dept} value={dept}>{dept}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Child Admission Status (Year)</label>
                                                    <select
                                                        className="form-input"
                                                        value={editUser.childAdmissionStatus}
                                                        onChange={(e) => setEditUser({
                                                            ...editUser,
                                                            childAdmissionStatus: e.target.value,
                                                            selectedChildId: ''
                                                        })}
                                                    >
                                                        <option value="">Select Year (Optional)</option>
                                                        <option value="First Year">First Year</option>
                                                        <option value="Second Year">Second Year</option>
                                                        <option value="Direct Second Year">Direct Second Year</option>
                                                        <option value="Third Year">Third Year</option>
                                                        <option value="Last Year">Last Year</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Choose Child (Student Name) *</label>
                                                    <select
                                                        className="form-input"
                                                        required
                                                        value={editUser.selectedChildId}
                                                        onChange={(e) => setEditUser({ ...editUser, selectedChildId: e.target.value })}
                                                    >
                                                        <option value="">Choose Child</option>
                                                        {getFilteredChildren(editUser.childGender, editUser.childDepartment, editUser.childAdmissionStatus).map(s => (
                                                            <option key={s._id} value={s._id}>
                                                                {s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown Student'} ({s.rollNumber || 'No Roll#'} - {s.department})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {getFilteredChildren(editUser.childGender, editUser.childDepartment, editUser.childAdmissionStatus).length === 0 && (
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#e74c3c' }}>
                                                            No students found matching the selected filters.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {editUser.role === 'student' && (
                                    <div>
                                        <label className="form-label">Admission Status</label>
                                        <select className="form-input" value={editUser.admissionStatus} onChange={(e) => setEditUser({ ...editUser, admissionStatus: e.target.value })}>
                                            <option value="">Select Year</option>
                                            <option value="First Year">First Year</option>
                                            <option value="Second Year">Second Year</option>
                                            <option value="Direct Second Year">Direct Second Year</option>
                                            <option value="Third Year">Third Year</option>
                                            <option value="Last Year">Last Year</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="form-label">Department</label>
                                    <select
                                        className="form-input"
                                        required={editUser.role !== 'parent' && editUser.role !== 'super_admin'}
                                        disabled={editUser.role === 'parent' || editUser.role === 'super_admin'}
                                        value={(editUser.role === 'parent' || editUser.role === 'super_admin') ? '' : editUser.department}
                                        onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Edit Modal mein Phone field ke baad ise lagayein */}
                                <div>
                                    <label className="form-label">Biometric Enroll ID</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder={editUser.role === 'parent' ? "Not applicable for parents" : "Assign Fingerprint ID"}
                                        disabled={editUser.role === 'parent'}
                                        value={editUser.role === 'parent' ? '' : editUser.enrollId}
                                        onChange={(e) => setEditUser({ ...editUser, enrollId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={editUser.phone} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Update User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminUsers;