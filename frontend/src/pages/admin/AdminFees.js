import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiSearch, FiDownload, FiCheck, FiX, FiTrendingUp, FiPlus, FiEdit, FiTrash2, FiUsers, FiCalendar, FiBook } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../student/StudentPages.css';

const AdminFees = () => {
    const [activeTab, setActiveTab] = useState('records'); // 'records' or 'structures'
    const [loading, setLoading] = useState(true);

    // Fee records
    const [fees, setFees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [stats, setStats] = useState({ total: 0, collected: 0, pending: 0 });

    // Fee structures
    const [structures, setStructures] = useState([]);
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [editingStructure, setEditingStructure] = useState(null);
    const [structureForm, setStructureForm] = useState({
        name: '',
        academicYear: '',
        department: '',
        semester: '',
        totalAmount: '',
        dueDate: '',
        description: '',
    });

    useEffect(() => {
        if (activeTab === 'records') {
            fetchFees();
        } else {
            fetchStructures();
        }
    }, [activeTab]);

    const fetchFees = async () => {
        setLoading(true);
        try {
            const res = await api.get('/fees');
            setFees(res.data.data || []);
            if (res.data.stats) {
                setStats(res.data.stats);
            }
        } catch (error) {
            console.error('Error fetching fees:', error);
            toast.error(error.response?.data?.message || 'Failed to load fee records');
            setFees([]);
        }
        setLoading(false);
    };

    const fetchStructures = async () => {
        setLoading(true);
        try {
            const res = await api.get('/fees/structures');
            setStructures(res.data.data || []);
        } catch (error) {
            console.error('Error fetching structures:', error);
            toast.error('Failed to load fee structures');
            setStructures([]);
        }
        setLoading(false);
    };

    const handleSaveStructure = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...structureForm,
                totalAmount: Number(structureForm.totalAmount),
            };

            if (editingStructure) {
                await api.put(`/fees/structure/${editingStructure._id}`, payload);
                toast.success('Fee structure updated successfully!');
            } else {
                await api.post('/fees/structure', payload);
                toast.success('Fee structure created successfully!');
            }

            closeStructureModal();
            fetchStructures();
        } catch (error) {
            console.error('Error saving structure:', error);
            toast.error(error.response?.data?.message || (editingStructure ? 'Failed to update fee structure' : 'Failed to create fee structure'));
        }
    };

    const handleDeleteStructure = async (id) => {
        if (window.confirm('Are you sure you want to delete this fee structure?')) {
            try {
                await api.delete(`/fees/structure/${id}`);
                toast.success('Fee structure deleted successfully');
                fetchStructures();
            } catch (error) {
                console.error('Error deleting structure:', error);
                toast.error('Failed to delete fee structure');
            }
        }
    };

    const handleAssignToAll = async () => {
        if (window.confirm('This will assign missing fees to all students. Continue?')) {
            try {
                const res = await api.post('/fees/assign-missing');
                toast.success(res.data.message || 'Fees assigned successfully');
                fetchFees();
            } catch (error) {
                console.error('Error assigning fees:', error);
                toast.error('Failed to assign fees');
            }
        }
    };

    const resetStructureForm = () => {
        setStructureForm({
            name: '',
            academicYear: '',
            department: '',
            semester: '',
            totalAmount: '',
            dueDate: '',
            description: '',
        });
    };

    const closeStructureModal = () => {
        setShowStructureModal(false);
        setEditingStructure(null);
        resetStructureForm();
    };

    const openCreateStructureModal = () => {
        setEditingStructure(null);
        resetStructureForm();
        setShowStructureModal(true);
    };

    const openEditStructureModal = (structure) => {
        setEditingStructure(structure);
        setStructureForm({
            name: structure.name || '',
            academicYear: structure.academicYear || '',
            department: structure.department || '',
            semester: structure.semester || '',
            totalAmount: structure.totalAmount || '',
            dueDate: structure.dueDate ? new Date(structure.dueDate).toISOString().slice(0, 10) : '',
            description: structure.description || '',
        });
        setShowStructureModal(true);
    };

    useEffect(() => {
        const total = fees.reduce((acc, f) => acc + f.amount, 0);
        const collected = fees.reduce((acc, f) => acc + f.paidAmount, 0);
        setStats({ total, collected, pending: total - collected });
    }, [fees]);

    const getStatusClass = (status) => {
        switch (status) {
            case 'Paid': return 'badge-success';
            case 'Partially Paid': return 'badge-warning';
            case 'Pending': return 'badge-error';
            default: return 'badge-info';
        }
    };

    const filteredFees = fees.filter(fee => {
        const studentName = `${fee.student?.user?.firstName || ''} ${fee.student?.user?.lastName || ''}`.toLowerCase();
        const matchesSearch = studentName.includes(searchQuery.toLowerCase()) ||
            fee.student?.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !statusFilter || fee.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const formatCurrency = (amount) => `₹${amount?.toLocaleString() || 0}`;

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading fee records...</p>
            </div>
        );
    }

    return (
        <div className="student-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Fee Management</h1>
                    <p>Manage fee structures and track payments</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                    {activeTab === 'structures' && (
                        <button className="btn btn-primary" onClick={openCreateStructureModal}>
                            <FiPlus /> Create Fee Structure
                        </button>
                    )}
                    {activeTab === 'structures' && (
                        <button className="btn btn-secondary" onClick={handleAssignToAll}>
                            <FiUsers /> Assign to All Students
                        </button>
                    )}
                    {activeTab === 'records' && (
                        <button className="btn btn-primary">
                            <FiDownload /> Export Report
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setActiveTab('records')}
                        style={{
                            padding: 'var(--spacing-4) var(--spacing-6)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500,
                            color: activeTab === 'records' ? 'var(--primary-color)' : 'var(--text-muted)',
                            borderBottom: activeTab === 'records' ? '2px solid var(--primary-color)' : '2px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-2)'
                        }}
                    >
                        <FiDollarSign /> Fee Records
                    </button>
                    <button
                        onClick={() => setActiveTab('structures')}
                        style={{
                            padding: 'var(--spacing-4) var(--spacing-6)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500,
                            color: activeTab === 'structures' ? 'var(--primary-color)' : 'var(--text-muted)',
                            borderBottom: activeTab === 'structures' ? '2px solid var(--primary-color)' : '2px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-2)'
                        }}
                    >
                        <FiBook /> Fee Structures ({structures.length})
                    </button>
                </div>
            </div>

            {/* Fee Records Tab */}
            {activeTab === 'records' && (
                <>
                    {/* Stats */}
                    <div className="summary-grid" style={{ marginBottom: 'var(--spacing-6)' }}>
                        <div className="summary-card">
                            <div className="summary-icon total">
                                <FiDollarSign />
                            </div>
                            <div className="summary-content">
                                <h3>{formatCurrency(stats.total)}</h3>
                                <p>Total Fees</p>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon present">
                                <FiCheck />
                            </div>
                            <div className="summary-content">
                                <h3>{formatCurrency(stats.collected)}</h3>
                                <p>Collected</p>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon absent">
                                <FiX />
                            </div>
                            <div className="summary-content">
                                <h3>{formatCurrency(stats.pending)}</h3>
                                <p>Pending</p>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon percentage">
                                <FiTrendingUp />
                            </div>
                            <div className="summary-content">
                                <h3>{stats.total > 0 ? ((stats.collected / stats.total) * 100).toFixed(1) : 0}%</h3>
                                <p>Collection Rate</p>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="section-card" style={{ marginBottom: 'var(--spacing-6)' }}>
                        <div style={{ padding: 'var(--spacing-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label">Search</label>
                                <div style={{ position: 'relative' }}>
                                    <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Search by name or roll number..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ paddingLeft: 40 }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="">All Status</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Fee Records Table */}
                    <div className="section-card">
                        <div className="section-header">
                            <h2>Fee Records ({filteredFees.length})</h2>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Roll No</th>
                                        <th>Student Name</th>
                                        <th>Fee Type</th>
                                        <th>Total Amount</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Due Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFees.length > 0 ? (
                                        filteredFees.map((fee) => (
                                            <tr key={fee._id}>
                                                <td><strong>{fee.student?.rollNumber}</strong></td>
                                                <td>{fee.student?.user?.firstName} {fee.student?.user?.lastName}</td>
                                                <td>{fee.feeStructure?.name || 'N/A'}</td>
                                                <td>{formatCurrency(fee.totalAmount)}</td>
                                                <td style={{ color: 'var(--success-color)' }}>{formatCurrency(fee.paidAmount)}</td>
                                                <td style={{ color: 'var(--error-color)' }}>{formatCurrency(fee.dueAmount)}</td>
                                                <td>
                                                    <span className={`badge ${getStatusClass(fee.status)}`}>
                                                        {fee.status}
                                                    </span>
                                                </td>
                                                <td>{new Date(fee.dueDate).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
                                                No fee records found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Fee Structures Tab */}
            {activeTab === 'structures' && (
                <div className="section-card">
                    <div className="section-header">
                        <h2>Fee Structures ({structures.length})</h2>
                    </div>
                    {structures.length > 0 ? (
                        <div style={{ padding: 'var(--spacing-6)' }}>
                            <div style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
                                {structures.map((structure) => (
                                    <div
                                        key={structure._id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-5)',
                                            background: 'var(--bg-secondary)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 var(--spacing-2)', fontSize: '1.25rem' }}>{structure.name}</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-3)' }}>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Academic Year</p>
                                                        <p style={{ margin: 0, fontWeight: 500 }}>{structure.academicYear}</p>
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Department</p>
                                                        <p style={{ margin: 0, fontWeight: 500 }}>{structure.department || 'All'}</p>
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Amount</p>
                                                        <p style={{ margin: 0, fontWeight: 500, color: 'var(--primary-color)', fontSize: '1.125rem' }}>
                                                            {formatCurrency(structure.totalAmount)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Due Date</p>
                                                        <p style={{ margin: 0, fontWeight: 500 }}>
                                                            <FiCalendar style={{ marginRight: 4 }} />
                                                            {new Date(structure.dueDate).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                {structure.description && (
                                                    <p style={{ margin: 'var(--spacing-3) 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                        {structure.description}
                                                    </p>
                                                )}
                                                <div style={{ marginTop: 'var(--spacing-2)' }}>
                                                    <span className={`badge ${structure.isActive ? 'badge-success' : 'badge-error'}`}>
                                                        {structure.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                                <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => openEditStructureModal(structure)}>
                                                    <FiEdit />
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleDeleteStructure(structure._id)}
                                                    style={{ color: 'var(--error-color)' }}
                                                    title="Delete"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 'var(--spacing-12)' }}>
                            <FiDollarSign size={48} />
                            <h3>No Fee Structures</h3>
                            <p>Create a fee structure to get started</p>
                            <button className="btn btn-primary" onClick={() => setShowStructureModal(true)}>
                                <FiPlus /> Create Fee Structure
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create Fee Structure Modal */}
            {showStructureModal && (
                <div className="modal-overlay" onClick={closeStructureModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{editingStructure ? <><FiEdit /> Edit Fee Structure</> : <><FiPlus /> Create Fee Structure</>}</h2>
                            <button className="modal-close" onClick={closeStructureModal}>×</button>
                        </div>
                        <form onSubmit={handleSaveStructure}>
                            <div className="form-group">
                                <label className="form-label">Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={structureForm.name}
                                    onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                                    placeholder="e.g., Tuition Fee 2024-25"
                                    required
                                />
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Academic Year *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={structureForm.academicYear}
                                        onChange={(e) => setStructureForm({ ...structureForm, academicYear: e.target.value })}
                                        placeholder="2024-25"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <select
                                        className="form-select"
                                        value={structureForm.department}
                                        onChange={(e) => setStructureForm({ ...structureForm, department: e.target.value })}
                                    >
                                        <option value="">All Departments</option>
                                        <option value="Computer Engineering">Computer Engineering</option>
                                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                                        <option value="Civil Engineering">Civil Engineering</option>
                                        <option value="Electronics Engineering">Electronics Engineering</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={structureForm.totalAmount}
                                        onChange={(e) => setStructureForm({ ...structureForm, totalAmount: e.target.value })}
                                        placeholder="55000"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date *</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={structureForm.dueDate}
                                        onChange={(e) => setStructureForm({ ...structureForm, dueDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={structureForm.description}
                                    onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })}
                                    placeholder="Optional description..."
                                />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeStructureModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingStructure ? <><FiEdit /> Update Structure</> : <><FiPlus /> Create Structure</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminFees;