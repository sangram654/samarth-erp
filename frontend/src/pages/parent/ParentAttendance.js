import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiCheck, FiX, FiClock, FiPieChart, FiChevronLeft } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { parentService } from '../../services/api';
import io from 'socket.io-client';
import './ParentPages.css';

const ParentAttendance = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [wardsData, setWardsData] = useState([]);
    const [selectedWard, setSelectedWard] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, percentage: 0 });
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    const fetchWardsData = useCallback(async () => {
        try {
            const res = await parentService.getWardDashboard();
            const wards = res.data.data || [];
            setWardsData(wards);
            if (wards.length > 0) {
                setSelectedWard(wards[0]);
            } else {
                setLoading(false); // No wards → stop loading
            }
        } catch (error) {
            console.error('Error fetching wards:', error);
            setWardsData([]);
            setSelectedWard(null);
            setLoading(false);
        }
    }, []);

    const fetchAttendance = useCallback(async () => {
        setLoading(true);
        try {
            const res = await parentService.getWardAttendance(selectedWard.student.id, { month: selectedMonth });
            const attendanceData = res.data.data || [];
            setAttendance(attendanceData);

            // Calculate summary
            const present = attendanceData.filter(a => ['Present', 'Late'].includes(a.status)).length;
            const absent = attendanceData.filter(a => a.status === 'Absent').length;
            const late = attendanceData.filter(a => a.status === 'Late').length;
            const total = attendanceData.length;

            setSummary({
                total,
                present,
                absent,
                late,
                percentage: total > 0 ? Math.round((present / total) * 100) : 0
            });
        } catch (error) {
            console.error('Error fetching attendance:', error);
            setAttendance([]);
            setSummary({ total: 0, present: 0, absent: 0, late: 0, percentage: 0 });
        }
        setLoading(false);
    }, [selectedWard, selectedMonth]);

    const fetchActivityLogs = async () => {
        try {
            const res = await api.get('/activity-logs');
            if (res.data.success) {
                setActivityLogs(res.data.data);
            }
        } catch (err) {
            console.error("Error fetching activity logs:", err);
        }
    };

    useEffect(() => {
        fetchWardsData();
        fetchActivityLogs();
    }, [fetchWardsData]);

    useEffect(() => {
        if (selectedWard) {
            fetchAttendance();
        }
    }, [selectedWard, fetchAttendance]);

    useEffect(() => {
        if (!user) return;
        
        const socketUrl = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000`;
        const socket = io(socketUrl);
        
        socket.on('connect', () => {
            console.log("🔌 Parent Attendance Socket Connected");
            socket.emit('register-user', { userId: user.id || user._id, role: user.role });
        });
        
        socket.on('new-activity-log', (newLog) => {
            setActivityLogs(prev => {
                if (prev.some(log => log._id === newLog._id)) return prev;
                return [newLog, ...prev].slice(0, 50);
            });
            fetchAttendance(); // Refresh ward attendance metrics instantly
        });
        
        return () => {
            socket.disconnect();
        };
    }, [user, fetchAttendance]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Present': return <FiCheck className="status-icon present" />;
            case 'Absent': return <FiX className="status-icon absent" />;
            case 'Late': return <FiClock className="status-icon late" />;
            default: return null;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Present': return 'badge-success';
            case 'Absent': return 'badge-error';
            case 'Late': return 'badge-warning';
            default: return 'badge-info';
        }
    };

    const months = [
        { value: '2024-12', label: 'December 2024' },
        { value: '2024-11', label: 'November 2024' },
        { value: '2024-10', label: 'October 2024' },
        { value: '2024-09', label: 'September 2024' },
        { value: '2024-08', label: 'August 2024' },
    ];

    if (loading && !selectedWard) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading attendance...</p>
            </div>
        );
    }

    return (
        <div className="parent-page animate-fade-in">
            <div className="page-header">
                <div className="header-left">
                    <Link to="/parent/dashboard" className="back-link">
                        <FiChevronLeft /> Back to Dashboard
                    </Link>
                    <h1>Ward's Attendance</h1>
                    <p>Track {selectedWard?.student?.name}'s attendance records</p>
                </div>
                <div className="header-actions">
                    {wardsData.length > 1 && (
                        <select
                            className="form-select"
                            value={selectedWard?.student?.id || ''}
                            onChange={(e) => {
                                const ward = wardsData.find(w => w.student.id === e.target.value);
                                setSelectedWard(ward);
                            }}
                        >
                            {wardsData.map(ward => (
                                <option key={ward.student.id} value={ward.student.id}>
                                    {ward.student.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-icon total">
                        <FiCalendar />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.total}</h3>
                        <p>Total Classes</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon present">
                        <FiCheck />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.present}</h3>
                        <p>Present</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon absent">
                        <FiX />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.absent}</h3>
                        <p>Absent</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon percentage">
                        <FiPieChart />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.percentage}%</h3>
                        <p>Attendance</p>
                    </div>
                    <div className={`status-indicator ${summary.percentage >= 75 ? 'good' : 'warning'}`}>
                        {summary.percentage >= 75 ? 'Good' : 'Low'}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="attendance-progress-card">
                <div className="progress-header">
                    <span>Overall Attendance</span>
                    <span className={`percentage ${summary.percentage >= 75 ? 'good' : 'warning'}`}>
                        {summary.percentage}%
                    </span>
                </div>
                <div className="progress-bar">
                    <div
                        className={`progress-fill ${summary.percentage >= 75 ? 'good' : 'warning'}`}
                        style={{ width: `${summary.percentage}%` }}
                    ></div>
                </div>
                <p className="progress-note">
                    {summary.percentage >= 75
                        ? '✅ Your ward meets the minimum attendance requirement'
                        : '⚠️ Your ward\'s attendance is below the 75% requirement'}
                </p>
            </div>

            {/* Attendance Table */}
            <div className="section-card">
                <div className="section-header">
                    <h2>Attendance Records</h2>
                    <span className="record-count">{attendance.length} records</span>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ minHeight: '200px' }}>
                        <div className="spinner"></div>
                    </div>
                ) : attendance.length > 0 ? (
                    <div className="table-container">
                        <table className="table attendance-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Day</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendance.map((record) => (
                                    <tr key={record._id}>
                                        <td>
                                            <div className="date-cell">
                                                <span className="date-number">
                                                    {new Date(record.date).getDate()}
                                                </span>
                                                <span className="date-month">
                                                    {new Date(record.date).toLocaleString('default', { month: 'short' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {new Date(record.date).toLocaleString('default', { weekday: 'long' })}
                                        </td>
                                        <td>
                                            <div className="subject-cell">
                                                <span className="subject-name">{record.subject?.name || 'N/A'}</span>
                                                <span className="subject-code">{record.subject?.code || ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusClass(record.status)}`}>
                                                {getStatusIcon(record.status)}
                                                {record.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <FiCalendar size={48} />
                        <h3>No attendance records</h3>
                        <p>Attendance records for the selected month will appear here</p>
                    </div>
                )}
            </div>

            {/* Real-time Biometric & Attendance Logs */}
            <div className="section-card" style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '15px' }}>⚡ Real-time Biometric & Attendance Logs</h3>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Activity Log Message</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activityLogs.length > 0 ? (
                                activityLogs.map((log) => (
                                    <tr key={log._id}>
                                        <td><strong>{log.message}</strong></td>
                                        <td style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No attendance activity logs recorded yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ParentAttendance;
