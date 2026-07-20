import React, { useState, useEffect } from 'react';
import {
    FiFilter, FiSearch, FiRefreshCw, FiAlertCircle,
    FiCheckCircle, FiClock, FiChevronDown
} from 'react-icons/fi';
import NoticeCard from './NoticeCard';
import { noticeService } from '../../services/api';
import { toast } from 'react-toastify';
import './NoticeList.css';

const NoticeList = ({
    filters = {},
    onNoticeClick,
    showFilters = true,
    showSearch = true,
    className = ''
}) => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    // Filter states
    const [activeFilters, setActiveFilters] = useState({
        type: '',
        priority: '',
        unread: '',
        sort: 'latest',
        search: '',
        ...filters
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Filter options
    const typeOptions = [
        { value: '', label: 'All Types' },
        { value: 'announcement', label: 'Announcements' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'academic', label: 'Academic' },
        { value: 'administrative', label: 'Administrative' },
        { value: 'event', label: 'Events' },
        { value: 'exam', label: 'Exams' },
        { value: 'general', label: 'General' }
    ];

    const priorityOptions = [
        { value: '', label: 'All Priorities' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
    ];

    const sortOptions = [
        { value: 'latest', label: 'Latest First' },
        { value: 'oldest', label: 'Oldest First' },
        { value: 'priority', label: 'By Priority' }
    ];

    // Fetch notices
    const fetchNotices = async (page = 1) => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                page,
                limit: pagination.limit,
                ...activeFilters
            };

            if (params.unread === 'logs') {
                params.status = 'logs';
                delete params.unread;
            }

            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });

            const response = await noticeService.getMyNotices(params);
            setNotices(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Error fetching notices:', error);
            setError('Failed to fetch notices');
            toast.error('Failed to fetch notices');
        } finally {
            setLoading(false);
        }
    };

    // Handle mark as read
    const handleMarkAsRead = async (noticeId) => {
        try {
            await noticeService.markAsRead(noticeId, { interactionLevel: 'viewed' });

            // Update local state
            setNotices(prevNotices =>
                prevNotices.map(notice =>
                    notice._id === noticeId
                        ? { ...notice, isRead: true, readAt: new Date() }
                        : notice
                )
            );

            toast.success('Notice marked as read');
        } catch (error) {
            console.error('Error marking notice as read:', error);
            toast.error('Failed to mark notice as read');
        }
    };

    // Handle filter change
    const handleFilterChange = (filterName, value) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    // Handle search
    const handleSearch = (e) => {
        const value = e.target.value;
        setActiveFilters(prev => ({
            ...prev,
            search: value
        }));
    };

    // Clear all filters
    const clearFilters = () => {
        setActiveFilters({
            type: '',
            priority: '',
            unread: '',
            sort: 'latest',
            search: ''
        });
    };

    // Load more notices (pagination)
    const loadMore = () => {
        if (pagination.hasNextPage) {
            fetchNotices(pagination.page + 1);
        }
    };

    // Effects
    useEffect(() => {
        fetchNotices(1);
    }, [activeFilters]);

    // Get active filter count
    const getActiveFilterCount = () => {
        return Object.values(activeFilters).filter(value =>
            value !== '' && value !== 'latest'
        ).length;
    };

    return (
        <div className={`notice-list ${className}`}>
            {/* Search and Filters */}
            {(showSearch || showFilters) && (
                <div className="notice-list-controls">
                    {/* Search */}
                    {showSearch && (
                        <div className="search-container">
                            <FiSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search notices..."
                                value={activeFilters.search}
                                onChange={handleSearch}
                                className="search-input"
                            />
                        </div>
                    )}

                    {/* Filter Toggle */}
                    {showFilters && (
                        <div className="filter-controls">
                            <button
                                className={`filter-toggle ${filtersOpen ? 'active' : ''}`}
                                onClick={() => setFiltersOpen(!filtersOpen)}
                            >
                                <FiFilter />
                                Filters
                                {getActiveFilterCount() > 0 && (
                                    <span className="filter-count">{getActiveFilterCount()}</span>
                                )}
                                <FiChevronDown className={`chevron ${filtersOpen ? 'rotate' : ''}`} />
                            </button>

                            <button
                                className="refresh-btn"
                                onClick={() => fetchNotices(pagination.page)}
                                disabled={loading}
                            >
                                <FiRefreshCw className={loading ? 'spinning' : ''} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Filter Panel */}
            {showFilters && filtersOpen && (
                <div className="filter-panel">
                    <div className="filter-grid">
                        {/* Type Filter */}
                        <div className="filter-group">
                            <label>Type</label>
                            <select
                                value={activeFilters.type}
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                                className="filter-select"
                            >
                                {typeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Priority Filter */}
                        <div className="filter-group">
                            <label>Priority</label>
                            <select
                                value={activeFilters.priority}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                className="filter-select"
                            >
                                {priorityOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Read Status Filter */}
                        <div className="filter-group">
                            <label>Status</label>
                            <select
                                value={activeFilters.unread}
                                onChange={(e) => handleFilterChange('unread', e.target.value)}
                                className="filter-select"
                            >
                                <option value="">Active Notices</option>
                                <option value="true">Unread Only</option>
                                <option value="false">Read Only</option>
                                <option value="logs">Notice Logs (Expired/History)</option>
                            </select>
                        </div>

                        {/* Sort Filter */}
                        <div className="filter-group">
                            <label>Sort By</label>
                            <select
                                value={activeFilters.sort}
                                onChange={(e) => handleFilterChange('sort', e.target.value)}
                                className="filter-select"
                            >
                                {sortOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {getActiveFilterCount() > 0 && (
                        <button className="clear-filters-btn" onClick={clearFilters}>
                            Clear All Filters
                        </button>
                    )}
                </div>
            )}

            {/* Results Info */}
            <div className="results-info">
                <span className="results-count">
                    {loading ? 'Loading...' : `${notices.length} of ${pagination.total} notices`}
                </span>
            </div>

            {/* Notice List */}
            <div className="notices-container">
                {loading && notices.length === 0 ? (
                    <div className="loading-state">
                        <FiRefreshCw className="spinning" />
                        <p>Loading notices...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <FiAlertCircle />
                        <p>{error}</p>
                        <button onClick={() => fetchNotices(pagination.page)}>
                            Try Again
                        </button>
                    </div>
                ) : notices.length === 0 ? (
                    <div className="empty-state">
                        <FiCheckCircle />
                        <h3>No notices found</h3>
                        <p>
                            {getActiveFilterCount() > 0
                                ? 'Try adjusting your filters to see more notices.'
                                : 'You\'re all caught up! No notices to display.'
                            }
                        </p>
                        {getActiveFilterCount() > 0 && (
                            <button onClick={clearFilters}>Clear Filters</button>
                        )}
                    </div>
                ) : (
                    <>
                        {notices.map((notice) => (
                            <NoticeCard
                                key={notice._id}
                                notice={notice}
                                onRead={handleMarkAsRead}
                                onClick={onNoticeClick}
                            />
                        ))}

                        {/* Load More Button */}
                        {pagination.hasNextPage && (
                            <div className="load-more-container">
                                <button
                                    className="load-more-btn"
                                    onClick={loadMore}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <FiRefreshCw className="spinning" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>Load More Notices</>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer Status */}
            {notices.length > 0 && (
                <div className="list-footer">
                    <div className="status-summary">
                        <div className="status-item">
                            <FiClock />
                            <span>{notices.filter(n => !n.isRead).length} unread</span>
                        </div>
                        <div className="status-item">
                            <FiCheckCircle />
                            <span>{notices.filter(n => n.isRead).length} read</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoticeList;