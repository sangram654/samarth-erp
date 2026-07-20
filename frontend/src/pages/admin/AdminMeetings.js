import React, { useState, useEffect } from 'react';
import { FiPlus, FiVideo, FiEdit2, FiTrash2, FiUsers, FiCalendar, FiClock, FiExternalLink, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { meetingService, classService } from '../../services/api';
import '../student/StudentPages.css';

const AdminMeetings = () => {
    const [loading, setLoading] = useState(true);
    const [meetings, setMeetings] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        meetingLink: '',
        platform: 'Google Meet',
        scheduledDate: '',
        scheduledTime: '',
        duration: 60,
        targetingType: 'class',
        selectedClass: '',
        classDetails: {
            department: '',
            semester: '',
            section: 'A'
        },
        departments: [],
        roles: [],
        subject: ''
    });

    const departments = [
        'Computer Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Electrical Engineering',
        'Electronics Engineering',
        'Information Technology',
        'Artificial Intelligence and Machine Learning'
    ];

    const roles = [
        { value: 'student', label: 'Students' },
        { value: 'teacher', label: 'Teachers' },
        { value: 'parent', label: 'Parents' }
    ];

    useEffect(() => {
        fetchMeetings();
        fetchClasses();
    }, [filterStatus]);

    const fetchClasses = async () => {
        try {
            const res = await classService.getAll();
            setClasses(res.data.data || []);
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const fetchMeetings = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus) params.status = filterStatus;
            
            const res = await meetingService.getAll(params);
            setMeetings(res.data.data || []);
        } catch (error) {
            console.error('Error fetching meetings:', error);
            toast.error('Failed to load meetings');
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            // Prepare data based on targeting type
            const meetingData = { ...formData };
            
            // If class is selected from dropdown, extract classDetails from it
            if (formData.targetingType === 'class' && formData.selectedClass) {
                const selectedClassObj = classes.find(c => c._id === formData.selectedClass);
                if (selectedClassObj) {
                    meetingData.classDetails = {
                        department: selectedClassObj.department,
                        semester: selectedClassObj.semester,
                        section: selectedClassObj.section
                    };
                }
            }
            
            delete meetingData.selectedClass;
            
            // Remove empty subject field to prevent ObjectId cast error
            if (!meetingData.subject || meetingData.subject === '') {
                delete meetingData.subject;
            }
            
            if (formData.targetingType !== 'class') {
                delete meetingData.classDetails;
            }
            if (formData.targetingType !== 'department') {
                delete meetingData.departments;
            }
            if (formData.targetingType !== 'role') {
                delete meetingData.roles;
            }

            console.log('Sending meeting data:', meetingData); // Debug log

            if (selectedMeeting) {
                await meetingService.update(selectedMeeting._id, meetingData);
                toast.success('Meeting updated successfully');
            } else {
                await meetingService.create(meetingData);
                toast.success('Meeting created successfully');
            }

            fetchMeetings();
            closeModal();
        } catch (error) {
            console.error('Error saving meeting:', error);
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this meeting?')) return;

        try {
            await meetingService.delete(id);
            toast.success('Meeting cancelled successfully');
            fetchMeetings();
        } catch (error) {
            console.error('Error deleting meeting:', error);
            toast.error('Failed to cancel meeting');
        }
    };

    const openModal = (meeting = null) => {
        if (meeting) {
            // Find matching class if exists
            let selectedClassId = '';
            if (meeting.classDetails && classes.length > 0) {
                const matchingClass = classes.find(c => 
                    c.department === meeting.classDetails.department &&
                    c.semester === meeting.classDetails.semester &&
                    c.section === meeting.classDetails.section
                );
                if (matchingClass) selectedClassId = matchingClass._id;
            }
            
            setSelectedMeeting(meeting);
            setFormData({
                title: meeting.title,
                description: meeting.description || '',
                meetingLink: meeting.meetingLink,
                platform: meeting.platform,
                scheduledDate: meeting.scheduledDate.split('T')[0],
                scheduledTime: meeting.scheduledTime,
                duration: meeting.duration,
                targetingType: meeting.targetingType,
                selectedClass: selectedClassId,
                classDetails: meeting.classDetails || { department: '', semester: '', section: 'A' },
                departments: meeting.departments || [],
                roles: meeting.roles || [],
                subject: meeting.subject?._id || ''
            });
        } else {
            setSelectedMeeting(null);
            setFormData({
                title: '',
                description: '',
                meetingLink: '',
                platform: 'Google Meet',
                scheduledDate: '',
                scheduledTime: '',
                duration: 60,
                targetingType: 'class',
                selectedClass: '',
                classDetails: { department: '', semester: '', section: 'A' },
                departments: [],
                roles: [],
                subject: ''
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedMeeting(null);
    };

    const getStatusBadge = (status) => {
        const colors = {
            'Scheduled': 'primary',
            'Ongoing': 'success',
            'Completed': 'secondary',
            'Cancelled': 'error'
        };
        return colors[status] || 'secondary';
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading meetings...</p>
            </div>
        );
    }

    return (
        <div className="student-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1><FiVideo /> Virtual Meetings</h1>
                    <p>Manage online meetings and classes</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <FiPlus /> Create Meeting
                </button>
            </div>

            {/* Filters */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div style={{ padding: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-4)' }}>
                    <select
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Meetings Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--spacing-4)' }}>
                {meetings.map((meeting) => (
                    <div key={meeting._id} className="section-card">
                        <div style={{ padding: 'var(--spacing-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-3)' }}>
                                <h3 style={{ margin: 0 }}>{meeting.title}</h3>
                                <span className={`badge badge-${getStatusBadge(meeting.status)}`}>
                                    {meeting.status}
                                </span>
                            </div>
                            
                            {meeting.description && (
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-3)', fontSize: '0.9rem' }}>
                                    {meeting.description}
                                </p>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <FiCalendar size={16} />
                                    <span>{new Date(meeting.scheduledDate).toLocaleDateString()}</span>
                                    <FiClock size={16} style={{ marginLeft: '12px' }} />
                                    <span>{meeting.scheduledTime} ({meeting.duration} min)</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <FiVideo size={16} />
                                    <span>{meeting.platform}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    <FiUsers size={16} />
                                    <span>{meeting.totalAttended}/{meeting.totalTargeted} attended</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => window.open(meeting.meetingLink, '_blank')}
                                >
                                    <FiExternalLink /> Link
                                </button>
                                {!['superadmin', 'super_admin'].includes(meeting.createdBy?.role) ? (
                                    <>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => openModal(meeting)}
                                        >
                                            <FiEdit2 /> Edit
                                        </button>
                                        <button
                                            className="btn btn-sm btn-error"
                                            onClick={() => handleDelete(meeting._id)}
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </>
                                ) : (
                                    <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                                        SuperAdmin Meeting
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {meetings.length === 0 && (
                <div className="empty-state">
                    <FiVideo size={48} />
                    <h3>No Meetings</h3>
                    <p>Create your first virtual meeting</p>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2>{selectedMeeting ? 'Edit Meeting' : 'Create Meeting'}</h2>
                            <button className="modal-close" onClick={closeModal}>
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Meeting Title *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        placeholder="e.g., Database Management Lecture"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-input"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        placeholder="Meeting description..."
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Meeting Link *</label>
                                        <input
                                            type="url"
                                            className="form-input"
                                            value={formData.meetingLink}
                                            onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                            required
                                            placeholder="https://meet.google.com/..."
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Platform</label>
                                        <select
                                            className="form-select"
                                            value={formData.platform}
                                            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                        >
                                            <option value="Google Meet">Google Meet</option>
                                            <option value="Zoom">Zoom</option>
                                            <option value="Microsoft Teams">Microsoft Teams</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Date *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.scheduledDate}
                                            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Time *</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={formData.scheduledTime}
                                            onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Duration (min) *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                            required
                                            min="15"
                                            max="480"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Target Audience *</label>
                                    <select
                                        className="form-select"
                                        value={formData.targetingType}
                                        onChange={(e) => setFormData({ ...formData, targetingType: e.target.value })}
                                    >
                                        <option value="class">Specific Class</option>
                                        <option value="department">Department-wise</option>
                                        <option value="role">Role-based</option>
                                    </select>
                                </div>

                                {/* Class Targeting */}
                                {formData.targetingType === 'class' && (
                                    <div className="form-group">
                                        <label className="form-label">Select Class *</label>
                                        {classes.length > 0 ? (
                                            <select
                                                className="form-select"
                                                value={formData.selectedClass}
                                                onChange={(e) => setFormData({ ...formData, selectedClass: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Class</option>
                                                {classes.map(cls => (
                                                    <option key={cls._id} value={cls._id}>
                                                        {cls.department} - Sem {cls.semester} - Sec {cls.section} ({cls.academicYear})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div style={{ padding: 'var(--spacing-3)', background: 'var(--warning-light)', borderRadius: 'var(--radius-md)', color: 'var(--warning-dark)' }}>
                                                <strong>No classes found!</strong> Please create classes in the Classes section first, or use Department/Role targeting.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Department Targeting */}
                                {formData.targetingType === 'department' && (
                                    <div className="form-group">
                                        <label className="form-label">Select Departments *</label>
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                                            gap: '12px',
                                            padding: 'var(--spacing-3)',
                                            background: 'var(--surface-color)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            {departments.map(dept => (
                                                <label 
                                                    key={dept} 
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        transition: 'background 0.2s',
                                                        ':hover': { background: 'var(--hover-color)' }
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.departments.includes(dept)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({
                                                                    ...formData,
                                                                    departments: [...formData.departments, dept]
                                                                });
                                                            } else {
                                                                setFormData({
                                                                    ...formData,
                                                                    departments: formData.departments.filter(d => d !== dept)
                                                                });
                                                            }
                                                        }}
                                                        style={{ 
                                                            width: '18px', 
                                                            height: '18px',
                                                            cursor: 'pointer',
                                                            flexShrink: 0
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '0.95rem' }}>{dept}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Role Targeting */}
                                {formData.targetingType === 'role' && (
                                    <div className="form-group">
                                        <label className="form-label">Select Roles *</label>
                                        <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '12px',
                                            padding: 'var(--spacing-3)',
                                            background: 'var(--surface-color)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            {roles.map(role => (
                                                <label 
                                                    key={role.value} 
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                        padding: '8px',
                                                        borderRadius: '6px'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.roles.includes(role.value)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({
                                                                    ...formData,
                                                                    roles: [...formData.roles, role.value]
                                                                });
                                                            } else {
                                                                setFormData({
                                                                    ...formData,
                                                                    roles: formData.roles.filter(r => r !== role.value)
                                                                });
                                                            }
                                                        }}
                                                        style={{ 
                                                            width: '18px', 
                                                            height: '18px',
                                                            cursor: 'pointer',
                                                            flexShrink: 0
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '0.95rem' }}>{role.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {selectedMeeting ? 'Update Meeting' : 'Create Meeting'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMeetings;