import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { updatePeserta, hitungSisa } from '../utils/storage';
import { useData } from '../context/DataContext';
import { exportPembayaranToExcel } from '../utils/exportExcel';
import { Search, Edit3, Check, X, Users, Save, Wallet, CreditCard, FileSpreadsheet, Printer, Archive, Layout, CaseUpper, CaseSensitive, MessageCircle } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import { printDaftarPembayaran } from '../utils/printPdf';
import { isLevelArchived } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { formatString, formatWhatsApp } from '../utils/formatters';

const STATUS_OPTIONS = ['Semua', 'Belum Bayar', 'DP', 'Lunas'];

const statusBadge = {
    'Belum Bayar': 'badge-rose',
    'DP': 'badge-amber',
    'Lunas': 'badge-emerald',
};

export default function DaftarPembayaran() {
    const { peserta, levels, updatePesertaLocal } = useData();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Semua');
    const [filterLevel, setFilterLevel] = useState('Semua');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [bulkEditIds, setBulkEditIds] = useState(new Set());
    const [bulkEditData, setBulkEditData] = useState({});
    const [toast, setToast] = useState(null);
    const [sortBy, setSortBy] = useState('terbaru');
    const [showArchived, setShowArchived] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        no: true,
        nama: true,
        wa: true,
        level: true,
        kategori: true,
        status: true,
        nominal: true,
        sisa: true,
        aksi: true,
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const { textFormat, setTextFormat } = useTheme();

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const levelOptions = useMemo(() => {
        const entries = Object.entries(levels);
        const active = entries.filter(([_, data]) => !isLevelArchived(data)).map(([k]) => k);
        const archived = entries.filter(([_, data]) => isLevelArchived(data)).map(([k]) => k);
        const list = showArchived
            ? ['Semua', ...archived]
            : ['Semua', ...active];
        return list.map(l => ({ value: l, label: l === 'Semua' ? 'Semua Pelatihan' : l }));
    }, [levels, showArchived]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fmt = (n) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    useEffect(() => {
        const opts = levelOptions.map(o => (typeof o === 'string' ? o : o.value));
        if (filterLevel !== 'Semua' && !opts.includes(filterLevel)) setFilterLevel('Semua');
    }, [showArchived]);

    const filtered = useMemo(() => {
        let result = peserta.filter((p) => {
            if (p.statusKepesertaan === 'Batal') return false;
            const archived = isLevelArchived(levels[p.level]);
            if (showArchived && !archived) return false;
            if (!showArchived && archived) return false;

            const matchSearch = !search || p.nama?.toLowerCase().includes(search.toLowerCase()) || p.wa?.includes(search);
            const matchStatus = filterStatus === 'Semua' || p.statusBayar === filterStatus;
            const matchLevel = filterLevel === 'Semua' || p.level === filterLevel;
            return matchSearch && matchStatus && matchLevel;
        });

        result.sort((a, b) => {
            switch (sortBy) {
                case 'nama-az': return (a.nama || '').localeCompare(b.nama || '');
                case 'nama-za': return (b.nama || '').localeCompare(a.nama || '');
                case 'terlama': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'sisa-tinggi': return (b.sisaTagihan || 0) - (a.sisaTagihan || 0);
                case 'sisa-rendah': return (a.sisaTagihan || 0) - (b.sisaTagihan || 0);
                case 'terbaru':
                default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
        });

        return result;
    }, [peserta, search, filterStatus, filterLevel, sortBy]);

    // --- Summary Stats ---
    const summary = useMemo(() => {
        const totalPeserta = filtered.length;
        const lunas = filtered.filter(p => p.statusBayar === 'Lunas').length;
        const dp = filtered.filter(p => p.statusBayar === 'DP').length;
        const belum = filtered.filter(p => p.statusBayar === 'Belum Bayar').length;
        const totalMasuk = filtered.reduce((sum, p) => {
            if (p.statusBayar === 'Lunas') {
                const ld = levels[p.level] || {};
                let biaya = ld.biayaNormal || ld.biaya || 0;
                if (p.jenisBiaya === 'Early Bird' && ld.biayaEarly) biaya = ld.biayaEarly;
                else if (p.jenisBiaya === 'Khusus' && ld.biayaKhusus) biaya = ld.biayaKhusus;
                return sum + biaya;
            }
            if (p.statusBayar === 'DP') return sum + (p.nominalDP || 0);
            return sum;
        }, 0);
        return { totalPeserta, lunas, dp, belum, totalMasuk };
    }, [filtered, levels]);

    // --- Single Edit ---
    const startEdit = (p) => {
        setEditingId(p.id);
        setEditData({
            statusBayar: p.statusBayar,
            nominalDP: p.nominalDP || 0,
            jenisBiaya: p.jenisBiaya || 'Normal',
            level: p.level,
        });
    };

    const saveEdit = async () => {
        const id = editingId;
        const activeLevelData = levels[editData.level] || {};
        const { statusBayar, jenisBiaya, nominalDP } = editData;

        let totalBiaya = activeLevelData.biayaNormal || activeLevelData.biaya || 0;
        if (jenisBiaya === 'Early Bird' && activeLevelData.biayaEarly) {
            totalBiaya = activeLevelData.biayaEarly;
        } else if (jenisBiaya === 'Khusus' && activeLevelData.biayaKhusus) {
            totalBiaya = activeLevelData.biayaKhusus;
        }

        const sisa = statusBayar === 'Lunas' ? 0 : Math.max(0, totalBiaya - Number(nominalDP));

        await updatePeserta(id, {
            statusBayar,
            jenisBiaya,
            nominalDP: statusBayar === 'Lunas' ? totalBiaya : Number(nominalDP),
            sisaTagihan: sisa,
            biaya: totalBiaya,
        });
        const updates = {
            statusBayar,
            jenisBiaya,
            nominalDP: statusBayar === 'Lunas' ? totalBiaya : Number(nominalDP),
            sisaTagihan: sisa,
            biaya: totalBiaya,
        };
        updatePesertaLocal(id, updates);
        setEditingId(null);
        showToast('Pembayaran berhasil diupdate!');
    };

    // --- Bulk Edit ---
    const handleBulkSelect = (id) => {
        const newSet = new Set(bulkEditIds);
        if (newSet.has(id)) {
            newSet.delete(id);
            const newData = { ...bulkEditData };
            delete newData[id];
            setBulkEditData(newData);
        } else {
            newSet.add(id);
            const p = peserta.find(x => x.id === id);
            setBulkEditData({ ...bulkEditData, [id]: { statusBayar: p.statusBayar, nominalDP: p.nominalDP || 0, jenisBiaya: p.jenisBiaya || 'Normal' } });
        }
        setBulkEditIds(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const newSet = new Set(filtered.map(p => p.id));
            setBulkEditIds(newSet);
            const newData = {};
            filtered.forEach(p => newData[p.id] = { statusBayar: p.statusBayar, nominalDP: p.nominalDP || 0, jenisBiaya: p.jenisBiaya || 'Normal' });
            setBulkEditData(newData);
        } else {
            setBulkEditIds(new Set());
            setBulkEditData({});
        }
    };

    const handleBulkEditChange = (id, field, value) => {
        if ((field === 'statusBayar' && value === 'Lunas') || field === 'jenisBiaya') {
            const p = peserta.find(x => x.id === id);
            const ld = levels[p.level] || {};
            const currentData = { ...bulkEditData[id], [field]: value };

            if (currentData.statusBayar === 'Lunas') {
                let fullBiaya = ld.biayaNormal || ld.biaya || 0;
                if (currentData.jenisBiaya === 'Early Bird' && ld.biayaEarly) fullBiaya = ld.biayaEarly;
                else if (currentData.jenisBiaya === 'Khusus' && ld.biayaKhusus) fullBiaya = ld.biayaKhusus;
                setBulkEditData(prev => ({ ...prev, [id]: { ...currentData, nominalDP: fullBiaya } }));
                return;
            }
        }
        setBulkEditData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const handleBulkSave = async () => {
        if (bulkEditIds.size === 0) return;
        const promises = [];
        const localUpdates = []; // collect updates for optimistic local update
        bulkEditIds.forEach(id => {
            const p = peserta.find(x => x.id === id);
            const editVals = bulkEditData[id];
            if (p && editVals) {
                const sisa = hitungSisa(levels, p.level, editVals.nominalDP, editVals.statusBayar, editVals.jenisBiaya);
                const ld = levels[p.level] || {};
                let totalBiaya = ld.biayaNormal || ld.biaya || 0;
                if (editVals.jenisBiaya === 'Early Bird' && ld.biayaEarly) totalBiaya = ld.biayaEarly;
                else if (editVals.jenisBiaya === 'Khusus' && ld.biayaKhusus) totalBiaya = ld.biayaKhusus;

                const updates = {
                    statusBayar: editVals.statusBayar,
                    jenisBiaya: editVals.jenisBiaya,
                    nominalDP: editVals.statusBayar === 'Lunas' ? totalBiaya : Number(editVals.nominalDP),
                    biaya: totalBiaya,
                    sisaTagihan: sisa,
                };
                promises.push(updatePeserta(id, updates));
                localUpdates.push({ id, updates });
            }
        });
        await Promise.all(promises);
        // Optimistic local updates — no refreshPeserta re-fetch
        localUpdates.forEach(({ id, updates }) => updatePesertaLocal(id, updates));
        const count = bulkEditIds.size;
        setBulkEditIds(new Set());
        setBulkEditData({});
        showToast(`${count} pembayaran berhasil diupdate!`);
    };

    const handleExport = () => {
        const d = filtered.map(p => {
            const ld = levels[p.level] || {};
            let biaya = ld.biayaNormal || ld.biaya || 0;
            if (p.jenisBiaya === 'Early Bird' && ld.biayaEarly) biaya = ld.biayaEarly;
            else if (p.jenisBiaya === 'Khusus' && ld.biayaKhusus) biaya = ld.biayaKhusus;
            return { ...p, nama: formatString(p.nama, textFormat), biaya };
        });
        if (d.length === 0) { showToast('Tidak ada data untuk diexport!', 'error'); return; }
        const levelLabel = filterLevel !== 'Semua' ? filterLevel.replace(/\s+/g, '_') : 'semua';
        exportPembayaranToExcel(d, `pembayaran_${levelLabel}`, visibleColumns);
        showToast(`${d.length} data pembayaran berhasil diexport!`);
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Daftar Pembayaran
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {filtered.length} peserta ditampilkan
                        {showArchived && <span className="badge badge-archived" style={{ fontSize: '10px' }}>📦 Mode Arsip</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {bulkEditIds.size > 0 && (
                        <button onClick={handleBulkSave} className="btn btn-primary" style={{ background: 'var(--accent-blue)' }}>
                            <Save style={{ width: '16px', height: '16px' }} />
                            Simpan ({bulkEditIds.size})
                        </button>
                    )}

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
                                        { key: 'nama', label: 'Nama' },
                                        { key: 'wa', label: 'Nomor WA' },
                                        { key: 'level', label: 'Jenis Pelatihan' },
                                        { key: 'kategori', label: 'Kategori Biaya' },
                                        { key: 'status', label: 'Status Pembayaran' },
                                        { key: 'nominal', label: 'Nominal DP' },
                                        { key: 'sisa', label: 'Sisa Tagihan' },
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
                        if (filtered.length === 0) { showToast('Tidak ada data!', 'error'); return; }
                        const titleSuffix = filterLevel !== 'Semua' ? ` — ${filterLevel}` : '';
                        const printData = filtered.map(p => ({ ...p, nama: formatString(p.nama, textFormat) }));
                        printDaftarPembayaran(printData, levels, { title: `Daftar Pembayaran${titleSuffix}`, summary, visibleColumns });
                    }} className="btn btn-ghost" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <Printer style={{ width: '16px', height: '16px' }} />
                        Print PDF
                    </button>
                    <button onClick={handleExport} className="btn btn-success">
                        <FileSpreadsheet style={{ width: '16px', height: '16px' }} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Pemasukan</p>
                    <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{fmt(summary.totalMasuk)}</p>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Lunas</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{summary.lunas}</p>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>DP</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-amber)' }}>{summary.dp}</p>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Belum Bayar</p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-rose)' }}>{summary.belum}</p>
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
                        options={STATUS_OPTIONS.map(o => ({ value: o, label: o === 'Semua' ? 'Semua Status' : o }))}
                    />
                    <CustomSelect
                        value={sortBy}
                        onChange={setSortBy}
                        style={{ flex: 1, minWidth: '180px' }}
                        options={[
                            { value: 'terbaru', label: 'Terbaru' },
                            { value: 'terlama', label: 'Terlama' },
                            { value: 'nama-az', label: 'Nama A-Z' },
                            { value: 'nama-za', label: 'Nama Z-A' },
                            { value: 'sisa-tinggi', label: 'Sisa Tagihan ↓' },
                            { value: 'sisa-rendah', label: 'Sisa Tagihan ↑' },
                        ]}
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <Wallet style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada data pembayaran</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>Tambahkan peserta terlebih dahulu</p>
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
                                                checked={filtered.length > 0 && bulkEditIds.size === filtered.length}
                                                onChange={handleSelectAll}
                                            />
                                            <span className="control-bubble"></span>
                                        </label>
                                    </th>
                                    {visibleColumns.no && <th>No</th>}
                                    {visibleColumns.nama && <th>Nama</th>}
                                    {visibleColumns.wa && <th>WA</th>}
                                    {visibleColumns.level && <th>Level</th>}
                                    {visibleColumns.kategori && <th>Kategori</th>}
                                    {visibleColumns.status && <th>Status Pembayaran</th>}
                                    {visibleColumns.nominal && <th>Nominal</th>}
                                    {visibleColumns.sisa && <th>Sisa</th>}
                                    {visibleColumns.aksi && <th>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p, i) => {
                                    const isBulkEditing = bulkEditIds.has(p.id);
                                    const currentBulkData = bulkEditData[p.id];
                                    const sisa = isBulkEditing
                                        ? hitungSisa(levels, p.level, currentBulkData?.nominalDP, currentBulkData?.statusBayar, currentBulkData?.jenisBiaya)
                                        : hitungSisa(levels, p.level, p.nominalDP, p.statusBayar, p.jenisBiaya);
                                    return (
                                        <tr key={p.id} style={{ background: isBulkEditing ? 'var(--bg-card-hover)' : 'transparent' }}>
                                            <td>
                                                <label className="custom-control custom-control-checkbox custom-control-bulat">
                                                    <input
                                                        type="checkbox"
                                                        checked={isBulkEditing}
                                                        onChange={() => handleBulkSelect(p.id)}
                                                    />
                                                    <span className="control-bubble"></span>
                                                </label>
                                            </td>
                                            {visibleColumns.no && <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>}
                                            {visibleColumns.nama && <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{formatString(p.nama, textFormat)}</td>}
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
                                            {visibleColumns.level && (
                                                <td>
                                                    <span className="badge badge-blue" style={{ fontSize: '11px' }}>{p.level}</span>
                                                    {isLevelArchived(levels[p.level]) && <span className="badge badge-archived" style={{ fontSize: '9px', marginLeft: '4px' }}>Arsip</span>}
                                                </td>
                                            )}
                                            {visibleColumns.kategori && (
                                                <td>
                                                    {isBulkEditing ? (
                                                        <div style={{ minWidth: '130px' }}>
                                                            <CustomSelect
                                                                value={currentBulkData?.jenisBiaya || 'Normal'}
                                                                onChange={(val) => handleBulkEditChange(p.id, 'jenisBiaya', val)}
                                                                options={[
                                                                    { value: "Normal", label: "Normal" },
                                                                    { value: "Early Bird", label: "Early Bird" },
                                                                    { value: "Khusus", label: "Khusus" }
                                                                ]}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className={p.jenisBiaya === 'Early Bird' ? 'badge badge-amber' : (p.jenisBiaya === 'Khusus' ? 'badge badge-emerald' : 'badge badge-ghost')}
                                                            style={{ fontSize: '11px', opacity: 0.9 }}
                                                        >
                                                            {p.jenisBiaya || 'Normal'}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            {visibleColumns.status && (
                                                <td>
                                                    {isBulkEditing ? (
                                                        <div style={{ minWidth: '130px' }}>
                                                            <CustomSelect
                                                                value={currentBulkData?.statusBayar || 'Belum Bayar'}
                                                                onChange={(val) => handleBulkEditChange(p.id, 'statusBayar', val)}
                                                                options={[
                                                                    { value: "Belum Bayar", label: "Belum Bayar" },
                                                                    { value: "DP", label: "DP" },
                                                                    { value: "Lunas", label: "Lunas" }
                                                                ]}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className={`badge ${statusBadge[p.statusBayar]}`}>{p.statusBayar}</span>
                                                    )}
                                                </td>
                                            )}
                                            {visibleColumns.nominal && (
                                                <td>
                                                    {isBulkEditing && currentBulkData?.statusBayar === 'DP' ? (
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            value={currentBulkData?.nominalDP || ''}
                                                            onChange={(e) => handleBulkEditChange(p.id, 'nominalDP', Number(e.target.value))}
                                                            style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
                                                            min="0"
                                                        />
                                                    ) : (
                                                        <span>{p.nominalDP ? fmt(p.nominalDP) : '-'}</span>
                                                    )}
                                                </td>
                                            )}
                                            {visibleColumns.sisa && (
                                                <td>
                                                    <span style={{ fontWeight: 600, color: sisa > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                                                        {fmt(sisa)}
                                                    </span>
                                                </td>
                                            )}
                                            {visibleColumns.aksi && (
                                                <td>
                                                    {!isBulkEditing && (
                                                        <button onClick={() => startEdit(p)} className="icon-btn icon-btn-blue" title="Edit Pembayaran">
                                                            <Edit3 style={{ width: '15px', height: '15px' }} />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Payment Modal */}
            {editingId && createPortal(
                <div className="modal-overlay" onClick={() => setEditingId(null)}>
                    <div className="modal-content" style={{ maxWidth: '500px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                                    <CreditCard />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Pembayaran</h3>
                            </div>
                            <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="label">Kategori Biaya</label>
                                <CustomSelect
                                    value={editData.jenisBiaya}
                                    onChange={v => setEditData({ ...editData, jenisBiaya: v })}
                                    options={[
                                        { value: 'Normal', label: 'Normal' },
                                        { value: 'Early Bird', label: 'Early Bird' },
                                        { value: 'Khusus', label: 'Khusus' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="label">Status Bayar</label>
                                <CustomSelect
                                    value={editData.statusBayar}
                                    onChange={v => setEditData({ ...editData, statusBayar: v })}
                                    options={[
                                        { value: 'Belum Bayar', label: 'Belum Bayar' },
                                        { value: 'DP', label: 'DP' },
                                        { value: 'Lunas', label: 'Lunas' },
                                    ]}
                                />
                            </div>
                            {editData.statusBayar === 'DP' && (
                                <div>
                                    <label className="label">Nominal (Rp)</label>
                                    <input type="number" className="input" value={editData.nominalDP} onChange={e => setEditData({ ...editData, nominalDP: Number(e.target.value) })} min="0" />
                                </div>
                            )}

                            {/* Preview */}
                            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TOTAL BIAYA</p>
                                        <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {(() => {
                                                const ld = levels[editData.level] || {};
                                                let b = ld.biayaNormal || ld.biaya || 0;
                                                if (editData.jenisBiaya === 'Early Bird' && ld.biayaEarly) b = ld.biayaEarly;
                                                else if (editData.jenisBiaya === 'Khusus' && ld.biayaKhusus) b = ld.biayaKhusus;
                                                return fmt(b);
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>SISA TAGIHAN</p>
                                        <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-amber)' }}>
                                            {(() => {
                                                const ld = levels[editData.level] || {};
                                                let b = ld.biayaNormal || ld.biaya || 0;
                                                if (editData.jenisBiaya === 'Early Bird' && ld.biayaEarly) b = ld.biayaEarly;
                                                else if (editData.jenisBiaya === 'Khusus' && ld.biayaKhusus) b = ld.biayaKhusus;
                                                const s = editData.statusBayar === 'Lunas' ? 0 : Math.max(0, b - Number(editData.nominalDP));
                                                return fmt(s);
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingId(null)} className="btn btn-ghost">Batal</button>
                            <button onClick={saveEdit} className="btn btn-primary">Simpan</button>
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
