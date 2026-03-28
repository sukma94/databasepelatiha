import React, { useState, useEffect, useMemo } from 'react';
import { getEditSuggestions, approveEditSuggestion, rejectEditSuggestion } from '../utils/storage';
import { Check, X, MessageSquare, ArrowRight, Save, Trash2, Clock, History, Search, ChevronDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { isLevelArchived } from '../utils/dateUtils';
import CustomSelect from '../components/CustomSelect';

export default function SaranEdit() {
    const [allSuggestions, setAllSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [toast, setToast] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [filterLevel, setFilterLevel] = useState('Semua');
    const [filterSource, setFilterSource] = useState('Semua');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const { updatePesertaLocal, levels } = useData();

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const loadData = async () => {
        setLoading(true);
        const data = await getEditSuggestions();
        setAllSuggestions(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const allPending = useMemo(() => allSuggestions.filter(s => s.status === 'pending' || !s.status), [allSuggestions]);
    const allHistory = useMemo(() => allSuggestions.filter(s => s.status === 'approved' || s.status === 'rejected'), [allSuggestions]);

    // Level options for filter
    const levelOptions = useMemo(() => {
        const active = Object.entries(levels)
            .filter(([_, data]) => !isLevelArchived(data))
            .map(([k]) => k);
        return ['Semua', ...active];
    }, [levels]);

    // Source options
    const sourceOptions = [
        { value: 'Semua', label: 'Semua Sumber' },
        { value: 'formulir', label: 'Formulir' },
        { value: 'public', label: 'Halaman Publik' },
    ];

    // Apply filters
    const applyFilters = (list) => {
        let result = list;
        if (filterLevel !== 'Semua') {
            result = result.filter(s => (s.dataLama?.level || s.dataBaru?.level) === filterLevel);
        }
        if (filterSource !== 'Semua') {
            result = result.filter(s => (s.source || 'public') === filterSource);
        }
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(s =>
                s.dataLama?.nama?.toLowerCase().includes(q) ||
                s.dataBaru?.nama?.toLowerCase().includes(q) ||
                s.dataLama?.cabor?.toLowerCase().includes(q)
            );
        }
        return result;
    };

    const pending = useMemo(() => applyFilters(allPending), [allPending, filterLevel, filterSource, searchTerm]);
    const history = useMemo(() => applyFilters(allHistory), [allHistory, filterLevel, filterSource, searchTerm]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleApprove = async (s) => {
        setActionLoading(s.id);

        const updates = {
            nama: s.dataBaru.nama,
            ttl: s.dataBaru.ttl,
            cabor: s.dataBaru.cabor,
            provinsi: s.dataBaru.provinsi,
            ukuranBaju: s.dataBaru.ukuranBaju,
            jenisKelamin: s.dataBaru.jenisKelamin,
            alamat: s.dataBaru.alamat,
        };

        if (s.dataBaru.nomerSertifikatLevel1 !== undefined) {
            updates.nomerSertifikatLevel1 = s.dataBaru.nomerSertifikatLevel1;
        }

        const ok = await approveEditSuggestion(s.id, s.pesertaId, updates);
        setActionLoading(null);
        if (ok) {
            updatePesertaLocal(s.pesertaId, updates);
            // Optimistic local update — no re-fetch
            setAllSuggestions(prev => prev.map(item =>
                item.id === s.id ? { ...item, status: 'approved', reviewedAt: new Date().toISOString() } : item
            ));
            showToast('Saran edit disetujui, data peserta telah diupdate.');
        } else {
            showToast('Gagal menyetujui saran edit.', 'error');
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Tolak pengajuan ini?")) return;
        setActionLoading(id);
        const ok = await rejectEditSuggestion(id);
        setActionLoading(null);
        if (ok) {
            // Optimistic local update — no re-fetch
            setAllSuggestions(prev => prev.map(item =>
                item.id === id ? { ...item, status: 'rejected', reviewedAt: new Date().toISOString() } : item
            ));
            showToast('Saran edit berhasil ditolak.');
        } else {
            showToast('Gagal menolak saran edit.', 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
                <div className="login-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <MessageSquare style={{ width: '20px', height: '20px', color: 'white' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Saran Edit dari Peserta
                    </h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Review dan setujui perubahan data yang diajukan oleh peserta
                    </p>
                </div>
            </div>

            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-input)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => setActiveTab('pending')}
                    style={{
                        flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: activeTab === 'pending' ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === 'pending' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    <Clock style={{ width: '14px', height: '14px' }} />
                    Pending
                    {allPending.length > 0 && (
                        <span style={{
                            background: 'var(--accent-amber)', color: 'white',
                            borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 800,
                        }}>{allPending.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: activeTab === 'history' ? 'var(--bg-card)' : 'transparent',
                        color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    <History style={{ width: '14px', height: '14px' }} />
                    Riwayat
                    {allHistory.length > 0 && (
                        <span style={{
                            background: 'var(--text-muted)', color: 'white',
                            borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 800,
                        }}>{allHistory.length}</span>
                    )}
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
                            placeholder="Cari nama atau cabor..."
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
                    <CustomSelect
                        value={filterSource}
                        onChange={setFilterSource}
                        options={sourceOptions}
                        style={{ flex: 1, minWidth: '150px' }}
                    />
                </div>
            </div>

            {/* ===== PENDING TAB ===== */}
            {activeTab === 'pending' && (
                <>
                    {pending.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <Check style={{ width: '48px', height: '48px', color: 'var(--accent-emerald)', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Tidak Ada Pengajuan Pending</p>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Semua saran edit telah direview.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {pending.map(s => {
                                const isExpanded = expandedIds.has(s.id);
                                return (
                                    <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <div
                                            style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', transition: 'background 0.15s' }}
                                            onClick={() => toggleExpand(s.id)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <ChevronDown style={{
                                                    width: '18px', height: '18px', color: 'var(--text-muted)', flexShrink: 0,
                                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                                }} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.dataLama?.nama || 'Peserta'}</h3>
                                                        {(s.dataLama?.level || s.dataBaru?.level) && (
                                                            <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                                {s.dataLama?.level || s.dataBaru?.level}
                                                            </span>
                                                        )}
                                                        {s.source === 'formulir' && (
                                                            <span className="badge badge-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}>Formulir</span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        Diajukan pada: {s.createdAt ? new Date(s.createdAt).toLocaleString('id-ID') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }} onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleReject(s.id)}
                                                    disabled={actionLoading === s.id}
                                                    className="btn btn-ghost"
                                                    style={{ color: 'var(--accent-rose)', gap: '6px' }}
                                                >
                                                    <Trash2 style={{ width: '16px', height: '16px' }} />
                                                    Tolak
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(s)}
                                                    disabled={actionLoading === s.id}
                                                    className="btn btn-primary"
                                                    style={{ background: 'var(--accent-emerald)', color: 'white', border: 'none', gap: '6px' }}
                                                >
                                                    <Save style={{ width: '16px', height: '16px' }} />
                                                    {actionLoading === s.id ? 'Loading...' : 'Setujui & Update'}
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{
                                            maxHeight: isExpanded ? '800px' : '0',
                                            overflow: 'hidden',
                                            transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }}>
                                            <div style={{ padding: '0 20px 20px' }}>
                                                <ComparisonGrid s={s} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ===== HISTORY TAB ===== */}
            {activeTab === 'history' && (
                <>
                    {history.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                            <History style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Belum Ada Riwayat</p>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Riwayat approve/tolak akan muncul di sini.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {history.map(s => {
                                const isExpanded = expandedIds.has(s.id);
                                return (
                                    <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: 0.92 }}>
                                        <div
                                            style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', transition: 'background 0.15s' }}
                                            onClick={() => toggleExpand(s.id)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <ChevronDown style={{
                                                    width: '18px', height: '18px', color: 'var(--text-muted)', flexShrink: 0,
                                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                                }} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.dataLama?.nama || 'Peserta'}</h3>
                                                        {(s.dataLama?.level || s.dataBaru?.level) && (
                                                            <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                                {s.dataLama?.level || s.dataBaru?.level}
                                                            </span>
                                                        )}
                                                        {s.source === 'formulir' && (
                                                            <span className="badge badge-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}>Formulir</span>
                                                        )}
                                                        <span style={{
                                                            fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px',
                                                            background: s.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                                            color: s.status === 'approved' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                                        }}>
                                                            {s.status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        Diajukan: {s.createdAt ? new Date(s.createdAt).toLocaleString('id-ID') : '-'}
                                                        {s.reviewedAt && (
                                                            <span style={{ marginLeft: '12px' }}>
                                                                • Direview: {new Date(s.reviewedAt).toLocaleString('id-ID')}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            maxHeight: isExpanded ? '800px' : '0',
                                            overflow: 'hidden',
                                            transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }}>
                                            <div style={{ padding: '0 20px 20px' }}>
                                                <ComparisonGrid s={s} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <X style={{ width: '18px', height: '18px' }} /> : <Check style={{ width: '18px', height: '18px' }} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

function ComparisonGrid({ s }) {
    const isLevel2 = (s.dataLama?.level || s.dataBaru?.level || '').toLowerCase().includes('2');

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: '16px', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', height: '100%' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>DATA LAMA</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <FieldRow label="Nama" val={s.dataLama?.nama} />
                    <FieldRow label="TTL" val={s.dataLama?.ttl} />
                    <FieldRow label="Cabor" val={s.dataLama?.cabor} />
                    <FieldRow label="Provinsi" val={s.dataLama?.provinsi} />
                    <FieldRow label="Size" val={s.dataLama?.ukuranBaju} />
                    <FieldRow label="JK" val={s.dataLama?.jenisKelamin} />
                    <FieldRow label="Alamat" val={s.dataLama?.alamat} />
                    {isLevel2 && <FieldRow label="No.Sert Lev.1" val={s.dataLama?.nomerSertifikatLevel1} />}
                </div>
            </div>

            <div style={{ background: 'var(--bg-body)', borderRadius: '50%', padding: '6px', border: '1px solid var(--border-color)', display: 'flex' }}>
                <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', height: '100%' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>DATA BARU (PENGAJUAN)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <FieldRow label="Nama" val={s.dataBaru?.nama} oldVal={s.dataLama?.nama} />
                    <FieldRow label="TTL" val={s.dataBaru?.ttl} oldVal={s.dataLama?.ttl} />
                    <FieldRow label="Cabor" val={s.dataBaru?.cabor} oldVal={s.dataLama?.cabor} />
                    <FieldRow label="Provinsi" val={s.dataBaru?.provinsi} oldVal={s.dataLama?.provinsi} />
                    <FieldRow label="Size" val={s.dataBaru?.ukuranBaju} oldVal={s.dataLama?.ukuranBaju} />
                    <FieldRow label="JK" val={s.dataBaru?.jenisKelamin} oldVal={s.dataLama?.jenisKelamin} />
                    <FieldRow label="Alamat" val={s.dataBaru?.alamat} oldVal={s.dataLama?.alamat} />
                    {isLevel2 && <FieldRow label="No.Sert Lev.1" val={s.dataBaru?.nomerSertifikatLevel1} oldVal={s.dataLama?.nomerSertifikatLevel1} />}
                </div>
            </div>
        </div>
    );
}

function FieldRow({ label, val, oldVal }) {
    const isChanged = oldVal !== undefined && val !== oldVal;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', width: '60px', flexShrink: 0 }}>{label}</span>
            <span style={{
                color: isChanged ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                fontWeight: isChanged ? 700 : 500,
                wordBreak: 'break-word',
                flex: 1
            }}>
                {val || '-'}
            </span>
        </div>
    );
}
