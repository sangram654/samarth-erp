import React, { useState, useEffect, useCallback } from 'react';
import {
    FiCalendar, FiSearch, FiCheckCircle, FiAlertCircle,
    FiClock, FiFileText, FiCpu, FiUserPlus, FiActivity
} from 'react-icons/fi';
import { MdFingerprint } from 'react-icons/md';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './student/StudentPages.css';

// Socket connection setup
const socketUrl = (process.env.REACT_APP_API_URL || window.location.origin).replace('/api', '');
const socket = io(socketUrl);

const BiometricAttendance = () => {
    const { user, profile } = useAuth();
    const [reportData, setReportData] = useState([]);
    const [personalLogs, setPersonalLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [department, setDepartment] = useState('');
    const [semester, setSemester] = useState('');

    // Device and Simulator status
    const [deviceStatus, setDeviceStatus] = useState("Waiting for hardware connection... ⏳");
    const [settingCommand, setSettingCommand] = useState(false);

    const departments = [
        'Computer Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Electrical Engineering',
        'Electronics Engineering',
        'Information Technology',
        'Artificial Intelligence and Machine Learning'
    ];

    const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];

    // Define helper to check roles
    const isStudent = user?.role === 'student';
    const isParent = user?.role === 'parent';
    const isTeacher = user?.role === 'teacher';
    const isAdmin = user?.role === 'admin';
    const isSuperAdmin = user?.role === 'super_admin';
    const hasControls = isSuperAdmin || isAdmin || isTeacher;

    // Set initial department based on profile (for Admin and Teacher)
    useEffect(() => {
        if ((isAdmin || isTeacher) && profile?.department) {
            setDepartment(profile.department);
        }
    }, [isAdmin, isTeacher, profile]);

    // Fetch shift report and personal logs
    const fetchAttendanceData = useCallback(async () => {
        try {
            setLoading(true);
            const params = { date };

            // Only send filters if role permits it
            if (isSuperAdmin) {
                if (department) params.department = department;
            } else if (isAdmin || isTeacher) {
                params.department = profile?.department || '';
            }

            if (!isStudent && !isParent && semester) {
                params.semester = semester;
            }

            const res = await api.get('/attendance2/shift-report', { params });
            if (res.data.success) {
                setReportData(res.data.data || []);
                setPersonalLogs(res.data.personalLogs || []);
            }
        } catch (error) {
            console.error('Error fetching biometric attendance:', error);
            toast.error(error.response?.data?.error || 'Failed to load attendance records.');
        } finally {
            setLoading(false);
        }
    }, [date, department, semester, isSuperAdmin, isAdmin, isTeacher, isStudent, isParent, profile]);

    // Fetch data on parameters change
    useEffect(() => {
        fetchAttendanceData();
    }, [fetchAttendanceData]);

    // Connect socket.io listeners
    useEffect(() => {
        socket.on('device-status-update', (data) => {
            setDeviceStatus(data.text);
        });

        socket.on('new-biometric-attendance', (newData) => {
            // Live fetch refresh
            fetchAttendanceData();

            // Show toast if it matches student user or if user is teacher/admin
            if (isStudent && String(newData.user) === String(user?.enrollId)) {
                toast.success(`Biometric scanned at ${newData.deviceId}!`);
            } else if (!isStudent && !isParent) {
                toast.info(`New Biometric scan received for ID: ${newData.user}`);
            }
        });

        return () => {
            socket.off('device-status-update');
            socket.off('new-biometric-attendance');
        };
    }, [fetchAttendanceData, isStudent, isParent, user]);

    // Hardware command handlers
    const handleStartEnrollment = async () => {
        const id = prompt("Enter Enrollment Fingerprint ID (1-127):");
        if (!id) return;

        const numericId = parseInt(id);
        if (isNaN(numericId) || numericId < 1 || numericId > 127) {
            toast.error("Invalid ID. Must be a number between 1 and 127.");
            return;
        }

        try {
            setSettingCommand(true);
            const res = await api.post('/attendance2/setCommand', {
                mode: "ENROLL",
                enrollId: numericId
            });
            if (res.data.success) {
                setDeviceStatus(`Registering ID ${numericId} on hardware... Place finger`);
                toast.success(`Enrollment mode active for ID ${numericId}`);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to set hardware enrollment mode.");
        } finally {
            setSettingCommand(false);
        }
    };

    const handleCheckAttendanceMode = async () => {
        try {
            setSettingCommand(true);
            setDeviceStatus("Initializing scanner device...");
            const res = await api.post('/attendance2/setCommand', {
                mode: "ATTENDANCE",
                enrollId: null
            });
            if (res.data.success) {
                setDeviceStatus("Scan Attendance Mode active... Ready");
                toast.success("Biometric Terminal set to Scan Mode");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to reset scanner to attendance mode.");
        } finally {
            setSettingCommand(false);
        }
    };

    // UI Badges helper
    const getStatusBadge = (status) => {
        if (status === 'Present') {
            return <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Present</span>;
        }
        return <span className="badge badge-error" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Absent</span>;
    };

    const getSummaryBadge = (summary) => {
        if (summary === 'Fully Present') {
            return <span className="badge badge-success" style={{ fontWeight: 'bold' }}>Fully Present</span>;
        } else if (summary?.startsWith('Partially Present')) {
            return <span className="badge badge-warning" style={{ fontWeight: 'bold' }}>{summary}</span>;
        }
        return <span className="badge badge-error" style={{ fontWeight: 'bold' }}>Absent</span>;
    };

    // Calculate report statistics
    const totalCount = reportData.length;
    const fullyPresentCount = reportData.filter(d => d.summary === 'Fully Present').length;
    const partiallyPresentCount = reportData.filter(d => d.summary?.startsWith('Partially Present')).length;
    const absentCount = reportData.filter(d => d.summary === 'Absent' || d.summary?.startsWith('Absent')).length;

    // Find personal student row if the user is a student
    const studentRow = isStudent
        ? reportData.find(row => String(row.enrollId) === String(user?.enrollId)) || (reportData.length > 0 ? reportData[0] : null)
        : null;

    return (
        <div className="student-page animate-fade-in">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1><FiClock style={{ marginRight: 8 }} /> Biometric Attendance</h1>
                    <p>Live verification and shift tracking connected directly to main gate hardware</p>
                </div>
            </div>

            {/* Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: hasControls ? '1.2fr 1fr' : '1fr', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)', alignItems: 'start' }}>

                {/* 1. Hardware Status & Controls (Super Admin / Admin / Teacher only) */}
                {hasControls && (
                    <div className="section-card" style={{ padding: 'var(--spacing-6)' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FiCpu /> Hardware Terminal Control
                        </h2>

                        <div style={{ background: '#0f172a', color: '#10b981', padding: '15px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--spacing-5)', border: '1px solid #1e293b', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FiActivity className="animate-pulse" />
                            <span>System Status: <strong>{deviceStatus}</strong></span>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                            <button
                                onClick={handleStartEnrollment}
                                className="btn btn-primary"
                                disabled={settingCommand}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <FiUserPlus /> Enroll Fingerprint
                            </button>
                            <button
                                onClick={handleCheckAttendanceMode}
                                className="btn btn-outline"
                                disabled={settingCommand}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <MdFingerprint size={20} /> Mark Attendance Mode
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Personal Log Scans (For logged-in users with enrollId) */}
                {user?.enrollId !== null && user?.enrollId !== undefined && (
                    <div className="section-card" style={{ padding: 'var(--spacing-6)', maxHeight: '200px', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MdFingerprint /> My Live Scans (Today)
                        </h2>
                        {personalLogs.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '10px 0' }}>
                                No raw scans logged for your ID ({user.enrollId}) today yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {personalLogs.map((log) => (
                                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                                        <div>
                                            <strong>{log.deviceId}</strong>
                                            <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>ID: {log.enrollId}</span>
                                        </div>
                                        <div style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                                            {new Date(log.time).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Filters Section */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div style={{ padding: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FiCalendar /> Select Date
                        </label>
                        <input
                            type="date"
                            className="form-input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            style={{ width: '160px' }}
                        />
                    </div>

                    {/* Super Admin / Admin / Teacher filters */}
                    {!isStudent && !isParent && (
                        <>
                            {isSuperAdmin ? (
                                <div>
                                    <label className="form-label">Department</label>
                                    <select
                                        className="form-input"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        style={{ width: '220px' }}
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="form-label">Department</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={profile?.department || 'Not Assigned'}
                                        disabled
                                        style={{ width: '220px', background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-input"
                                    value={semester}
                                    onChange={(e) => setSemester(e.target.value)}
                                    style={{ width: '120px' }}
                                >
                                    <option value="">All Semesters</option>
                                    {semesters.map(sem => (
                                        <option key={sem} value={sem}>Sem {sem}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary" onClick={fetchAttendanceData} style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiSearch /> Search Report
                    </button>
                </div>
            </div>

            {/* KPI Cards (Only if not student or parent) */}
            {!isStudent && !isParent && (
                <div className="summary-grid" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <div className="summary-card">
                        <div className="summary-icon total">
                            <FiFileText />
                        </div>
                        <div className="summary-content">
                            <h3>{totalCount}</h3>
                            <p>Total Students</p>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-icon present">
                            <FiCheckCircle />
                        </div>
                        <div className="summary-content">
                            <h3>{fullyPresentCount}</h3>
                            <p>Fully Present</p>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-icon percentage" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <FiClock />
                        </div>
                        <div className="summary-content">
                            <h3>{partiallyPresentCount}</h3>
                            <p>Partially Present</p>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-icon absent">
                            <FiAlertCircle />
                        </div>
                        <div className="summary-content">
                            <h3>{absentCount}</h3>
                            <p>Absent</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Personal Dashboard Card for Student */}
            {isStudent && studentRow && (
                <div className="section-card animate-fade-in" style={{ marginBottom: 'var(--spacing-6)', padding: 'var(--spacing-6)' }}>
                    <h2 style={{ marginBottom: 'var(--spacing-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiCheckCircle /> Biometric Shift & Gate Overview ({new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
                    </h2>
                    
                    {/* Overall Summary Banner */}
                    <div style={{
                        background: studentRow.summary === 'Fully Present' ? 'rgba(34, 197, 94, 0.1)' : studentRow.summary?.startsWith('Partially') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: studentRow.summary === 'Fully Present' ? '1px solid rgba(34, 197, 94, 0.3)' : studentRow.summary?.startsWith('Partially') ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '15px 20px',
                        marginBottom: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Overall Attendance Status</span>
                            <h3 style={{
                                margin: '5px 0 0 0',
                                color: studentRow.summary === 'Fully Present' ? '#22c55e' : studentRow.summary?.startsWith('Partially') ? '#f59e0b' : '#ef4444',
                                fontSize: '1.5rem',
                                fontWeight: '700'
                            }}>
                                {studentRow.summary}
                            </h3>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Gate Status</span>
                            <div style={{ marginTop: '5px' }}>
                                {studentRow.gateIn ? (
                                    studentRow.gateOut ? (
                                        <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Gate Verified ✅</span>
                                    ) : (
                                        <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Gate OUT Pending ⚠️</span>
                                    )
                                ) : (
                                    <span className="badge badge-error" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Gate IN Missing ❌</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Timeline Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
                        
                        {/* Gate IN Checkpoint */}
                        <div className="summary-card" style={{ borderTop: studentRow.gateIn ? '4px solid #22c55e' : '4px solid #ef4444', padding: '15px', borderRadius: '8px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>1. Gate IN</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: studentRow.gateIn ? '#22c55e' : '#ef4444', margin: '8px 0' }}>
                                {studentRow.gateIn ? studentRow.gateIn : 'Missing'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time: 9:00 AM - 10:00 AM</div>
                        </div>

                        {/* Shift 1 Checkpoint */}
                        <div className="summary-card" style={{ borderTop: studentRow.shift1.status === 'Present' ? '4px solid #22c55e' : '4px solid #ef4444', padding: '15px', borderRadius: '8px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>2. Shift 1</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: studentRow.shift1.status === 'Present' ? '#22c55e' : '#ef4444', margin: '8px 0' }}>
                                {studentRow.shift1.status === 'Present' ? studentRow.shift1.checkIn : 'Absent'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time: 9:30 AM - 11:30 AM</div>
                        </div>

                        {/* Shift 2 Checkpoint */}
                        <div className="summary-card" style={{ borderTop: studentRow.shift2.status === 'Present' ? '4px solid #22c55e' : '4px solid #ef4444', padding: '15px', borderRadius: '8px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>3. Shift 2</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: studentRow.shift2.status === 'Present' ? '#22c55e' : '#ef4444', margin: '8px 0' }}>
                                {studentRow.shift2.status === 'Present' ? studentRow.shift2.checkIn : 'Absent'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time: 11:45 AM - 1:45 PM</div>
                        </div>

                        {/* Shift 3 Checkpoint */}
                        <div className="summary-card" style={{ borderTop: studentRow.shift3.status === 'Present' ? '4px solid #22c55e' : '4px solid #ef4444', padding: '15px', borderRadius: '8px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>4. Shift 3</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: studentRow.shift3.status === 'Present' ? '#22c55e' : '#ef4444', margin: '8px 0' }}>
                                {studentRow.shift3.status === 'Present' ? studentRow.shift3.checkIn : 'Absent'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time: 2:30 PM - 4:30 PM</div>
                        </div>

                        {/* Gate OUT Checkpoint */}
                        <div className="summary-card" style={{ borderTop: studentRow.gateOut ? '4px solid #22c55e' : '4px solid #ef4444', padding: '15px', borderRadius: '8px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>5. Gate OUT</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: studentRow.gateOut ? '#22c55e' : '#ef4444', margin: '8px 0' }}>
                                {studentRow.gateOut ? studentRow.gateOut : 'Missing'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time: &gt;= 4:30 PM</div>
                        </div>

                    </div>
                </div>
            )}

            {/* Detailed Table Card */}
            <div className="section-card">
                <div className="table-container">
                    {loading ? (
                        <div className="page-loading"><div className="spinner"></div></div>
                    ) : reportData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-muted)' }}>
                            <FiAlertCircle size={48} style={{ marginBottom: 'var(--spacing-3)' }} />
                            <h3>No double-validation logs found</h3>
                            <p>Select a date, department, or verify if student biometric logs exist.</p>
                        </div>
                    ) : (
                        <table className="table" style={{ fontSize: '0.875rem' }}>
                            <thead>
                                <tr>
                                    <th>Name (Roll No)</th>
                                    <th>Enroll ID</th>
                                    {!isTeacher && <th>Gate IN (9:00 - 10:00)</th>}
                                    <th>Shift 1 (9:30 - 11:30)</th>
                                    <th>Shift 2 (11:45 - 1:45)</th>
                                    <th>Shift 3 (2:30 - 4:30)</th>
                                    {!isTeacher && <th>Gate OUT (&gt;= 4:30)</th>}
                                    {!isTeacher && <th>Gate Status</th>}
                                    <th>Summary Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row) => (
                                    <tr key={row.studentId}>
                                        <td>
                                            <strong>{row.firstName} {row.lastName}</strong>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Roll/ID: {row.rollNumber}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{row.enrollId || '--'}</td>

                                        {/* Gate IN cell */}
                                        {!isTeacher && (
                                            <td style={{ fontWeight: '500', color: row.gateIn ? '#10b981' : '#ef4444' }}>
                                                {row.gateIn ? `🟢 ${row.gateIn}` : '❌ Missing'}
                                            </td>
                                        )}

                                        {/* Shift 1 cell */}
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {getStatusBadge(row.shift1.status)}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {row.shift1.checkIn ? `Time: ${row.shift1.checkIn}` : 'No Check-in'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Shift 2 cell */}
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {getStatusBadge(row.shift2.status)}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {row.shift2.checkIn ? `Time: ${row.shift2.checkIn}` : 'No Check-in'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Shift 3 cell */}
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {getStatusBadge(row.shift3.status)}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {row.shift3.checkIn ? `Time: ${row.shift3.checkIn}` : 'No Check-in'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Gate OUT cell */}
                                        {!isTeacher && (
                                            <td style={{ fontWeight: '500', color: row.gateOut ? '#10b981' : '#ef4444' }}>
                                                {row.gateOut ? `🟢 ${row.gateOut}` : '❌ Missing'}
                                            </td>
                                        )}

                                        {/* Gate Status Badge */}
                                        {!isTeacher && (
                                            <td>
                                                {row.gateIn ? (
                                                    row.gateOut ? (
                                                        <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>Marked</span>
                                                    ) : (
                                                        <span className="badge badge-warning" style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pending</span>
                                                    )
                                                ) : (
                                                    <span className="badge badge-error" style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>Absent</span>
                                                )}
                                            </td>
                                        )}

                                        {/* Final summary status */}
                                        <td>
                                            {getSummaryBadge(row.summary)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BiometricAttendance;
