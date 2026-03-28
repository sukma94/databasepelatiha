import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, Eye, EyeOff, ArrowRight, Users, AlertCircle, Loader2 } from 'lucide-react';
import { usePublicData } from '../utils/usePublicData';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { settings } = usePublicData({ settingsOnly: true });
    const { login } = useAuth();
    const { dark } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Email dan password harus diisi.');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            navigate('/admin');
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Email atau password salah.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Terlalu banyak percobaan. Coba lagi nanti.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Format email tidak valid.');
            } else {
                setError('Terjadi kesalahan. Silakan coba lagi.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    return (
        <div className="login-container">
            {/* Floating Orbs */}
            <div className="login-orb login-orb-1" />
            <div className="login-orb login-orb-2" />
            <div className="login-orb login-orb-3" />

            <div className="login-card animate-scale-in">
                {/* Logo & Title */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Lock style={{ width: '32px', height: '32px', color: 'white' }} />
                    </div>
                    <h1 style={{
                        fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)',
                        marginBottom: '8px', letterSpacing: '-0.02em'
                    }}>
                        Admin Login
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {settings?.appTitle || 'Database Pelatihan'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="login-error animate-fade-in">
                        <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="login-field">
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                className="login-input"
                                placeholder="admin@contoh.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ paddingLeft: '44px' }}
                                autoComplete="email"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="login-field">
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingLeft: '44px', paddingRight: '44px' }}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                                    padding: '4px', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                                Masuk...
                            </>
                        ) : (
                            <>
                                Masuk sebagai Admin
                                <ArrowRight style={{ width: '18px', height: '18px' }} />
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '28px 0 20px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>atau</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                </div>

                {/* Public Link */}
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <div className="login-public-btn">
                        <Users style={{ width: '18px', height: '18px' }} />
                        <span>Lihat Data Peserta</span>
                        <ArrowRight style={{ width: '16px', height: '16px', marginLeft: 'auto' }} />
                    </div>
                </Link>
            </div>
        </div>
    );
}
