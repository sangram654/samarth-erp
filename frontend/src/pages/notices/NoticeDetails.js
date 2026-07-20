import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiBell, FiAlertTriangle, FiClock, FiUser,
    FiCalendar, FiEye, FiDownload, FiShare2, FiPrinter,
    FiEdit, FiTrash2
} from 'react-icons/fi';
import { noticeService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { hasPermission } from '../../utils/permissions';
import './NoticeDetails.css';

const NoticeDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user can manage notices
    const canManage = hasPermission(user?.role, 'communication', 'update');

    // Fetch notice details
    const fetchNotice = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await noticeService.getById(id);
            setNotice(response.data.data);

            // Mark as read if not already read
            if (!response.data.data.isRead) {
                await noticeService.markAsRead(id, { interactionLevel: 'viewed' });
                setNotice(prev => ({ ...prev, isRead: true, readAt: new Date() }));
            }
        } catch (error) {
            console.error('Error fetching notice:', error);
            setError('Failed to load notice');
            toast.error('Failed to load notice');
        } finally {
            setLoading(false);
        }
    };

    // Handle delete notice
    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this notice?')) return;

        try {
            await noticeService.delete(id);
            toast.success('Notice deleted successfully');
            navigate('../notices');
        } catch (error) {
            console.error('Error deleting notice:', error);
            toast.error('Failed to delete notice');
        }
    };

    // Handle print
    const handlePrint = () => {
        window.print();
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get priority icon
    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'urgent':
                return <FiAlertTriangle className="text-red-500 priority-icon urgent" />;
            case 'high':
                return <FiAlertTriangle className="text-orange-500 priority-icon high" />;
            case 'medium':
                return <FiBell className="text-blue-500 priority-icon medium" />;
            case 'low':
            default:
                return <FiBell className="text-gray-500 priority-icon low" />;
        }
    };

    // Get type label
    const getTypeLabel = (type) => {
        const typeLabels = {
            announcement: 'Announcement',
            urgent: 'Urgent Notice',
            academic: 'Academic Notice',
            administrative: 'Administrative Notice',
            event: 'Event Notification',
            exam: 'Exam Notice',
            general: 'General Notice'
        };
        return typeLabels[type] || 'Notice';
    };

    useEffect(() => {
        if (id) {
            fetchNotice();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="notice-details">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading notice...</p>
                </div>
            </div>
        );
    }

    if (error || !notice) {
        return (
            <div className="notice-details">
                <div className="error-container">
                    <FiAlertTriangle className="error-icon" />
                    <h2>Notice Not Found</h2>
                    <p>{error || 'The requested notice could not be found.'}</p>
                    <button
                        className="btn-back"
                        onClick={() => navigate('../notices')}
                    >
                        <FiArrowLeft />
                        Back to Notices
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="notice-details">
            {/* Header */}
            <div className="notice-header">
                <div className="header-actions">
                    <button
                        className="btn-back"
                        onClick={() => navigate(-1)}
                    >
                        <FiArrowLeft />
                        Back
                    </button>

                    <div className="action-buttons">
                        <button
                            className="btn-action"
                            onClick={handlePrint}
                            title="Print"
                        >
                            <FiPrinter />
                        </button>

                        {canManage && notice.createdBy === user?.id && (
                            <>
                                <button
                                    className="btn-action edit"
                                    onClick={() => navigate(`../notices/${id}/edit`)}
                                    title="Edit Notice"
                                >
                                    <FiEdit />
                                </button>
                                <button
                                    className="btn-action delete"
                                    onClick={handleDelete}
                                    title="Delete Notice"
                                >
                                    <FiTrash2 />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Notice Content */}
            <div className="notice-content-container">
                {/* Meta Information */}
                <div className="notice-meta">
                    <div className="meta-header">
                        <div className="notice-badges">
                            <span className={`notice-type-badge ${notice.type}`}>
                                {getTypeLabel(notice.type)}
                            </span>
                            <span className={`priority-badge ${notice.priority}`}>
                                {getPriorityIcon(notice.priority)}
                                {notice.priority.toUpperCase()}
                            </span>
                        </div>

                        {!notice.isRead && (
                            <span className="unread-badge">
                                <FiEye /> New
                            </span>
                        )}
                    </div>

                    <div className="meta-info">
                        <div className="meta-item">
                            <FiUser className="meta-icon" />
                            <span>
                                Published by {notice.creator
                                    ? `${notice.creator.firstName || ''} ${notice.creator.lastName || ''}`.trim()
                                    : typeof notice.createdBy === 'object' && notice.createdBy
                                    ? `${notice.createdBy.firstName || ''} ${notice.createdBy.lastName || ''}`.trim()
                                    : 'System Admin'
                                }
                            </span>
                        </div>

                        <div className="meta-item">
                            <FiCalendar className="meta-icon" />
                            <span>Published on {formatDate(notice.publishDate)}</span>
                        </div>

                        {notice.expiryDate && (
                            <div className="meta-item" style={{ color: new Date(notice.expiryDate) < new Date() ? '#dc2626' : 'inherit' }}>
                                <FiClock className="meta-icon" />
                                <span>{new Date(notice.expiryDate) < new Date() ? 'Expired on' : 'Expires on'} {formatDate(notice.expiryDate)}</span>
                            </div>
                        )}

                        {notice.readAt && (
                            <div className="meta-item">
                                <FiEye className="meta-icon" />
                                <span>Read on {formatDate(notice.readAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Title */}
                <h1 className="notice-title">
                    {notice.title}
                </h1>

                {/* Content */}
                <div className="notice-content">
                    <div className="content-text">
                        {notice.content.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </div>

                {/* Attachments */}
                {notice.attachments && notice.attachments.length > 0 && (
                    <div className="notice-attachments">
                        <h3>Attachments</h3>
                        <div className="attachments-list">
                            {notice.attachments.map((attachment, index) => (
                                <div key={index} className="attachment-item">
                                    <FiDownload className="attachment-icon" />
                                    <span className="attachment-name">{attachment.name}</span>
                                    <span className="attachment-size">
                                        ({Math.round(attachment.size / 1024)} KB)
                                    </span>
                                    <a
                                        href={attachment.url}
                                        download
                                        className="attachment-download"
                                    >
                                        Download
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Expiry Warning / Status Banner */}
                {notice.expiryDate && new Date(notice.expiryDate) < new Date() ? (
                    <div className="expiry-warning" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}>
                        <FiClock className="warning-icon" />
                        <span>
                            Notice Expired on {formatDate(notice.expiryDate)} (Archived in Logs)
                        </span>
                    </div>
                ) : notice.expiryDate && new Date(notice.expiryDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000) ? (
                    <div className="expiry-warning">
                        <FiClock className="warning-icon" />
                        <span>
                            This notice will expire on {formatDate(notice.expiryDate)}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default NoticeDetails;