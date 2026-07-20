import React from 'react';
import {
    FiBell, FiAlertTriangle, FiClock, FiUser,
    FiCalendar, FiEye, FiDownload, FiExternalLink
} from 'react-icons/fi';
import './NoticeCard.css';

const NoticeCard = ({ notice, onRead, onClick, className = '' }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        return date.toLocaleDateString();
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'urgent':
                return <FiAlertTriangle className="text-red-500" />;
            case 'high':
                return <FiAlertTriangle className="text-orange-500" />;
            case 'medium':
                return <FiBell className="text-blue-500" />;
            case 'low':
            default:
                return <FiBell className="text-gray-500" />;
        }
    };

    const getPriorityClass = (priority) => {
        const baseClass = 'notice-card';
        switch (priority) {
            case 'urgent':
                return `${baseClass} notice-urgent`;
            case 'high':
                return `${baseClass} notice-high`;
            case 'medium':
                return `${baseClass} notice-medium`;
            case 'low':
            default:
                return `${baseClass} notice-low`;
        }
    };

    const getTypeLabel = (type) => {
        const typeLabels = {
            announcement: 'Announcement',
            urgent: 'Urgent',
            academic: 'Academic',
            administrative: 'Administrative',
            event: 'Event',
            exam: 'Exam',
            general: 'General'
        };
        return typeLabels[type] || 'Notice';
    };

    const handleCardClick = () => {
        if (!notice.isRead && onRead) {
            onRead(notice._id);
        }
        if (onClick) {
            onClick(notice);
        }
    };

    const handleMarkAsRead = (e) => {
        e.stopPropagation();
        if (onRead) {
            onRead(notice._id);
        }
    };

    return (
        <div
            className={`${getPriorityClass(notice.priority)} ${!notice.isRead ? 'unread' : 'read'} ${className}`}
            onClick={handleCardClick}
        >
            {/* Priority indicator */}
            <div className="notice-priority-indicator">
                {getPriorityIcon(notice.priority)}
            </div>

            {/* Header */}
            <div className="notice-header">
                <div className="notice-meta">
                    <span className={`notice-type notice-type-${notice.type}`}>
                        {getTypeLabel(notice.type)}
                    </span>
                    <span className={`notice-priority notice-priority-${notice.priority}`}>
                        {notice.priority.toUpperCase()}
                    </span>
                </div>

                <div className="notice-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
                    <div><FiCalendar className="date-icon" /> <strong>Start:</strong> {new Date(notice.publishDate).toLocaleDateString()} {new Date(notice.publishDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {notice.expiryDate && (
                        <div style={{ color: new Date(notice.expiryDate) < new Date() ? '#dc2626' : 'inherit' }}>
                            <FiClock className="date-icon" /> <strong>End:</strong> {new Date(notice.expiryDate).toLocaleDateString()} {new Date(notice.expiryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>
            </div>

            {/* Title */}
            <h3 className="notice-title">
                {notice.title}
                {!notice.isRead && <span className="unread-indicator"></span>}
            </h3>

            {/* Content preview */}
            <div className="notice-content">
                <p>
                    {notice.content.length > 150
                        ? `${notice.content.substring(0, 150)}...`
                        : notice.content
                    }
                </p>
            </div>

            {/* Attachments */}
            {notice.attachments && notice.attachments.length > 0 && (
                <div className="notice-attachments">
                    <FiDownload className="attachment-icon" />
                    <span>{notice.attachments.length} attachment{notice.attachments.length > 1 ? 's' : ''}</span>
                </div>
            )}

            {/* Footer */}
            <div className="notice-footer">
                {/* Creator info */}
                <div className="notice-creator">
                    <FiUser className="creator-icon" />
                    <span>
                        {notice.creator
                            ? `${notice.creator.firstName || ''} ${notice.creator.lastName || ''}`.trim()
                            : typeof notice.createdBy === 'object' && notice.createdBy
                            ? `${notice.createdBy.firstName || ''} ${notice.createdBy.lastName || ''}`.trim()
                            : 'Admin'
                        }
                    </span>
                </div>

                {/* Action buttons */}
                <div className="notice-actions">
                    {!notice.isRead && (
                        <button
                            className="action-btn mark-read-btn"
                            onClick={handleMarkAsRead}
                            title="Mark as read"
                        >
                            <FiEye />
                        </button>
                    )}

                    <button
                        className="action-btn view-btn"
                        onClick={handleCardClick}
                        title="View full notice"
                    >
                        <FiExternalLink />
                    </button>
                </div>
            </div>

            {/* Read status indicator */}
            <div className={`read-status ${notice.isRead ? 'read' : 'unread'}`}>
                <div className="read-dot"></div>
            </div>

            {/* Expiry warning / status */}
            {notice.expiryDate && new Date(notice.expiryDate) < new Date() ? (
                <div className="expiry-warning" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}>
                    <FiClock className="expiry-icon" />
                    <span>Expired</span>
                </div>
            ) : notice.expiryDate && new Date(notice.expiryDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000) ? (
                <div className="expiry-warning">
                    <FiClock className="expiry-icon" />
                    <span>Expires soon</span>
                </div>
            ) : null}
        </div>
    );
};

export default NoticeCard;