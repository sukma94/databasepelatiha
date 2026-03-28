import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { addFormulirResponse, addEditSuggestion, checkFormulirExistsByPesertaId } from '../utils/storage';
import { sanitizeFormData } from '../utils/inputValidation';
import { canSubmit, getCooldownRemaining } from '../utils/rateLimit';
import { usePublicData } from '../utils/usePublicData';
import { formatString } from '../utils/formatters';
import { isLevelArchived } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { Link, useParams } from 'react-router-dom';
import './FormulirUpdatePeserta.css';
import './PublicPeserta.css';
import {
    Search, Sun, Moon, Check, Upload, User, FileText, Send, X, AlertCircle, Lock,
    ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MessageCircle, Edit3, ArrowLeft, Users, PenTool
} from 'lucide-react';

const PENDIDIKAN_OPTIONS = ['SMP', 'SMA/SMK', 'D3', 'S1', 'S2', 'S3'];
const PENGALAMAN_OPTIONS = ['1-2 tahun', '3-5 tahun', '5-8 tahun', '9+ tahun'];
const LEVEL_KEPELATIHAN_OPTIONS = ['Loka/Kab-Kota', 'Provinsi', 'Nasional', 'Internasional'];
const TEMPAT_KERJA_OPTIONS = ['Sekolah Dasar', 'Sekolah Menengah', 'Universitas', 'Militer', 'Organisasi Cabor', 'Klub'];
const PENGALAMAN_MELATIH_FISIK_OPTIONS = ['1-2 thn', '3-5 thn', '5-8 thn', '9+ thn'];
const LEVEL_MELATIH_FISIK_OPTIONS = ['Lokal/Kab-Kota', 'Provinsi', 'Nasional', 'Internasional'];

// ⚠️ GANTI URL ini dengan URL deployment Google Apps Script Anda
// Ikuti panduan di google_drive_setup.md untuk cara deploy
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwzz2aXTykVK7ekREQeH5ho0C1SBDKtzAuW0zORH9wzo7hZsyfP7HPO96GCCwIU5NuCKg/exec';


// Convert Google Drive URL to directly embeddable format
function toDriveDirectUrl(url) {
    if (!url) return url;
    if (url.includes('drive.google.com/thumbnail')) return url;
    let fileId = null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,                    // drive.google.com/file/d/ID
        /[?&]id=([a-zA-Z0-9_-]+)/,                        // ?id=ID or &id=ID
        /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/, // lh3.../d/ID
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) { fileId = m[1]; break; }
    }
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}`;
    return url; // fallback: return as-is
}
export default function FormulirUpdatePeserta() {
    const { levelSlug } = useParams();

    const { peserta, levels, settings, publicSettings, notFound } = usePublicData({ levelSlug });
    const [selectedPeserta, setSelectedPeserta] = useState(null);
    const [searchNama, setSearchNama] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [toast, setToast] = useState(null);
    const [showVerifyWa, setShowVerifyWa] = useState(false);
    const [verifyWaInput, setVerifyWaInput] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [verifyAttempts, setVerifyAttempts] = useState(0);
    const [confirmed, setConfirmed] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const { dark, toggle, textFormat } = useTheme();

    // Signature pad state
    const signatureCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState(null);
    const [signatureStrokes, setSignatureStrokes] = useState([]);

    const getCanvasPoint = useCallback((e) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height),
        };
    }, []);

    const redrawSignature = useCallback((strokes) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = dark ? '#e2e8f0' : '#1a202c';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        strokes.forEach(stroke => {
            if (stroke.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            ctx.stroke();
        });
    }, [dark]);

    const handleSignatureStart = useCallback((e) => {
        e.preventDefault();
        setIsDrawing(true);
        const point = getCanvasPoint(e);
        setSignatureStrokes(prev => [...prev, [point]]);
    }, [getCanvasPoint]);

    const handleSignatureMove = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const point = getCanvasPoint(e);
        setSignatureStrokes(prev => {
            const updated = [...prev];
            const last = [...updated[updated.length - 1], point];
            updated[updated.length - 1] = last;
            return updated;
        });
    }, [isDrawing, getCanvasPoint]);

    const handleSignatureEnd = useCallback(() => {
        setIsDrawing(false);
        const canvas = signatureCanvasRef.current;
        if (canvas) {
            setSignatureData(canvas.toDataURL('image/png'));
        }
    }, []);

    const clearSignature = useCallback(() => {
        setSignatureStrokes([]);
        setSignatureData(null);
        const canvas = signatureCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    const undoSignature = useCallback(() => {
        setSignatureStrokes(prev => {
            const updated = prev.slice(0, -1);
            redrawSignature(updated);
            if (updated.length === 0) setSignatureData(null);
            else {
                const canvas = signatureCanvasRef.current;
                if (canvas) setSignatureData(canvas.toDataURL('image/png'));
            }
            return updated;
        });
    }, [redrawSignature]);

    // Redraw whenever strokes change
    useEffect(() => {
        redrawSignature(signatureStrokes);
    }, [signatureStrokes, redrawSignature]);

    // Form fields
    const [form, setForm] = useState({
        jenisKelamin: '',
        pekerjaan: '',
        pendidikan: '',
        latarPendidikanOlahraga: '',
        sertifikatPelatih: '',
        khususPelatihFisik: '',
        pengalamanMelatih: '',
        levelKepelatihan: '',
        tempatKerja: [],
        tempatKerjaLain: '',
        fotoFile: null,
        // Level 2 specific fields
        pelatihanLevel1DiManaTahun: '',
        pekerjaanSetelahLevel1: '',
        pengalamanMelatihFisik: '',
        levelMelatihFisik: '',
    });

    // Inline edit overrides for read-only fields
    const [editOverrides, setEditOverrides] = useState({});
    const [editingField, setEditingField] = useState(null);

    const startEdit = (key, currentVal) => {
        setEditOverrides(prev => ({ ...prev, [key]: prev[key] !== undefined ? prev[key] : (currentVal || '') }));
        setEditingField(key);
    };

    const updateOverride = (key, val) => {
        setEditOverrides(prev => ({ ...prev, [key]: val }));
    };

    const cancelEdit = (key) => {
        setEditOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setEditingField(null);
    };

    // Detect if current level is level 2
    const isLevel2 = publicSettings?.levelName?.includes('2') || levelSlug?.includes('2');

    const publishedPeserta = useMemo(() => {
        if (!publicSettings) return [];
        const levelName = publicSettings.levelName;
        // Filter peserta by level
        let list = peserta.filter(p => p.level === levelName);
        if (!publicSettings.publishAll) {
            const publishedIds = new Set(publicSettings.publishedIds || []);
            list = list.filter(p => publishedIds.has(p.id));
        }
        // Hide archived & 'Batal' from form
        return list.filter(p => !isLevelArchived(levels[p.level]) && p.statusKepesertaan !== 'Batal');
    }, [peserta, publicSettings, levels]);

    const filteredNames = useMemo(() => {
        if (!searchNama.trim()) return publishedPeserta.slice(0, 20);
        return publishedPeserta.filter(p =>
            p.nama?.toLowerCase().includes(searchNama.toLowerCase())
        ).slice(0, 20);
    }, [publishedPeserta, searchNama]);

    const handleSelectPeserta = async (p) => {
        setSelectedPeserta(p);
        setSearchNama(p.nama || '');
        setEditOverrides({});
        setEditingField(null);
        setAlreadySubmitted(false);
        setForm(prev => ({
            ...prev,
            alamat: p.alamat || '',
        }));
        setShowDropdown(false);

        // Check if this peserta already submitted
        const exists = await checkFormulirExistsByPesertaId(p.id);
        if (exists) {
            setAlreadySubmitted(true);
        }
    };

    const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const toggleTempatKerja = (val) => {
        setForm(prev => {
            const list = prev.tempatKerja.includes(val)
                ? prev.tempatKerja.filter(v => v !== val)
                : [...prev.tempatKerja, val];
            return { ...prev, tempatKerja: list };
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1 * 1024 * 1024) {
                setToast({ message: 'Ukuran file maksimal 1MB', type: 'error' });
                setTimeout(() => setToast(null), 3000);
                return;
            }
            updateForm('fotoFile', file);
        }
    };

    const handleClickKirim = (e) => {
        e.preventDefault();
        if (!selectedPeserta) {
            setToast({ message: 'Pilih nama peserta terlebih dahulu!', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }
        if (alreadySubmitted) {
            setToast({ message: 'Anda sudah pernah mengirim formulir. Jika ada kendala atau perubahan data, silakan hubungi Admin.', type: 'error' });
            setTimeout(() => setToast(null), 5000);
            return;
        }

        const currentJK = editOverrides.jenisKelamin || selectedPeserta.jenisKelamin;
        if (!currentJK || currentJK === '-') {
            setToast({ message: 'Jenis kelamin wajib dipilih!', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        const currentTTL = editOverrides.ttl || selectedPeserta.ttl;
        if (!currentTTL || currentTTL === '-') {
            setToast({ message: 'Tempat, Tanggal Lahir wajib diisi!', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        const currentAlamat = editOverrides.alamat || selectedPeserta.alamat;
        if (!currentAlamat || currentAlamat === '-') {
            setToast({ message: 'Alamat wajib diisi!', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        if (!isLevel2 && !form.fotoFile) {
            setToast({ message: 'Pas Foto wajib diupload!', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        // Show WA verification modal
        setShowVerifyWa(true);
        setVerifyWaInput('');
        setVerifyError('');
        setVerifyAttempts(0);
    };

    const handleVerifyAndSubmit = () => {
        const waClean = (selectedPeserta.wa || '').replace(/\D/g, '');
        const last3 = waClean.slice(-3);
        if (!waClean || waClean.length < 3) {
            setVerifyError('Data WhatsApp peserta tidak valid.');
            return;
        }
        if (verifyWaInput !== last3) {
            setVerifyAttempts(prev => prev + 1);
            setVerifyError('3 digit terakhir WhatsApp salah.');
            return;
        }
        setShowVerifyWa(false);
        setVerifyWaInput('');
        setVerifyError('');
        setVerifyAttempts(0);
        doSubmit();
    };

    const doSubmit = async () => {
        if (!canSubmit('formulir_' + selectedPeserta.id, 60000)) {
            const remaining = getCooldownRemaining('formulir_' + selectedPeserta.id, 60000);
            setToast({ message: `Harap tunggu ${remaining} detik sebelum mengirim lagi.`, type: 'error' });
            setTimeout(() => setToast(null), 4000);
            return;
        }
        setSubmitting(true);

        // Upload foto ke Google Drive via Apps Script
        let fotoUrl = null;
        if (form.fotoFile) {
            try {
                setToast({ message: 'Mengupload foto...', type: 'info' });

                // Convert file to base64 (tanpa prefix data:...;base64,)
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result;
                        resolve(result.split(',')[1]);
                    };
                    reader.readAsDataURL(form.fotoFile);
                });

                const response = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        base64: base64,
                        mimeType: form.fotoFile.type,
                        fileName: `${selectedPeserta.nama}.${form.fotoFile.name.split('.').pop()}`,
                    }),
                });

                const result = await response.json();
                if (result.success) {
                    fotoUrl = toDriveDirectUrl(result.url);
                } else {
                    console.error('Drive upload error:', result.error);
                    setToast({ message: 'Gagal upload foto ke Drive. Formulir tetap dikirim tanpa foto.', type: 'error' });
                    setTimeout(() => setToast(null), 4000);
                }
            } catch (err) {
                console.error('Upload error:', err);
                setToast({ message: 'Gagal upload foto. Formulir tetap dikirim tanpa foto.', type: 'error' });
                setTimeout(() => setToast(null), 4000);
            }
        }

        const tempatKerjaFinal = [...form.tempatKerja];
        if (form.tempatKerjaLain.trim()) {
            tempatKerjaFinal.push(`Lainnya: ${form.tempatKerjaLain.trim()}`);
        }

        const dataToSave = sanitizeFormData({
            pesertaId: selectedPeserta.id,
            nama: selectedPeserta.nama,
            cabor: selectedPeserta.cabor || '',
            ttl: editOverrides.ttl || selectedPeserta.ttl || '',
            alamat: editOverrides.alamat || selectedPeserta.alamat || '',
            provinsi: selectedPeserta.provinsi || '',
            wa: selectedPeserta.wa || '',
            level: selectedPeserta.level || '',
            jenisKelamin: editOverrides.jenisKelamin || selectedPeserta.jenisKelamin || form.jenisKelamin || '',
            pekerjaan: form.pekerjaan,
            pendidikan: isLevel2 ? '' : form.pendidikan,
            latarPendidikanOlahraga: isLevel2 ? '' : form.latarPendidikanOlahraga,
            sertifikatPelatih: isLevel2 ? '' : form.sertifikatPelatih,
            khususPelatihFisik: isLevel2 ? '' : form.khususPelatihFisik,
            pengalamanMelatih: form.pengalamanMelatih,
            levelKepelatihan: form.levelKepelatihan,
            tempatKerja: tempatKerjaFinal,
            fotoUrl: isLevel2 ? null : fotoUrl,
            // Level 2 specific fields
            ...(isLevel2 ? {
                pelatihanLevel1DiManaTahun: form.pelatihanLevel1DiManaTahun,
                pekerjaanSetelahLevel1: form.pekerjaanSetelahLevel1,
                pengalamanMelatihFisik: form.pengalamanMelatihFisik,
                levelMelatihFisik: form.levelMelatihFisik,
                tandaTangan: signatureData,
            } : {}),
        });

        const ok = await addFormulirResponse(dataToSave);

        // Submit edit suggestions for any overridden read-only fields
        const hasOverrides = Object.keys(editOverrides).length > 0;
        if (ok && hasOverrides) {
            const dataBaru = { ...selectedPeserta };
            for (const [key, val] of Object.entries(editOverrides)) {
                if (val !== (selectedPeserta[key] || '')) {
                    dataBaru[key] = val;
                }
            }
            await addEditSuggestion({
                pesertaId: selectedPeserta.id,
                dataLama: selectedPeserta,
                dataBaru,
                source: 'formulir',
            });
        }

        setSubmitting(false);

        if (ok) {
            setSubmitted(true);
        } else {
            setToast({ message: 'Gagal mengirim formulir. Coba lagi.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    // --- Loading ---
    if (!settings) {
        return (
            <div className="fup-loading-screen">
                <div className="login-spinner" />
            </div>
        );
    }

    // --- Not Found ---
    if (notFound) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
                <header className="pp-hero">
                    <div className="pp-hero-inner">
                        <div className="pp-hero-brand">
                            <img src={logoSrc} alt="Logo" />
                            <div>
                                <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                                <p>Formulir Data Diri</p>
                            </div>
                        </div>
                        <button onClick={toggle} className="pp-theme-btn" aria-label="Toggle theme">
                            {dark ? <Sun key="sun" className="theme-icon-anim" size={18} /> : <Moon key="moon" className="theme-icon-anim" size={18} />}
                        </button>
                    </div>
                </header>
                <div className="pp-content">
                    <div className="pp-empty" style={{ marginTop: '24px' }}>
                        <div className="pp-empty-icon">
                            <Users style={{ width: '36px', height: '36px', color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Halaman Tidak Ditemukan
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            Pelatihan ini belum dipublikasikan atau tidak tersedia.
                        </p>
                        <Link to="/formulir" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', borderRadius: '12px',
                            background: 'var(--accent-blue)', color: 'white',
                            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
                            transition: 'all 0.2s',
                        }}>
                            <ArrowLeft style={{ width: '16px', height: '16px' }} />
                            Kembali ke Pilih Pelatihan
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // --- Success ---
    if (submitted) {
        return (
            <div className="fup-success-screen">
                <div className="fup-success-card">
                    <div className="fup-success-icon">
                        <Check size={36} strokeWidth={3} />
                    </div>
                    <h2 className="fup-success-title">Formulir Terkirim!</h2>
                    <p className="fup-success-msg">
                        Terima kasih, <strong>{selectedPeserta?.nama}</strong>. Data Anda telah berhasil diperbarui dan tercatat dalam sistem kami.
                    </p>
                    <button onClick={() => window.history.back()} className="fup-success-btn">
                        <X size={16} />
                        <span>Tutup</span>
                    </button>
                </div>
            </div>
        );
    }

    // --- Main Form ---
    return (
        <div className="fup-container">
            {/* ===== Header (matching PublicPeserta) ===== */}
            <header className="pp-hero">
                <div className="pp-hero-inner">
                    <div className="pp-hero-brand">
                        <img src={logoSrc} alt="Logo" />
                        <div>
                            <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                            <p>Formulir — {publicSettings?.levelName || levelSlug}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link to="/formulir" className="pp-theme-btn" title="Kembali" style={{ textDecoration: 'none' }}>
                            <ArrowLeft style={{ width: '18px', height: '18px' }} />
                        </Link>
                        <button onClick={toggle} className="pp-theme-btn" aria-label="Toggle theme">
                            {dark ? <Sun key="sun" className="theme-icon-anim" size={18} /> : <Moon key="moon" className="theme-icon-anim" size={18} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* ===== Content ===== */}
            <main className="fup-main">
                <div className="fup-page-header">
                    <h2 className="fup-page-title">Lengkapi Profil Anda</h2>
                    <p className="fup-page-subtitle">Pilih nama Anda dan perbarui informasi data diri terbaru.</p>
                    <p className="fup-page-subtitle" style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
                        *(Jika data form yang terdapat logo pensil/edit sudah sesuai maka tidak perlu diedit)
                    </p>
                </div>

                <div className="fup-notice">
                    <div className="fup-notice-icon">
                        <AlertCircle size={20} />
                    </div>
                    <div className="fup-notice-body">
                        <p><strong>Mohon diisi dengan cermat dan teliti.</strong></p>
                        <p>Mohon diisi selengkap mungkin karena sebagai database kami <strong>SPORTUNYS</strong>, <strong>LP2O LANKOR</strong> dan <strong>ICCA</strong>.</p>
                        <p>Jika ada pertanyaan atau kendala hubungi Admin (<a href="https://wa.me/6285786018422" target="_blank" rel="noopener noreferrer">+6285786018422</a>)</p>
                        <p className="fup-notice-footer">Terima Kasih,<br />Salam Olahraga!! 💪</p>
                    </div>
                </div>

                <form onSubmit={handleClickKirim}>
                    {/* ===== Section 1: Pencarian Peserta ===== */}
                    <div className="fup-card">
                        <div className="fup-card-header">
                            <div className="fup-card-header-icon blue">
                                <Search size={16} />
                            </div>
                            <h3 className="fup-card-title">Form Peserta</h3>
                        </div>
                        <div className="fup-card-body">
                            {/* Name Search */}
                            <div className="fup-search-block">
                                <label className="fup-field-label">
                                    Pilih Nama Peserta <span className="fup-required">*</span>
                                </label>
                                <div className="fup-input-wrapper">
                                    <Search className="fup-input-icon" size={18} />
                                    <input
                                        type="text"
                                        className="fup-input fup-input-with-icon"
                                        placeholder="Ketik nama Anda di sini..."
                                        value={searchNama}
                                        onChange={(e) => { setSearchNama(e.target.value); setShowDropdown(true); setSelectedPeserta(null); }}
                                        onFocus={() => setShowDropdown(true)}
                                    />
                                </div>

                                {showDropdown && filteredNames.length > 0 && !selectedPeserta && (
                                    <div className="fup-dropdown">
                                        {filteredNames.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleSelectPeserta(p)}
                                                className="fup-dropdown-item"
                                            >
                                                <p className="fup-dropdown-item-name">
                                                    {formatString(p.nama, textFormat)}
                                                </p>
                                                {p.cabor && (
                                                    <span className="badge badge-blue" style={{ fontSize: '10px', marginTop: '4px' }}>{p.cabor}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ===== Section 2: Data Pribadi ===== */}
                    {selectedPeserta && (
                        <>
                            <div className="fup-card fup-animate-in">
                                <div className="fup-card-header">
                                    <div className="fup-card-header-icon blue">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <h3 className="fup-card-title">Data Pribadi</h3>
                                        <p className="fup-card-desc">Informasi dasar tentang diri Anda</p>
                                    </div>
                                </div>
                                <div className="fup-card-body">
                                    <div className="fup-autofill-section">
                                        <EditableReadOnlyField
                                            label="Nama Lengkap"
                                            fieldKey="nama"
                                            value={selectedPeserta.nama}
                                            editOverrides={editOverrides}
                                            editingField={editingField}
                                            onStartEdit={startEdit}
                                            onUpdate={updateOverride}
                                            onCancel={cancelEdit}
                                        />
                                        <div className="fup-grid-2" style={{ marginTop: '16px' }}>
                                            <div className="fup-full-span">
                                                <EditableReadOnlyField
                                                    label="Tempat, Tanggal Lahir"
                                                    fieldKey="ttl"
                                                    value={selectedPeserta.ttl}
                                                    editOverrides={editOverrides}
                                                    editingField={editingField}
                                                    onStartEdit={startEdit}
                                                    onUpdate={updateOverride}
                                                    onCancel={cancelEdit}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="fup-grid-2" style={{ marginTop: '16px' }}>
                                            <EditableReadOnlyField
                                                label="Cabang Olahraga"
                                                fieldKey="cabor"
                                                value={selectedPeserta.cabor}
                                                editOverrides={editOverrides}
                                                editingField={editingField}
                                                onStartEdit={startEdit}
                                                onUpdate={updateOverride}
                                                onCancel={cancelEdit}
                                            />
                                            <EditableReadOnlyField
                                                label="Asal Provinsi"
                                                fieldKey="provinsi"
                                                value={selectedPeserta.provinsi}
                                                editOverrides={editOverrides}
                                                editingField={editingField}
                                                onStartEdit={startEdit}
                                                onUpdate={updateOverride}
                                                onCancel={cancelEdit}
                                            />
                                        </div>

                                        <div style={{ marginTop: '16px' }}>
                                            <EditableReadOnlyField
                                                label="Alamat Tempat Tinggal"
                                                fieldKey="alamat"
                                                value={selectedPeserta.alamat}
                                                editOverrides={editOverrides}
                                                editingField={editingField}
                                                onStartEdit={startEdit}
                                                onUpdate={updateOverride}
                                                onCancel={cancelEdit}
                                                isTextarea
                                                required
                                            />
                                        </div>

                                        {selectedPeserta.level?.includes('2') && (
                                            <div style={{ marginTop: '16px' }}>
                                                <EditableReadOnlyField
                                                    label="No Sertifikat Lv. 1"
                                                    fieldKey="nomerSertifikatLevel1"
                                                    value={selectedPeserta.nomerSertifikatLevel1}
                                                    editOverrides={editOverrides}
                                                    editingField={editingField}
                                                    onStartEdit={startEdit}
                                                    onUpdate={updateOverride}
                                                    onCancel={cancelEdit}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="fup-section-fields" style={{ marginTop: '20px' }}>
                                        <div>
                                            <EditableReadOnlyField
                                                label="Jenis Kelamin"
                                                fieldKey="jenisKelamin"
                                                value={selectedPeserta.jenisKelamin}
                                                editOverrides={editOverrides}
                                                editingField={editingField}
                                                onStartEdit={startEdit}
                                                onUpdate={updateOverride}
                                                onCancel={cancelEdit}
                                                selectOptions={['Laki-laki', 'Perempuan']}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <h4 className="fup-question-title">
                                                Pekerjaan Saat Ini <span className="fup-required">*</span>
                                            </h4>
                                            <input
                                                type="text"
                                                className="fup-input"
                                                placeholder="Cth: Pegawai, Pelatih, dll..."
                                                value={form.pekerjaan}
                                                onChange={e => updateForm('pekerjaan', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ===== Section 3: Riwayat Pendidikan (hidden for Level 2) ===== */}
                            {!isLevel2 && (
                            <div className="fup-card fup-animate-in">
                                <div className="fup-card-header">
                                    <div className="fup-card-header-icon gradient">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <h3 className="fup-card-title">Riwayat Pendidikan</h3>
                                        <p className="fup-card-desc">Latar belakang pendidikan & sertifikasi</p>
                                    </div>
                                </div>
                                <div className="fup-card-body">
                                    <div className="fup-section-fields">
                                        <div>
                                            <h4 className="fup-question-title">
                                                Pendidikan Terakhir <span className="fup-required">*</span>
                                            </h4>
                                            <div className="fup-radio-group">
                                                {PENDIDIKAN_OPTIONS.map(p => (
                                                    <button
                                                        key={p} type="button"
                                                        className={`fup-radio-btn ${form.pendidikan === p ? 'selected' : ''}`}
                                                        onClick={() => updateForm('pendidikan', p)}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="fup-question-title">
                                                Apakah Anda berlatar pendidikan olahraga? <span className="fup-required">*</span>
                                            </h4>
                                            <div className="fup-radio-group">
                                                {['Ya', 'Tidak'].map(v => (
                                                    <button key={v} type="button"
                                                        className={`fup-radio-btn ${form.latarPendidikanOlahraga === v ? 'selected' : ''}`}
                                                        onClick={() => updateForm('latarPendidikanOlahraga', v)}
                                                    >{v}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="fup-question-title">
                                                Apakah Anda memiliki sertifikat pelatih? <span className="fup-required">*</span>
                                            </h4>
                                            <div className="fup-radio-group">
                                                {['Ya', 'Tidak'].map(v => (
                                                    <button key={v} type="button"
                                                        className={`fup-radio-btn ${form.sertifikatPelatih === v ? 'selected' : ''}`}
                                                        onClick={() => updateForm('sertifikatPelatih', v)}
                                                    >{v}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="fup-question-title">
                                                Apakah Anda khusus pelatih fisik? <span className="fup-required">*</span>
                                            </h4>
                                            <div className="fup-radio-group">
                                                {['Ya', 'Tidak'].map(v => (
                                                    <button key={v} type="button"
                                                        className={`fup-radio-btn ${form.khususPelatihFisik === v ? 'selected' : ''}`}
                                                        onClick={() => updateForm('khususPelatihFisik', v)}
                                                    >{v}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* ===== Section 4: Pengalaman Kepelatihan ===== */}
                            <div className="fup-card fup-animate-in">
                                <div className="fup-card-header">
                                    <div className="fup-card-header-icon blue">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <h3 className="fup-card-title">Pengalaman Kepelatihan</h3>
                                        <p className="fup-card-desc">Pengalaman & tempat kerja Anda</p>
                                    </div>
                                </div>
                                <div className="fup-card-body">
                                    <div className="fup-section-fields">
                                        {/* Level 2 specific fields */}
                                        {isLevel2 && (
                                            <>
                                                <div>
                                                    <h4 className="fup-question-title">
                                                        Pelatihan Level I dilakukan di mana & Tahun? <span className="fup-required">*</span>
                                                    </h4>
                                                    <input
                                                        type="text"
                                                        className="fup-input"
                                                        placeholder="Cth: Jakarta, 2024"
                                                        value={form.pelatihanLevel1DiManaTahun}
                                                        onChange={e => updateForm('pelatihanLevel1DiManaTahun', e.target.value)}
                                                    />
                                                </div>

                                                <div>
                                                    <h4 className="fup-question-title">
                                                        Pekerjaan Pelatih Fisik setelah Level I <span className="fup-required">*</span>
                                                    </h4>
                                                    <input
                                                        type="text"
                                                        className="fup-input"
                                                        placeholder="Cth: Pelatih Fisik di Klub XYZ"
                                                        value={form.pekerjaanSetelahLevel1}
                                                        onChange={e => updateForm('pekerjaanSetelahLevel1', e.target.value)}
                                                    />
                                                </div>

                                                <div>
                                                    <h4 className="fup-question-title">
                                                        Pengalaman melatih Fisik <span className="fup-required">*</span>
                                                    </h4>
                                                    <div className="fup-radio-group">
                                                        {PENGALAMAN_MELATIH_FISIK_OPTIONS.map(p => (
                                                            <button
                                                                key={p} type="button"
                                                                className={`fup-radio-btn ${form.pengalamanMelatihFisik === p ? 'selected' : ''}`}
                                                                onClick={() => updateForm('pengalamanMelatihFisik', form.pengalamanMelatihFisik === p ? '' : p)}
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="fup-question-title">
                                                        Level Melatih Fisik <span className="fup-required">*</span>
                                                    </h4>
                                                    <div className="fup-radio-group">
                                                        {LEVEL_MELATIH_FISIK_OPTIONS.map(l => (
                                                            <button
                                                                key={l} type="button"
                                                                className={`fup-radio-btn ${form.levelMelatihFisik === l ? 'selected' : ''}`}
                                                                onClick={() => updateForm('levelMelatihFisik', form.levelMelatihFisik === l ? '' : l)}
                                                            >
                                                                {l}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div>
                                            <div className="fup-label-row">
                                                <h4 className="fup-question-title">Pengalaman Melatih</h4>
                                                <span className="fup-optional-badge">Opsional</span>
                                            </div>
                                            <div className="fup-radio-group">
                                                {PENGALAMAN_OPTIONS.map(p => (
                                                    <button
                                                        key={p} type="button"
                                                        className={`fup-radio-btn ${form.pengalamanMelatih === p ? 'selected' : ''}`}
                                                        onClick={() => updateForm('pengalamanMelatih', form.pengalamanMelatih === p ? '' : p)}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="fup-label-row">
                                                <h4 className="fup-question-title">Level Kepelatihan</h4>
                                                <span className="fup-optional-badge">Opsional</span>
                                            </div>
                                            <div className="fup-radio-group">
                                                {LEVEL_KEPELATIHAN_OPTIONS.map(l => (
                                                    <button
                                                        key={l} type="button"
                                                        className={`fup-radio-btn ${form.levelKepelatihan === l ? 'selected' : ''}`}
                                                        onClick={() => updateForm('levelKepelatihan', form.levelKepelatihan === l ? '' : l)}
                                                    >
                                                        {l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bekerja sebagai pelatih di (hidden for Level 2) */}
                                        {!isLevel2 && (
                                        <div>
                                            <div className="fup-label-row">
                                                <h4 className="fup-question-title">Bekerja sebagai pelatih di</h4>
                                                <span className="fup-optional-badge">Opsional</span>
                                            </div>
                                            <div className="fup-checkbox-col">
                                                {TEMPAT_KERJA_OPTIONS.map(t => {
                                                    const checked = form.tempatKerja.includes(t);
                                                    return (
                                                        <div
                                                            key={t}
                                                            className={`fup-checkbox-btn ${checked ? 'checked' : ''}`}
                                                            onClick={() => toggleTempatKerja(t)}
                                                        >
                                                            <div className="fup-checkbox-icon">
                                                                {checked && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                            <span>{t}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <input
                                                type="text"
                                                className="fup-input"
                                                placeholder="Tuliskan di sini jika ada yang lain..."
                                                value={form.tempatKerjaLain}
                                                onChange={e => updateForm('tempatKerjaLain', e.target.value)}
                                                style={{ marginTop: '12px' }}
                                            />
                                        </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ===== Section 5: Upload Foto (hidden for Level 2) ===== */}
                            {!isLevel2 && (
                            <div className="fup-card fup-animate-in">
                                <div className="fup-card-header">
                                    <div className="fup-card-header-icon blue">
                                        <Upload size={16} />
                                    </div>
                                    <div>
                                        <h3 className="fup-card-title">Pas Foto <span className="fup-required">*</span></h3>
                                        <p className="fup-card-desc">Upload foto selfie atau formal</p>
                                    </div>
                                </div>
                                <div className="fup-card-body">
                                    {/* Contoh Pas Foto */}
                                    <div className="fup-example-photo">
                                        <img
                                            src="/img/contoh pas foto.png"
                                            alt="Contoh Pas Foto"
                                            className="fup-example-photo-img"
                                        />
                                    </div>

                                    <div
                                        className={`fup-upload-area ${form.fotoFile ? 'active' : ''}`}
                                        onClick={() => document.getElementById('foto-upload').click()}
                                    >
                                        {form.fotoFile ? (
                                            <div className="fup-animate-in" style={{ textAlign: 'center' }}>
                                                <div className="fup-upload-icon-wrap success">
                                                    <Check size={28} />
                                                </div>
                                                <p className="fup-upload-filename">{form.fotoFile.name}</p>
                                                <span className="fup-upload-size">
                                                    {(form.fotoFile.size / 1024 / 1024).toFixed(2)} MB — Klik untuk ganti
                                                </span>
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="fup-upload-icon-wrap default">
                                                    <Upload size={24} />
                                                </div>
                                                <p className="fup-upload-title">Upload Pas Foto Anda</p>
                                                <p className="fup-upload-subtitle">Maksimal 1MB</p>
                                                <span className="fup-upload-format">Format JPG, PNG</span>
                                            </div>
                                        )}
                                        <input id="foto-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                                    </div>
                                </div>
                            </div>
                            )}
                        </>
                    )}

                    {/* ===== Section: Tanda Tangan (Level 2 only) ===== */}
                    {selectedPeserta && isLevel2 && (
                        <div className="fup-card fup-animate-in">
                            <div className="fup-card-header">
                                <div className="fup-card-header-icon blue">
                                    <PenTool size={16} />
                                </div>
                                <div>
                                    <h3 className="fup-card-title">Tanda Tangan <span className="fup-required">*</span></h3>
                                    <p className="fup-card-desc">Buat tanda tangan Anda di kolom bawah ini</p>
                                </div>
                            </div>
                            <div className="fup-card-body">
                                <div style={{
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '8px',
                                    background: 'var(--bg-input)',
                                    position: 'relative',
                                }}>
                                    <canvas
                                        ref={signatureCanvasRef}
                                        width={600}
                                        height={200}
                                        style={{
                                            width: '100%',
                                            height: '180px',
                                            cursor: 'crosshair',
                                            touchAction: 'none',
                                            borderRadius: '8px',
                                            display: 'block',
                                        }}
                                        onMouseDown={handleSignatureStart}
                                        onMouseMove={handleSignatureMove}
                                        onMouseUp={handleSignatureEnd}
                                        onMouseLeave={handleSignatureEnd}
                                        onTouchStart={handleSignatureStart}
                                        onTouchMove={handleSignatureMove}
                                        onTouchEnd={handleSignatureEnd}
                                    />
                                    {!signatureData && (
                                        <div style={{
                                            position: 'absolute', top: '50%', left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            pointerEvents: 'none',
                                            color: 'var(--text-muted)',
                                            fontSize: '14px', fontWeight: 500,
                                            textAlign: 'center', opacity: 0.6,
                                        }}>
                                            <PenTool size={24} style={{ marginBottom: '6px', opacity: 0.4 }} />
                                            <p>Gambar tanda tangan Anda di sini</p>
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    display: 'flex', gap: '8px', marginTop: '10px',
                                    justifyContent: 'flex-end',
                                }}>
                                    <button
                                        type="button"
                                        onClick={undoSignature}
                                        disabled={signatureStrokes.length === 0}
                                        style={{
                                            padding: '6px 14px', borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600,
                                            cursor: signatureStrokes.length === 0 ? 'not-allowed' : 'pointer',
                                            opacity: signatureStrokes.length === 0 ? 0.5 : 1,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        Undo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearSignature}
                                        disabled={signatureStrokes.length === 0}
                                        style={{
                                            padding: '6px 14px', borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--accent-rose, #e53e3e)',
                                            fontSize: '12px', fontWeight: 600,
                                            cursor: signatureStrokes.length === 0 ? 'not-allowed' : 'pointer',
                                            opacity: signatureStrokes.length === 0 ? 0.5 : 1,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        Hapus Semua
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== Confirmation & Submit ===== */}
                    {selectedPeserta && (
                        <div className="fup-submit-section">
                            <div
                                className={`fup-confirm-check ${confirmed ? 'checked' : ''}`}
                                onClick={() => setConfirmed(!confirmed)}
                            >
                                <div className="fup-confirm-checkbox">
                                    {confirmed && <Check size={14} strokeWidth={3} />}
                                </div>
                                <span>Saya menyatakan bahwa data di atas sudah sesuai dan benar.</span>
                            </div>
                            {alreadySubmitted && (
                                <div className="fup-notice" style={{ marginBottom: '16px', borderColor: 'var(--color-error, #e53e3e)' }}>
                                    <div className="fup-notice-icon" style={{ color: 'var(--color-error, #e53e3e)' }}>
                                        <AlertCircle size={20} />
                                    </div>
                                    <div className="fup-notice-body">
                                        <p><strong>Anda sudah pernah mengirim formulir ini.</strong></p>
                                        <p>Jika ada kendala atau perubahan data, silakan hubungi Admin (<a href="https://wa.me/6285786018422" target="_blank" rel="noopener noreferrer">+6285786018422</a>)</p>
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleClickKirim}
                                disabled={submitting || !confirmed || alreadySubmitted}
                                className="fup-submit-btn"
                            >
                                <Send size={18} />
                                <span>{alreadySubmitted ? 'Sudah Terkirim' : submitting ? 'Sedang Memproses...' : 'Kirim'}</span>
                            </button>
                            <p className="fup-security-note">
                                <Lock size={14} />
                                Data Anda dilindungi dan dienkripsi.
                            </p>
                        </div>
                    )}
                </form>
            </main>

            {/* ===== WA Verification Modal ===== */}
            {
                showVerifyWa && (
                    <div className="modal-overlay" onClick={() => { setShowVerifyWa(false); setVerifyError(''); setVerifyWaInput(''); setVerifyAttempts(0); }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                            <button onClick={() => { setShowVerifyWa(false); setVerifyError(''); setVerifyWaInput(''); setVerifyAttempts(0); }} className="fup-modal-close">
                                <X size={16} />
                            </button>

                            <div className="fup-modal-icon amber">
                                <Lock size={28} />
                            </div>
                            <h3 className="fup-modal-title">Verifikasi Identitas</h3>
                            <p className="fup-modal-desc">
                                Masukkan <strong>3 digit terakhir WhatsApp</strong> Anda untuk memvalidasi pengiriman.
                            </p>

                            <div className="fup-modal-input-wrap">
                                <input
                                    type="text"
                                    className="fup-wa-input"
                                    placeholder="---"
                                    maxLength={3}
                                    value={verifyWaInput}
                                    onChange={(e) => { setVerifyWaInput(e.target.value.replace(/\D/g, '')); setVerifyError(''); }}
                                    autoFocus
                                />
                                {verifyAttempts > 0 && !verifyError && (
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                                        Percobaan ke-{verifyAttempts} dari 3
                                    </p>
                                )}
                                {verifyError && (
                                    <div style={{ marginTop: '12px' }}>
                                        <div className="fup-modal-error">
                                            <AlertCircle size={16} />
                                            {verifyError}
                                        </div>
                                        {verifyAttempts >= 3 && (
                                            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', marginTop: '14px', textAlign: 'center' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>Ada kendala? Hubungi admin:</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <a
                                                        href="https://wa.me/6285786018422?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20verifikasi%20formulir."
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="pp-wa-btn"
                                                    >
                                                        <MessageCircle style={{ width: '15px', height: '15px' }} />
                                                        085786018422
                                                    </a>
                                                    <a
                                                        href="https://wa.me/6285270033705?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20verifikasi%20formulir."
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="pp-wa-btn"
                                                    >
                                                        <MessageCircle style={{ width: '15px', height: '15px' }} />
                                                        085270033705
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="fup-modal-actions">
                                <button onClick={handleVerifyAndSubmit} className="fup-modal-btn-primary">
                                    Lanjut Kirim
                                </button>
                                <button onClick={() => { setShowVerifyWa(false); setVerifyError(''); setVerifyWaInput(''); setVerifyAttempts(0); }} className="fup-modal-btn-ghost">
                                    Batal
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ===== Toast ===== */}
            {
                toast && (
                    <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                        {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                        {toast.message}
                    </div>
                )
            }
        </div >
    );
}

// ===== Sub-Components =====

function ReadOnlyField({ label, value }) {
    return (
        <div>
            <label className="fup-field-label">{label}</label>
            <div className="fup-read-only-field">
                {value || '-'}
            </div>
        </div>
    );
}

function EditableReadOnlyField({ label, fieldKey, value, editOverrides, editingField, onStartEdit, onUpdate, onCancel, isTextarea, selectOptions, required }) {
    const isEditing = editOverrides[fieldKey] !== undefined;
    const isActive = editingField === fieldKey;
    const editedVal = editOverrides[fieldKey];
    const hasChanged = isEditing && editedVal !== (value || '');

    if (isEditing) {
        return (
            <div>
                <label className="fup-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {label} {required && <span className="fup-required">*</span>}
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-amber)', background: 'var(--accent-amber-light)', padding: '1px 6px', borderRadius: '4px' }}>Koreksi</span>
                </label>
                <div style={{ position: 'relative' }}>
                    {selectOptions ? (
                        <div className="fup-radio-group" style={{ marginTop: '4px' }}>
                            {selectOptions.map(opt => (
                                <button
                                    key={opt} type="button"
                                    className={`fup-radio-btn ${editedVal === opt ? 'selected' : ''}`}
                                    onClick={() => onUpdate(fieldKey, opt)}
                                    style={{ borderColor: editedVal === opt && hasChanged ? 'var(--accent-emerald)' : undefined }}
                                >
                                    {opt}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => onCancel(fieldKey)}
                                className="fup-radio-btn"
                                style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '12px' }}
                                title="Batalkan koreksi"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : isTextarea ? (
                        <textarea
                            className="fup-input fup-textarea"
                            value={editedVal}
                            onChange={e => onUpdate(fieldKey, e.target.value)}
                            autoFocus={isActive}
                            style={{ borderColor: hasChanged ? 'var(--accent-emerald)' : undefined }}
                        />
                    ) : (
                        <input
                            type="text"
                            className="fup-input"
                            value={editedVal}
                            onChange={e => onUpdate(fieldKey, e.target.value)}
                            autoFocus={isActive}
                            style={{ borderColor: hasChanged ? 'var(--accent-emerald)' : undefined, paddingRight: '36px' }}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => onCancel(fieldKey)}
                        style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        }}
                        title="Batalkan koreksi"
                    >
                        <X size={14} />
                    </button>
                </div>
                {hasChanged && (
                    <p style={{ fontSize: '11px', color: 'var(--accent-emerald)', marginTop: '4px', fontWeight: 600 }}>
                        ✓ Koreksi akan diajukan sebagai saran edit
                    </p>
                )}
            </div>
        );
    }

    return (
        <div>
            <label className="fup-field-label">
                {label} {required && <span className="fup-required">*</span>}
            </label>
            <div className="fup-read-only-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: (!value || value === '-') && required ? 'var(--accent-rose)' : 'inherit' }}>
                    {value && value !== '-' ? value : '(Wajib Pilih)'}
                </span>
                <button
                    type="button"
                    onClick={() => onStartEdit(fieldKey, value)}
                    style={{
                        background: 'var(--accent-blue-light)', border: 'none', borderRadius: '6px',
                        cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center',
                        gap: '4px', color: 'var(--accent-blue)', fontSize: '11px', fontWeight: 600,
                        flexShrink: 0, transition: 'all 0.15s',
                    }}
                    title="Ajukan koreksi data ini"
                >
                    <Edit3 size={12} />
                </button>
            </div>
        </div>
    );
}

function YesNoField({ label, value, onChange, required }) {
    return (
        <div className="fup-yesno-card">
            <label className="fup-field-label">
                {label} {required && <span className="fup-required">*</span>}
            </label>
            <div className="fup-radio-group">
                <button
                    type="button"
                    className={`fup-radio-btn ${value === 'Ya' ? 'selected' : ''}`}
                    onClick={() => onChange('Ya')}
                >
                    Ya
                </button>
                <button
                    type="button"
                    className={`fup-radio-btn ${value === 'Tidak' ? 'selected' : ''}`}
                    onClick={() => onChange('Tidak')}
                >
                    Tidak
                </button>
            </div>
        </div>
    );
}
