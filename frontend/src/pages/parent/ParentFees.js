import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiCreditCard, FiDownload, FiCalendar, FiChevronLeft, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { parentService } from '../../services/api';
import './ParentPages.css';

const ParentFees = () => {
    const [loading, setLoading] = useState(true);
    const [wardsData, setWardsData] = useState([]);
    const [selectedWard, setSelectedWard] = useState(null);
    const [fees, setFees] = useState([]);
    const [summary, setSummary] = useState({ total: 0, paid: 0, due: 0 });

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

    const fetchFees = useCallback(async () => {
        setLoading(true);
        try {
            const res = await parentService.getWardFees(selectedWard.student.id);
            const feesData = res.data.data || [];
            setFees(feesData);

            // Calculate summary
            const calcSummary = feesData.reduce((acc, fee) => ({
                total: acc.total + (fee.totalAmount || 0),
                paid: acc.paid + (fee.paidAmount || 0),
                due: acc.due + (fee.dueAmount || 0),
            }), { total: 0, paid: 0, due: 0 });

            setSummary(calcSummary);
        } catch (error) {
            console.error('Error fetching fees:', error);
            setFees([]);
            setSummary({ total: 0, paid: 0, due: 0 });
        }
        setLoading(false);
    }, [selectedWard]);

    useEffect(() => {
        fetchWardsData();
    }, [fetchWardsData]);

    useEffect(() => {
        if (selectedWard) {
            fetchFees();
        }
    }, [selectedWard, fetchFees]);

    const getStatusClass = (status) => {
        switch (status) {
            case 'Paid': return 'paid';
            case 'Pending': return 'pending';
            case 'Overdue': return 'overdue';
            case 'Partial': return 'partial';
            default: return '';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Paid': return <FiCheck />;
            case 'Pending': return <FiClock />;
            case 'Overdue': return <FiAlertCircle />;
            case 'Partial': return <FiCreditCard />;
            default: return null;
        }
    };

    const handleDownloadReceipt = (feeId, paymentId) => {
        // In a real implementation, this would download the receipt
        console.log('Downloading receipt for fee:', feeId, 'payment:', paymentId);
        alert('Receipt download will be available soon!');
    };

    if (loading && !selectedWard) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading fee details...</p>
            </div>
        );
    }

    if (!selectedWard) {
        return (
            <div className="parent-page animate-fade-in">
                <div className="page-header">
                    <div className="header-left">
                        <Link to="/parent/dashboard" className="back-link">
                            <FiChevronLeft /> Back to Dashboard
                        </Link>
                        <h1>Fee Payment Status</h1>
                    </div>
                </div>
                <div className="empty-state-large">
                    <FiDollarSign size={48} />
                    <h2>No Wards Linked</h2>
                    <p>No students are currently linked to your account. Please contact the administration.</p>
                </div>
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
                    <h1>Fee Payment Status</h1>
                    <p>View {selectedWard?.student?.name}'s fee details and receipts</p>
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
                        <FiDollarSign />
                    </div>
                    <div className="summary-content">
                        <h3>₹{summary.total?.toLocaleString()}</h3>
                        <p>Total Fees</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon present">
                        <FiCreditCard />
                    </div>
                    <div className="summary-content">
                        <h3>₹{summary.paid?.toLocaleString()}</h3>
                        <p>Paid Amount</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon absent">
                        <FiDollarSign />
                    </div>
                    <div className="summary-content">
                        <h3>₹{summary.due?.toLocaleString()}</h3>
                        <p>Due Amount</p>
                    </div>
                    {summary.due > 0 && (
                        <div className="status-indicator warning">Pending</div>
                    )}
                </div>

                <div className="summary-card">
                    <div className="summary-icon percentage">
                        <FiCreditCard />
                    </div>
                    <div className="summary-content">
                        <h3>{summary.total > 0 ? Math.round((summary.paid / summary.total) * 100) : 0}%</h3>
                        <p>Payment Progress</p>
                    </div>
                </div>
            </div>

            {/* Fee Payment Progress */}
            <div className="fee-progress-card">
                <div className="progress-header">
                    <span>Total Fee Payment Progress</span>
                    <span className={`amount ${summary.due > 0 ? 'due' : 'paid'}`}>
                        ₹{summary.paid?.toLocaleString()} / ₹{summary.total?.toLocaleString()}
                    </span>
                </div>
                <div className="progress-bar large">
                    <div
                        className="progress-fill good"
                        style={{ width: `${summary.total > 0 ? (summary.paid / summary.total) * 100 : 0}%` }}
                    ></div>
                </div>
                <p className="progress-note">
                    {summary.due === 0
                        ? '✅ All fees have been paid'
                        : `⚠️ ₹${summary.due?.toLocaleString()} pending to be paid`}
                </p>
            </div>

            {/* Fee Cards */}
            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="fee-cards-grid">
                    {fees.map((fee) => (
                        <div key={fee._id} className={`fee-card ${getStatusClass(fee.status)}`}>
                            <div className="fee-card-header">
                                <div>
                                    <h3>{fee.feeStructure?.name || fee.name}</h3>
                                    <p>Academic Year: {fee.academicYear} | Semester {fee.semester}</p>
                                </div>
                                <span className={`status-badge ${getStatusClass(fee.status)}`}>
                                    {getStatusIcon(fee.status)}
                                    {fee.status}
                                </span>
                            </div>
                            <div className="fee-card-body">
                                <div className="fee-amount-row">
                                    <span>Total Amount</span>
                                    <span>₹{fee.totalAmount?.toLocaleString()}</span>
                                </div>
                                <div className="fee-amount-row">
                                    <span>Paid Amount</span>
                                    <span className="text-success">₹{fee.paidAmount?.toLocaleString()}</span>
                                </div>
                                <div className="fee-amount-row total">
                                    <span>Due Amount</span>
                                    <span className={fee.dueAmount > 0 ? 'text-error' : ''}>
                                        ₹{fee.dueAmount?.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="fee-card-footer">
                                <div className="due-date">
                                    <FiCalendar style={{ marginRight: 4 }} />
                                    Due: {new Date(fee.dueDate).toLocaleDateString()}
                                </div>
                                {fee.status === 'Paid' && fee.payments?.length > 0 && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleDownloadReceipt(fee._id, fee.payments[0]._id)}
                                    >
                                        <FiDownload /> Receipt
                                    </button>
                                )}
                            </div>

                            {/* Payment History */}
                            {fee.payments && fee.payments.length > 0 && (
                                <div className="payment-history">
                                    <h4>Payment History</h4>
                                    {fee.payments.map((payment) => (
                                        <div key={payment._id} className="payment-item">
                                            <div className="payment-info">
                                                <span className="payment-amount">₹{payment.amount?.toLocaleString()}</span>
                                                <span className="payment-method">{payment.method}</span>
                                            </div>
                                            <div className="payment-meta">
                                                <span>{new Date(payment.paymentDate).toLocaleDateString()}</span>
                                                <span className="txn-id">#{payment.transactionId}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {fees.length === 0 && !loading && (
                <div className="empty-state">
                    <FiDollarSign size={48} />
                    <h3>No fee records</h3>
                    <p>Fee details will appear here once assigned</p>
                </div>
            )}
        </div>
    );
};

export default ParentFees;
