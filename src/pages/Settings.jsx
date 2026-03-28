import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { saveLevels } from '../utils/storage';
import { useData } from '../context/DataContext';
import { Settings as SettingsIcon, Plus, Trash2, Save, RotateCcw, CheckCircle, Edit3, X, Archive, Calendar, Download, Upload, FileJson, Loader2, AlertCircle, Package, Users, Wallet, Award, MapPin, FileText, ClipboardList, Eye } from 'lucide-react';
import { isLevelArchived } from '../utils/dateUtils';
import { exportLevelData, downloadJson, parseImportFile, importLevelData } from '../utils/backupRestore';
import CustomSelect from '../components/CustomSelect';

// Format a date range into Indonesian string
function formatDateRange(startDate, endDate) {
    if (!startDate) return '-';
    const fmtOpts = { day: 'numeric', month: 'long', year: 'numeric' };
    const startStr = startDate.toLocaleDateString('id-ID', fmtOpts);

    if (!endDate || startDate.getTime() === endDate.getTime()) {
        return startStr;
    }

    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    if (sameMonth) {
        return `${startDate.getDate()} - ${endDate.toLocaleDateString('id-ID', fmtOpts)}`;
    }

    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    if (sameYear) {
        return `${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('id-ID', fmtOpts)}`;
    }

    return `${startStr} - ${endDate.toLocaleDateString('id-ID', fmtOpts)}`;
}

export default function Settings() {
    const { levels: contextLevels, setLevelsLocal, refreshLevels, refreshPeserta } = useData();
    const [levels, setLevels] = useState({});

    // Add form state
    const [newLevelName, setNewLevelName] = useState('');
    const [newBiayaNormal, setNewBiayaNormal] = useState('');
    const [newBiayaEarly, setNewBiayaEarly] = useState('');
    const [newBiayaKhusus, setNewBiayaKhusus] = useState('');
    const [newLevelDateStart, setNewLevelDateStart] = useState(null);
    const [newLevelDateEnd, setNewLevelDateEnd] = useState(null);

    // Edit modal state
    const [editingLevel, setEditingLevel] = useState(null);
    const [editLevelData, setEditLevelData] = useState({});

    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Backup & Restore state
    const [exportLevel, setExportLevel] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);
    const [importFileData, setImportFileData] = useState(null);
    const [importFileName, setImportFileName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(null);
    const [importResults, setImportResults] = useState(null);
    const [importSections, setImportSections] = useState({
        levelConfig: true,
        peserta: true,
        cashflow: true,
        sertifikat: true,
        publicSettings: true,
        alamatPengiriman: true,
        editSuggestions: true,
        formulirResponses: true,
    });
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const importFileRef = useRef(null);

    // Initialize local draft from context
    useEffect(() => {
        if (Object.keys(contextLevels).length > 0 && Object.keys(levels).length === 0) {
            setLevels(contextLevels);
        }
    }, [contextLevels]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddLevel = (e) => {
        e.preventDefault();
        if (!newLevelName.trim() || !newBiayaNormal) {
            showToast('Nama pelatihan dan Biaya Normal wajib diisi!', 'error');
            return;
        }
        if (levels[newLevelName]) {
            showToast('Pelatihan ini sudah ada!', 'error');
            return;
        }

        const formattedDate = formatDateRange(newLevelDateStart, newLevelDateEnd);
        const updatedLevels = {
            ...levels,
            [newLevelName.trim()]: {
                biayaNormal: Number(newBiayaNormal),
                biayaEarly: newBiayaEarly ? Number(newBiayaEarly) : 0,
                biayaKhusus: newBiayaKhusus ? Number(newBiayaKhusus) : 0,
                tanggal: formattedDate,
                sertifikatPassword: ''
            }
        };
        setLevels(updatedLevels);
        setNewLevelName('');
        setNewBiayaNormal('');
        setNewBiayaEarly('');
        setNewBiayaKhusus('');
        setNewLevelDateStart(null);
        setNewLevelDateEnd(null);
        showToast('Pelatihan baru ditambahkan ke draft.');
    };

    const handleDeleteLevel = (name) => {
        const updatedLevels = { ...levels };
        delete updatedLevels[name];
        setLevels(updatedLevels);
        showToast('Pelatihan dihapus dari draft.');
    };

    const handleToggleArchive = (name) => {
        const updatedLevels = { ...levels };
        const currentData = updatedLevels[name];
        updatedLevels[name] = {
            ...currentData,
            archived: !currentData.archived
        };
        setLevels(updatedLevels);
        showToast(currentData.archived ? `${name} diaktifkan kembali (draft).` : `${name} diarsipkan (draft).`);
    };

    const startEditLevel = (name, data) => {
        setEditingLevel(name);
        setEditLevelData({
            name,
            biayaNormal: data.biayaNormal || data.biaya || 0,
            biayaEarly: data.biayaEarly || 0,
            biayaKhusus: data.biayaKhusus || 0,
            tanggal: data.tanggal || '',
            sertifikatPassword: data.sertifikatPassword || '',
            // For the date pickers in edit mode, we just use the text field
            // since parsing Indonesian dates back to Date objects is complex
        });
    };

    const handleSaveEditLevel = () => {
        const { name, biayaNormal, biayaEarly, biayaKhusus, tanggal } = editLevelData;
        const trimmedName = name.trim();
        if (!trimmedName || !biayaNormal) {
            showToast('Nama pelatihan dan Biaya Normal wajib diisi!', 'error');
            return;
        }

        const updatedLevels = { ...levels };
        if (trimmedName !== editingLevel) {
            if (updatedLevels[trimmedName]) {
                showToast('Nama pelatihan sudah ada!', 'error');
                return;
            }
            delete updatedLevels[editingLevel];
        }

        updatedLevels[trimmedName] = {
            biayaNormal: Number(biayaNormal),
            biayaEarly: biayaEarly ? Number(biayaEarly) : 0,
            biayaKhusus: biayaKhusus ? Number(biayaKhusus) : 0,
            tanggal: tanggal || '-',
            sertifikatPassword: editLevelData.sertifikatPassword || ''
        };
        setLevels({ ...updatedLevels });
        setEditingLevel(null);
        showToast('Perubahan pelatihan disimpan ke draft.');
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        let finalLevels = { ...levels };

        // If currently editing, commit it first
        if (editingLevel) {
            const { name, biayaNormal, biayaEarly, biayaKhusus, tanggal } = editLevelData;
            const trimmedName = name.trim();
            if (trimmedName && biayaNormal) {
                if (trimmedName !== editingLevel) {
                    delete finalLevels[editingLevel];
                }
                finalLevels[trimmedName] = {
                    biayaNormal: Number(biayaNormal),
                    biayaEarly: biayaEarly ? Number(biayaEarly) : 0,
                    biayaKhusus: biayaKhusus ? Number(biayaKhusus) : 0,
                    tanggal: tanggal || '-',
                    sertifikatPassword: editLevelData.sertifikatPassword || ''
                };
            }
            setEditingLevel(null);
        }

        if (Object.keys(finalLevels).length === 0) {
            showToast('Minimal harus ada satu pelatihan!', 'error');
            setIsSaving(false);
            return;
        }

        try {
            const success = await saveLevels(finalLevels);
            setIsSaving(false);

            if (success) {
                setLevels(finalLevels);
                setLevelsLocal(finalLevels);
                showToast('Pengaturan pelatihan berhasil disimpan!');
            } else {
                showToast('Gagal menyimpan ke database!', 'error');
            }
        } catch (err) {
            console.error("UI Save Error:", err);
            setIsSaving(false);
            showToast('Terjadi kesalahan sistem!', 'error');
        }
    };

    const handleReset = async () => {
        await refreshLevels();
        setLevels(contextLevels);
        showToast('Draft direset ke pengaturan tersimpan.');
    };

    const handleImportFile = (file) => {
        if (!file.name.endsWith('.json')) {
            showToast('File harus berformat .json!', 'error');
            return;
        }
        setImportResults(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = parseImportFile(e.target.result);
                setImportFileData(parsed);
                setImportFileName(file.name);
            } catch (err) {
                console.error('Parse error:', err);
                showToast(err.message || 'File tidak valid!', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleExecuteImport = async () => {
        setShowImportConfirm(false);
        setIsImporting(true);
        setImportProgress(null);
        setImportResults(null);
        try {
            const selectedSections = Object.entries(importSections)
                .filter(([_, v]) => v)
                .map(([k]) => k);
            const results = await importLevelData(
                importFileData,
                { sections: selectedSections },
                (p) => setImportProgress(p)
            );
            setImportResults(results);
            showToast('Import data berhasil!');
            // Refresh context data
            await refreshLevels();
            await refreshPeserta();
        } catch (err) {
            console.error('Import error:', err);
            showToast('Gagal mengimport data: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            setIsImporting(false);
            setImportProgress(null);
        }
    };

    const fmt = (n) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    const activeLevelEntries = Object.entries(levels).filter(([_, data]) => !isLevelArchived(data));
    const archivedLevelEntries = Object.entries(levels).filter(([_, data]) => isLevelArchived(data));

    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };

    return (
        <div className="animate-fade-in" style={{ width: '100%' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Kategori Pelatihan
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Atur nama, jadwal, dan biaya pelatihan</p>
            </div>

            {/* Add New Level Form */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} />
                    Tambah Pelatihan Baru
                </h2>
                <form onSubmit={handleAddLevel}>
                    {/* Row 1: Name + Dates */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={labelStyle}>Nama Pelatihan</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Contoh: Sports Massage Level 1"
                                value={newLevelName}
                                onChange={(e) => setNewLevelName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Tanggal Mulai</label>
                            <div className="custom-datepicker-wrapper">
                                <DatePicker
                                    selected={newLevelDateStart}
                                    onChange={(date) => {
                                        setNewLevelDateStart(date);
                                        if (!newLevelDateEnd || (newLevelDateEnd && date > newLevelDateEnd)) {
                                            setNewLevelDateEnd(date);
                                        }
                                    }}
                                    dateFormat="dd MMM yyyy"
                                    placeholderText="Pilih tanggal mulai"
                                    className="input"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Tanggal Selesai</label>
                            <div className="custom-datepicker-wrapper">
                                <DatePicker
                                    selected={newLevelDateEnd}
                                    onChange={(date) => setNewLevelDateEnd(date)}
                                    dateFormat="dd MMM yyyy"
                                    placeholderText="Pilih tanggal selesai"
                                    className="input"
                                    minDate={newLevelDateStart}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Prices + Button */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>Biaya Normal (Rp) *</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="Wajib diisi"
                                value={newBiayaNormal}
                                onChange={(e) => setNewBiayaNormal(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Early Bird (Rp)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="Opsional"
                                value={newBiayaEarly}
                                onChange={(e) => setNewBiayaEarly(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Harga Khusus (Rp)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="Opsional"
                                value={newBiayaKhusus}
                                onChange={(e) => setNewBiayaKhusus(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px', whiteSpace: 'nowrap' }}>
                            <Plus style={{ width: '18px', height: '18px' }} />
                            Tambah
                        </button>
                    </div>
                </form>
            </div>

            {/* Active Level List */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle style={{ width: '18px', height: '18px', color: 'var(--accent-emerald)' }} />
                    Pelatihan Aktif
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>({activeLevelEntries.length})</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeLevelEntries.length === 0 && (
                        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                            Tidak ada pelatihan aktif.
                        </p>
                    )}
                    {activeLevelEntries.map(([name, data]) => (
                        <LevelCard key={name} name={name} data={data} fmt={fmt} onEdit={() => startEditLevel(name, data)} onDelete={() => handleDeleteLevel(name)} onToggleArchive={() => handleToggleArchive(name)} />
                    ))}
                </div>
            </div>

            {/* Archived Level List */}
            {archivedLevelEntries.length > 0 && (
                <div className="card" style={{ padding: '28px', marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Archive style={{ width: '18px', height: '18px', color: 'var(--accent-amber)' }} />
                        Pelatihan Selesai (Arsip)
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>({archivedLevelEntries.length})</span>
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {archivedLevelEntries.map(([name, data]) => (
                            <LevelCard key={name} name={name} data={data} fmt={fmt} onEdit={() => startEditLevel(name, data)} onDelete={() => handleDeleteLevel(name)} onToggleArchive={() => handleToggleArchive(name)} archived />
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <button onClick={handleSaveSettings} className="btn btn-success" disabled={isSaving}>
                    <Save style={{ width: '18px', height: '18px' }} />
                    {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
                <button onClick={handleReset} className="btn btn-ghost">
                    <RotateCcw style={{ width: '18px', height: '18px' }} />
                    Reset Draft
                </button>
            </div>

            {/* ===== BACKUP & RESTORE ===== */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Backup & Restore
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Export dan import seluruh data per jenis pelatihan</p>
            </div>

            {/* Export Section */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} />
                    Export Data Pelatihan
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Pilih jenis pelatihan untuk mengexport seluruh data terkait (peserta, pembayaran, sertifikat, cashflow, dll) ke file JSON.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={labelStyle}>Pilih Pelatihan</label>
                        <CustomSelect
                            value={exportLevel}
                            onChange={setExportLevel}
                            placeholder="-- Pilih Pelatihan --"
                            options={Object.keys(contextLevels).map(l => ({ value: l, label: l }))}
                        />
                    </div>
                    <button
                        onClick={async () => {
                            if (!exportLevel) { showToast('Pilih pelatihan terlebih dahulu!', 'error'); return; }
                            setIsExporting(true);
                            setExportProgress(null);
                            try {
                                const data = await exportLevelData(exportLevel, (p) => setExportProgress(p));
                                const safeName = exportLevel.replace(/[^a-zA-Z0-9]/g, '_');
                                const dateStr = new Date().toISOString().slice(0, 10);
                                downloadJson(data, `backup_${safeName}_${dateStr}.json`);
                                showToast(`Data "${exportLevel}" berhasil diexport! (${data.summary.peserta} peserta, ${data.summary.cashflow} cashflow, ${data.summary.sertifikat} sertifikat)`);
                            } catch (err) {
                                console.error('Export error:', err);
                                showToast('Gagal mengexport data!', 'error');
                            } finally {
                                setIsExporting(false);
                                setExportProgress(null);
                            }
                        }}
                        className="btn btn-primary"
                        disabled={isExporting || !exportLevel}
                        style={{ height: '42px', whiteSpace: 'nowrap' }}
                    >
                        {isExporting ? (
                            <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Mengexport...</>
                        ) : (
                            <><Download style={{ width: '16px', height: '16px' }} /> Export JSON</>
                        )}
                    </button>
                </div>
                {exportProgress && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--accent-blue-light)', borderRadius: '10px', border: '1px solid var(--accent-blue-border)', fontSize: '13px', color: 'var(--accent-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                        {exportProgress.detail}
                    </div>
                )}
            </div>

            {/* Import Section */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload style={{ width: '18px', height: '18px', color: 'var(--accent-emerald)' }} />
                    Import Data Pelatihan
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Upload file JSON backup untuk mengimport data pelatihan. Data duplikat akan otomatis di-skip.
                </p>

                {/* File drop zone */}
                <label
                    htmlFor="import-file-input"
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '32px 24px', borderRadius: '14px',
                        border: '2px dashed var(--border-color)',
                        background: 'var(--bg-input)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                        position: 'relative',
                    }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.background = 'var(--accent-blue-light)'; }}
                    onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                    onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                        const file = e.dataTransfer.files[0];
                        if (file) handleImportFile(file);
                    }}
                >
                    <FileJson style={{ width: '36px', height: '36px', color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.6 }} />
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Klik atau drag & drop file JSON</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>File backup (.json) dari fitur export</p>
                    <input
                        id="import-file-input"
                        ref={importFileRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={e => {
                            const file = e.target.files[0];
                            if (file) handleImportFile(file);
                        }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                </label>

                {/* Import Preview */}
                {importFileData && (
                    <div style={{ marginTop: '20px' }}>
                        {/* File info header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', background: 'var(--accent-emerald-light)', borderRadius: '10px', display: 'flex' }}>
                                    <FileJson style={{ width: '20px', height: '20px', color: 'var(--accent-emerald)' }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{importFileName}</p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>Exported: {new Date(importFileData.exportedAt).toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setImportFileData(null); setImportFileName(''); setImportResults(null); if (importFileRef.current) importFileRef.current.value = ''; }}
                                className="btn btn-ghost" style={{ padding: '6px' }}
                            >
                                <X style={{ width: '16px', height: '16px' }} />
                            </button>
                        </div>

                        {/* Level name + summary card */}
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Package style={{ width: '16px', height: '16px', color: 'var(--accent-blue)' }} />
                                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{importFileData.levelName}</span>
                                <span className="badge badge-blue" style={{ fontSize: '10px' }}>v{importFileData.exportVersion}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                                {[
                                    { icon: Users, label: 'Peserta', count: importFileData.summary?.peserta || 0, color: 'var(--accent-blue)' },
                                    { icon: Wallet, label: 'Cashflow', count: importFileData.summary?.cashflow || 0, color: 'var(--accent-emerald)' },
                                    { icon: Award, label: 'Sertifikat', count: importFileData.summary?.sertifikat || 0, color: 'var(--accent-amber)' },
                                    { icon: MapPin, label: 'Alamat', count: importFileData.summary?.alamatPengiriman || 0, color: 'var(--accent-rose)' },
                                    { icon: FileText, label: 'Saran Edit', count: importFileData.summary?.editSuggestions || 0, color: 'var(--text-muted)' },
                                    { icon: ClipboardList, label: 'Formulir', count: importFileData.summary?.formulirResponses || 0, color: 'var(--text-muted)' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                        <item.icon style={{ width: '14px', height: '14px', color: item.color, flexShrink: 0 }} />
                                        <div>
                                            <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.count}</p>
                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{item.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section selection */}
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Pilih data yang ingin diimport</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                                {[
                                    { key: 'levelConfig', label: 'Konfigurasi Level', disabled: !importFileData.levelConfig },
                                    { key: 'peserta', label: `Peserta (${importFileData.summary?.peserta || 0})`, disabled: !importFileData.peserta?.length },
                                    { key: 'cashflow', label: `Cashflow (${importFileData.summary?.cashflow || 0})`, disabled: !importFileData.cashflow?.length },
                                    { key: 'sertifikat', label: `Sertifikat (${importFileData.summary?.sertifikat || 0})`, disabled: !importFileData.sertifikat?.length },
                                    { key: 'publicSettings', label: 'Pengaturan Publik', disabled: !importFileData.publicSettings },
                                    { key: 'alamatPengiriman', label: `Alamat (${importFileData.summary?.alamatPengiriman || 0})`, disabled: !importFileData.alamatPengiriman?.length },
                                    { key: 'editSuggestions', label: `Saran Edit (${importFileData.summary?.editSuggestions || 0})`, disabled: !importFileData.editSuggestions?.length },
                                    { key: 'formulirResponses', label: `Formulir (${importFileData.summary?.formulirResponses || 0})`, disabled: !importFileData.formulirResponses?.length },
                                ].map(sec => (
                                    <label key={sec.key} className="custom-control custom-control-bulat" style={{ opacity: sec.disabled ? 0.4 : 1, pointerEvents: sec.disabled ? 'none' : 'auto' }}>
                                        <input
                                            type="checkbox"
                                            checked={importSections[sec.key] && !sec.disabled}
                                            onChange={() => setImportSections(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                                            disabled={sec.disabled}
                                        />
                                        <span className="control-bubble"></span>
                                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{sec.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Info note */}
                        <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
                            <AlertCircle style={{ width: '16px', height: '16px', color: 'var(--accent-blue)', flexShrink: 0, marginTop: '1px' }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                <strong>Duplikat akan di-skip.</strong> Peserta dengan nama & nomor WA yang sama pada level yang sama tidak akan ditambahkan ulang. Level config baru akan otomatis dibuat jika belum ada.
                            </span>
                        </div>

                        {/* Import button */}
                        <button
                            onClick={() => setShowImportConfirm(true)}
                            className="btn btn-success"
                            disabled={isImporting}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                        >
                            {isImporting ? (
                                <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Mengimport...</>
                            ) : (
                                <><Upload style={{ width: '16px', height: '16px' }} /> Import Data Sekarang</>
                            )}
                        </button>

                        {/* Import progress */}
                        {importProgress && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--accent-blue-light)', borderRadius: '10px', border: '1px solid var(--accent-blue-border)', fontSize: '13px', color: 'var(--accent-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                                {importProgress.detail}
                            </div>
                        )}

                        {/* Import results */}
                        {importResults && (
                            <div style={{ marginTop: '12px', padding: '16px', borderRadius: '12px', background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald-border)' }}>
                                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle style={{ width: '16px', height: '16px' }} /> Import Berhasil!
                                </p>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {Object.entries(importResults.imported).map(([key, val]) => (
                                        <span key={key}>✅ {key}: <strong>{val}</strong>{importResults.skipped[key] ? ` (${importResults.skipped[key]} duplikat di-skip)` : ''}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingLevel && createPortal(
                <div className="modal-overlay" onClick={() => setEditingLevel(null)}>
                    <div className="modal-content" style={{ maxWidth: '600px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                                    <Edit3 />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Pelatihan</h3>
                            </div>
                            <button onClick={() => setEditingLevel(null)} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Nama Pelatihan</label>
                                <input type="text" className="input" value={editLevelData.name || ''} onChange={e => setEditLevelData({ ...editLevelData, name: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Tanggal Pelatihan</label>
                                <input type="text" className="input" value={editLevelData.tanggal || ''} onChange={e => setEditLevelData({ ...editLevelData, tanggal: e.target.value })} placeholder="Contoh: 3 - 5 Maret 2026" />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Format: "3 - 5 Maret 2026" atau "3 Maret 2026"</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Biaya Normal (Rp) *</label>
                                    <input type="number" className="input" value={editLevelData.biayaNormal || ''} onChange={e => setEditLevelData({ ...editLevelData, biayaNormal: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Early Bird (Rp)</label>
                                    <input type="number" className="input" value={editLevelData.biayaEarly || ''} onChange={e => setEditLevelData({ ...editLevelData, biayaEarly: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Harga Khusus (Rp)</label>
                                    <input type="number" className="input" value={editLevelData.biayaKhusus || ''} onChange={e => setEditLevelData({ ...editLevelData, biayaKhusus: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingLevel(null)} className="btn btn-ghost">Batal</button>
                            <button onClick={handleSaveEditLevel} className="btn btn-primary">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Import Confirmation Modal */}
            {showImportConfirm && createPortal(
                <div className="modal-overlay" onClick={() => setShowImportConfirm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Konfirmasi Import Data</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Anda akan mengimport data pelatihan <strong>"{importFileData?.levelName}"</strong> ke Firestore.
                        </p>
                        <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: 0 }}>• Data duplikat (peserta dengan nama & WA sama) akan di-skip</p>
                            <p style={{ margin: '4px 0 0 0' }}>• Level config akan dibuat otomatis jika belum ada</p>
                            <p style={{ margin: '4px 0 0 0' }}>• Tindakan ini tidak dapat dibatalkan</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowImportConfirm(false)} className="btn btn-ghost" style={{ padding: '8px 18px' }}>Batal</button>
                            <button onClick={handleExecuteImport} className="btn btn-success" style={{ padding: '8px 18px' }}>
                                <Upload style={{ width: '16px', height: '16px' }} /> Ya, Import Sekarang
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <CheckCircle style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}

// Sub-component for each level card
function LevelCard({ name, data, fmt, onEdit, onDelete, onToggleArchive, archived }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', borderRadius: '14px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            opacity: archived ? 0.7 : 1,
            transition: 'all 0.2s ease',
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{name}</p>
                    {archived && (
                        <span className="badge badge-archived" style={{ fontSize: '10px' }}>📦 Arsip</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Normal: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(data.biayaNormal || data.biaya)}</span>
                        </span>
                        {data.biayaEarly > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Early Bird: <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{fmt(data.biayaEarly)}</span>
                            </span>
                        )}
                        {data.biayaKhusus > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Khusus: <span style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{fmt(data.biayaKhusus)}</span>
                            </span>
                        )}
                    </div>
                    {data.tanggal && data.tanggal !== '-' && (
                        <span style={{
                            fontSize: '12px', color: 'var(--accent-blue)',
                            background: 'var(--accent-blue-light)', padding: '4px 10px',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px',
                            fontWeight: 600
                        }}>
                            <Calendar style={{ width: '12px', height: '12px' }} />
                            {data.tanggal}
                        </span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                <button onClick={onToggleArchive} className={archived ? 'icon-btn icon-btn-emerald' : 'icon-btn icon-btn-amber'} title={archived ? 'Aktifkan Kembali' : 'Arsipkan Pelatihan'}>
                    {archived ? <RotateCcw style={{ width: '16px', height: '16px' }} /> : <Archive style={{ width: '16px', height: '16px' }} />}
                </button>
                <button onClick={onEdit} className="icon-btn icon-btn-blue" title="Edit Pelatihan">
                    <Edit3 style={{ width: '16px', height: '16px' }} />
                </button>
                <button onClick={onDelete} className="icon-btn icon-btn-rose" title="Hapus Pelatihan">
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                </button>
            </div>
        </div>
    );
}
