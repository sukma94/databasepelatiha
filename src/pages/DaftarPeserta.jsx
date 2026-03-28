import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { updatePeserta, deletePeserta } from '../utils/storage';
import { useData } from '../context/DataContext';
import { exportToExcel } from '../utils/exportExcel';
import { useTheme } from '../context/ThemeContext';
import { formatString, formatWhatsApp } from '../utils/formatters';
import { findSimilarNames } from '../utils/similarity';
import { Search, Trash2, Edit3, Check, X, FileSpreadsheet, Users, Eye, ClipboardList, MessageCircle, CaseUpper, CaseSensitive, CaseLower, AlertTriangle, ChevronDown, ChevronUp, ArrowUpDown, Layout, Printer, Archive } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import { printDaftarPeserta } from '../utils/printPdf';
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

export default function DaftarPeserta() {
    const { peserta, levels, updatePesertaLocal, deletePesertaLocal } = useData();
    const [search, setSearch] = useState('');
    const [filterLevel, setFilterLevel] = useState('Semua');
    const [filterStatus, setFilterStatus] = useState('Semua');
    const [filterKepesertaan, setFilterKepesertaan] = useState('Semua');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [toast, setToast] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [sortBy, setSortBy] = useState('terbaru');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [visibleColumns, setVisibleColumns] = useState({
        no: true,
        nama: true,
        jenisKelamin: true,
        provinsi: true,
        alamat: true,
        wa: true,
        info: true,
        sizeBaju: true,
        lahir: true,
        sertifikatLv1: false,
        level: false,
        status: true,
        kepesertaan: true,
        aksi: true,
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const { textFormat, setTextFormat } = useTheme();

    const levelOptions = useMemo(() => {
        const activeLevels = [];
        const archivedLevels = [];
        Object.entries(levels).forEach(([name, data]) => {
            if (isLevelArchived(data)) {
                archivedLevels.push(name);
            } else {
                activeLevels.push(name);
            }
        });

        const list = showArchived
            ? ['Semua', ...archivedLevels]
            : ['Semua', ...activeLevels];
        return list.map(l => ({ value: l, label: l === 'Semua' ? 'Semua Pelatihan' : l }));

    }, [levels, showArchived]);

    // Reset filterLevel if it's not valid for the current view
    useEffect(() => {
        if (filterLevel !== 'Semua' && !levelOptions.some(opt => opt.value === filterLevel)) {
            setFilterLevel('Semua');
        }
    }, [levelOptions, filterLevel]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fmt = (n) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    const getKepesertaanStatus = (p) => {
        if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') return 'Terdaftar';
        return p.statusKepesertaan || 'Konfirmasi';
    };

    const filtered = useMemo(() => {
        let result = peserta.filter((p) => {
            const dataLevel = levels[p.level];
            const pArchived = isLevelArchived(dataLevel);

            if (showArchived && !pArchived) return false;
            if (!showArchived && pArchived) return false;

            const matchSearch = !search || p.nama?.toLowerCase().includes(search.toLowerCase()) || p.wa?.includes(search);
            const matchLevel = filterLevel === 'Semua' || p.level === filterLevel;
            const matchStatus = filterStatus === 'Semua' || p.statusBayar === filterStatus;
            const kepesertaanStatus = getKepesertaanStatus(p);
            const matchKepesertaan = filterKepesertaan === 'Semua' || kepesertaanStatus === filterKepesertaan;
            return matchSearch && matchLevel && matchStatus && matchKepesertaan;
        });

        result.sort((a, b) => {
            const statusOrder = {
                'Terdaftar': 1,
                'Konfirmasi': 2,
                'Batal': 3
            };

            const statusA = getKepesertaanStatus(a);
            const statusB = getKepesertaanStatus(b);

            if (statusOrder[statusA] !== statusOrder[statusB]) {
                return statusOrder[statusA] - statusOrder[statusB];
            }

            switch (sortBy) {
                case 'nama-az': return (a.nama || '').localeCompare(b.nama || '');
                case 'nama-za': return (b.nama || '').localeCompare(a.nama || '');
                case 'terlama': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'terbaru':
                default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
        });

        return result;
    }, [peserta, search, filterLevel, filterStatus, filterKepesertaan, sortBy]);

    const similarGroups = useMemo(() => findSimilarNames(peserta, 0.8), [peserta]);

    const startEdit = (p) => {
        setEditingId(p.id);
        setEditData({ ...p });
    };


    const handleToggleKepesertaan = async (p) => {
        if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') {
            showToast('Peserta yang sudah bayar otomatis Terdaftar.', 'error');
            return;
        }

        const current = p.statusKepesertaan || 'Konfirmasi';
        let next = 'Konfirmasi';
        if (current === 'Konfirmasi') next = 'Batal';
        else if (current === 'Batal') next = 'Terdaftar';
        else next = 'Konfirmasi';

        await updatePeserta(p.id, { statusKepesertaan: next });
        updatePesertaLocal(p.id, { statusKepesertaan: next });
        showToast(`Status kepesertaan diubah menjadi ${next}.`);
    };

    const formatName = (type) => {
        let name = editData.nama || '';
        if (type === 'upper') name = name.toUpperCase();
        else if (type === 'capitalize') {
            name = name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        } else if (type === 'sentence') {
            name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        }
        setEditData({ ...editData, nama: name });
    };

    const saveEdit = async () => {
        const updates = {
            nama: editData.nama || '',
            wa: editData.wa || '',
            cabor: editData.cabor || '',
            ukuranBaju: editData.ukuranBaju || '',
            ttl: editData.ttl || '',
            provinsi: editData.provinsi || '',
            alamat: editData.alamat || '',
            jenisKelamin: editData.jenisKelamin || '',
        };
        if (editData.level?.includes('2')) {
            updates.nomerSertifikatLevel1 = editData.nomerSertifikatLevel1 || '';
        }
        await updatePeserta(editingId, updates);
        updatePesertaLocal(editingId, updates);
        setEditingId(null);
        showToast('Data peserta berhasil diupdate!');
    };

    const confirmDelete = async (id) => {
        await deletePeserta(id);
        deletePesertaLocal(id);
        setDeleteConfirm(null);
        showToast('Peserta dihapus.');
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filtered.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleExport = () => {
        const sourceData = selectedIds.size > 0
            ? peserta.filter(p => selectedIds.has(p.id))
            : filtered;

        const d = sourceData.map((p) => {
            const activeLevelData = levels[p.level] || {};
            let biaya = activeLevelData.biayaNormal || activeLevelData.biaya || 0;
            if (p.jenisBiaya === 'Early Bird' && activeLevelData.biayaEarly) biaya = activeLevelData.biayaEarly;
            else if (p.jenisBiaya === 'Khusus' && activeLevelData.biayaKhusus) biaya = activeLevelData.biayaKhusus;
            return {
                ...p,
                nama: formatString(p.nama, textFormat),
                provinsi: formatString(p.provinsi, textFormat),
                alamat: formatString(p.alamat, textFormat),
                cabor: formatString(p.cabor, textFormat),
                ttl: formatString(p.ttl, textFormat),
                biaya,
                tanggalPelatihan: activeLevelData.tanggal || '-',
                kepesertaan: getKepesertaanStatus(p),
                nomerSertifikatLevel1: p.nomerSertifikatLevel1 || '',
            };
        });
        if (d.length === 0) { showToast('Tidak ada data untuk diexport!', 'error'); return; }
        exportToExcel(d, 'data_peserta');
        showToast(`${d.length} data berhasil diexport!`);
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Daftar Peserta
                        {showArchived && <span className="badge badge-archived" style={{ fontSize: '14px', letterSpacing: '0.05em' }}>📦 Mode Arsip Aktif</span>}
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        {filtered.length} dari {peserta.filter(p => showArchived === isLevelArchived(levels[p.level])).length} peserta ditampilkan
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="custom-control custom-control-bulat" style={{ padding: '10px 14px', background: showArchived ? 'var(--bg-card-hover)' : 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: showArchived ? 'var(--shadow-sm)' : 'none' }}>
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                        />
                        <span className="control-bubble"></span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: showArchived ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Archive style={{ width: '14px', height: '14px' }} /> Lihat Arsip</span>
                    </label>

                    {/* Format Nama */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '10px' }}>Format:</span>
                        {[
                            { id: 'none', label: 'None', icon: CaseSensitive },
                            { id: 'upper', label: 'UPPER', icon: CaseUpper },
                            { id: 'capitalize', label: 'Capitalize', icon: CaseSensitive }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setTextFormat(f.id)}
                                style={{
                                    background: textFormat === f.id ? 'var(--bg-card)' : 'transparent',
                                    color: textFormat === f.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                                    padding: '6px 10px', borderRadius: '7px', cursor: 'pointer',
                                    fontSize: '11px', fontWeight: 600, display: 'flex',
                                    alignItems: 'center', gap: '4px', transition: 'all 0.2s ease',
                                    boxShadow: textFormat === f.id ? 'var(--shadow-sm)' : 'none',
                                    border: textFormat === f.id ? '1px solid var(--accent-blue-border)' : '1px solid transparent'
                                }}
                            >
                                <f.icon style={{ width: '13px', height: '13px' }} />
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className="btn btn-ghost"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                        >
                            <Layout style={{ width: '16px', height: '16px' }} />
                            Opsi Kolom
                        </button>
                        {showColumnPicker && (
                            <div className="card" style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 100,
                                padding: '12px', minWidth: '180px', boxShadow: 'var(--shadow-lg)'
                            }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Tampilkan Kolom</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { key: 'no', label: 'No' },
                                        { key: 'nama', label: 'Nama Lengkap' },
                                        { key: 'jenisKelamin', label: 'Jenis Kelamin' },
                                        { key: 'provinsi', label: 'Provinsi' },
                                        { key: 'alamat', label: 'Alamat' },
                                        { key: 'wa', label: 'Nomor WA' },
                                        { key: 'info', label: 'Cabang Olahraga' },
                                        { key: 'sizeBaju', label: 'Size Baju' },
                                        { key: 'lahir', label: 'Tempat, Tanggal Lahir' },
                                        { key: 'sertifikatLv1', label: 'No Sertifikat Lv. 1' },
                                        { key: 'level', label: 'Jenis Pelatihan' },
                                        { key: 'status', label: 'Status Pembayaran' },
                                        { key: 'kepesertaan', label: 'Kepesertaan' }
                                    ].map(col => (
                                        <label key={col.key} className="custom-control custom-control-bulat">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[col.key]}
                                                onChange={() => toggleColumn(col.key)}
                                            />
                                            <span className="control-bubble"></span>
                                            <span style={{ fontSize: '13px' }}>{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => {
                        const sourceData = selectedIds.size > 0
                            ? filtered.filter(p => selectedIds.has(p.id))
                            : filtered;
                        const d = sourceData.map(p => ({
                            ...p,
                            nama: formatString(p.nama, textFormat),
                            cabor: formatString(p.cabor, textFormat),
                            kepesertaan: getKepesertaanStatus(p),
                            nomerSertifikatLevel1: p.nomerSertifikatLevel1 || '',
                        }));
                        if (d.length === 0) { showToast('Tidak ada data!', 'error'); return; }
                        printDaftarPeserta(d, { title: 'Daftar Peserta', visibleColumns });
                    }} className="btn btn-ghost" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <Printer style={{ width: '16px', height: '16px' }} />
                        Print PDF
                    </button>
                    <button onClick={handleExport} className="btn btn-success">
                        <FileSpreadsheet style={{ width: '16px', height: '16px' }} />
                        {selectedIds.size > 0 ? `Export Terpilih (${selectedIds.size})` : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="input"
                            placeholder="Cari nama atau nomor WA..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                    <CustomSelect
                        value={filterLevel}
                        onChange={setFilterLevel}
                        options={levelOptions}
                        style={{ flex: 1, minWidth: '150px' }}
                    />
                    <CustomSelect
                        value={filterStatus}
                        onChange={setFilterStatus}
                        style={{ flex: 1, minWidth: '150px' }}
                        options={[
                            { value: 'Semua', label: 'Semua Pembayaran' },
                            { value: 'Belum Bayar', label: 'Belum Bayar' },
                            { value: 'DP', label: 'DP' },
                            { value: 'Lunas', label: 'Lunas' },
                        ]}
                    />
                    <CustomSelect
                        value={filterKepesertaan}
                        onChange={setFilterKepesertaan}
                        style={{ flex: 1, minWidth: '150px' }}
                        options={[
                            { value: 'Semua', label: 'Semua Kepesertaan' },
                            { value: 'Terdaftar', label: 'Terdaftar' },
                            { value: 'Konfirmasi', label: 'Konfirmasi' },
                            { value: 'Batal', label: 'Batal' },
                        ]}
                    />
                    <CustomSelect
                        value={sortBy}
                        onChange={setSortBy}
                        style={{ flex: 1, minWidth: '160px' }}
                        options={[
                            { value: 'terbaru', label: 'Terbaru' },
                            { value: 'terlama', label: 'Terlama' },
                            { value: 'nama-az', label: 'Nama A-Z' },
                            { value: 'nama-za', label: 'Nama Z-A' },
                        ]}
                    />
                </div>
            </div>

            {/* Similar Names Warning */}
            {similarGroups.length > 0 && (
                <div className="card" style={{ padding: '16px', marginBottom: '20px', border: '2px solid var(--accent-amber-border)', background: 'var(--accent-amber-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowDuplicates(!showDuplicates)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertTriangle style={{ width: '20px', height: '20px', color: 'var(--accent-amber)' }} />
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent-amber)' }}>
                                {similarGroups.length} grup nama mirip terdeteksi!
                            </span>
                        </div>
                        {showDuplicates ? <ChevronUp style={{ width: '18px', color: 'var(--accent-amber)' }} /> : <ChevronDown style={{ width: '18px', color: 'var(--accent-amber)' }} />}
                    </div>
                    {showDuplicates && (
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Tinjau nama-nama berikut. Klik <strong>Hapus</strong> untuk menghapus data duplikat, atau <strong>Keep</strong> untuk mempertahankan.
                            </p>
                            {similarGroups.map((group, gi) => (
                                <div key={gi} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '10px' }}>Grup {gi + 1}</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {group.map(p => (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatString(p.nama, textFormat)}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{p.wa || '-'}</span>
                                                    <span className="badge badge-blue" style={{ fontSize: '10px', flexShrink: 0 }}>{p.level}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                    <button
                                                        onClick={() => setViewData(p)}
                                                        className="btn"
                                                        style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue-border)' }}
                                                    >
                                                        <Eye style={{ width: '12px', height: '12px' }} /> Detail
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(p.id)}
                                                        className="btn"
                                                        style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--accent-rose-light)', color: 'var(--accent-rose)', border: '1px solid var(--accent-rose-border)' }}
                                                    >
                                                        <Trash2 style={{ width: '12px', height: '12px' }} /> Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <Users style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada data peserta</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>Tambahkan peserta baru melalui halaman input</p>
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <label className="custom-control custom-control-checkbox custom-control-bulat">
                                            <input
                                                type="checkbox"
                                                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                                                onChange={handleSelectAll}
                                            />
                                            <span className="control-bubble"></span>
                                        </label>
                                    </th>
                                    {visibleColumns.no && <th>No</th>}
                                    {visibleColumns.nama && <th>Nama Lengkap</th>}
                                    {visibleColumns.jenisKelamin && <th>JK</th>}
                                    {visibleColumns.provinsi && <th>Provinsi</th>}
                                    {visibleColumns.alamat && <th>Alamat</th>}
                                    {visibleColumns.wa && <th>Nomor WA</th>}
                                    {visibleColumns.info && <th>Cabang Olahraga</th>}
                                    {visibleColumns.sizeBaju && <th style={{ textAlign: 'center' }}>Size</th>}
                                    {visibleColumns.lahir && <th>Tempat, Tanggal Lahir</th>}
                                    {visibleColumns.sertifikatLv1 && <th>No Sertifikat Lv. 1</th>}
                                    {visibleColumns.level && <th>Jenis Pelatihan</th>}
                                    {visibleColumns.status && <th>Status Pembayaran</th>}
                                    {visibleColumns.kepesertaan && <th>Kepesertaan</th>}
                                    {visibleColumns.aksi && <th>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p, i) => (
                                    <tr key={p.id} style={{ background: selectedIds.has(p.id) ? 'var(--bg-card-hover)' : 'transparent' }}>
                                        <td>
                                            <label className="custom-control custom-control-checkbox custom-control-bulat">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(p.id)}
                                                    onChange={() => handleSelectOne(p.id)}
                                                />
                                                <span className="control-bubble"></span>
                                            </label>
                                        </td>
                                        {visibleColumns.no && <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>}
                                        {visibleColumns.nama && (
                                            <td style={{ minWidth: '180px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>
                                                    {formatString(p.nama, textFormat)}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.jenisKelamin && (
                                            <td style={{ fontSize: '12px', textAlign: 'center' }}>
                                                <span className={`badge ${p.jenisKelamin === 'Laki-laki' ? 'badge-blue' : p.jenisKelamin === 'Perempuan' ? 'badge-rose' : 'badge-ghost'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                    {p.jenisKelamin === 'Laki-laki' ? 'L' : p.jenisKelamin === 'Perempuan' ? 'P' : '-'}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.provinsi && (
                                            <td style={{ minWidth: '120px', fontSize: '13px' }}>
                                                <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                                                    {formatString(p.provinsi, textFormat) || '-'}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.alamat && (
                                            <td style={{ minWidth: '180px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {formatString(p.alamat, textFormat) || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.wa && (
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{p.wa?.replace(/-/g, '')}</span>
                                                    {p.wa && (
                                                        <a
                                                            href={`https://wa.me/${formatWhatsApp(p.wa)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="icon-btn icon-btn-emerald"
                                                            style={{ width: '24px', height: '24px' }}
                                                            title="Chat WhatsApp"
                                                        >
                                                            <MessageCircle style={{ width: '14px', height: '14px' }} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.info && (
                                            <td>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                    {formatString(p.cabor, textFormat) || '-'}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.sizeBaju && (
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-ghost" style={{ fontSize: '11px', padding: '4px 8px' }}>{p.ukuranBaju || '-'}</span>
                                            </td>
                                        )}
                                        {visibleColumns.lahir && (
                                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '120px' }}>
                                                {formatString(p.ttl, textFormat) || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.sertifikatLv1 && (
                                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {p.level?.includes('2') ? (p.nomerSertifikatLevel1 || '-') : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                            </td>
                                        )}
                                        {visibleColumns.level && (
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                    <span className="badge badge-blue" style={{ fontSize: '11px' }}>{p.level}</span>
                                                    {isLevelArchived(levels[p.level]) && (
                                                        <span className="badge badge-archived" style={{ fontSize: '9px', opacity: 0.8 }}>📦 Arsip</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.status && (
                                            <td>
                                                <span className={`badge ${statusBadge[p.statusBayar] || 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                                    {p.statusBayar}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.kepesertaan && (
                                            <td>
                                                <button
                                                    onClick={() => handleToggleKepesertaan(p)}
                                                    style={{ border: 'none', background: 'transparent', cursor: p.statusBayar === 'Lunas' || p.statusBayar === 'DP' ? 'default' : 'pointer', padding: 0 }}
                                                    title={p.statusBayar === 'Lunas' || p.statusBayar === 'DP' ? 'Peserta yang sudah bayar otomatis Terdaftar' : 'Klik untuk mengubah status'}
                                                >
                                                    <span className={`badge ${kepesertaanBadge[getKepesertaanStatus(p)] || 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                                        {getKepesertaanStatus(p)}
                                                    </span>
                                                </button>
                                            </td>
                                        )}
                                        {visibleColumns.aksi && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => setViewData(p)} className="icon-btn icon-btn-emerald" title="Lihat Detail">
                                                        <Eye style={{ width: '15px', height: '15px' }} />
                                                    </button>
                                                    <button onClick={() => startEdit(p)} className="icon-btn icon-btn-blue" title="Edit Biodata">
                                                        <Edit3 style={{ width: '15px', height: '15px' }} />
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(p.id)} className="icon-btn icon-btn-rose" title="Hapus">
                                                        <Trash2 style={{ width: '15px', height: '15px' }} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Biodata Modal */}
            {editingId && createPortal(
                <div className="modal-overlay" onClick={() => setEditingId(null)}>
                    <div className="modal-content" style={{ maxWidth: '700px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Data Peserta</h3>
                            <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label">Nama Lengkap</label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <button onClick={() => formatName('upper')} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} title="HURUF BESAR SEMUA">
                                        <CaseUpper style={{ width: '14px', height: '14px' }} /> UPPER
                                    </button>
                                    <button onClick={() => formatName('capitalize')} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} title="Huruf Besar Tiap Kata">
                                        <CaseSensitive style={{ width: '14px', height: '14px' }} /> Capitalize
                                    </button>
                                    <button onClick={() => formatName('sentence')} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} title="Huruf besar di depan saja">
                                        <CaseLower style={{ width: '14px', height: '14px' }} /> Sentence
                                    </button>
                                </div>
                                <input className="input" value={editData.nama || ''} onChange={e => setEditData({ ...editData, nama: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">WhatsApp</label>
                                <input className="input" value={editData.wa || ''} onChange={e => setEditData({ ...editData, wa: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Cabang Olahraga</label>
                                <input className="input" value={editData.cabor || ''} onChange={e => setEditData({ ...editData, cabor: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Jenis Kelamin</label>
                                <CustomSelect
                                    value={editData.jenisKelamin || ''}
                                    onChange={val => setEditData({ ...editData, jenisKelamin: val })}
                                    options={[
                                        { value: "", label: "-- Pilih --" },
                                        { value: "Laki-laki", label: "Laki-laki" },
                                        { value: "Perempuan", label: "Perempuan" }
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="label">Ukuran Baju</label>
                                <input className="input" value={editData.ukuranBaju || ''} onChange={e => setEditData({ ...editData, ukuranBaju: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Tempat, Tanggal Lahir</label>
                                <input className="input" value={editData.ttl || ''} onChange={e => setEditData({ ...editData, ttl: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Provinsi</label>
                                <input className="input" value={editData.provinsi || ''} onChange={e => setEditData({ ...editData, provinsi: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label">Alamat Lengkap</label>
                                <textarea className="input" rows="2" value={editData.alamat || ''} onChange={e => setEditData({ ...editData, alamat: e.target.value })} />
                            </div>
                            {editData.level?.includes('2') && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">No Sertifikat Lv. 1</label>
                                    <input className="input" value={editData.nomerSertifikatLevel1 || ''} onChange={e => setEditData({ ...editData, nomerSertifikatLevel1: e.target.value })} placeholder="Masukkan nomor sertifikat level 1" />
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingId(null)} className="btn btn-ghost">Batal</button>
                            <button onClick={saveEdit} className="btn btn-primary">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* View Detail Modal */}
            {viewData && createPortal(
                <div className="modal-overlay" onClick={() => setViewData(null)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                                    <ClipboardList />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Detail Peserta</h3>
                            </div>
                            <button onClick={() => setViewData(null)} className="btn btn-ghost" style={{ padding: '8px' }}>
                                <X style={{ width: '20px', height: '20px' }} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Nama Lengkap</p>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatString(viewData.nama, textFormat)}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Nomor WhatsApp</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{viewData.wa}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Cabang Olahraga</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatString(viewData.cabor, textFormat) || '-'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Jenis Kelamin</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{viewData.jenisKelamin || '-'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Ukuran Baju</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{viewData.ukuranBaju || '-'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Tempat, Tanggal Lahir</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatString(viewData.ttl, textFormat) || '-'}</p>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Alamat & Provinsi</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    {viewData.alamat || '-'} <br />
                                    <span style={{ color: 'var(--accent-blue)', fontSize: '12px' }}>{viewData.provinsi}</span>
                                </p>
                            </div>
                            {viewData.level?.includes('2') && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>No Sertifikat Lv. 1</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{viewData.nomerSertifikatLevel1 || '-'}</p>
                                </div>
                            )}
                            <div style={{ gridColumn: '1 / -1', padding: '16px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>PELATIHAN</p>
                                <span className="badge badge-blue">{viewData.level}</span>
                                {levels[viewData.level]?.tanggal && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>{levels[viewData.level].tanggal}</span>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setViewData(null)} className="btn btn-primary" style={{ padding: '10px 24px' }}>Tutup</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {deleteConfirm && createPortal(
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Konfirmasi Hapus</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Apakah Anda yakin ingin menghapus peserta ini? Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: '8px 18px' }}>Batal</button>
                            <button onClick={() => confirmDelete(deleteConfirm)} className="btn btn-danger" style={{ padding: '8px 18px' }}>Ya, Hapus</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <Check style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}
