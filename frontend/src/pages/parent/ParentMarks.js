import React, { useState, useEffect, useCallback } from 'react';
import { FiBook, FiAward, FiAlertTriangle, FiTrendingUp, FiChevronLeft } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { parentService } from '../../services/api';
import './ParentPages.css';

const ParentMarks = () => {
    const [loading, setLoading] = useState(true);
    const [wardsData, setWardsData] = useState([]);
    const [selectedWard, setSelectedWard] = useState(null);
    const [marks, setMarks] = useState([]);
    const [summary, setSummary] = useState({ cgpa: 0, totalCredits: 0, backlogs: 0, passed: 0 });

    const calculateSummary = useCallback((marksData) => {
        const passed = marksData.filter(m => m.status === 'Pass' || (m.obtainedMarks || m.marksObtained) >= (m.maxMarks * 0.4)).length;
        const backlogs = marksData.filter(m => m.status === 'Fail' || (m.obtainedMarks || m.marksObtained) < (m.maxMarks * 0.4)).length;
        const totalCredits = marksData.reduce((sum, m) => sum + (m.subject?.credits || 0), 0);

        // Calculate CGPA (simplified)
        const gradePoints = { 'O': 10, 'A+': 10, 'A': 9, 'B+': 8, 'B': 7, 'C+': 6, 'C': 5, 'D': 4, 'F': 0 };
        let totalGradePoints = 0;
        let totalCreds = 0;

        marksData.forEach(m => {
            const credits = m.subject?.credits || 0;
            const points = gradePoints[m.grade] || 0;
            totalGradePoints += points * credits;
            totalCreds += credits;
        });

        const cgpa = totalCreds > 0 ? (totalGradePoints / totalCreds).toFixed(2) : 0;

        setSummary({ cgpa, totalCredits, backlogs, passed });
    }, []);

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

    const fetchMarks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await parentService.getWardMarks(selectedWard.student.id);
            const marksData = res.data.data || [];
            setMarks(marksData);
            calculateSummary(marksData);
        } catch (error) {
            console.error('Error fetching marks:', error);
            setMarks([]);
            calculateSummary([]);
        }
        setLoading(false);
    }, [selectedWard, calculateSummary]);

    useEffect(() => {
        fetchWardsData();
    }, [fetchWardsData]);

    useEffect(() => {
        if (selectedWard) {
            fetchMarks();
        }
    }, [selectedWard, fetchMarks]);

    const groupedBySemester = marks.reduce((acc, mark) => {
        const sem = mark.semester || 'Other';
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(mark);
        return acc;
    }, {});

    const getGradeClass = (grade) => {
        if (!grade) return 'D';
        const g = grade.toString();
        if (g.startsWith('A') || g.startsWith('O')) return 'A';
        if (g.startsWith('B')) return 'B';
        if (g.startsWith('C')) return 'C';
        return 'D';
    };

    const calculateSGPA = (semesterMarks) => {
        const gradePoints = { 'O': 10, 'A+': 10, 'A': 9, 'B+': 8, 'B': 7, 'C+': 6, 'C': 5, 'D': 4, 'F': 0 };
        let totalGradePoints = 0;
        let totalCredits = 0;

        semesterMarks.forEach(m => {
            const credits = m.subject?.credits || 0;
            const points = gradePoints[m.grade] || 0;
            totalGradePoints += points * credits;
            totalCredits += credits;
        });

        return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 'N/A';
    };

    if (loading && !selectedWard) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading marks...</p>
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
                    <h1>Academic Performance</h1>
                    <p>View {selectedWard?.student?.name}'s marks and results</p>
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
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-icon percentage">
                        <FiTrendingUp />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.cgpa}</h3>
                        <p>CGPA</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon total">
                        <FiBook />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.totalCredits}</h3>
                        <p>Total Credits</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon present">
                        <FiAward />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.passed}</h3>
                        <p>Subjects Passed</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon absent">
                        <FiAlertTriangle />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.backlogs}</h3>
                        <p>Backlogs</p>
                    </div>
                    {summary.backlogs > 0 && (
                        <div className="status-indicator warning">Needs Attention</div>
                    )}
                </div>
            </div>

            {/* CGPA Progress */}
            <div className="cgpa-progress-card">
                <div className="cgpa-display">
                    <div className="cgpa-circle">
                        <svg viewBox="0 0 36 36">
                            <path
                                className="circle-bg"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="circle good"
                                strokeDasharray={`${(summary.cgpa / 10) * 100}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <div className="cgpa-value">
                            <span>{summary.cgpa}</span>
                            <small>/10</small>
                        </div>
                    </div>
                    <div className="cgpa-info">
                        <h3>Cumulative Grade Point Average</h3>
                        <p>Based on {marks.length} subjects across {Object.keys(groupedBySemester).length} semesters</p>
                        <div className="performance-tag">
                            {summary.cgpa >= 8.5 ? '🏆 Excellent Performance' :
                                summary.cgpa >= 7 ? '⭐ Good Performance' :
                                    summary.cgpa >= 5 ? '📚 Average Performance' : '⚠️ Needs Improvement'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Marks by Semester */}
            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="marks-grid">
                    {Object.entries(groupedBySemester)
                        .sort((a, b) => b[0] - a[0])
                        .map(([semester, semesterMarks]) => (
                            <div key={semester} className="semester-section">
                                <div className="semester-header">
                                    <h3>Semester {semester}</h3>
                                    <div className="sgpa-badge">
                                        SGPA: {calculateSGPA(semesterMarks)}
                                    </div>
                                </div>
                                <div className="table-container">
                                    <table className="table marks-table">
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Credits</th>
                                                <th>Marks</th>
                                                <th>Grade</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {semesterMarks.map((mark) => (
                                                <tr key={mark._id}>
                                                    <td>
                                                        <div className="subject-cell">
                                                            <span className="subject-name">{mark.subject?.name}</span>
                                                            <span className="subject-code">{mark.subject?.code}</span>
                                                        </div>
                                                    </td>
                                                    <td>{mark.subject?.credits}</td>
                                                    <td>{mark.obtainedMarks || mark.marksObtained}/{mark.maxMarks}</td>
                                                    <td>
                                                        <div className="grade-cell">
                                                            <span className={`grade-badge ${getGradeClass(mark.grade)}`}>
                                                                {mark.grade}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${mark.status === 'Pass' ? 'badge-success' : 'badge-error'}`}>
                                                            {mark.status === 'Pass' ? 'Passed' : 'Failed'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {marks.length === 0 && !loading && (
                <div className="empty-state">
                    <FiBook size={48} />
                    <h3>No marks available</h3>
                    <p>Marks and results will appear here once published</p>
                </div>
            )}
        </div>
    );
};

export default ParentMarks;
