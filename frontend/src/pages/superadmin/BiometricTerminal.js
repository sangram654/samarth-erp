import React, { useState, useEffect } from 'react';
import { FiCpu, FiAlertCircle, FiSettings, FiActivity } from 'react-icons/fi';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../student/StudentPages.css';

// Socket connection
const socket = io(process.env.REACT_APP_API_URL || window.location.origin);

const BiometricTerminal = () => {
    const { user } = useAuth();
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [deviceId, setDeviceId] = useState('MAIN_GATE');
    const [useLiveTime, setUseLiveTime] = useState(true);
    const [overrideDate, setOverrideDate] = useState(new Date().toISOString().split('T')[0]);
    const [overrideTime, setOverrideTime] = useState('09:15');
    const [scanFeed, setScanFeed] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sensorStatus, setSensorStatus] = useState('Sensor Ready / Standby 🟢');

    // Initialize deviceId based on role
    useEffect(() => {
        if (user?.role === 'teacher') {
            setDeviceId('CLASS_SCANNER');
        } else if (user?.role === 'super_admin') {
            setDeviceId('MAIN_GATE');
        }
    }, [user]);

    // Fetch student list on mount
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                if (user?.role === 'super_admin') {
                    // Fetch student users (unfiltered limit to get seeded users)
                    const res = await api.get('/super-admin/users', { params: { role: 'student', limit: 100 } });
                    if (res.data.success) {
                        setStudents(res.data.data.filter(s => s.enrollId !== null));
                    }
                } else if (user?.role === 'teacher') {
                    // Fetch student profiles via standard endpoint
                    const res = await api.get('/students', { params: { limit: 100 } });
                    if (res.data.success) {
                        const mapped = res.data.data
                            .filter(s => s.user && s.user.enrollId !== null && s.user.enrollId !== undefined)
                            .map(s => ({
                                _id: s.user._id,
                                firstName: s.user.firstName,
                                lastName: s.user.lastName,
                                email: s.user.email,
                                enrollId: s.user.enrollId
                            }));
                        setStudents(mapped);
                    }
                }
            } catch (error) {
                console.error('Error fetching students:', error);
                toast.error('Failed to load student profiles.');
            }
            setLoading(false);
        };
        if (user) {
            fetchStudents();
        }
    }, [user]);

    // Listen to real-time socket events
    useEffect(() => {
        socket.on('device-status-update', (data) => {
            setSensorStatus(data.text);
        });

        socket.on('new-biometric-attendance', (newData) => {
            setScanFeed(prev => [
                {
                    id: Math.random().toString(),
                    enrollId: newData.user,
                    deviceId: newData.deviceId || 'ESP32_SAMARTH',
                    time: new Date(newData.time || new Date()).toLocaleTimeString(),
                    status: newData.status || 'Present'
                },
                ...prev
            ].slice(0, 10)); // Limit to latest 10 logs
        });

        return () => {
            socket.off('new-biometric-attendance');
            socket.off('device-status-update');
        };
    }, []);

    // Simulate Fingerprint Scan submit logic
    const handleSimulateScan = async (e) => {
        e.preventDefault();
        if (!selectedStudent) {
            toast.warn('Please select a student first');
            return;
        }

        const student = students.find(s => s._id === selectedStudent);
        if (!student || !student.enrollId) {
            toast.error('Selected student does not have an Enroll ID assigned');
            return;
        }

        try {
            setSubmitting(true);

            // Construct timestamp
            let scanTime = new Date();
            if (!useLiveTime) {
                scanTime = new Date(`${overrideDate}T${overrideTime}:00`);
            }

            const res = await api.post('/attendance2/mark', {
                user: String(student.enrollId),
                deviceId: deviceId,
                status: 'Present',
                time: scanTime
            });

            if (res.data.success) {
                toast.success(`Fingerprint tap simulated successfully for ${student.firstName} ${student.lastName}!`);
            }
        } catch (error) {
            console.error('Scan simulation failed:', error);
            toast.error(error.response?.data?.message || 'Simulation request failed.');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter students list based on search
    const filteredStudents = students.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.enrollId).includes(searchQuery)
    );

    return (
        <div className="student-page animate-fade-in">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1><FiCpu style={{ marginRight: 8 }} /> Biometric Terminal Simulator</h1>
                    <p>Simulate hardware fingerprint scan logs for testing gate and classroom double validation</p>
                </div>
            </div>

            {/* Grid Container */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--spacing-6)', alignItems: 'start' }}>
                
                {/* Simulation Control Card */}
                <div className="section-card" style={{ padding: 'var(--spacing-6)' }}>
                    <h2 style={{ marginBottom: 'var(--spacing-5)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <FiSettings /> Control Panel
                    </h2>
                    
                    <form onSubmit={handleSimulateScan}>
                        <div style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
                            
                            {/* 1. Student Search & Select */}
                            <div>
                                <label className="form-label">Search & Select Student</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Type name, email or Enroll ID to search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ marginBottom: 'var(--spacing-2)' }}
                                />
                                {loading ? (
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading students...</div>
                                ) : (
                                    <select
                                        className="form-input"
                                        required
                                        value={selectedStudent}
                                        onChange={(e) => setSelectedStudent(e.target.value)}
                                        style={{ maxHeight: '200px' }}
                                    >
                                        <option value="">-- Select Student (Enroll ID) --</option>
                                        {filteredStudents.map(s => (
                                            <option key={s._id} value={s._id}>
                                                {s.firstName} {s.lastName} (Enroll ID: {s.enrollId})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="form-label">Terminal Device Scanner</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-2)' }}>
                                    {user?.role === 'super_admin' && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                                            <input
                                                type="radio"
                                                name="deviceId"
                                                value="MAIN_GATE"
                                                checked={deviceId === 'MAIN_GATE'}
                                                onChange={() => setDeviceId('MAIN_GATE')}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            Main Gate Scanner (Gate IN/OUT)
                                        </label>
                                    )}
                                    {user?.role === 'teacher' && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                                            <input
                                                type="radio"
                                                name="deviceId"
                                                value="CLASS_SCANNER"
                                                checked={deviceId === 'CLASS_SCANNER'}
                                                onChange={() => setDeviceId('CLASS_SCANNER')}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            Classroom Scanner (Shift 1/2/3)
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* 3. Time Customization */}
                            <div style={{ background: 'var(--bg-secondary)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-lg)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: 'var(--spacing-3)' }}>
                                    <input
                                        type="checkbox"
                                        checked={useLiveTime}
                                        onChange={(e) => setUseLiveTime(e.target.checked)}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    Use Live Current Time
                                </label>

                                {!useLiveTime && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--spacing-3)' }}>
                                        <div>
                                            <label className="form-label">Override Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={overrideDate}
                                                onChange={(e) => setOverrideDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label">Override Time</label>
                                            <input
                                                type="time"
                                                className="form-input"
                                                value={overrideTime}
                                                onChange={(e) => setOverrideTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Simulation Button */}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting}
                                style={{
                                    height: '50px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--spacing-2)',
                                    borderRadius: 'var(--radius-lg)',
                                    marginTop: 'var(--spacing-2)',
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>👆</span>
                                {submitting ? 'Simulating Scan...' : 'Simulate Fingerprint Tap'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Real-time Status and Scan Logs Feed */}
                <div style={{ display: 'grid', gap: 'var(--spacing-6)' }}>
                    
                    {/* Sensor Status Card */}
                    <div className="section-card" style={{ padding: 'var(--spacing-5)', borderLeft: '4px solid var(--primary-color)' }}>
                        <h3 style={{ margin: '0 0 var(--spacing-2)', fontSize: '0.875rem', textTransform: 'uppercase', tracking: '0.05em', color: 'var(--text-muted)' }}>
                            Hardware Terminal Status
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                            <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--primary-color)' }}></div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {sensorStatus}
                            </span>
                        </div>
                    </div>

                    {/* Live Logs Feed Card */}
                    <div className="section-card" style={{ padding: 'var(--spacing-6)', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <FiActivity /> Live Logs Feed
                        </h2>
                        
                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px' }}>
                            {scanFeed.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 'var(--spacing-2)' }}>
                                    <FiAlertCircle size={32} />
                                    <p style={{ margin: 0 }}>No raw scans recorded yet today.</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem' }}>Simulate a fingerprint scan to see logs populate.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                    {scanFeed.map(feed => {
                                        const std = students.find(s => String(s.enrollId) === String(feed.enrollId));
                                        return (
                                            <div
                                                key={feed.id}
                                                style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: 'var(--spacing-3) var(--spacing-4)',
                                                    borderRadius: 'var(--radius-md)',
                                                    borderLeft: feed.deviceId === 'MAIN_GATE' ? '3px solid #f59e0b' : '3px solid #10b981',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
                                                        {std ? `${std.firstName} ${std.lastName}` : `Enroll ID: ${feed.enrollId}`}
                                                    </h4>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Terminal: <strong>{feed.deviceId}</strong>
                                                    </span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{feed.time}</div>
                                                    <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                                                        SUCCESS
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default BiometricTerminal;
