import React, { useState, useEffect, useCallback } from 'react';
import {
    FiFileText, FiCalendar, FiClock, FiCheck, FiX,
    FiChevronLeft
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { parentService } from '../../services/api';
import './ParentPages.css';

const ParentLeave = () => {
    const [loading, setLoading] = useState(true);
    const [wardsData, setWardsData] = useState([]);
    const [selectedWard, setSelectedWard] = useState(null);
    const [leaves, setLeaves] = useState([]);
    const [filter, setFilter] = useState('all');
    const [selectedLeave, setSelectedLeave] = useState(null);

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

    const fetchLeaves = useCallback(async () => {
        setLoading(true);
        try {
            const res = await parentService.getWardLeaves(selectedWard.student.id);
            setLeaves(res.data.data || []);
        } catch (error) {
            console.error('Error fetching leaves:', error);
            setLeaves([]);
        }
        setLoading(false);
    }, [selectedWard]);

    useEffect(() => {
        fetchWardsData();
    }, [fetchWardsData]);

    useEffect(() => {
        if (selectedWard) {
            fetchLeaves();
        }
    }, [selectedWard, fetchLeaves]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Approved': return <FiCheck />;
            case 'Rejected': return <FiX />;
            case 'Pending': return <FiClock />;
            default: return <FiFileText />;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Approved': return 'approved';
            case 'Rejected': return 'rejected';
            case 'Pending': return 'pending';
            default: return '';
        }
    };

    const getBadgeClass = (status) => {
        switch (status) {
            case 'Approved': return 'badge-success';
            case 'Rejected': return 'badge-error';
            case 'Pending': return 'badge-warning';
            default: return 'badge-info';
        }
    };

    const filteredLeaves = leaves.filter(leave =>
        filter === 'all' || leave.status.toLowerCase() === filter
    );

    const summary = {
        total: leaves.length,
        pending: leaves.filter(l => l.status === 'Pending').length,
        approved: leaves.filter(l => l.status === 'Approved').length,
        rejected: leaves.filter(l => l.status === 'Rejected').length,
        totalDays: leaves.filter(l => l.status === 'Approved').reduce((sum, l) => sum + l.numberOfDays, 0),
    };

    if (loading && !selectedWard) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading leave applications...</p>
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
                    <h1>Leave Applications</h1>
                    <p>Monitor {selectedWard?.student?.name}'s leave requests</p>
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
                    <div className="summary-icon total">
                        <FiFileText />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.total}</h3>
                        <p>Total Applications</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon percentage">
                        <FiClock />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.pending}</h3>
                        <p>Pending</p>
                    </div>
                    {summary.pending > 0 && (
                        <div className="status-indicator warning">Action Required</div>
                    )}
                </div>

                <div className="summary-card">
                    <div className="summary-icon present">
                        <FiCheck />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.approved}</h3>
                        <p>Approved</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon absent">
                        <FiX />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.rejected}</h3>
                        <p>Rejected</p>
                    </div>
                </div>
            </div>

            {/* Leave Days Summary */}
            <div className="leave-days-card">
                <div className="leave-days-info">
                    <FiCalendar size={32} />
                    <div>
                        <h3>{summary.totalDays} Days</h3>
                        <p>Total approved leave days this academic year</p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({leaves.length})
                </button>
                <button
                    className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                >
                    Pending ({summary.pending})
                </button>
                <button
                    className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
                    onClick={() => setFilter('approved')}
                >
                    Approved ({summary.approved})
                </button>
                <button
                    className={`filter-tab ${filter === 'rejected' ? 'active' : ''}`}
                    onClick={() => setFilter('rejected')}
                >
                    Rejected ({summary.rejected})
                </button>
            </div>

            {/* Leave Cards */}
            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <div className="spinner"></div>
                </div>
            ) : filteredLeaves.length > 0 ? (
                <div className="leave-cards-grid">
                    {filteredLeaves.map((leave) => (
                        <div key={leave._id} className={`leave-card ${getStatusClass(leave.status)}`}>
                            <div className="leave-card-header">
                                <div className="leave-type-info">
                                    <span className="leave-type">{leave.leaveType}</span>
                                    <span className="leave-days">{leave.numberOfDays} day{leave.numberOfDays > 1 ? 's' : ''}</span>
                                </div>
                                <span className={`badge ${getBadgeClass(leave.status)}`}>
                                    {getStatusIcon(leave.status)} {leave.status}
                                </span>
                            </div>

                            <div className="leave-card-body">
                                <div className="leave-dates">
                                    <div className="date-range">
                                        <FiCalendar />
                                        <span>
                                            {new Date(leave.fromDate).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                            {leave.numberOfDays > 1 && (
                                                <> - {new Date(leave.toDate).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="leave-reason">
                                    <strong>Reason:</strong>
                                    <p>{leave.reason}</p>
                                </div>

                                {leave.status !== 'Pending' && leave.reviewRemarks && (
                                    <div className="review-remarks">
                                        <strong>Admin Remarks:</strong>
                                        <p>{leave.reviewRemarks}</p>
                                        {leave.reviewedBy && (
                                            <span className="reviewed-by">
                                                - {leave.reviewedBy.firstName} {leave.reviewedBy.lastName}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="leave-card-footer">
                                <span className="applied-date">
                                    Applied: {new Date(leave.createdAt).toLocaleDateString()}
                                </span>
                                {leave.reviewDate && (
                                    <span className="review-date">
                                        Reviewed: {new Date(leave.reviewDate).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <FiFileText size={48} />
                    <h3>No leave applications</h3>
                    <p>
                        {filter !== 'all'
                            ? `No ${filter} leave applications found`
                            : 'Leave applications will appear here'}
                    </p>
                </div>
            )}

            {/* Leave Detail Modal */}
            {selectedLeave && (
                <div className="modal-overlay" onClick={() => setSelectedLeave(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Leave Application Details</h2>
                            <button className="close-btn" onClick={() => setSelectedLeave(null)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Modal content would go here */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParentLeave;
