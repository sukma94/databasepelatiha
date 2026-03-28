import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getSertifikatData, saveSertifikatBatch, deleteSertifikat, deleteAllSertifikat, getLevels, updatePeserta, updateSertifikat, getCertViews } from '../utils/storage';
import { useData } from '../context/DataContext';
import { Upload, FileSpreadsheet, Trash2, AlertTriangle, Check, X, Download, RefreshCw, Search, ExternalLink, Award, ChevronDown, Pencil, Save, Link, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect from '../components/CustomSelect';

export default function ImportSertifikat() {
    const { peserta: allPeserta, updatePesertaLocal } = useData();
    const [data, setData] = useState([]);
    const [levels, setLevels] = useState({});
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [importing, setImporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState('');
    const [filterLevel, setFilterLevel] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({ nama: '', cabor: '', provinsi: '', linkLankor: '', linkICCA: '', linkSportunys: '' });
    const [saving, setSaving] = useState(false);
    const [certViews, setCertViews] = useState([]);
    const fileInputRef = useRef(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [result, lvls, views] = await Promise.all([getSertifikatData(), getLevels(), getCertViews()]);
        setData(result);
        setLevels(lvls);
        setCertViews(views);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const levelNames = Object.keys(levels);

    // Unique levels from existing data (for filter)
    const dataLevels = [...new Set(data.map(p => p.level).filter(Boolean))];

    // Header mapping
    const HEADER_MAP = {
        'no': null,
        'no.': null,
        'nama lengkap pesert': 'nama',
        'nama lengkap peserta': 'nama',
        'nama': 'nama',
        'nama lengkap': 'nama',
        'cabang olahraga': 'cabor',
        'cabor': 'cabor',
        'provinsi': 'provinsi',
        'no wa': 'noWa',
        'no. wa': 'noWa',
        'no whatsapp': 'noWa',
        'no. whatsapp': 'noWa',
        'nowa': 'noWa',
        'whatsapp': 'noWa',
        'wa': 'noWa',
        'no hp': 'noWa',
        'no. hp': 'noWa',
        'link sertifikat lankor': 'linkLankor',
        'sertifikat lankor': 'linkLankor',
        'lankor': 'linkLankor',
        'link sertifikat icca': 'linkICCA',
        'sertifikat icca': 'linkICCA',
        'icca': 'linkICCA',
        'link sertifikat sportunys': 'linkSportunys',
        'sertifikat sportunys': 'linkSportunys',
        'sportunys': 'linkSportunys',
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!selectedLevel) {
            showToast('Pilih jenis pelatihan terlebih dahulu!', 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (jsonData.length === 0) {
                    showToast('File Excel kosong atau format tidak sesuai.', 'error');
                    return;
                }

                const headers = Object.keys(jsonData[0]);
                const mapping = {};
                headers.forEach(h => {
                    const key = h.trim().toLowerCase();
                    if (HEADER_MAP[key] !== undefined) {
                        mapping[h] = HEADER_MAP[key];
                    }
                });

                const parsed = jsonData
                    .map(row => {
                        const item = { level: selectedLevel };
                        Object.entries(mapping).forEach(([excelHeader, field]) => {
                            if (field) {
                                item[field] = String(row[excelHeader] || '').trim();
                            }
                        });
                        return item;
                    })
                    .filter(item => item.nama);

                if (parsed.length === 0) {
                    showToast('Tidak ada data valid ditemukan. Pastikan header sesuai format.', 'error');
                    return;
                }

                setPreview(parsed);
                showToast(`${parsed.length} data berhasil dibaca dari Excel.`, 'success');
            } catch (err) {
                console.error('Excel parse error:', err);
                showToast('Gagal membaca file Excel. Pastikan format file benar.', 'error');
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImport = async () => {
        if (!preview || preview.length === 0) return;
        setImporting(true);

        // -- Integrasi WA ke Daftar Peserta --
        try {
            for (const item of preview) {
                if (!item.noWa) continue;
                // Match by name (case-insensitive) and level
                const matchedPeserta = allPeserta.filter(p => 
                    p.nama && item.nama &&
                    p.nama.toLowerCase().trim() === item.nama.toLowerCase().trim() && 
                    p.level === item.level
                );
                
                for (const p of matchedPeserta) {
                    if (p.wa !== item.noWa) {
                        await updatePeserta(p.id, { wa: item.noWa });
                        updatePesertaLocal(p.id, { wa: item.noWa });
                    }
                }
            }
        } catch (err) {
            console.error("Error integrating WA to peserta:", err);
        }
        // -----------------------------------

        const result = await saveSertifikatBatch(preview);
        setImporting(false);
        if (result) {
            showToast(`${result.length} data sertifikat (${selectedLevel}) berhasil diimport. WA berhasil diintegrasikan ke Daftar Peserta!`, 'success');
            setPreview(null);
            loadData();
        } else {
            showToast('Gagal mengimport data. Periksa koneksi Anda.', 'error');
        }
    };

    const handleDeleteAll = async () => {
        setDeleting(true);
        const ok = await deleteAllSertifikat();
        setDeleting(false);
        setShowDeleteConfirm(false);
        if (ok) {
            showToast('Semua data sertifikat berhasil dihapus.', 'success');
            setData([]);
        } else {
            showToast('Gagal menghapus data.', 'error');
        }
    };

    const handleDeleteOne = async (id) => {
        const ok = await deleteSertifikat(id);
        if (ok) {
            setData(prev => prev.filter(d => d.id !== id));
            showToast('Data berhasil dihapus.', 'success');
        } else {
            showToast('Gagal menghapus data.', 'error');
        }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setEditForm({
            nama: item.nama || '',
            cabor: item.cabor || '',
            provinsi: item.provinsi || '',
            linkLankor: item.linkLankor || '',
            linkICCA: item.linkICCA || '',
            linkSportunys: item.linkSportunys || '',
        });
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editItem) return;
        setSaving(true);
        const ok = await updateSertifikat(editItem.id, editForm);
        setSaving(false);
        if (ok) {
            setData(prev => prev.map(d => d.id === editItem.id ? { ...d, ...editForm } : d));
            setEditItem(null);
            showToast('Data sertifikat berhasil diperbarui.', 'success');
        } else {
            showToast('Gagal memperbarui data. Coba lagi.', 'error');
        }
    };

    const filteredData = data.filter(p => {
        const matchLevel = !filterLevel || p.level === filterLevel;
        const matchSearch = !search || (p.nama || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.cabor || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.provinsi || '').toLowerCase().includes(search.toLowerCase());
        return matchLevel && matchSearch;
    });

    // Build a lookup map: sertifikatId -> array of view records
    const viewMap = useMemo(() => {
        const map = {};
        certViews.forEach(v => {
            if (!map[v.sertifikatId]) map[v.sertifikatId] = [];
            map[v.sertifikatId].push(v);
        });
        return map;
    }, [certViews]);

    // Count viewed for current filter
    const viewedCount = useMemo(() => {
        return filteredData.filter(p => viewMap[p.id] && viewMap[p.id].length > 0).length;
    }, [filteredData, viewMap]);

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0,
                    }}>
                        <Award style={{ width: '24px', height: '24px' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Import Sertifikat
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Import data sertifikat peserta dari file Excel per jenis pelatihan
                        </p>
                    </div>
                </div>
            </div>

            {/* Upload Section */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '24px', marginBottom: '20px',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Upload File Excel
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
                    Format header: <b>No.</b> | <b>Nama Lengkap</b> | <b>Cabang Olahraga</b> | <b>Provinsi</b> | <b>No WA</b> | <b>Sertifikat Lankor</b> | <b>ICCA</b>
                    <br />Kolom <b>Sportunys</b> akan dibaca jika ada. Kolom <b>No WA</b> digunakan sebagai password (3 digit terakhir) untuk membuka sertifikat.
                </p>

                {/* Level Selector */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Pilih Jenis Pelatihan <span style={{ color: 'var(--accent-rose)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative', maxWidth: '320px' }}>
                        <CustomSelect
                            value={selectedLevel}
                            onChange={(val) => setSelectedLevel(val)}
                            options={[
                                { value: "", label: "-- Pilih Pelatihan --" },
                                ...levelNames.map(name => ({ value: name, label: name }))
                            ]}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', borderRadius: '12px',
                        background: selectedLevel ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'var(--bg-input)',
                        color: selectedLevel ? '#fff' : 'var(--text-muted)',
                        fontSize: '14px', fontWeight: 700,
                        cursor: selectedLevel ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        boxShadow: selectedLevel ? '0 4px 14px rgba(59, 130, 246, 0.25)' : 'none',
                        border: selectedLevel ? 'none' : '1px solid var(--border-color)',
                        opacity: selectedLevel ? 1 : 0.6,
                    }}>
                        <Upload style={{ width: '18px', height: '18px' }} />
                        Pilih File Excel
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={!selectedLevel}
                            style={{ display: 'none' }}
                        />
                    </label>

                    {data.length > 0 && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '12px 20px', borderRadius: '12px',
                                background: 'var(--accent-rose-light)', border: '1px solid var(--accent-rose-border)',
                                color: 'var(--accent-rose)', fontSize: '14px', fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                        >
                            <Trash2 style={{ width: '18px', height: '18px' }} />
                            {deleting ? 'Menghapus...' : 'Hapus Semua Data'}
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Section */}
            {preview && (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--accent-blue-border)',
                    borderRadius: '16px', padding: '24px', marginBottom: '20px',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.08)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                Preview Data — {selectedLevel} ({preview.length} peserta)
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Periksa data di bawah sebelum import ke database
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setPreview(null)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 16px', borderRadius: '10px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                <X style={{ width: '14px', height: '14px' }} />
                                Batal
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 16px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700,
                                    cursor: importing ? 'wait' : 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                                    opacity: importing ? 0.7 : 1,
                                }}
                            >
                                {importing ? (
                                    <><RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> Mengimport...</>
                                ) : (
                                    <><Download style={{ width: '14px', height: '14px' }} /> Import ke Database</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                    {['No', 'Nama', 'Cabor', 'Provinsi', 'No WA', 'Lankor', 'ICCA', 'Sportunys'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.slice(0, 20).map((p, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700 }}>{p.nama || '-'}</td>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.cabor || '-'}</td>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.provinsi || '-'}</td>
                                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.noWa ? `***${(p.noWa).slice(-3)}` : '-'}</td>
                                        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                                            {p.linkLankor ? <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Ada</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                                            {p.linkICCA ? <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Ada</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                                            {p.linkSportunys ? <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Ada</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {preview.length > 20 && (
                            <p style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
                                ... dan {preview.length - 20} data lainnya
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Existing Data */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '24px',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Data Sertifikat ({filteredData.length})
                        </h3>
                        {filteredData.length > 0 && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', borderRadius: '10px',
                                background: viewedCount === filteredData.length
                                    ? 'var(--accent-emerald-light)'
                                    : 'var(--accent-amber-light)',
                                border: `1px solid ${viewedCount === filteredData.length
                                    ? 'var(--accent-emerald-border)'
                                    : 'var(--accent-amber-border)'}`,
                                fontSize: '12px', fontWeight: 700,
                                color: viewedCount === filteredData.length
                                    ? 'var(--accent-emerald)'
                                    : 'var(--accent-amber)',
                            }}>
                                <Eye style={{ width: '13px', height: '13px' }} />
                                {viewedCount}/{filteredData.length} sudah dilihat
                            </div>
                        )}
                    </div>
                    {data.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', flex: '0 1 auto', flexWrap: 'wrap' }}>
                            {/* Level Filter */}
                            <div style={{ position: 'relative' }}>
                                <CustomSelect
                                    value={filterLevel}
                                    onChange={(val) => setFilterLevel(val)}
                                    options={[
                                        { value: "", label: "Semua Pelatihan" },
                                        ...dataLevels.map(name => ({ value: name, label: name }))
                                    ]}
                                />
                            </div>
                            {/* Search */}
                            <div style={{ position: 'relative', flex: '0 1 220px' }}>
                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Cari..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px 10px 36px',
                                        background: 'var(--bg-input)', border: '1.5px solid var(--border-color)',
                                        borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                                        color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <div className="login-spinner" />
                    </div>
                ) : data.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 16px',
                        }}>
                            <FileSpreadsheet style={{ width: '24px', height: '24px', color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Belum ada data sertifikat
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Pilih jenis pelatihan lalu upload file Excel.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}>
                                    {['No', 'Nama Peserta', 'Cabor', 'Provinsi', 'No WA', 'Pelatihan', 'Lankor', 'ICCA', 'Sportunys', 'Dilihat', ''].map((h, i) => (
                                        <th key={i} style={{
                                            padding: '12px 14px', fontSize: '11px', fontWeight: 700,
                                            color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px',
                                            textAlign: (i === 0 || h === 'Dilihat') ? 'center' : 'left', whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((p, i) => (
                                    <tr key={p.id} style={{
                                        borderTop: '1px solid var(--border-light)',
                                        background: i % 2 === 1 ? 'var(--bg-input)' : 'transparent',
                                    }}>
                                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{(p.nama || '').toUpperCase()}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{(p.cabor || '').toUpperCase()}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{(p.provinsi || '').toUpperCase()}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{p.noWa ? `***${String(p.noWa).slice(-3)}` : '-'}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '8px',
                                                background: 'var(--accent-blue-light)', color: 'var(--accent-blue)',
                                                fontSize: '11px', fontWeight: 700,
                                            }}>{p.level}</span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {p.linkLankor ? (
                                                <a href={p.linkLankor} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#dc2626', textDecoration: 'none' }}>
                                                    <ExternalLink style={{ width: '12px', height: '12px' }} /> Buka
                                                </a>
                                            ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {p.linkICCA ? (
                                                <a href={p.linkICCA} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
                                                    <ExternalLink style={{ width: '12px', height: '12px' }} /> Buka
                                                </a>
                                            ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {p.linkSportunys ? (
                                                <a href={p.linkSportunys} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#059669', textDecoration: 'none' }}>
                                                    <ExternalLink style={{ width: '12px', height: '12px' }} /> Buka
                                                </a>
                                            ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                            {(() => {
                                                const views = viewMap[p.id];
                                                if (views && views.length > 0) {
                                                    const lastView = views[0]; // sorted desc
                                                    const date = new Date(lastView.viewedAt);
                                                    const timeStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                                    return (
                                                        <span
                                                            title={`Terakhir dilihat: ${timeStr} (${lastView.certType}) — Total: ${views.length}x`}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                padding: '4px 10px', borderRadius: '8px',
                                                                background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)',
                                                                fontSize: '11px', fontWeight: 700, cursor: 'help',
                                                            }}
                                                        >
                                                            <Eye style={{ width: '12px', height: '12px' }} />
                                                            {views.length}x
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span
                                                        title="Belum pernah dilihat"
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 10px', borderRadius: '8px',
                                                            background: 'var(--accent-rose-light)', color: 'var(--accent-rose)',
                                                            fontSize: '11px', fontWeight: 700, cursor: 'help',
                                                        }}
                                                    >
                                                        <EyeOff style={{ width: '12px', height: '12px' }} />
                                                        Belum
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    title="Edit Data Sertifikat"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: 'transparent', border: '1px solid transparent',
                                                        color: 'var(--text-muted)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue-light)'; e.currentTarget.style.borderColor = 'var(--accent-blue-border)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                >
                                                    <Pencil style={{ width: '14px', height: '14px' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOne(p.id)}
                                                    title="Hapus"
                                                    style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: 'transparent', border: '1px solid transparent',
                                                        color: 'var(--text-muted)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-rose-light)'; e.currentTarget.style.borderColor = 'var(--accent-rose-border)'; e.currentTarget.style.color = 'var(--accent-rose)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                >
                                                    <Trash2 style={{ width: '14px', height: '14px' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 999,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)', borderRadius: '20px',
                            padding: '32px', maxWidth: '400px', width: '100%',
                            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            background: 'var(--accent-rose-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <AlertTriangle style={{ width: '28px', height: '28px', color: 'var(--accent-rose)' }} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                            Hapus Semua Data?
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
                            Tindakan ini akan menghapus <b>{data.length} data</b> sertifikat dari semua pelatihan secara permanen.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                disabled={deleting}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700,
                                    cursor: deleting ? 'wait' : 'pointer', transition: 'all 0.2s',
                                    opacity: deleting ? 0.7 : 1,
                                }}
                            >
                                {deleting ? 'Menghapus...' : 'Ya, Hapus Semua'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Link Modal */}
            {editItem && (
                <div
                    onClick={() => setEditItem(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 999,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)', borderRadius: '20px',
                            padding: '32px', maxWidth: '520px', width: '100%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Pencil style={{ width: '20px', height: '20px', color: '#fff' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                    Edit Data Sertifikat
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    {editItem.level}
                                </p>
                            </div>
                        </div>

                        {/* Data Peserta Section */}
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Data Peserta</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { field: 'nama', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
                                    { field: 'cabor', label: 'Cabang Olahraga', placeholder: 'Masukkan cabang olahraga' },
                                    { field: 'provinsi', label: 'Provinsi', placeholder: 'Masukkan provinsi' },
                                ].map(({ field, label, placeholder }) => (
                                    <div key={field}>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
                                            marginBottom: '6px',
                                        }}>
                                            {label}
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm[field]}
                                            onChange={(e) => handleEditChange(field, e.target.value)}
                                            placeholder={placeholder}
                                            style={{
                                                width: '100%', padding: '11px 14px',
                                                background: 'var(--bg-input)', border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                                                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                                transition: 'border-color 0.2s',
                                                boxSizing: 'border-box',
                                            }}
                                            onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '20px' }} />

                        {/* Link Sertifikat Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Link Sertifikat</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {[
                                    { field: 'linkLankor', label: 'Link Sertifikat Lankor', color: '#dc2626' },
                                    { field: 'linkICCA', label: 'Link Sertifikat ICCA', color: '#2563eb' },
                                    { field: 'linkSportunys', label: 'Link Sertifikat Sportunys', color: '#059669' },
                                ].map(({ field, label, color }) => (
                                    <div key={field}>
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '12px', fontWeight: 700, color: color,
                                            marginBottom: '6px',
                                        }}>
                                            <Link style={{ width: '13px', height: '13px' }} />
                                            {label}
                                        </label>
                                        <input
                                            type="url"
                                            value={editForm[field]}
                                            onChange={(e) => handleEditChange(field, e.target.value)}
                                            placeholder="https://..."
                                            style={{
                                                width: '100%', padding: '11px 14px',
                                                background: 'var(--bg-input)', border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                                                color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                                transition: 'border-color 0.2s',
                                                boxSizing: 'border-box',
                                            }}
                                            onFocus={(e) => e.currentTarget.style.borderColor = color}
                                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        />
                                        {editForm[field] && (
                                            <a
                                                href={editForm[field]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '11px', fontWeight: 600, color: color,
                                                    marginTop: '4px', textDecoration: 'none', opacity: 0.8,
                                                }}
                                            >
                                                <ExternalLink style={{ width: '10px', height: '10px' }} /> Preview link
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setEditItem(null)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                    border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700,
                                    cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)',
                                    opacity: saving ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                }}
                            >
                                {saving ? (
                                    <><RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> Menyimpan...</>
                                ) : (
                                    <><Save style={{ width: '14px', height: '14px' }} /> Simpan Perubahan</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 20px', borderRadius: '14px',
                    background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: '#fff', fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                    animation: 'ppCardSlide 0.3s ease-out',
                }}>
                    {toast.type === 'success' ? <Check style={{ width: '18px', height: '18px' }} /> : <AlertTriangle style={{ width: '18px', height: '18px' }} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}
