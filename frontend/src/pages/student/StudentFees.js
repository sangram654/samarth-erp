import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiCreditCard, FiDownload, FiCalendar, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { feeService } from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import './StudentPages.css';

const StudentFees = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [fees, setFees] = useState([]);
    const [summary, setSummary] = useState({ total: 0, paid: 0, due: 0 });
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedFee, setSelectedFee] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    const fetchFees = useCallback(async () => {
        try {
            console.log('Fetching fees for student profile:', profile);
            // Use profile._id (which is student ID) directly for the API call
            const res = await feeService.getStudentFees(profile._id);
            console.log('Fees API response:', res.data);
            const feesData = res.data.data || [];

            // Map fee data to include structure name
            const formattedFees = feesData.map(fee => ({
                ...fee,
                name: fee.feeStructure?.name || fee.name || 'Fee',
            }));
            setFees(formattedFees);

            // Calculate summary from fees (backend returns totalAmount/paidAmount/dueAmount)
            const calcSummary = {
                total: res.data.summary?.totalAmount || feesData.reduce((sum, f) => sum + (f.totalAmount || 0), 0),
                paid: res.data.summary?.paidAmount || feesData.reduce((sum, f) => sum + (f.paidAmount || 0), 0),
                due: res.data.summary?.dueAmount || feesData.reduce((sum, f) => sum + (f.dueAmount || 0), 0),
            };
            setSummary(calcSummary);
        } catch (error) {
            console.error('Error fetching fees:', error);
            setFees([]);
            setSummary({ total: 0, paid: 0, due: 0 });
        }
        setLoading(false);
    }, [profile]);

    useEffect(() => {
        if (profile?._id) {
            console.log('Profile available:', profile);
            fetchFees();
        } else {
            setFees([]);
            setSummary({ total: 0, paid: 0, due: 0 });
            setLoading(false);
        }
    }, [profile, fetchFees]);

    const handlePayNow = (fee) => {
        setSelectedFee(fee);
        setPaymentAmount(fee.dueAmount.toString());
        setPaymentMethod('cash');
        setShowPaymentModal(true);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (parseFloat(paymentAmount) > selectedFee.dueAmount) {
            toast.error('Payment amount cannot exceed due amount');
            return;
        }

        try {
            const paymentMethodMap = {
                cash: 'Cash',
                online: 'Online',
                card: 'Card',
                upi: 'UPI',
                cheque: 'Cheque',
            };

            const paymentData = {
                feeId: selectedFee._id,
                amount: parseFloat(paymentAmount),
                paymentMethod: paymentMethodMap[paymentMethod] || paymentMethod,
                transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
            };

            const res = await feeService.makePayment(paymentData);
            
            if (res.data.success) {
                toast.success('Payment successful! 🎉');
                setShowPaymentModal(false);
                setSelectedFee(null);
                setPaymentAmount('');
                fetchFees(); // Refresh fees data
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error(error.response?.data?.message || 'Payment failed. Please try again.');
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Paid': return 'paid';
            case 'Pending': return 'pending';
            case 'Overdue': return 'overdue';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading fees...</p>
            </div>
        );
    }

    return (
        <div className="student-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Fee Payment</h1>
                    <p>View and pay your fees online</p>
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
                        <p>Paid</p>
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
                </div>
            </div>

            {/* Fee Cards */}
            <div className="fee-cards-grid">
                {fees.map((fee) => (
                    <div key={fee._id} className={`fee-card ${getStatusClass(fee.status)}`}>
                        <div className="fee-card-header">
                            <div>
                                <h3>{fee.name}</h3>
                                <p>Academic Year: {fee.academicYear}</p>
                            </div>
                            <span className={`badge badge-${fee.status === 'Paid' ? 'success' : fee.status === 'Overdue' ? 'error' : 'warning'}`}>
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
                            {fee.status === 'Paid' ? (
                                <button className="btn btn-secondary btn-sm">
                                    <FiDownload /> Receipt
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handlePayNow(fee)}
                                >
                                    Pay Now
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedFee && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>💳 Pay Fees</h2>
                            <button 
                                className="modal-close" 
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedFee(null);
                                    setPaymentAmount('');
                                }}
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handlePayment}>
                            {/* Fee Details */}
                            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{selectedFee.name}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Academic Year: {selectedFee.academicYear}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Amount</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>₹{selectedFee.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Due Amount</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--error)' }}>₹{selectedFee.dueAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Amount */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Payment Amount *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter amount to pay"
                                    min="1"
                                    max={selectedFee.dueAmount}
                                    required
                                    autoFocus
                                />
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Maximum: ₹{selectedFee.dueAmount.toLocaleString()}
                                </p>
                            </div>

                            {/* Payment Method */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Payment Method *</label>
                                <select
                                    className="form-input"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    required
                                >
                                    <option value="cash">Cash</option>
                                    <option value="online">Online Payment</option>
                                    <option value="card">Debit/Credit Card</option>
                                    <option value="upi">UPI</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            {/* UPI QR Display if payment method is UPI or Online */}
                            {(paymentMethod === 'upi' || paymentMethod === 'online') && (
                                <div style={{ textAlign: 'center', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '0.95rem' }}>
                                        Instant Paytm & UPI Payment Gateway
                                    </h4>
                                    <div style={{ background: '#ffffff', padding: '10px', display: 'inline-block', borderRadius: '12px', border: '2px solid #00baf2' }}>
                                        <QRCodeSVG
                                            value={`upi://pay?pa=9561563002@ptsbi&pn=${encodeURIComponent('Samarth College of Engineering')}&am=${paymentAmount || selectedFee.dueAmount}&cu=INR&tn=${encodeURIComponent(selectedFee.name || 'Fee Payment')}`}
                                            size={160}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>
                                    <p style={{ margin: '8px 0 2px 0', fontWeight: '700', fontSize: '0.9rem', color: '#0369a1' }}>
                                        Paytm Merchant UPI: 9561563002@ptsbi
                                    </p>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#64748b' }}>
                                        Scan QR or click below to launch UPI app directly:
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                        <a href={`paytmmp://pay?pa=9561563002@ptsbi&pn=${encodeURIComponent('Samarth College')}&am=${paymentAmount || selectedFee.dueAmount}&cu=INR`} className="btn btn-sm" style={{ background: '#00baf2', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', padding: '6px 12px', fontSize: '0.8rem' }}>
                                            Paytm
                                        </a>
                                        <a href={`phonepe://pay?pa=9561563002@ptsbi&pn=${encodeURIComponent('Samarth College')}&am=${paymentAmount || selectedFee.dueAmount}&cu=INR`} className="btn btn-sm" style={{ background: '#5f259f', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', padding: '6px 12px', fontSize: '0.8rem' }}>
                                            PhonePe
                                        </a>
                                        <a href={`gpay://upi/pay?pa=9561563002@ptsbi&pn=${encodeURIComponent('Samarth College')}&am=${paymentAmount || selectedFee.dueAmount}&cu=INR`} className="btn btn-sm" style={{ background: '#4285F4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', padding: '6px 12px', fontSize: '0.8rem' }}>
                                            Google Pay
                                        </a>
                                        <a href={`upi://pay?pa=9561563002@ptsbi&pn=${encodeURIComponent('Samarth College')}&am=${paymentAmount || selectedFee.dueAmount}&cu=INR`} className="btn btn-sm" style={{ background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', padding: '6px 12px', fontSize: '0.8rem' }}>
                                            BHIM UPI
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowPaymentModal(false);
                                        setSelectedFee(null);
                                        setPaymentAmount('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <FiCreditCard style={{ marginRight: '8px' }} />
                                    Pay ₹{paymentAmount || 0}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentFees;
