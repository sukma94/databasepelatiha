import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addPeserta, batchAddPeserta } from '../utils/storage';
import { useData } from '../context/DataContext';
import { Wand2, ClipboardPaste, Save, RotateCcw, CheckCircle, Sparkles, Trash2, ListChecks, ArrowRight } from 'lucide-react';

export default function TambahPeserta() {
    const { levels, addPesertaLocal, batchAddPesertaLocal } = useData();

    // Set default level when levels load
    useEffect(() => {
        const levelKeys = Object.keys(levels);
        if (levelKeys.length > 0 && !formData.level) {
            setFormData(prev => ({ ...prev, level: levelKeys[0] }));
        }
    }, [levels]);

    const emptyForm = {
        nama: '', ukuranBaju: '', wa: '', provinsi: '', tempatLahir: '', tanggalLahirDate: null, ttlRaw: '', alamat: '', cabor: '', level: '', jenisBiaya: 'Normal', nomerSertifikatLevel1: '',
    };

    const [formData, setFormData] = useState({ ...emptyForm });
    const [pasteText, setPasteText] = useState('');
    const [batchPreview, setBatchPreview] = useState([]); // List for mass extraction
    const [showPaste, setShowPaste] = useState(true);
    const [toast, setToast] = useState(null);
    const [isSavingBatch, setIsSavingBatch] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleMagicPaste = () => {
        if (!pasteText.trim()) return;

        // Robust splitting: Look for "Nama" followed by possible suffixes and a separator (: or space)
        const rawBlocks = pasteText.split(/(?=nama\s*(?:untuk\s+sertifikat|sertifikat|lengkap|peserta)?\s*[:\s])/gi).filter(b => b.trim());

        const extractedResults = [];

        rawBlocks.forEach(block => {
            if (!block.trim()) return;

            const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
            let extracted = { ...emptyForm, level: formData.level, jenisBiaya: formData.jenisBiaya };

            const getValue = (currentLine, index, blockLines) => {
                const parts = currentLine.split(':');
                let val = parts.length > 1 ? parts.slice(1).join(':').trim() : '';

                if (!val) {
                    for (let j = 1; j <= 2; j++) {
                        if (index + j < blockLines.length) {
                            const nextLine = blockLines[index + j].trim();
                            if (!nextLine) continue;
                            const looksLikeLabel = (nextLine.includes(':') && nextLine.split(':')[0].length < 25);
                            if (!looksLikeLabel) { val = nextLine; break; } else { break; }
                        }
                    }
                }
                return val;
            };

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const text = line.toLowerCase();

                const isNameLabel = text.match(/^nama\s*(?:untuk\s+sertifikat|sertifikat|lengkap|peserta)?\s*[:\s]/i);

                if (isNameLabel && !text.includes('cabang')) {
                    const v = getValue(line, i, lines); if (v) extracted.nama = v;
                } else if (text.includes('ukuran baju') || text.includes('size baju')) {
                    const v = getValue(line, i, lines); if (v) extracted.ukuranBaju = v.toUpperCase();
                } else if (text.includes('nomor wa') || text.includes('no wa') || text.includes('whatsapp')) {
                    const v = getValue(line, i, lines); if (v) extracted.wa = v;
                } else if (text.includes('provinsi')) {
                    const v = getValue(line, i, lines); if (v) extracted.provinsi = v;
                } else if (text.includes('tempat & tanggal lahir') || text.includes('ttl')) {
                    const v = getValue(line, i, lines);
                    if (v) {
                        const parts = v.split(',');
                        if (parts.length > 1) {
                            extracted.tempatLahir = parts[0].trim();
                            extracted.ttlRaw = parts.slice(1).join(',').trim();
                        } else { extracted.tempatLahir = v.trim(); }
                    }
                } else if (text.includes('alamat domisili') || text.includes('alamat')) {
                    const v = getValue(line, i, lines); if (v) extracted.alamat = v;
                } else if (text.includes('cabang olahraga') || text.includes('cabor')) {
                    const v = getValue(line, i, lines); if (v) extracted.cabor = v;
                } else if (text.includes('no sertifikat') || text.includes('no sertfikat') || text.includes('sertifikat lankor')) {
                    const v = getValue(line, i, lines); if (v) extracted.nomerSertifikatLevel1 = v;
                }
            }

            if (extracted.nama) extractedResults.push(extracted);
        });

        if (extractedResults.length > 0) {
            setBatchPreview(extractedResults);
            showToast(`${extractedResults.length} peserta terdeteksi! Tinjau data di bawah.`, 'success');
        } else {
            showToast('Gagal mendeteksi data peserta. Cek format paste Anda.', 'error');
        }

        setPasteText('');
    };

    const handleSaveBatch = async () => {
        if (batchPreview.length === 0) return;
        setIsSavingBatch(true);

        const activeLevelData = levels[formData.level] || {};
        let biayaBase = activeLevelData.biayaNormal || activeLevelData.biaya || 0;
        if (formData.jenisBiaya === 'Early Bird' && activeLevelData.biayaEarly) biayaBase = activeLevelData.biayaEarly;
        else if (formData.jenisBiaya === 'Khusus' && activeLevelData.biayaKhusus) biayaBase = activeLevelData.biayaKhusus;

        const preparedItems = batchPreview.map(item => {
            const ttlFinal = [item.tempatLahir, item.ttlRaw].filter(Boolean).join(', ');
            const finalItem = { ...item, ttl: ttlFinal, biaya: biayaBase, sisaTagihan: biayaBase };
            delete finalItem.tempatLahir;
            delete finalItem.tanggalLahirDate;
            delete finalItem.ttlRaw;
            return finalItem;
        });

        const success = await batchAddPeserta(preparedItems);
        setIsSavingBatch(false);

        if (success) {
            batchAddPesertaLocal(success);
            setBatchPreview([]);
            showToast(`${preparedItems.length} peserta berhasil disimpan masal! 🚀`);
        } else {
            showToast('Gagal menyimpan beberapa data.', 'error');
        }
    };

    const removePreviewItem = (index) => {
        const up = [...batchPreview];
        up.splice(index, 1);
        setBatchPreview(up);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nama.trim()) { showToast('Nama wajib diisi!', 'error'); return; }
        if (!formData.level) { showToast('Pilih level pelatihan!', 'error'); return; }

        const dateStr = formData.tanggalLahirDate
            ? formData.tanggalLahirDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : formData.ttlRaw; // fallback to raw string if datepicker not used

        const ttlFinal = [formData.tempatLahir, dateStr].filter(Boolean).join(', ');

        const activeLevelData = levels[formData.level] || {};
        let biaya = activeLevelData.biayaNormal || activeLevelData.biaya || 0;
        if (formData.jenisBiaya === 'Early Bird' && activeLevelData.biayaEarly) {
            biaya = activeLevelData.biayaEarly;
        } else if (formData.jenisBiaya === 'Khusus' && activeLevelData.biayaKhusus) {
            biaya = activeLevelData.biayaKhusus;
        }

        const dataToSave = { ...formData, ttl: ttlFinal, biaya, sisaTagihan: biaya };
        delete dataToSave.tempatLahir;
        delete dataToSave.tanggalLahirDate;
        delete dataToSave.ttlRaw;

        const result = await addPeserta(dataToSave);
        if (result) addPesertaLocal(result);

        // Reset form but keep the current level & jenisBiaya
        setFormData({ ...emptyForm, level: formData.level, jenisBiaya: formData.jenisBiaya });
        showToast('Peserta berhasil disimpan!');
    };

    const handleReset = () => {
        const levelKeys = Object.keys(levels);
        setFormData({ ...emptyForm, level: levelKeys[0] || '' });
        setPasteText('');
        setBatchPreview([]);
    };

    const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));
    const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    const fields = [
        { key: 'nama', label: 'Nama Lengkap', placeholder: 'Nama lengkap untuk sertifikat', required: true },
        { key: 'wa', label: 'Nomor WA', placeholder: '08xxxxxxxxxx' },
        { key: 'ukuranBaju', label: 'Ukuran Baju', placeholder: 'S / M / L / XL / XXL' },
        { key: 'provinsi', label: 'Provinsi Asal', placeholder: 'Provinsi' },
        { key: 'ttl_complex', label: 'Tempat, Tanggal Lahir', placeholder: 'Pilih' },
        { key: 'cabor', label: 'Cabang Olahraga', placeholder: 'Cabang olahraga' },
        { key: 'alamat', label: 'Alamat Domisili', placeholder: 'Alamat lengkap', fullWidth: true },
        // Input dinamis disisipkan saat mapping render
    ];

    return (
        <div className="animate-fade-in" style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Tambah Peserta
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Input data peserta baru dengan Magic Paste atau form manual</p>
            </div>

            {/* Category Selection */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Pilih Kategori Pelatihan Terlebih Dahulu
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {Object.entries(levels).map(([lvl, data], idx) => {
                        const active = formData.level === lvl;

                        // Define color themes for different categories
                        const themes = [
                            { border: 'var(--accent-blue)', bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)' },
                            { border: 'var(--accent-emerald)', bg: 'var(--accent-emerald-light)', text: 'var(--accent-emerald)' },
                            { border: 'var(--accent-amber)', bg: 'var(--accent-amber-light)', text: 'var(--accent-amber)' },
                            { border: 'var(--accent-rose)', bg: 'var(--accent-rose-light)', text: 'var(--accent-rose)' },
                        ];
                        const theme = themes[idx % themes.length];

                        return (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => update('level', lvl)}
                                className={`category-select-btn ${active ? 'active' : ''}`}
                                style={{
                                    padding: '24px 20px',
                                    borderRadius: '16px',
                                    border: '2px solid',
                                    borderColor: active ? theme.border : 'var(--border-color)',
                                    background: active ? theme.bg : 'var(--bg-card)',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: active ? `0 4px 12px ${theme.border}20` : 'var(--shadow-sm)'
                                }}
                            >
                                {active && (
                                    <div style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        background: theme.border, color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px'
                                    }}>
                                        <CheckCircle style={{ width: '12px', height: '12px' }} />
                                    </div>
                                )}
                                <p style={{
                                    fontSize: '15px',
                                    fontWeight: 800,
                                    color: active ? theme.text : 'var(--text-primary)',
                                    lineHeight: 1.3
                                }}>
                                    {lvl}
                                </p>
                                {data.tanggal && (
                                    <p style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: active ? theme.text : 'var(--text-muted)',
                                        opacity: 0.9
                                    }}>
                                        {data.tanggal}
                                    </p>
                                )}
                                <p style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: 'var(--text-muted)',
                                    marginTop: '4px'
                                }}>
                                    {fmt(data.biayaNormal || data.biaya)}
                                    {data.biayaEarly > 0 ? ` / EB: ${fmt(data.biayaEarly)}` : ''}
                                    {data.biayaKhusus > 0 ? ` / HK: ${fmt(data.biayaKhusus)}` : ''}
                                </p>
                            </button>
                        );
                    })}
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '16px' }}>
                    Kategori Biaya Pendaftaran
                </h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['Normal', 'Early Bird', 'Khusus'].map(jenis => {
                        const activeLevelData = levels[formData.level] || {};
                        const disabled = (jenis === 'Early Bird' && !activeLevelData.biayaEarly) || (jenis === 'Khusus' && !activeLevelData.biayaKhusus);
                        const active = formData.jenisBiaya === jenis && !disabled;

                        let b = activeLevelData.biayaNormal || activeLevelData.biaya;
                        if (jenis === 'Early Bird') b = activeLevelData.biayaEarly;
                        if (jenis === 'Khusus') b = activeLevelData.biayaKhusus;

                        return (
                            <button
                                key={jenis}
                                type="button"
                                onClick={() => !disabled && update('jenisBiaya', jenis)}
                                disabled={disabled}
                                style={{
                                    padding: '16px 24px',
                                    borderRadius: '16px',
                                    border: '2px solid',
                                    borderColor: active ? 'var(--accent-blue)' : 'var(--border-color)',
                                    background: disabled ? 'var(--bg-input)' : (active ? 'var(--accent-blue-light)' : 'var(--bg-card)'),
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: disabled ? 0.6 : 1,
                                    textAlign: 'left',
                                    minWidth: '180px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    boxShadow: active ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'var(--shadow-sm)'
                                }}
                            >
                                <p style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: active ? 'var(--accent-blue)' : 'var(--text-primary)'
                                }}>
                                    {jenis}
                                </p>
                                {!disabled ? (
                                    <p style={{ fontSize: '15px', fontWeight: 600, color: active ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                                        {fmt(b || 0)}
                                    </p>
                                ) : (
                                    <p style={{ fontSize: '12px', color: 'var(--accent-rose)', fontWeight: 600 }}>
                                        Tidak Tersedia
                                    </p>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-input)', padding: '4px', borderRadius: '14px', maxWidth: '320px' }}>
                {[
                    { key: true, label: 'Magic Paste', icon: Sparkles },
                    { key: false, label: 'Form Manual', icon: ClipboardPaste },
                ].map((tab) => (
                    <button
                        key={String(tab.key)}
                        onClick={() => setShowPaste(tab.key)}
                        className={showPaste === tab.key ? 'btn btn-primary' : 'btn'}
                        style={{
                            flex: 1, justifyContent: 'center', padding: '10px 16px', fontSize: '13px',
                            ...(showPaste !== tab.key ? { background: 'transparent', color: 'var(--text-secondary)', border: 'none' } : {}),
                        }}
                    >
                        <tab.icon style={{ width: '15px', height: '15px' }} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Magic Paste */}
            {showPaste && (
                <div className="paste-zone animate-fade-in" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        < Wand2 style={{ width: '20px', height: '20px', color: 'var(--accent-blue)' }} />
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Magic Paste (Mendukung Masal)</h2>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Copy seluruh chat pendaftaran WhatsApp (boleh lebih dari satu orang) dan paste di bawah. Sistem akan otomatis memisahkan tiap orang.
                    </p>
                    <textarea
                        className="input"
                        rows="7"
                        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '13px', resize: 'vertical' }}
                        placeholder={`Contoh:\nNama: Budi\nUkuran: L\n\nNama: Susi\nUkuran: M`}
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                    />
                    <div style={{ marginTop: '16px' }}>
                        <button onClick={handleMagicPaste} disabled={!pasteText.trim()} className="btn btn-primary">
                            <Sparkles style={{ width: '16px', height: '16px' }} />
                            Ekstrak {pasteText.toLowerCase().includes('nama') ? 'Masal' : 'Data'}
                        </button>
                    </div>
                </div>
            )}

            {/* Batch Preview Table */}
            {batchPreview.length > 0 && (
                <div className="card animate-scale-in" style={{ padding: '28px', marginBottom: '32px', border: '1px solid var(--accent-emerald-border)', background: 'var(--bg-card)', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                                <ListChecks style={{ width: '20px', height: '20px' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Hasil Ekstraksi</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{batchPreview.length} peserta ditemukan</p>
                            </div>
                        </div>
                        <button onClick={handleSaveBatch} disabled={isSavingBatch} className="btn btn-emerald" style={{ boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                            <Save style={{ width: '18px', height: '18px' }} />
                            {isSavingBatch ? 'Menyimpan...' : 'Simpan Semua'}
                        </button>
                    </div>

                    <p style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '10px' }}>
                        <ArrowRight style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '6px', color: 'var(--accent-emerald)' }} />
                        Peserta akan disimpan ke kategori <strong style={{ color: 'var(--text-primary)' }}>{formData.level}</strong> dengan biaya <strong style={{ color: 'var(--text-primary)' }}>{formData.jenisBiaya}</strong>.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {batchPreview.map((item, idx) => (
                            <div key={idx} style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' }}>
                                <button
                                    onClick={() => removePreviewItem(idx)}
                                    style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: 'none', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseOver={e => { e.currentTarget.style.color = 'var(--accent-rose)'; e.currentTarget.style.background = 'var(--accent-rose-light)'; }}
                                    onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                                    title="Hapus dari daftar"
                                >
                                    <Trash2 style={{ width: '14px', height: '14px' }} />
                                </button>
                                
                                <div style={{ marginBottom: '16px', paddingRight: '30px' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.nama || '-'}
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                                        {item.wa || 'Tanpa WA'}
                                    </p>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                                        <span>Cabor:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.cabor || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                                        <span>Size Baju:</span>
                                        <span className="badge badge-ghost" style={{ padding: '2px 8px', fontSize: '11px' }}>{item.ukuranBaju || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Asal:</span>
                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.provinsi || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!showPaste && (
                <form onSubmit={handleSubmit}>
                    {/* Form Data Peserta Di Bawah Kategori */}
                    <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
                            Data Peserta {formData.level ? `(${formData.level})` : ''}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            {/* Render extra field nomer sertifikat Level 1 jika level mengandung 'level 2' */}
                            {formData.level && formData.level.toLowerCase().includes('level 2') && (
                                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--accent-blue-border)' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '6px' }}>
                                        Nomer Sertifikat Level 1 <span style={{ color: 'var(--accent-rose)', marginLeft: '4px' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Masukkan No. Sertifikat Level 1"
                                        value={formData.nomerSertifikatLevel1}
                                        onChange={(e) => update('nomerSertifikatLevel1', e.target.value)}
                                        required={formData.level && formData.level.toLowerCase().includes('level 2')}
                                    />
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Peserta Level 2 wajib melampirkan Nomer Sertifikat Level 1.</p>
                                </div>
                            )}

                            {fields.map((f) => {
                                if (f.key === 'ttl_complex') {
                                    return (
                                        <div key={f.key}>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                                {f.label}
                                            </label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Tempat"
                                                    value={formData.tempatLahir}
                                                    onChange={(e) => update('tempatLahir', e.target.value)}
                                                    style={{ flex: 1.2, minWidth: '100px' }}
                                                />
                                                <div className="custom-datepicker-wrapper" style={{ flex: 2, minWidth: '140px' }}>
                                                    <DatePicker
                                                        selected={formData.tanggalLahirDate}
                                                        onChange={(date) => update('tanggalLahirDate', date)}
                                                        dateFormat="dd MMMM yyyy"
                                                        placeholderText={formData.ttlRaw || "Tanggal"}
                                                        className="input"
                                                        showMonthDropdown
                                                        showYearDropdown
                                                        dropdownMode="select"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={f.key} style={f.fullWidth ? { gridColumn: '1 / -1' } : {}}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            {f.label}
                                            {f.required && <span style={{ color: 'var(--accent-rose)', marginLeft: '4px' }}>*</span>}
                                        </label>
                                        {f.fullWidth ? (
                                            <textarea
                                                className="input"
                                                rows="2"
                                                placeholder={f.placeholder}
                                                value={formData[f.key]}
                                                onChange={(e) => update(f.key, e.target.value)}
                                                style={{ resize: 'vertical' }}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder={f.placeholder}
                                                value={formData[f.key]}
                                                onChange={(e) => update(f.key, e.target.value)}
                                                required={f.required}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" className="btn btn-success">
                            <Save style={{ width: '16px', height: '16px' }} />
                            Simpan ke Database
                        </button>
                        <button type="button" onClick={handleReset} className="btn btn-ghost">
                            <RotateCcw style={{ width: '16px', height: '16px' }} />
                            Reset
                        </button>
                    </div>
                </form>
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
