import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getFormulirResponses, deleteFormulirResponse, approveFormulirResponse, getSertifikatData, slugify } from '../utils/storage';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { formatString, formatWhatsApp } from '../utils/formatters';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { exportFormulirToExcel } from '../utils/exportExcel';
import { isLevelArchived } from '../utils/dateUtils';
import CustomSelect from '../components/CustomSelect';
import {
    FileText, Trash2, User, Search,
    X, Check, AlertCircle, Award, GraduationCap, Image, FileSpreadsheet, Copy, Users, Clock, ClipboardList, CheckCircle, XCircle, MessageCircle,
    PenTool, ExternalLink, Dumbbell, MapPin
} from 'lucide-react';

// Convert Google Drive URL to directly embeddable format
function toDriveDirectUrl(url) {
    if (!url) return url;
    if (url.includes('drive.google.com/thumbnail')) return url;
    let fileId = null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) { fileId = m[1]; break; }
    }
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}`;
    return url;
}


export default function DaftarFormulir() {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState(null);
    const [copiedNames, setCopiedNames] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [activeTab, setActiveTab] = useState('formulir');
    const [sertifikatData, setSertifikatData] = useState([]);

    // Filter & Sort State
    const [filterStatus, setFilterStatus] = useState('Semua');
    const [filterLevel, setFilterLevel] = useState('Semua');
    const [sortBy, setSortBy] = useState('default');

    const { dark, textFormat } = useTheme();
    const { peserta, levels, updatePesertaLocal } = useData();

    // Map peserta by ID for quick lookup
    const pesertaMap = useMemo(() => {
        const map = {};
        peserta.forEach(p => { map[p.id] = p; });
        return map;
    }, [peserta]);

    // Level options for filter
    const levelOptions = useMemo(() => {
        const active = Object.entries(levels)
            .filter(([_, data]) => !isLevelArchived(data))
            .map(([k]) => k);
        return ['Semua', ...active];
    }, [levels]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [data, sertData] = await Promise.all([
            getFormulirResponses(),
            getSertifikatData(),
        ]);
        setResponses(data);
        setSertifikatData(sertData);
        setLoading(false);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleReject = async (item, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(`Tolak dan hapus formulir dari ${item.nama}?`)) return;
        setActionLoading(item.id);
        const ok = await deleteFormulirResponse(item.id);
        setActionLoading(null);
        if (ok) {
            setResponses(prev => prev.filter(r => r.id !== item.id));
            if (selectedItem?.id === item.id) setSelectedItem(null);
            showToast('Formulir ditolak dan dihapus.');
        } else {
            showToast('Gagal menghapus formulir.', 'error');
        }
    };

    // Helper: convert submittedAt to comparable number
    const toTs = (v) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        if (v?.seconds) return v.seconds * 1000; // Firestore Timestamp
        return new Date(v).getTime() || 0;
    };

    // Sinkronkan data formulir dengan data peserta terbaru (master data)
    const syncedResponses = useMemo(() => {
        return responses.map(r => {
            const p = pesertaMap[r.pesertaId];
            if (p) {
                return {
                    ...r,
                    // Timpa dengan data terbaru yang ada di database peserta (DaftarPeserta.jsx)
                    nama: p.nama || r.nama,
                    cabor: p.cabor || r.cabor,
                    level: p.level || r.level,
                    wa: p.wa || r.wa,
                    provinsi: p.provinsi || r.provinsi,
                    alamat: p.alamat || r.alamat,
                    ttl: p.ttl || r.ttl,
                    jenisKelamin: p.jenisKelamin || r.jenisKelamin,
                };
            }
            return r;
        });
    }, [responses, pesertaMap]);

    // Use sorting on filtered responses
    const filtered = useMemo(() => {
        let result = syncedResponses.filter(r =>
            r.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.cabor?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Filter by level
        if (filterLevel !== 'Semua') {
            result = result.filter(r => r.level === filterLevel);
        }

        return [...result].sort((a, b) => {
            if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
            if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
            if (sortBy === 'terlama') return toTs(a.submittedAt) - toTs(b.submittedAt);
            return toTs(b.submittedAt) - toTs(a.submittedAt); // default = terbaru
        });
    }, [syncedResponses, searchTerm, sortBy, filterLevel]);

    // Duplicate detection: count submissions per normalized name
    const duplicateNames = useMemo(() => {
        const nameCount = {};
        syncedResponses.forEach(r => {
            const key = (r.nama || '').trim().toLowerCase();
            if (key) nameCount[key] = (nameCount[key] || 0) + 1;
        });
        const dupes = new Set();
        Object.entries(nameCount).forEach(([k, v]) => { if (v > 1) dupes.add(k); });
        return dupes;
    }, [syncedResponses]);

    const duplicateCount = duplicateNames.size;

    // Count formulir from active (non-archived) peserta
    const activeCount = useMemo(() => {
        return syncedResponses.filter(r => {
            const p = pesertaMap[r.pesertaId];
            if (!p) return false;
            const levelData = levels[p.level];
            return !isLevelArchived(levelData);
        }).length;
    }, [syncedResponses, pesertaMap, levels]);

    const handleExport = () => {
        if (filtered.length === 0) {
            showToast('Tidak ada data untuk diexport!', 'error');
            return;
        }

        const d = filtered.map(r => ({
            ...r,
            nama: formatString(r.nama, textFormat),
            cabor: formatString(r.cabor, textFormat),
            provinsi: formatString(r.provinsi, textFormat),
            alamat: formatString(r.alamat, textFormat),
            ttl: formatString(r.ttl, textFormat),
        }));

        exportFormulirToExcel(d, 'data_formulir_update');
        showToast(`${d.length} formulir berhasil diexport!`);
    };

    // Set of pesertaIds who have submitted formulir
    const submittedIds = useMemo(() => {
        return new Set(syncedResponses.map(r => r.pesertaId));
    }, [syncedResponses]);

    // Active (non-archived) peserta list
    const activePeserta = useMemo(() => {
        return peserta.filter(p => {
            if (p.statusKepesertaan === 'Batal') return false;
            const levelData = levels[p.level];
            return !isLevelArchived(levelData);
        });
    }, [peserta, levels]);

    const filteredPeserta = useMemo(() => {
        let result = activePeserta;

        // Filter: Level
        if (filterLevel !== 'Semua') {
            result = result.filter(p => p.level === filterLevel);
        }

        // Filter: Status Submit
        if (filterStatus === 'Sudah Kirim') {
            result = result.filter(p => submittedIds.has(p.id));
        } else if (filterStatus === 'Belum Kirim') {
            result = result.filter(p => !submittedIds.has(p.id));
        }

        // Search: text
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.nama?.toLowerCase().includes(q) ||
                p.cabor?.toLowerCase().includes(q) ||
                p.level?.toLowerCase().includes(q)
            );
        }

        // Sort
        return [...result].sort((a, b) => {
            if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
            if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
            if (sortBy === 'sudah-kirim') return (submittedIds.has(b.id) ? 1 : 0) - (submittedIds.has(a.id) ? 1 : 0);
            if (sortBy === 'belum-kirim') return (submittedIds.has(a.id) ? 1 : 0) - (submittedIds.has(b.id) ? 1 : 0);
            return 0; // default
        });
    }, [activePeserta, searchTerm, filterStatus, filterLevel, sortBy, submittedIds]);

    // Stats derived from filtered data
    const sudahKirimCount = filteredPeserta.filter(p => submittedIds.has(p.id)).length;
    const belumKirimCount = filteredPeserta.filter(p => !submittedIds.has(p.id)).length;

    // Copy daftar nama peserta yang belum kirim
    const handleCopyBelumKirim = () => {
        const belumKirimList = filteredPeserta.filter(p => !submittedIds.has(p.id));
        if (belumKirimList.length === 0) {
            showToast('Tidak ada peserta yang belum kirim.', 'error');
            return;
        }
        const sorted = [...belumKirimList].sort((a, b) =>
            (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
        );
        const text = sorted.map((p, i) => `${i + 1} ${p.nama}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopiedNames(true);
            showToast(`${sorted.length} nama peserta belum kirim berhasil disalin!`);
            setTimeout(() => setCopiedNames(false), 2500);
        });
    };

    // Duplicate count from filtered formulir
    const filteredDuplicateCount = useMemo(() => {
        const nameCount = {};
        filtered.forEach(r => {
            const key = (r.nama || '').trim().toLowerCase();
            if (key) nameCount[key] = (nameCount[key] || 0) + 1;
        });
        return Object.values(nameCount).filter(v => v > 1).length;
    }, [filtered]);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <FileText style={{ width: '20px', height: '20px', color: 'white' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Formulir Update Peserta
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Lihat data formulir yang baru masuk
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={handleExport} className="btn btn-primary" style={{ padding: '8px 16px', gap: '8px' }}>
                        <FileSpreadsheet style={{ width: '16px', height: '16px' }} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-input)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => { setActiveTab('formulir'); setSortBy('default'); }}
                    style={{
                        flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: activeTab === 'formulir' ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === 'formulir' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === 'formulir' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    <FileText style={{ width: '14px', height: '14px' }} />
                    Formulir Masuk
                    {syncedResponses.length > 0 && (
                        <span style={{
                            background: 'var(--accent-amber)', color: 'white',
                            borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 800,
                        }}>{syncedResponses.length}</span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab('peserta'); setSortBy('default'); }}
                    style={{
                        flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: activeTab === 'peserta' ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === 'peserta' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === 'peserta' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    <Users style={{ width: '14px', height: '14px' }} />
                    Peserta Aktif
                    <span style={{
                        background: 'var(--text-muted)', color: 'white',
                        borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 800,
                    }}>{activePeserta.length}</span>
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input"
                            placeholder={activeTab === 'formulir' ? 'Cari nama atau cabor...' : 'Cari peserta...'}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                    <CustomSelect
                        value={filterLevel}
                        onChange={setFilterLevel}
                        options={levelOptions.map(l => ({ value: l, label: l === 'Semua' ? 'Semua Pelatihan' : l }))}
                        style={{ flex: 1, minWidth: '150px' }}
                    />
                    {activeTab === 'peserta' && (
                        <CustomSelect
                            value={filterStatus}
                            onChange={setFilterStatus}
                            style={{ flex: 1, minWidth: '150px' }}
                            options={[
                                { value: 'Semua', label: 'Semua Status' },
                                { value: 'Sudah Kirim', label: 'Sudah Kirim' },
                                { value: 'Belum Kirim', label: 'Belum Kirim' },
                            ]}
                        />
                    )}
                    {activeTab === 'formulir' ? (
                        <CustomSelect
                            value={sortBy}
                            onChange={setSortBy}
                            style={{ flex: 1, minWidth: '160px' }}
                            options={[
                                { value: 'default', label: 'Terbaru' },
                                { value: 'terlama', label: 'Terlama' },
                                { value: 'nama-asc', label: 'Nama A-Z' },
                                { value: 'nama-desc', label: 'Nama Z-A' },
                            ]}
                        />
                    ) : (
                        <CustomSelect
                            value={sortBy}
                            onChange={setSortBy}
                            style={{ flex: 1, minWidth: '160px' }}
                            options={[
                                { value: 'default', label: 'Urutan Default' },
                                { value: 'nama-asc', label: 'Nama A-Z' },
                                { value: 'nama-desc', label: 'Nama Z-A' },
                                { value: 'sudah-kirim', label: 'Sudah Kirim Dulu' },
                                { value: 'belum-kirim', label: 'Belum Kirim Dulu' },
                            ]}
                        />
                    )}
                </div>
            </div>

            {/* ===== FORMULIR TAB ===== */}
            {activeTab === 'formulir' && (<>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ClipboardList style={{ width: '18px', height: '18px', color: 'var(--accent-amber)' }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-amber)', lineHeight: 1 }}>{filtered.length}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Formulir Masuk</p>
                        </div>
                    </div>
                    <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{activeCount}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Peserta Aktif</p>
                        </div>
                    </div>
                    {filteredDuplicateCount > 0 && (
                        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Copy style={{ width: '18px', height: '18px', color: 'var(--accent-rose)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-rose)', lineHeight: 1 }}>{filteredDuplicateCount}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Duplikat</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* List */}
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                        <div className="login-spinner" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <Check style={{ width: '48px', height: '48px', color: 'var(--accent-emerald)', margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Tidak Ada Formulir Pending</p>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Semua formulir telah direview.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filtered.map((item, index) => {
                            const isDuplicate = duplicateNames.has((item.nama || '').trim().toLowerCase());
                            return (
                                <div
                                    key={item.id}
                                    className="card"
                                    onClick={() => setSelectedItem(item)}
                                    style={{
                                        padding: '16px 20px', cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        borderLeft: `3px solid ${isDuplicate ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                                            {/* Nomor */}
                                            <span style={{
                                                width: '28px', height: '28px', borderRadius: '8px',
                                                background: isDuplicate ? 'rgba(244, 63, 94, 0.12)' : 'var(--bg-input)',
                                                color: isDuplicate ? 'var(--accent-rose)' : 'var(--text-muted)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px', fontWeight: 800, flexShrink: 0,
                                            }}>
                                                {index + 1}
                                            </span>

                                            {/* Foto */}
                                            <div style={{
                                                width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden',
                                                background: 'var(--bg-input)', flexShrink: 0, display: 'flex',
                                                alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {item.fotoUrl ? (
                                                    <img
                                                        src={toDriveDirectUrl(item.fotoUrl)}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <User style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {formatString(item.nama, textFormat)}
                                                    </p>
                                                    {isDuplicate && (
                                                        <span style={{
                                                            fontSize: '9px', fontWeight: 800, padding: '2px 6px',
                                                            borderRadius: '6px', background: 'rgba(244, 63, 94, 0.12)',
                                                            color: 'var(--accent-rose)', whiteSpace: 'nowrap', flexShrink: 0,
                                                        }}>
                                                            DUPLIKAT
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                                                    <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 8px' }}>{item.level}</span>
                                                    <span className="badge badge-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}>{item.cabor}</span>
                                                    {item.wa && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            {item.wa?.replace(/-/g, '')}
                                                            <a
                                                                href={`https://wa.me/${formatWhatsApp(item.wa)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="icon-btn icon-btn-emerald"
                                                                style={{ width: '22px', height: '22px' }}
                                                                title="Chat WhatsApp"
                                                            >
                                                                <MessageCircle style={{ width: '12px', height: '12px' }} />
                                                            </a>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Time & Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {item.submittedAt ? format(new Date(item.submittedAt), 'dd MMM yyyy', { locale: localeId }) : '-'}
                                            </span>
                                            <button
                                                onClick={(e) => handleReject(item, e)}
                                                disabled={actionLoading === item.id}
                                                className="btn btn-ghost"
                                                style={{ padding: '6px', color: 'var(--accent-rose)' }}
                                                title="Tolak"
                                            >
                                                <Trash2 style={{ width: '16px', height: '16px' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ===== Detail / Comparison Modal ===== */}
                {selectedItem && createPortal(
                    <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
                        <div className="modal-content" style={{ maxWidth: '780px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)', color: 'white', position: 'relative' }}>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    style={{ position: 'absolute', right: '16px', top: '16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex' }}
                                >
                                    <X style={{ width: '18px', height: '18px' }} />
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {selectedItem.fotoUrl && (
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                                            <img src={toDriveDirectUrl(selectedItem.fotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '2px' }}>
                                            {formatString(selectedItem.nama, textFormat)}
                                        </h2>
                                        <p style={{ fontSize: '13px', opacity: 0.9 }}>
                                            Dikirim {selectedItem.submittedAt ? format(new Date(selectedItem.submittedAt), 'EEEE, dd MMMM yyyy HH:mm', { locale: localeId }) : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Comparison Body */}
                            <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
                                <ComparisonView
                                    formulir={selectedItem}
                                    peserta={pesertaMap[selectedItem.pesertaId]}
                                    sertifikatData={sertifikatData}
                                />
                            </div>

                            {/* Footer Actions */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'flex-start', gap: '12px' }}>
                                <button
                                    onClick={() => handleReject(selectedItem)}
                                    disabled={actionLoading === selectedItem.id}
                                    className="btn btn-ghost"
                                    style={{ color: 'var(--accent-rose)', gap: '6px' }}
                                >
                                    <Trash2 style={{ width: '16px', height: '16px' }} />
                                    Hapus Formulir
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </>)}

            {/* ===== PESERTA AKTIF TAB ===== */}
            {activeTab === 'peserta' && (
                <>
                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Users style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{filteredPeserta.length}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Ditampilkan</p>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCircle style={{ width: '18px', height: '18px', color: 'var(--accent-emerald)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)', lineHeight: 1 }}>{sudahKirimCount}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Sudah Kirim</p>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <XCircle style={{ width: '18px', height: '18px', color: 'var(--accent-rose)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-rose)', lineHeight: 1 }}>{belumKirimCount}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Belum Kirim</p>
                            </div>
                        </div>
                    </div>

                    {/* Copy Button for Belum Kirim */}
                    {belumKirimCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                            <button
                                onClick={handleCopyBelumKirim}
                                className="btn btn-outline"
                                style={{
                                    padding: '8px 16px', fontSize: '13px', gap: '6px',
                                    display: 'flex', alignItems: 'center',
                                    borderColor: copiedNames ? 'var(--accent-emerald)' : undefined,
                                    color: copiedNames ? 'var(--accent-emerald)' : undefined,
                                }}
                            >
                                {copiedNames ? <Check size={14} /> : <Copy size={14} />}
                                {copiedNames ? 'Tersalin!' : `Copy Daftar Belum Kirim (${belumKirimCount})`}
                            </button>
                        </div>
                    )}

                    {/* Peserta List */}
                    {filteredPeserta.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <Users style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Tidak ada peserta ditemukan</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredPeserta.map((p, index) => {
                                const hasSubmitted = submittedIds.has(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className="card"
                                        style={{
                                            padding: '14px 20px',
                                            borderLeft: `3px solid ${hasSubmitted ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                {/* Nomor */}
                                                <span style={{
                                                    width: '28px', height: '28px', borderRadius: '8px',
                                                    background: 'var(--bg-input)',
                                                    color: 'var(--text-muted)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '12px', fontWeight: 800, flexShrink: 0,
                                                }}>
                                                    {index + 1}
                                                </span>

                                                {/* Info */}
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {formatString(p.nama, textFormat)}
                                                    </p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                                                        <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 8px' }}>{p.level}</span>
                                                        <span className="badge badge-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}>{p.cabor}</span>
                                                        {p.wa && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                {p.wa?.replace(/-/g, '')}
                                                                <a
                                                                    href={
                                                                        hasSubmitted
                                                                            ? `https://wa.me/${formatWhatsApp(p.wa)}`
                                                                            : `https://wa.me/${formatWhatsApp(p.wa)}?text=${encodeURIComponent(
                                                                                `Halo coach ${p.nama || ''} mohon segera mengisi data formulir pada link berikut ${window.location.origin}/formulir/${slugify(p.level || '')}\nditunggu ya coach. terimakasih`
                                                                            )}`
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="icon-btn icon-btn-emerald"
                                                                    style={{ width: '22px', height: '22px' }}
                                                                    title="Chat WhatsApp"
                                                                >
                                                                    <MessageCircle style={{ width: '12px', height: '12px' }} />
                                                                </a>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <span style={{
                                                fontSize: '11px', fontWeight: 800, padding: '4px 12px',
                                                borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0,
                                                background: hasSubmitted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                                color: hasSubmitted ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                            }}>
                                                {hasSubmitted ? <CheckCircle style={{ width: '13px', height: '13px' }} /> : <XCircle style={{ width: '13px', height: '13px' }} />}
                                                {hasSubmitted ? 'Sudah Kirim' : 'Belum Kirim'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <AlertCircle style={{ width: '18px', height: '18px' }} /> : <Check style={{ width: '18px', height: '18px' }} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

function ComparisonView({ formulir, peserta, sertifikatData = [] }) {
    if (!peserta) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle style={{ width: '32px', height: '32px', margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 600 }}>Data peserta tidak ditemukan di database.</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Peserta mungkin sudah dihapus.</p>
            </div>
        );
    }

    const isLevel2 = (formulir.level || peserta.level || '').toLowerCase().includes('2');

    const groups = [
        {
            title: 'Data Pribadi',
            icon: <User size={16} />,
            fields: [
                { key: 'ttl', label: 'Tempat, Tanggal Lahir' },
                { key: 'alamat', label: 'Alamat' },
                { key: 'jenisKelamin', label: 'Jenis Kelamin' },
                { key: 'pekerjaan', label: 'Pekerjaan' },
            ],
        },
        ...(!isLevel2 ? [{
            title: 'Pendidikan & Sertifikasi',
            icon: <GraduationCap size={16} />,
            fields: [
                { key: 'pendidikan', label: 'Pendidikan Terakhir' },
                { key: 'latarPendidikanOlahraga', label: 'Latar Pend. Olahraga' },
                { key: 'sertifikatPelatih', label: 'Sertifikat Pelatih' },
                { key: 'khususPelatihFisik', label: 'Khusus Pelatih Fisik' },
            ],
        }] : []),
        {
            title: 'Pengalaman & Lingkup',
            icon: <Award size={16} />,
            fields: [
                { key: 'pengalamanMelatih', label: 'Pengalaman Melatih' },
                { key: 'levelKepelatihan', label: 'Level Kepelatihan' },
                ...(!isLevel2 ? [{ key: 'tempatKerja', label: 'Bekerja Sebagai Pelatih di' }] : []),
            ],
        },
        ...(isLevel2 ? [{
            title: 'Data Khusus Level 2',
            icon: <Dumbbell size={16} />,
            fields: [
                { key: 'pelatihanLevel1DiManaTahun', label: 'Pelatihan Level I di mana & Tahun' },
                { key: 'pekerjaanSetelahLevel1', label: 'Pekerjaan Pelatih Fisik setelah Level I' },
                { key: 'pengalamanMelatihFisik', label: 'Pengalaman Melatih Fisik' },
                { key: 'levelMelatihFisik', label: 'Level Melatih Fisik' },
            ],
        }] : []),
    ];

    // Find sertifikat data for this peserta (match by name & level)
    const pesertaSertifikat = useMemo(() => {
        if (!isLevel2 || !sertifikatData.length) return null;
        const namaLower = (peserta.nama || '').trim().toLowerCase();
        const levelName = formulir.level || peserta.level || '';
        return sertifikatData.find(s =>
            (s.nama || '').trim().toLowerCase() === namaLower &&
            (s.level || '') === levelName
        ) || null;
    }, [isLevel2, sertifikatData, peserta.nama, formulir.level, peserta.level]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Info badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-blue" style={{ padding: '4px 10px', fontSize: '11px' }}>{peserta.level}</span>
                <span className="badge badge-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>{peserta.cabor}</span>
                <span className="badge badge-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>{peserta.wa}</span>
                {isLevel2 && (
                    <span style={{
                        padding: '4px 10px', fontSize: '11px', fontWeight: 800,
                        borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)',
                        color: 'var(--accent-amber)',
                    }}>Level 2</span>
                )}
            </div>

            {groups.map(group => {
                return (
                    <div key={group.title} style={{
                        background: 'var(--bg-input)', borderRadius: '14px',
                        padding: '16px', border: '1px solid var(--border-light)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <div style={{ color: 'var(--accent-blue)' }}>{group.icon}</div>
                            <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>{group.title}</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {group.fields.map(f => (
                                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        {f.label}
                                    </span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        {Array.isArray(formulir[f.key]) ? formulir[f.key].join(', ') : (formulir[f.key] || '-')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Tanda Tangan (Level 2 only) */}
            {isLevel2 && formulir.tandaTangan && (
                <div style={{
                    background: 'var(--bg-input)', borderRadius: '14px',
                    padding: '16px', border: '1px solid var(--border-light)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <PenTool size={16} style={{ color: 'var(--accent-blue)' }} />
                        <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>Tanda Tangan</h4>
                    </div>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '12px',
                        border: '2px dashed var(--border-color)', padding: '12px',
                        display: 'flex', justifyContent: 'center',
                    }}>
                        <img
                            src={formulir.tandaTangan}
                            alt="Tanda Tangan"
                            style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain' }}
                        />
                    </div>
                </div>
            )}

            {/* Sertifikat Links (Level 2 only) */}
            {isLevel2 && pesertaSertifikat && (
                <div style={{
                    background: 'var(--bg-input)', borderRadius: '14px',
                    padding: '16px', border: '1px solid var(--border-light)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Award size={16} style={{ color: 'var(--accent-amber)' }} />
                        <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>Sertifikat</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Peserta info */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                            {pesertaSertifikat.cabor && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                                    background: 'var(--bg-card)', padding: '3px 10px', borderRadius: '8px',
                                }}>
                                    <Dumbbell size={11} /> {(pesertaSertifikat.cabor || '').toUpperCase()}
                                </span>
                            )}
                            {pesertaSertifikat.provinsi && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                                    background: 'var(--bg-card)', padding: '3px 10px', borderRadius: '8px',
                                }}>
                                    <MapPin size={11} /> {(pesertaSertifikat.provinsi || '').toUpperCase()}
                                </span>
                            )}
                        </div>
                        {/* Cert links */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {pesertaSertifikat.linkLankor && (
                                <a
                                    href={pesertaSertifikat.linkLankor}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                        color: 'white', fontSize: '12px', fontWeight: 700,
                                        textDecoration: 'none', transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                                    }}
                                >
                                    <ExternalLink size={13} /> Lankor
                                </a>
                            )}
                            {pesertaSertifikat.linkICCA && (
                                <a
                                    href={pesertaSertifikat.linkICCA}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: 'white', fontSize: '12px', fontWeight: 700,
                                        textDecoration: 'none', transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                                    }}
                                >
                                    <ExternalLink size={13} /> ICCA
                                </a>
                            )}
                            {pesertaSertifikat.linkSportunys && (
                                <a
                                    href={pesertaSertifikat.linkSportunys}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        color: 'white', fontSize: '12px', fontWeight: 700,
                                        textDecoration: 'none', transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                                    }}
                                >
                                    <ExternalLink size={13} /> Sportunys
                                </a>
                            )}
                        </div>
                        {!pesertaSertifikat.linkLankor && !pesertaSertifikat.linkICCA && !pesertaSertifikat.linkSportunys && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Data sertifikat ditemukan, namun belum ada link sertifikat yang tersedia.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* No sertifikat data notice for Level 2 */}
            {isLevel2 && !pesertaSertifikat && (
                <div style={{
                    background: 'rgba(245, 158, 11, 0.06)', borderRadius: '14px',
                    padding: '16px', border: '1px solid rgba(245, 158, 11, 0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={16} style={{ color: 'var(--accent-amber)' }} />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Data sertifikat untuk peserta ini belum tersedia.
                        </p>
                    </div>
                </div>
            )}

            {/* Foto comparison */}
            {formulir.fotoUrl && (
                <div style={{
                    background: 'var(--bg-input)', borderRadius: '14px',
                    padding: '16px', border: '1px solid var(--border-light)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Image size={16} style={{ color: 'var(--accent-blue)' }} />
                        <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', flex: 1 }}>Foto Diunggah</h4>
                    </div>
                    <a href={toDriveDirectUrl(formulir.fotoUrl)} target="_blank" rel="noreferrer">
                        <img
                            src={toDriveDirectUrl(formulir.fotoUrl)}
                            alt="Foto Peserta"
                            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px' }}
                        />
                    </a>
                </div>
            )}
        </div>
    );
}
