import React, { useState, useEffect } from 'react';
import { saveAppSettings } from '../utils/storage';
import { useData } from '../context/DataContext';
import { Save, Upload, Type, Layout, Check, Trash2 } from 'lucide-react';

const FONT_OPTIONS = [
    { name: 'Inter', value: "'Inter', sans-serif" },
    { name: 'Roboto', value: "'Roboto', sans-serif" },
    { name: 'Outfit', value: "'Outfit', sans-serif" },
    { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
    { name: 'Poppins', value: "'Poppins', sans-serif" },
];

export default function AppSettings() {
    const { appSettings, setAppSettingsLocal } = useData();
    const [settings, setSettings] = useState({
        appTitle: '',
        logoLight: '',
        logoDark: '',
        fontFamily: 'Inter',
    });
    const [toast, setToast] = useState(null);

    // Initialize from context
    useEffect(() => {
        if (appSettings) {
            setSettings(appSettings);
        }
    }, [appSettings]);

    useEffect(() => {
        // Apply font live preview
        if (settings.fontFamily) {
            document.body.style.fontFamily = settings.fontFamily;
        }
    }, [settings.fontFamily]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        await saveAppSettings(settings);
        setAppSettingsLocal(settings);
        showToast('Pengaturan aplikasi berhasil disimpan!');
        // Small delay to allow toast to show before potentially refreshing or just visually confirming
        setTimeout(() => {
            window.location.reload(); // Reload to apply title changes globally
        }, 1000);
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({ ...settings, [type]: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const removeLogo = (type) => {
        setSettings({ ...settings, [type]: '' });
    };

    return (
        <div className="animate-fade-in" style={{ width: '100%' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Pengaturan Aplikasi
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Kustomisasi identitas, logo, dan tampilan dasar aplikasi</p>
            </div>

            {/* General Settings */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Layout style={{ color: 'var(--accent-blue)', width: '20px' }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Identitas Web</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Judul Aplikasi</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Contoh: DATABASE PELATIHAN SPORTUNYS"
                        value={settings.appTitle}
                        onChange={(e) => setSettings({ ...settings, appTitle: e.target.value.toUpperCase() })}
                    />
                </div>
            </div>

            {/* Logo Settings */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Upload style={{ color: 'var(--accent-emerald)', width: '20px' }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Logo Kustom</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Logo Light Theme</label>
                        <div style={{
                            height: '120px', background: 'var(--bg-input)', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border-color)',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            {settings.logoLight ? (
                                <>
                                    <img src={settings.logoLight} alt="Logo Light" style={{ maxHeight: '80%', maxWidth: '80%', objectFit: 'contain' }} />
                                    <button
                                        onClick={() => removeLogo('logoLight')}
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--accent-rose)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            ) : (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Belum ada logo</p>
                            )}
                        </div>
                        <label className="btn btn-ghost" style={{ cursor: 'pointer', textAlign: 'center' }}>
                            <Upload size={14} style={{ marginRight: '8px' }} />
                            Pilih File
                            <input type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, 'logoLight')} />
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Logo Dark Theme</label>
                        <div style={{
                            height: '120px', background: '#0f172a', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #1e293b',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            {settings.logoDark ? (
                                <>
                                    <img src={settings.logoDark} alt="Logo Dark" style={{ maxHeight: '80%', maxWidth: '80%', objectFit: 'contain' }} />
                                    <button
                                        onClick={() => removeLogo('logoDark')}
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--accent-rose)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            ) : (
                                <p style={{ fontSize: '12px', color: '#64748b' }}>Belum ada logo</p>
                            )}
                        </div>
                        <label className="btn btn-ghost" style={{ cursor: 'pointer', textAlign: 'center' }}>
                            <Upload size={14} style={{ marginRight: '8px' }} />
                            Pilih File
                            <input type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, 'logoDark')} />
                        </label>
                    </div>
                </div>
            </div>

            {/* Typography */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Type style={{ color: 'var(--accent-amber)', width: '20px' }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Tipografi</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {FONT_OPTIONS.map((f) => {
                        const active = settings.fontFamily === f.value;
                        return (
                            <button
                                key={f.name}
                                onClick={() => setSettings({ ...settings, fontFamily: f.value })}
                                style={{
                                    padding: '12px', borderRadius: '12px', border: '2px solid',
                                    borderColor: active ? 'var(--accent-blue)' : 'var(--border-color)',
                                    background: active ? 'var(--accent-blue-light)' : 'var(--bg-card)',
                                    cursor: 'pointer', fontFamily: f.value, textAlign: 'center',
                                    transition: 'all 0.2s ease', color: active ? 'var(--accent-blue)' : 'var(--text-primary)'
                                }}
                            >
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{f.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px' }}>
                <Save style={{ width: '20px', height: '20px' }} />
                Simpan Semua Pengaturan
            </button>

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <Check style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}
