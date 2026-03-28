import React, { useState, useEffect, useMemo } from 'react';
import { getAllPublicSettings, savePublicSettingsBySlug, slugify } from '../utils/storage';
import { useData } from '../context/DataContext';
import { formatString } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import {
    Search, Check, X, Eye, EyeOff, Globe, Users, ChevronDown, ChevronUp,
    Save, ToggleLeft, ToggleRight, Layout, ExternalLink, CheckSquare, Square, Archive,
    Copy, Link2
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import { isLevelArchived } from '../utils/dateUtils';

const statusBadge = {
    'Belum Bayar': 'badge-rose',
    'DP': 'badge-amber',
    'Lunas': 'badge-emerald',
};

const kepesertaanBadge = {
    'Terdaftar': 'badge-emerald',
    'Konfirmasi': 'badge-amber',
    'Batal': 'badge-rose',
};

const COLUMN_OPTIONS = [
    { key: 'no', label: 'No' },
    { key: 'nama', label: 'Nama Lengkap' },
    { key: 'jenisKelamin', label: 'Jenis Kelamin' },
    { key: 'provinsi', label: 'Provinsi' },
    { key: 'alamat', label: 'Alamat' },
    { key: 'wa', label: 'Nomor WA' },
    { key: 'cabor', label: 'Cabang Olahraga' },
    { key: 'sizeBaju', label: 'Size Baju' },
    { key: 'lahir', label: 'Tempat, Tanggal Lahir' },
    { key: 'sertifikatLv1', label: 'No Sertifikat Lv. 1' },
    { key: 'level', label: 'Jenis Pelatihan' },
    { key: 'kepesertaan', label: 'Kepesertaan' },
];

const DEFAULT_VISIBLE_COLUMNS = {
    no: true, nama: true, jenisKelamin: false, provinsi: true,
    wa: false, cabor: true, sizeBaju: true, lahir: false,
    sertifikatLv1: false, level: true, kepesertaan: true, alamat: false,
};


export default function PublishPeserta() {
    const { peserta, levels } = useData();
    const [allSettings, setAllSettings] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState(null);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState(null);
    const { textFormat } = useTheme();

    // Active (non-archived) level names
    const activeLevels = useMemo(() => {
        return Object.keys(levels).filter(k => !isLevelArchived(levels[k]));
    }, [levels]);

    // Auto-select first level
    useEffect(() => {
        if (activeLevels.length > 0 && !selectedLevel) {
            setSelectedLevel(activeLevels[0]);
        }
    }, [activeLevels, selectedLevel]);

    // Load all public settings
    useEffect(() => {
        const load = async () => {
            const ps = await getAllPublicSettings();
            setAllSettings(ps);
        };
        load();
    }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getKepesertaanStatus = (p) => {
        if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') return 'Terdaftar';
        return p.statusKepesertaan || 'Konfirmasi';
    };

    // Current level's slug & settings
    const currentSlug = slugify(selectedLevel);
    const currentSettings = allSettings?.[currentSlug] || {
        levelName: selectedLevel,
        publishedIds: [],
        visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
        publishAll: false,
        isPublished: false,
    };

    // Peserta for selected level only
    const levelPeserta = useMemo(() => {
        return peserta.filter(p => p.level === selectedLevel && p.statusKepesertaan !== 'Batal');
    }, [peserta, selectedLevel]);

    // Filtered by search
    const filtered = useMemo(() => {
        return levelPeserta.filter(p => {
            return !search || p.nama?.toLowerCase().includes(search.toLowerCase());
        });
    }, [levelPeserta, search]);

    // Update a field in current level's settings
    const updateCurrentSettings = (updater) => {
        setAllSettings(prev => {
            const slug = currentSlug;
            const old = prev?.[slug] || {
                levelName: selectedLevel,
                publishedIds: [],
                visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
                publishAll: false,
                isPublished: false,
            };
            const updated = typeof updater === 'function' ? updater(old) : { ...old, ...updater };
            return { ...prev, [slug]: updated };
        });
        setHasChanges(true);
    };

    const togglePublish = (id) => {
        updateCurrentSettings(prev => {
            const ids = new Set(prev.publishedIds || []);
            if (ids.has(id)) ids.delete(id);
            else ids.add(id);
            return { ...prev, publishedIds: [...ids] };
        });
    };

    const togglePublishAll = () => {
        updateCurrentSettings(prev => {
            const newVal = !prev.publishAll;
            return { ...prev, publishAll: newVal, publishedIds: newVal ? [] : prev.publishedIds };
        });
    };

    const toggleIsPublished = () => {
        updateCurrentSettings(prev => {
            return { ...prev, isPublished: !prev.isPublished };
        });
    };

    const selectAllFiltered = () => {
        updateCurrentSettings(prev => {
            const ids = new Set(prev.publishedIds || []);
            filtered.forEach(p => ids.add(p.id));
            return { ...prev, publishedIds: [...ids] };
        });
    };

    const deselectAllFiltered = () => {
        updateCurrentSettings(prev => {
            const filteredIds = new Set(filtered.map(p => p.id));
            const remaining = (prev.publishedIds || []).filter(id => !filteredIds.has(id));
            return { ...prev, publishedIds: remaining };
        });
    };

    const toggleColumn = (key) => {
        updateCurrentSettings(prev => ({
            ...prev,
            visibleColumns: {
                ...prev.visibleColumns,
                [key]: !prev.visibleColumns[key]
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        const slug = currentSlug;
        const data = { ...currentSettings, levelName: selectedLevel };
        const ok = await savePublicSettingsBySlug(slug, data);
        setSaving(false);
        if (ok) {
            // Optimistic local update — sync allSettings state
            setAllSettings(prev => ({ ...prev, [slug]: data }));
            showToast('Pengaturan publik berhasil disimpan!');
            setHasChanges(false);
        } else {
            showToast('Gagal menyimpan pengaturan.', 'error');
        }
    };

    const publishedCount = currentSettings.publishAll
        ? levelPeserta.length
        : (currentSettings.publishedIds?.length || 0);

    const publicUrl = `${window.location.origin}/peserta/${currentSlug}`;

    const copyLink = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopiedSlug(currentSlug);
        showToast('Link berhasil disalin!');
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    if (!allSettings) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                <div className="login-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Globe style={{ width: '20px', height: '20px', color: 'white' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Publish Data Peserta
                            </h1>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Kelola data publik peserta per jenis pelatihan
                            </p>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        disabled={saving || !hasChanges}
                        style={{ gap: '8px' }}
                    >
                        <Save style={{ width: '16px', height: '16px' }} />
                        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </div>

            {/* Level Tabs */}
            <div className="card" style={{ padding: '6px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                    {activeLevels.map(level => {
                        const slug = slugify(level);
                        const isActive = selectedLevel === level;
                        const levelSettings = allSettings[slug];
                        const isLevelPublished = levelSettings?.isPublished;
                        return (
                            <button
                                key={level}
                                onClick={() => { setSelectedLevel(level); setSearch(''); setHasChanges(false); }}
                                style={{
                                    padding: '10px 20px', borderRadius: '10px', border: 'none',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                    background: isActive ? 'var(--accent-blue)' : 'transparent',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}
                            >
                                {level}
                                {isLevelPublished && (
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: isActive ? 'rgba(255,255,255,0.8)' : 'var(--accent-emerald)',
                                        display: 'inline-block', flexShrink: 0,
                                    }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedLevel && (
                <>
                    {/* Publish Toggle + Link */}
                    <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Halaman Publik {selectedLevel}
                                        </p>
                                        <span className={`badge ${currentSettings.isPublished ? 'badge-emerald' : 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                            {currentSettings.isPublished ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Aktifkan untuk membuat halaman publik bisa diakses
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleIsPublished}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: currentSettings.isPublished ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {currentSettings.isPublished
                                    ? <ToggleRight style={{ width: '40px', height: '40px' }} />
                                    : <ToggleLeft style={{ width: '40px', height: '40px' }} />
                                }
                            </button>
                        </div>

                        {/* Public link */}
                        {currentSettings.isPublished && (
                            <div style={{
                                marginTop: '14px', paddingTop: '14px',
                                borderTop: '1px dashed var(--border-color)',
                                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                            }}>
                                <Link2 style={{ width: '14px', height: '14px', color: 'var(--accent-blue)', flexShrink: 0 }} />
                                <code style={{
                                    flex: 1, fontSize: '12px', color: 'var(--accent-blue)',
                                    background: 'var(--accent-blue-light)', padding: '8px 14px',
                                    borderRadius: '8px', fontWeight: 600, wordBreak: 'break-all',
                                    border: '1px solid var(--accent-blue-border)',
                                }}>
                                    {publicUrl}
                                </code>
                                <button onClick={copyLink} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}>
                                    {copiedSlug === currentSlug ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                                    {copiedSlug === currentSlug ? 'Disalin!' : 'Salin'}
                                </button>
                                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}>
                                    <ExternalLink style={{ width: '14px', height: '14px' }} />
                                    Buka
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Stats Bar */}
                    <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Globe style={{ width: '16px', height: '16px', color: 'var(--accent-emerald)' }} />
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                                    {publishedCount}
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>peserta dipublish</span>
                            </div>
                            <span style={{ color: 'var(--border-color)' }}>|</span>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {levelPeserta.length} total peserta {selectedLevel}
                            </span>
                        </div>
                        {hasChanges && (
                            <span className="badge badge-amber" style={{ fontSize: '11px' }}>
                                Ada perubahan belum disimpan
                            </span>
                        )}
                    </div>

                    {/* Two Column Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

                        {/* Left: Peserta Selection */}
                        <div>
                            {/* Publish All Toggle */}
                            <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Publish Semua Peserta {selectedLevel}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            Aktifkan untuk menampilkan semua peserta {selectedLevel} secara otomatis
                                        </p>
                                    </div>
                                    <button
                                        onClick={togglePublishAll}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: currentSettings.publishAll ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                        }}
                                    >
                                        {currentSettings.publishAll
                                            ? <ToggleRight style={{ width: '40px', height: '40px' }} />
                                            : <ToggleLeft style={{ width: '40px', height: '40px' }} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Search & Bulk Actions */}
                            {!currentSettings.publishAll && (
                                <>
                                    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                                <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Cari nama peserta..."
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    style={{ paddingLeft: '40px' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)' }}>
                                            <button onClick={selectAllFiltered} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px', gap: '6px' }}>
                                                <CheckSquare style={{ width: '14px', height: '14px' }} />
                                                Pilih Semua ({filtered.length})
                                            </button>
                                            <button onClick={deselectAllFiltered} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px', gap: '6px' }}>
                                                <Square style={{ width: '14px', height: '14px' }} />
                                                Hapus Pilihan
                                            </button>
                                        </div>
                                    </div>

                                    {/* Peserta List */}
                                    <div className="card" style={{ overflow: 'hidden' }}>
                                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                            {filtered.length === 0 ? (
                                                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                                                    <Users style={{ width: '40px', height: '40px', color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Tidak ada peserta ditemukan</p>
                                                </div>
                                            ) : (
                                                filtered.map((p, i) => {
                                                    const isPublished = currentSettings.publishedIds?.includes(p.id);
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => togglePublish(p.id)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '14px',
                                                                padding: '14px 20px', cursor: 'pointer',
                                                                borderBottom: '1px solid var(--border-light)',
                                                                background: isPublished ? 'var(--accent-emerald-light)' : 'transparent',
                                                                transition: 'all 0.15s ease',
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '24px', height: '24px', borderRadius: '8px',
                                                                border: isPublished ? '2px solid var(--accent-emerald)' : '2px solid var(--border-color)',
                                                                background: isPublished ? 'var(--accent-emerald)' : 'transparent',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.2s', flexShrink: 0
                                                            }}>
                                                                {isPublished && <Check style={{ width: '14px', height: '14px', color: 'white' }} />}
                                                            </div>

                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {formatString(p.nama, textFormat)}
                                                                </p>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                                    <span className={`badge ${statusBadge[p.statusBayar] || 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                                                        {p.statusBayar || 'Belum Bayar'}
                                                                    </span>
                                                                    <span className={`badge ${kepesertaanBadge[getKepesertaanStatus(p)] || 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                                                        {getKepesertaanStatus(p)}
                                                                    </span>
                                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.wa || '-'}</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ flexShrink: 0 }}>
                                                                {isPublished ? (
                                                                    <Eye style={{ width: '18px', height: '18px', color: 'var(--accent-emerald)' }} />
                                                                ) : (
                                                                    <EyeOff style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Column Settings */}
                        <div className="card" style={{ padding: '20px', position: 'sticky', top: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Layout style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} />
                                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Kolom yang Ditampilkan</h3>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Pilih kolom apa saja yang terlihat di halaman publik {selectedLevel}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {COLUMN_OPTIONS.map(col => {
                                    const active = currentSettings.visibleColumns?.[col.key] ?? true;
                                    return (
                                        <label
                                            key={col.key}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                                                background: active ? 'var(--accent-blue-light)' : 'var(--bg-input)',
                                                border: active ? '1px solid var(--accent-blue-border)' : '1px solid var(--border-color)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{
                                                width: '20px', height: '20px', borderRadius: '6px',
                                                border: active ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)',
                                                background: active ? 'var(--accent-blue)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s', flexShrink: 0
                                            }}>
                                                {active && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                                            </div>
                                            <span style={{
                                                fontSize: '13px', fontWeight: 600,
                                                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)'
                                            }}>{col.label}</span>
                                            <input
                                                type="checkbox"
                                                checked={active}
                                                onChange={() => toggleColumn(col.key)}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <Check style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}
