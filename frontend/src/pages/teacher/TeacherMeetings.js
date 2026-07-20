import React, { useState, useEffect } from 'react';
import { FiPlus, FiVideo, FiEdit2, FiTrash2, FiUsers, FiCalendar, FiClock, FiExternalLink, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api, { meetingService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../student/StudentPages.css';

const TeacherMeetings = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [meetings, setMeetings] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [assignments, setAssignments] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        meetingLink: '',
        platform: 'Google Meet',
        scheduledDate: '',
        scheduledTime: '',
        duration: 60,
        assignmentId: ''
    });

    useEffect(() => {
        fetchMeetings();
        fetchAssignments();
    }, []);

    // Updated Fetch Logic - Teacher ke own + Admin/SuperAdmin ke class meetings dono laayega
    // Updated fetchMeetings function (TeacherMeetings.js)
    const fetchMeetings = async () => {
        setLoading(true);
        try {
            // 1. Teacher ke khud banaye meetings
            const myMeetingsRes = await meetingService.getMyMeetings();
            const myMeetings = myMeetingsRes.data.data || [];

            // 2. Admin/SuperAdmin ke meetings (teacher ke classes ke liye)
            const classMeetingsRes = await api.get('/meetings/my-class-meetings');
            const classMeetings = classMeetingsRes.data.data || [];

            // Combine + remove duplicates
            const allMeetings = [...myMeetings, ...classMeetings];
            const uniqueMeetings = Array.from(
                new Map(allMeetings.map(meeting => [meeting._id, meeting])).values()
            );

            setMeetings(uniqueMeetings);
        } catch (error) {
            console.error('Error fetching meetings:', error);
            toast.error('Failed to load meetings');

            // Fallback
            try {
                const res = await meetingService.getMyMeetings();
                setMeetings(res.data.data || []);
            } catch (fallbackErr) {
                console.error('Fallback failed:', fallbackErr);
            }
        }
        setLoading(false);
    };

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/teaching-assignments/my-assignments');
            setAssignments(res.data.data || []);
        } catch (error) {
            console.error('Error fetching assignments:', error);
            setAssignments([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const assignment = assignments.find(a => a._id === formData.assignmentId);
            
            if (!assignment) {
                toast.error('Please select a valid class');
                return;
            }

            const meetingData = {
                title: formData.title,
                description: formData.description,
                meetingLink: formData.meetingLink,
                platform: formData.platform,
                scheduledDate: formData.scheduledDate,
                scheduledTime: formData.scheduledTime,
                duration: formData.duration,
                targetingType: 'class',
                classDetails: {
                    department: assignment.classId?.department || assignment.department,
                    semester: assignment.classId?.semester || assignment.semester,
                    section: assignment.classId?.section || assignment.section
                },
                subject: assignment.subjectId?._id
            };

            if (selectedMeeting) {
                await meetingService.update(selectedMeeting._id, meetingData);
                toast.success('Meeting updated successfully');
            } else {
                await meetingService.create(meetingData);
                toast.success('Meeting created successfully');
            }

            fetchMeetings();   // Refresh after create/update
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
            setSelectedMeeting(meeting);
            setFormData({
                title: meeting.title,
                description: meeting.description || '',
                meetingLink: meeting.meetingLink,
                platform: meeting.platform,
                scheduledDate: meeting.scheduledDate.split('T')[0],
                scheduledTime: meeting.scheduledTime,
                duration: meeting.duration,
                assignmentId: ''
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
                assignmentId: ''
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

    const upcomingMeetings = meetings.filter(m => m.status === 'Scheduled' || m.status === 'Ongoing');
    const completedMeetings = meetings.filter(m => m.status === 'Completed');

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
                    <h1><FiVideo /> My Virtual Meetings</h1>
                    <p>Manage your online classes and meetings</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <FiPlus /> Create Meeting
                </button>
            </div>

            {/* Summary Cards - No change */}
            <div className="summary-grid" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="summary-card">
                    <div className="summary-icon total">
                        <FiVideo />
                    </div>
                    <div className="summary-content">
                        <h3>{meetings.length}</h3>
                        <p>Total Meetings</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon present">
                        <FiCalendar />
                    </div>
                    <div className="summary-content">
                        <h3>{upcomingMeetings.length}</h3>
                        <p>Upcoming</p>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon percentage">
                        <FiUsers />
                    </div>
                    <div className="summary-content">
                        <h3>{completedMeetings.length}</h3>
                        <p>Completed</p>
                    </div>
                </div>
            </div>

            {/* Upcoming Meetings */}
            {upcomingMeetings.length > 0 && (
                <div className="section-card" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <div className="section-header">
                        <h2>Upcoming Meetings</h2>
                    </div>
                    <div style={{ padding: 'var(--spacing-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--spacing-4)' }}>
                        {upcomingMeetings.map((meeting) => (
                            <MeetingCard
                                key={meeting._id}
                                meeting={meeting}
                                onEdit={openModal}
                                onDelete={handleDelete}
                                getStatusBadge={getStatusBadge}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* All Meetings */}
            <div className="section-card">
                <div className="section-header">
                    <h2>All Meetings</h2>
                </div>
                <div style={{ padding: 'var(--spacing-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--spacing-4)' }}>
                    {meetings.map((meeting) => (
                        <MeetingCard
                            key={meeting._id}
                            meeting={meeting}
                            onEdit={openModal}
                            onDelete={handleDelete}
                            getStatusBadge={getStatusBadge}
                        />
                    ))}
                </div>
            </div>

            {meetings.length === 0 && (
                <div className="empty-state">
                    <FiVideo size={48} />
                    <h3>No Meetings</h3>
                    <p>Create your first virtual meeting for your class</p>
                </div>
            )}

            {/* Create/Edit Modal - No change */}
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
                                    <label className="form-label">Select Class *</label>
                                    <select
                                        className="form-select"
                                        value={formData.assignmentId}
                                        onChange={(e) => setFormData({ ...formData, assignmentId: e.target.value })}
                                        required
                                        disabled={selectedMeeting}
                                    >
                                        <option value="">Select Class</option>
                                        {assignments.map(assignment => (
                                            <option key={assignment._id} value={assignment._id}>
                                                {assignment.subjectId?.code} - {assignment.subjectId?.name} 
                                                ({assignment.classId?.department || assignment.department} Sem {assignment.classId?.semester || assignment.semester} {assignment.classId?.section || assignment.section})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Meeting Title *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        placeholder="e.g., Database Management Lecture - Unit 3"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-input"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        placeholder="Meeting description or agenda..."
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

const MeetingCard = ({ meeting, onEdit, onDelete, getStatusBadge }) => {
    const isHigherAdminMeeting = ['superadmin', 'super_admin', 'admin'].includes(meeting.createdBy?.role);

    return (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-4)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-3)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{meeting.title}</h3>
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
                    <span>{meeting.totalAttended || 0}/{meeting.totalTargeted || 0} attended</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => window.open(meeting.meetingLink, '_blank')}
                >
                    <FiExternalLink /> Link
                </button>
                {!isHigherAdminMeeting ? (
                    <>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onEdit(meeting)}
                            disabled={meeting.status === 'Completed' || meeting.status === 'Cancelled'}
                        >
                            <FiEdit2 /> Edit
                        </button>
                        <button
                            className="btn btn-sm btn-error"
                            onClick={() => onDelete(meeting._id)}
                            disabled={meeting.status === 'Completed' || meeting.status === 'Cancelled'}
                        >
                            <FiTrash2 />
                        </button>
                    </>
                ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        Created by {['superadmin', 'super_admin'].includes(meeting.createdBy?.role) ? 'SuperAdmin' : 'Admin'}
                    </span>
                )}
            </div>
        </div>
    );
};

export default TeacherMeetings;