import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex', height: '100vh', width: '100vw',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-body)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="login-spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Memuat...
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
