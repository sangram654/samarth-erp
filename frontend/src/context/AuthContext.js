import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    const response = await api.get('/auth/me');
                    setUser(response.data.data.user);
                    setProfile(response.data.data.profile);
                } catch (error) {
                    console.error('Auth initialization failed:', error);
                    localStorage.removeItem('token');
                    setToken(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { user, profile, token } = response.data.data;

            localStorage.setItem('token', token);
            setToken(token);
            setUser(user);
            setProfile(profile);

            return { success: true, user };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.detail || error.response?.data?.message || 'Login failed'
            };
        }
    };

    const register = async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            const { user, profile, token } = response.data.data;

            localStorage.setItem('token', token);
            setToken(token);
            setUser(user);
            setProfile(profile);

            return { success: true, user };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setProfile(null);
    };

    const updateProfile = async (data) => {
        try {
            const response = await api.put('/auth/profile', data);
            setUser(response.data.data.user);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Profile update failed'
            };
        }
    };

    const getDashboardRoute = (role = user?.role) => {
        if (!role) return '/login';
        switch (role) {
            case 'super_admin': return '/super-admin/dashboard';
            case 'admin': return '/admin/dashboard';
            case 'teacher': return '/teacher/dashboard';
            case 'student': return '/student/dashboard';
            case 'parent': return '/parent/dashboard';
            case 'accountant': return '/accountant/dashboard';
            case 'librarian': return '/librarian/dashboard';
            case 'receptionist': return '/receptionist/dashboard';
            default: return '/';
        }
    };

    const value = {
        user,
        profile,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        getDashboardRoute,
        isAuthenticated: !!token && !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
