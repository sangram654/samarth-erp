import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiBell, FiAlertTriangle, FiCheckCircle, FiClock,
    FiTrendingUp, FiFilter, FiPlus, FiEye
} from 'react-icons/fi';
import NoticeList from '../../components/notices/NoticeList';
import { noticeService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { hasPermission } from '../../utils/permissions';
import './NoticesDashboard.css';

const NoticesDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalNotices: 0,
        unreadCount: 0,
        urgentCount: 0,
        todayCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [quickFilters, setQuickFilters] = useState({
        all: true,
        unread: false,
        urgent: false,
        today: false,
        logs: false
    });

    // Check if user can create notices
    const canCreateNotice = hasPermission(user?.role, 'communication', 'create');

    // Fetch dashboard stats
    const fetchStats = async () => {
        try {
            setLoading(true);

            // Get unread count
            const unreadResponse = await noticeService.getUnreadCount();
            const unreadCount = unreadResponse.data.data.unreadCount;

            // Get all notices for stats calculation
            const allNoticesResponse = await noticeService.getMyNotices({
                limit: 100 // Get more for accurate stats
            });
            const notices = allNoticesResponse.data.data;

            // Calculate stats
            const today = new Date().toDateString();
            const urgentCount = notices.filter(n => n.priority === 'urgent' && !n.isRead).length;
            const todayCount = notices.filter(n =>
                new Date(n.publishDate).toDateString() === today
            ).length;

            setStats({
                totalNotices: allNoticesResponse.data.pagination.total,
                unreadCount,
                urgentCount,
                todayCount
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            toast.error('Failed to load dashboard statistics');
        } finally {
            setLoading(false);
        }
    };

    // Handle quick filter change
    const handleQuickFilter = (filterName) => {
        setQuickFilters({
            all: false,
            unread: false,
            urgent: false,
            today: false,
            logs: false,
            [filterName]: true
        });
    };

    // Get current filter for notice list
    const getCurrentFilter = () => {
        if (quickFilters.unread) return { unread: 'true' };
        if (quickFilters.urgent) return { priority: 'urgent' };
        if (quickFilters.today) {
            const today = new Date().toISOString().split('T')[0];
            return { date: today };
        }
        if (quickFilters.logs) return { status: 'logs' };
        return {};
    };

    // Handle notice click - navigate to full view
    const handleNoticeClick = (notice) => {
        navigate(`${notice._id}`);
    };

    // Handle mark all as read
    const handleMarkAllAsRead = async () => {
        try {
            // This would require a backend endpoint for bulk operations
            // For now, we'll just refresh the stats
            await fetchStats();
            toast.success('All notices marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div className="notices-dashboard">
            {/* Header */}
            <div className="notices-page-header">
                <div className="header-content">
                    <div className="header-text">
                        <h1>
                            <FiBell className="header-icon" />
                            Notices & Announcements
                        </h1>
                        <p>Stay updated with the latest college announcements and notifications</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="header-actions">
                        {canCreateNotice && (
                            <button
                                className="create-notice-btn"
                                onClick={() => navigate('create')}
                            >
                                <FiPlus />
                                Create Notice
                            </button>
                        )}

                        {stats.unreadCount > 0 && (
                            <button
                                className="mark-all-read-btn"
                                onClick={handleMarkAllAsRead}
                            >
                                <FiCheckCircle />
                                Mark All Read
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card total">
                    <div className="stat-icon">
                        <FiBell />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : stats.totalNotices}</h3>
                        <p>Total Notices</p>
                    </div>
                </div>

                <div className="stat-card unread">
                    <div className="stat-icon">
                        <FiEye />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : stats.unreadCount}</h3>
                        <p>Unread</p>
                        {stats.unreadCount > 0 && <div className="stat-badge">{stats.unreadCount}</div>}
                    </div>
                </div>

                <div className="stat-card urgent">
                    <div className="stat-icon">
                        <FiAlertTriangle />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : stats.urgentCount}</h3>
                        <p>Urgent</p>
                        {stats.urgentCount > 0 && <div className="stat-badge urgent">{stats.urgentCount}</div>}
                    </div>
                </div>

                <div className="stat-card today">
                    <div className="stat-icon">
                        <FiTrendingUp />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : stats.todayCount}</h3>
                        <p>Today</p>
                        {stats.todayCount > 0 && <div className="stat-badge today">{stats.todayCount}</div>}
                    </div>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="quick-filters">
                <div className="filter-title">
                    <FiFilter />
                    <span>Quick Filters</span>
                </div>
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${quickFilters.all ? 'active' : ''}`}
                        onClick={() => handleQuickFilter('all')}
                    >
                        All Notices
                    </button>
                    <button
                        className={`filter-btn ${quickFilters.unread ? 'active' : ''}`}
                        onClick={() => handleQuickFilter('unread')}
                    >
                        Unread ({stats.unreadCount})
                    </button>
                    <button
                        className={`filter-btn ${quickFilters.urgent ? 'active' : ''}`}
                        onClick={() => handleQuickFilter('urgent')}
                    >
                        Urgent ({stats.urgentCount})
                    </button>
                    <button
                        className={`filter-btn ${quickFilters.today ? 'active' : ''}`}
                        onClick={() => handleQuickFilter('today')}
                    >
                        Today ({stats.todayCount})
                    </button>
                    <button
                        className={`filter-btn ${quickFilters.logs ? 'active' : ''}`}
                        onClick={() => handleQuickFilter('logs')}
                    >
                        Notice Logs (History)
                    </button>
                </div>
            </div>

            {/* Notice List */}
            <div className="notices-content">
                <NoticeList
                    filters={getCurrentFilter()}
                    onNoticeClick={handleNoticeClick}
                    showFilters={true}
                    showSearch={true}
                />
            </div>

            {/* Welcome Message for New Users */}
            {!loading && stats.totalNotices === 0 && (
                <div className="welcome-message">
                    <div className="welcome-icon">
                        <FiBell />
                    </div>
                    <h2>Welcome to Notices & Announcements!</h2>
                    <p>
                        This is where you'll find all important college notices, announcements, and updates.
                        When new notices are published that are relevant to you, they will appear here.
                    </p>
                    <div className="welcome-features">
                        <div className="feature">
                            <FiAlertTriangle className="feature-icon" />
                            <span>Urgent notices will be highlighted</span>
                        </div>
                        <div className="feature">
                            <FiClock className="feature-icon" />
                            <span>Track read/unread status</span>
                        </div>
                        <div className="feature">
                            <FiFilter className="feature-icon" />
                            <span>Filter by type and priority</span>
                        </div>
                    </div>
                    {canCreateNotice && (
                        <button
                            className="welcome-cta"
                            onClick={() => navigate('create')}
                        >
                            <FiPlus />
                            Create Your First Notice
                        </button>
                    )}
                </div>
            )}

            {/* Help Text */}
            <div className="help-section">
                <h3>💡 Tips for using Notices</h3>
                <ul>
                    <li><strong>Priority Levels:</strong> Urgent notices are highlighted and may create push notifications</li>
                    <li><strong>Read Status:</strong> Click on any notice to mark it as read and view full details</li>
                    <li><strong>Filters:</strong> Use filters to find specific types of notices or view only unread items</li>
                    <li><strong>Expiry:</strong> Some notices have expiry dates - don't miss important deadlines!</li>
                    {canCreateNotice && (
                        <li><strong>Creating Notices:</strong> Use the "Create Notice" button to send announcements to students and staff</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default NoticesDashboard;