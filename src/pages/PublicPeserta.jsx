import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { addEditSuggestion } from '../utils/storage';
import { sanitizeFormData } from '../utils/inputValidation';
import { canSubmit, getCooldownRemaining } from '../utils/rateLimit';
import { usePublicData } from '../utils/usePublicData';
import { formatString } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { Link, useParams } from 'react-router-dom';
import {
    Calendar, ChevronRight, Clock, Users, MapPin, Dumbbell, Award, GraduationCap, X, ChevronDown, Check, Phone, Filter, ArrowUpDown, FileSpreadsheet, Printer, ArrowLeft, Sun, Moon, Edit3, MessageCircle, AlertCircle, Lock, Monitor, Smartphone, Briefcase, Flag, Mail, Save, FileText, LayoutTemplate, UserCircle, RefreshCcw, Search, ChevronUp, ChevronLeft, CalendarDays, Key, Map, Layers, Type, CreditCard, Banknote, HelpCircle, Activity, Globe, Info, Target, Cpu, Download, Box, PlusCircle, Star, PenTool, Hash, Layout, Share2, MousePointer, Smile, Cpu as CpuIcon, Code, Eye, Anchor, Shirt
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CustomSelect from '../components/CustomSelect';
import './PublicPeserta.css';
import XLSX from 'xlsx-js-style';
import { isLevelArchived } from '../utils/dateUtils';

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];

const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => CURRENT_YEAR - i);

const kepesertaanBadge = {
    'Terdaftar': 'badge-emerald',
    'Konfirmasi': 'badge-amber',
    'Batal': 'badge-rose',
};

const statusColorMap = {
    'Terdaftar': 'status-terdaftar',
    'Konfirmasi': 'status-konfirmasi',
    'Batal': 'status-batal',
};

const BULAN_MAP = {
    'januari': 0, 'februari': 1, 'maret': 2, 'april': 3,
    'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7,
    'september': 8, 'oktober': 9, 'november': 10, 'desember': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,
    'jun': 5, 'jul': 6, 'ags': 7, 'aug': 7, 'sep': 8, 'okt': 9, 'nop': 10, 'nov': 10, 'des': 11, 'dec': 11,
};

function parseFlexibleDate(str) {
    if (!str) return null;
    const s = str.trim();
    const numericMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (numericMatch) {
        const d = parseInt(numericMatch[1], 10);
        const m = parseInt(numericMatch[2], 10) - 1;
        const y = parseInt(numericMatch[3], 10);
        if (m >= 0 && m <= 11 && d >= 1 && d <= 31) return new Date(y, m, d);
    }
    const indoMatch = s.match(/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})$/);
    if (indoMatch) {
        const d = parseInt(indoMatch[1], 10);
        const monthKey = indoMatch[2].toLowerCase();
        const y = parseInt(indoMatch[3], 10);
        const m = BULAN_MAP[monthKey];
        if (m !== undefined && d >= 1 && d <= 31) return new Date(y, m, d);
    }
    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
}

export default function PublicPeserta() {
    const { levelSlug } = useParams();

    const { peserta, levels, settings, publicSettings, notFound } = usePublicData({ levelSlug });
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('nama-az');
    const [viewData, setViewData] = useState(null);
    const [showVerifyModal, setShowVerifyModal] = useState(null);
    const [verifyWaInput, setVerifyWaInput] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [verifyAttempts, setVerifyAttempts] = useState(0);
    const [editForm, setEditForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [sortOpen, setSortOpen] = useState(false);
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [sizeOpen, setSizeOpen] = useState(false);
    const sortRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { dark, toggle } = useTheme();
    const textFormat = 'upper';

    const getKepesertaanStatus = (p) => {
        if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') return 'Terdaftar';
        return p.statusKepesertaan || 'Konfirmasi';
    };

    const handleVerifyNext = () => {
        const p = publishedPeserta.find(item => item.id === showVerifyModal);
        if (!p) return;
        const waClean = (p.wa || '').replace(/\D/g, '');
        const last3 = waClean.slice(-3);
        if (!waClean || waClean.length < 3) {
            setVerifyError('Nomor WhatsApp peserta tidak valid untuk verifikasi.');
            return;
        }
        if (verifyWaInput === last3) {
            setVerifyError('');
            setShowVerifyModal(null);
            setVerifyWaInput('');
            setVerifyAttempts(0);
            const ttlParts = (p.ttl || '').split(',');
            const tempatLahir = ttlParts.length > 1 ? ttlParts[0].trim() : '';
            const tanggalStr = ttlParts.length > 1 ? ttlParts.slice(1).join(',').trim() : (p.ttl || '').trim();
            let tanggalLahirDate = null;
            if (tanggalStr) tanggalLahirDate = parseFlexibleDate(tanggalStr);
            setEditForm({ ...p, tempatLahir, tanggalLahirDate });
        } else {
            setVerifyAttempts(prev => prev + 1);
            setVerifyError('3 digit nomor WhatsApp salah.');
        }
    };

    const formatTanggalIndo = (date) => {
        if (!date) return '';
        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${date.getDate()} ${bulanIndo[date.getMonth()]} ${date.getFullYear()}`;
    };

    const handleEditFormSubmit = async () => {
        if (!canSubmit('editSuggestion_' + editForm.id)) {
            const remaining = getCooldownRemaining('editSuggestion_' + editForm.id);
            setToast({ message: `Harap tunggu ${remaining} detik sebelum mengirim lagi.`, type: 'error' });
            setTimeout(() => setToast(null), 4000);
            return;
        }
        setSaving(true);
        const dateStr = editForm.tanggalLahirDate ? formatTanggalIndo(editForm.tanggalLahirDate) : '';
        const ttlFinal = [editForm.tempatLahir, dateStr].filter(Boolean).join(', ');
        const dataBaru = sanitizeFormData({ ...editForm, ttl: ttlFinal });
        delete dataBaru.tempatLahir;
        delete dataBaru.tanggalLahirDate;
        const suggestion = {
            pesertaId: editForm.id,
            dataLama: viewData || publishedPeserta.find(p => p.id === editForm.id),
            dataBaru,
        };
        const ok = await addEditSuggestion(suggestion);
        setSaving(false);
        if (ok) {
            setEditForm(null);
            setViewData(null);
            setToast({ message: 'Saran edit berhasil dikirim, menunggu persetujuan admin.', type: 'success' });
            setTimeout(() => setToast(null), 4000);
        } else {
            setToast({ message: 'Gagal mengirim saran edit.', type: 'error' });
            setTimeout(() => setToast(null), 4000);
        }
    };

    const publishedPeserta = useMemo(() => {
        if (!publicSettings) return [];
        const levelName = publicSettings.levelName;
        // Filter peserta by level
        let list = peserta.filter(p => p.level === levelName);
        if (!publicSettings.publishAll) {
            const publishedIds = new Set(publicSettings.publishedIds || []);
            list = list.filter(p => publishedIds.has(p.id));
        }
        // Hide archived & 'Batal' from public view
        return list.filter(p => !isLevelArchived(levels[p.level]) && p.statusKepesertaan !== 'Batal');
    }, [peserta, publicSettings, levels]);

    const filtered = useMemo(() => {
        let result = publishedPeserta.filter((p) => {
            const matchSearch = !search || p.nama?.toLowerCase().includes(search.toLowerCase()) || p.wa?.includes(search);
            return matchSearch;
        });

        result.sort((a, b) => {
            const statusOrder = { 'Terdaftar': 1, 'Konfirmasi': 2, 'Batal': 3 };
            const statusA = statusOrder[getKepesertaanStatus(a)] || 2;
            const statusB = statusOrder[getKepesertaanStatus(b)] || 2;
            if (statusA !== statusB) return statusA - statusB;

            switch (sortBy) {
                case 'nama-az': return (a.nama || '').localeCompare(b.nama || '');
                case 'nama-za': return (b.nama || '').localeCompare(a.nama || '');
                case 'terlama': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'terbaru':
                default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
        });

        return result;
    }, [publishedPeserta, search, sortBy]);

    const vc = publicSettings?.visibleColumns || {};

    // ===== Export Excel =====
    const handleExportExcel = useCallback(() => {
        if (!filtered.length) return;

        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
            fill: { fgColor: { rgb: '3B82F6' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'BFDBFE' } },
                bottom: { style: 'thin', color: { rgb: 'BFDBFE' } },
                left: { style: 'thin', color: { rgb: 'BFDBFE' } },
                right: { style: 'thin', color: { rgb: 'BFDBFE' } },
            },
        };
        const cellBase = {
            font: { sz: 11, name: 'Calibri', color: { rgb: '1E293B' } },
            alignment: { vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'E2E8F0' } },
            },
        };
        const cellCenter = { ...cellBase, alignment: { ...cellBase.alignment, horizontal: 'center' } };

        // Build dynamic columns based on visible settings
        const cols = [{ label: 'No', key: 'no', style: cellCenter, width: 5 }];
        cols.push({ label: 'Nama Lengkap', key: 'nama', style: cellBase, width: 30 });
        if (vc.wa) cols.push({ label: 'Nomor WA', key: 'wa', style: cellBase, width: 18 });
        if (vc.jenisKelamin) cols.push({ label: 'Jenis Kelamin', key: 'jk', style: cellCenter, width: 14 });
        if (vc.cabor) cols.push({ label: 'Cabang Olahraga', key: 'cabor', style: cellBase, width: 20 });
        if (vc.sizeBaju) cols.push({ label: 'Ukuran Baju', key: 'size', style: cellCenter, width: 12 });
        if (vc.lahir) cols.push({ label: 'TTL', key: 'ttl', style: cellBase, width: 28 });
        if (vc.provinsi) cols.push({ label: 'Provinsi', key: 'prov', style: cellBase, width: 18 });
        if (vc.kepesertaan) cols.push({ label: 'Status', key: 'status', style: cellCenter, width: 14 });
        if (vc.level) cols.push({ label: 'Level', key: 'level', style: cellCenter, width: 14 });
        if (vc.sertifikatLv1) cols.push({ label: 'No Sertifikat Lv. 1', key: 'sertLv1', style: cellBase, width: 22 });

        const headers = cols.map(c => c.label);
        const rows = filtered.map((p, i) => {
            const row = {};
            cols.forEach(c => {
                switch (c.key) {
                    case 'no': row[c.key] = i + 1; break;
                    case 'nama': row[c.key] = formatString(p.nama, textFormat) || ''; break;
                    case 'wa': row[c.key] = (p.wa || '').replace(/-/g, ''); break;
                    case 'jk': row[c.key] = p.jenisKelamin || '-'; break;
                    case 'cabor': row[c.key] = formatString(p.cabor, textFormat) || ''; break;
                    case 'size': row[c.key] = p.ukuranBaju || ''; break;
                    case 'ttl': row[c.key] = formatString(p.ttl, textFormat) || ''; break;
                    case 'prov': row[c.key] = formatString(p.provinsi, textFormat) || ''; break;
                    case 'status': row[c.key] = getKepesertaanStatus(p); break;
                    case 'level': row[c.key] = p.level || ''; break;
                    case 'sertLv1': row[c.key] = p.nomerSertifikatLevel1 || ''; break;
                    default: break;
                }
            });
            return cols.map(c => row[c.key]);
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        // Apply header styles
        cols.forEach((_, ci) => {
            const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
            if (ws[addr]) ws[addr].s = headerStyle;
        });
        // Apply cell styles and alternating row color
        rows.forEach((row, ri) => {
            cols.forEach((col, ci) => {
                const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
                if (ws[addr]) {
                    const base = { ...col.style };
                    if (ri % 2 === 1) base.fill = { fgColor: { rgb: 'F8FAFC' } };
                    ws[addr].s = base;
                }
            });
        });
        ws['!cols'] = cols.map(c => ({ wch: c.width }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Peserta');
        const levelName = publicSettings?.levelName || 'peserta';
        const ts = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `data_peserta_${levelName.replace(/\s+/g, '_')}_${ts}.xlsx`);
    }, [filtered, vc, publicSettings]);

    // ===== Print PDF =====
    const handlePrintPDF = useCallback(() => {
        if (!filtered.length) return;

        const cols = [{ label: 'No', key: 'no' }];
        cols.push({ label: 'Nama Lengkap', key: 'nama' });
        if (vc.wa) cols.push({ label: 'No. WA', key: 'wa' });
        if (vc.jenisKelamin) cols.push({ label: 'JK', key: 'jk' });
        if (vc.cabor) cols.push({ label: 'Cabor', key: 'cabor' });
        if (vc.sizeBaju) cols.push({ label: 'Size', key: 'size' });
        if (vc.lahir) cols.push({ label: 'TTL', key: 'ttl' });
        if (vc.provinsi) cols.push({ label: 'Provinsi', key: 'prov' });
        if (vc.kepesertaan) cols.push({ label: 'Status', key: 'status' });
        if (vc.level) cols.push({ label: 'Level', key: 'level' });
        if (vc.sertifikatLv1) cols.push({ label: 'Sertifikat Lv.1', key: 'sertLv1' });

        const levelName = publicSettings?.levelName || 'Peserta';
        const thCells = cols.map(c => `<th style="padding:8px 10px;background:#3b82f6;color:#fff;font-weight:700;font-size:11px;text-align:left;border-bottom:2px solid #2563eb;white-space:nowrap;">${c.label}</th>`).join('');
        const bodyRows = filtered.map((p, i) => {
            const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
            const getValue = (key) => {
                switch (key) {
                    case 'no': return i + 1;
                    case 'nama': return formatString(p.nama, textFormat) || '';
                    case 'wa': return (p.wa || '').replace(/-/g, '');
                    case 'jk': return p.jenisKelamin || '-';
                    case 'cabor': return formatString(p.cabor, textFormat) || '';
                    case 'size': return p.ukuranBaju || '';
                    case 'ttl': return formatString(p.ttl, textFormat) || '';
                    case 'prov': return formatString(p.provinsi, textFormat) || '';
                    case 'status': return getKepesertaanStatus(p);
                    case 'level': return p.level || '';
                    case 'sertLv1': return p.nomerSertifikatLevel1 || '';
                    default: return '';
                }
            };
            const tds = cols.map(c => `<td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#334155;">${getValue(c.key)}</td>`).join('');
            return `<tr style="background:${bg};">${tds}</tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><title>Data Peserta - ${levelName}</title>
<style>@page{size:landscape;margin:12mm;}body{font-family:Calibri,Arial,sans-serif;margin:0;padding:20px;}table{border-collapse:collapse;width:100%;}@media print{body{padding:0;}}</style>
</head><body>
<div style="margin-bottom:16px;">
<h2 style="margin:0 0 4px;font-size:16px;color:#1e293b;">Data Peserta — ${levelName}</h2>
<p style="margin:0;font-size:11px;color:#64748b;">Total: ${filtered.length} peserta &bull; Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</div>
<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 350);
    }, [filtered, vc, publicSettings]);

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    const stats = useMemo(() => ({
        total: publishedPeserta.length,
        terdaftar: publishedPeserta.filter(p => getKepesertaanStatus(p) === 'Terdaftar').length,
        konfirmasi: publishedPeserta.filter(p => getKepesertaanStatus(p) === 'Konfirmasi').length,
    }), [publishedPeserta]);

    if (!settings) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div className="login-spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    // Not found / not published
    if (notFound) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
                <header className="pp-hero">
                    <div className="pp-hero-inner">
                        <div className="pp-hero-brand">
                            <img src={logoSrc} alt="Logo" />
                            <div>
                                <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                                <p>Data Peserta Pelatihan</p>
                            </div>
                        </div>
                        <button onClick={toggle} className="pp-theme-btn">
                            {dark
                                ? <Sun key="sun" className="theme-icon-anim" style={{ width: '18px', height: '18px' }} />
                                : <Moon key="moon" className="theme-icon-anim" style={{ width: '18px', height: '18px' }} />
                            }
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
                        <Link to="/" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', borderRadius: '12px',
                            background: 'var(--accent-blue)', color: 'white',
                            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
                            transition: 'all 0.2s',
                        }}>
                            <ArrowLeft style={{ width: '16px', height: '16px' }} />
                            Kembali ke Beranda
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
            {/* Gradient Header */}
            <header className="pp-hero">
                <div className="pp-hero-inner">
                    <div className="pp-hero-brand">
                        <img src={logoSrc} alt="Logo" />
                        <div>
                            <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                            <p>Data Peserta — {publicSettings?.levelName || levelSlug}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link to="/" className="pp-theme-btn" title="Kembali" style={{ textDecoration: 'none' }}>
                            <ArrowLeft style={{ width: '18px', height: '18px' }} />
                        </Link>
                        <button onClick={toggle} className="pp-theme-btn">
                            {dark
                                ? <Sun key="sun" className="theme-icon-anim" style={{ width: '18px', height: '18px' }} />
                                : <Moon key="moon" className="theme-icon-anim" style={{ width: '18px', height: '18px' }} />
                            }
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="pp-content">

                {publishedPeserta.length === 0 ? (
                    <div className="pp-empty" style={{ marginTop: '24px' }}>
                        <div className="pp-empty-icon">
                            <Users style={{ width: '36px', height: '36px', color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Belum Ada Data Dipublikasikan
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                            Admin belum mempublikasikan data peserta untuk pelatihan ini.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Search */}
                        <div className="pp-search-section">
                            <div className="pp-search-row">
                                <div className="pp-search-input-wrap">
                                    <Search className="pp-search-icon" />
                                    <input
                                        type="text"
                                        className="pp-search-input"
                                        placeholder="Cari berdasarkan nama"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="pp-sort-wrap" ref={sortRef}>
                                    <button
                                        className={`pp-sort-trigger ${sortOpen ? 'open' : ''}`}
                                        onClick={() => setSortOpen(!sortOpen)}
                                    >
                                        <ArrowUpDown style={{ width: '14px', height: '14px' }} />
                                        <span>{sortBy === 'nama-az' ? 'Nama A-Z' : 'Nama Z-A'}</span>
                                        <ChevronDown style={{ width: '14px', height: '14px', transition: 'transform 0.2s', transform: sortOpen ? 'rotate(180deg)' : 'none' }} />
                                    </button>
                                    {sortOpen && (
                                        <div className="pp-sort-dropdown">
                                            {[{ value: 'nama-az', label: 'Nama A-Z' }, { value: 'nama-za', label: 'Nama Z-A' }].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    className={`pp-sort-option ${sortBy === opt.value ? 'active' : ''}`}
                                                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                                                >
                                                    {sortBy === opt.value && <Check style={{ width: '14px', height: '14px' }} />}
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="pp-export-btn pp-export-excel"
                                    onClick={handleExportExcel}
                                    title="Export Excel"
                                >
                                    <FileSpreadsheet style={{ width: '14px', height: '14px' }} />
                                    <span>Excel</span>
                                </button>
                                <button
                                    className="pp-export-btn pp-export-pdf"
                                    onClick={handlePrintPDF}
                                    title="Print PDF"
                                >
                                    <Printer style={{ width: '14px', height: '14px' }} />
                                    <span>PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Results Info */}
                        <div className="pp-results-info">
                            <span className="pp-results-count">
                                <Users style={{ width: '14px', height: '14px' }} />
                                {filtered.length} dari {publishedPeserta.length} peserta
                            </span>
                        </div>

                        {/* Peserta Cards */}
                        {filtered.length === 0 ? (
                            <div className="pp-empty">
                                <div className="pp-empty-icon">
                                    <Search style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }} />
                                </div>
                                <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Tidak ada data ditemukan
                                </p>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Coba ubah kata kunci pencarian
                                </p>
                            </div>
                        ) : (
                            <div className="pp-list">
                                {filtered.map((p, i) => {
                                    const status = getKepesertaanStatus(p);
                                    return (
                                        <div
                                            key={p.id}
                                            className={`pp-card ${statusColorMap[status] || ''}`}
                                            onClick={() => setViewData(p)}
                                        >
                                            <div className="pp-card-top">
                                                <div className="pp-card-number">{i + 1}</div>
                                                <div className="pp-card-name">
                                                    <h3>{formatString(p.nama, textFormat)}</h3>
                                                    <div className="pp-card-badges">
                                                        {vc.level && (
                                                            <span className="badge badge-blue" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                                {p.level}
                                                            </span>
                                                        )}
                                                        {vc.sizeBaju && p.ukuranBaju && (
                                                            <span className="badge badge-ghost" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                                {p.ukuranBaju}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="pp-card-arrow">
                                                    <ChevronRight />
                                                </div>
                                            </div>

                                            {/* Meta info row */}
                                            <div className="pp-card-meta">
                                                {vc.kepesertaan && (
                                                    <div className="pp-card-meta-item">
                                                        <span className={`badge ${kepesertaanBadge[status] || 'badge-ghost'}`} style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                            {status}
                                                        </span>
                                                    </div>
                                                )}
                                                {vc.jenisKelamin && p.jenisKelamin && (
                                                    <div className="pp-card-meta-item">
                                                        <span className={`badge ${p.jenisKelamin === 'Laki-laki' ? 'badge-blue' : p.jenisKelamin === 'Perempuan' ? 'badge-rose' : 'badge-ghost'}`} style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                            {p.jenisKelamin === 'Laki-laki' ? 'Laki-laki' : p.jenisKelamin === 'Perempuan' ? 'Perempuan' : '-'}
                                                        </span>
                                                    </div>
                                                )}
                                                {vc.provinsi && p.provinsi && (
                                                    <div className="pp-card-meta-item">
                                                        <MapPin />
                                                        <span>{formatString(p.provinsi, textFormat)}</span>
                                                    </div>
                                                )}
                                                {vc.wa && p.wa && (
                                                    <div className="pp-card-meta-item">
                                                        <Phone />
                                                        <span>{p.wa?.replace(/-/g, '')}</span>
                                                    </div>
                                                )}
                                                {vc.cabor && p.cabor && (
                                                    <div className="pp-card-meta-item">
                                                        <Dumbbell />
                                                        <span>{formatString(p.cabor, textFormat)}</span>
                                                    </div>
                                                )}
                                                {vc.lahir && p.ttl && (
                                                    <div className="pp-card-meta-item">
                                                        <Calendar />
                                                        <span>{formatString(p.ttl, textFormat)}</span>
                                                    </div>
                                                )}
                                                {vc.sertifikatLv1 && p.level?.includes('2') && p.nomerSertifikatLevel1 && (
                                                    <div className="pp-card-meta-item">
                                                        <Award />
                                                        <span>{p.nomerSertifikatLevel1}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ===== Detail Modal ===== */}
            {viewData && createPortal(
                <div className="modal-overlay" onClick={() => setViewData(null)}>
                    <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                        {/* Header with avatar */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div className="pp-detail-header">
                                <div className="pp-detail-avatar">
                                    {getInitials(viewData.nama)}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '6px' }}>
                                        {formatString(viewData.nama, textFormat)}
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {vc.level && <span className="badge badge-blue">{viewData.level}</span>}
                                        {vc.kepesertaan && (
                                            <span className={`badge ${kepesertaanBadge[getKepesertaanStatus(viewData)] || 'badge-ghost'}`} style={{ fontSize: '10px' }}>
                                                {getKepesertaanStatus(viewData)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setViewData(null)} style={{
                                background: 'var(--bg-input)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                color: 'var(--text-muted)', transition: 'all 0.2s'
                            }}>
                                <X style={{ width: '18px', height: '18px' }} />
                            </button>
                        </div>

                        {/* Detail Grid */}
                        <div className="pp-detail-grid">
                            {vc.jenisKelamin && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">Jenis Kelamin</div>
                                    <div className="pp-detail-item-value">{viewData.jenisKelamin || '-'}</div>
                                </div>
                            )}
                            {vc.wa && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">Nomor WhatsApp</div>
                                    <div className="pp-detail-item-value">{viewData.wa || '-'}</div>
                                </div>
                            )}
                            {vc.cabor && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">Cabang Olahraga</div>
                                    <div className="pp-detail-item-value">{formatString(viewData.cabor, textFormat) || '-'}</div>
                                </div>
                            )}
                            {vc.sizeBaju && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">Ukuran Baju</div>
                                    <div className="pp-detail-item-value">{viewData.ukuranBaju || '-'}</div>
                                </div>
                            )}
                            {vc.lahir && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">Tempat, Tanggal Lahir</div>
                                    <div className="pp-detail-item-value">{formatString(viewData.ttl, textFormat) || '-'}</div>
                                </div>
                            )}
                            {viewData.level?.includes('2') && vc.sertifikatLv1 && (
                                <div className="pp-detail-item">
                                    <div className="pp-detail-item-label">No Sertifikat Lv. 1</div>
                                    <div className="pp-detail-item-value">{viewData.nomerSertifikatLevel1 || '-'}</div>
                                </div>
                            )}
                            {(vc.alamat || vc.provinsi) && (
                                <div className="pp-detail-item pp-detail-full">
                                    <div className="pp-detail-item-label">Provinsi</div>
                                    <div className="pp-detail-item-value">
                                        {vc.alamat ? (formatString(viewData.alamat, textFormat) || '-') : ''}
                                        {vc.alamat && vc.provinsi && viewData.provinsi && (
                                            <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 700 }}>
                                                {formatString(viewData.provinsi, textFormat)}
                                            </span>
                                        )}
                                        {!vc.alamat && vc.provinsi && (
                                            <span>{formatString(viewData.provinsi, textFormat) || '-'}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {vc.level && (
                                <div className="pp-detail-training">
                                    <div className="pp-detail-item-label" style={{ color: 'var(--accent-blue)' }}>Pelatihan</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        <span className="badge badge-blue" style={{ fontSize: '12px', padding: '5px 12px' }}>{viewData.level}</span>
                                        {levels[viewData.level]?.tanggal && (
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {levels[viewData.level].tanggal}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setViewData(null)}
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== WA Verification Modal ===== */}
            {showVerifyModal && createPortal(
                <div className="modal-overlay" onClick={() => { setShowVerifyModal(null); setVerifyError(''); setVerifyWaInput(''); setVerifyAttempts(0); }}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent-amber-light), var(--accent-amber-border))', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Lock style={{ width: '26px', height: '26px' }} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Verifikasi Keamanan</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
                            Masukkan <b>3 digit terakhir nomor <span style={{ color: '#25D366' }}>WhatsApp</span></b> Anda yang terdaftar pada sistem.
                        </p>

                        <div style={{ marginBottom: '24px' }}>
                            <input
                                type="text"
                                className="pp-search-input"
                                placeholder="- - -"
                                maxLength={3}
                                value={verifyWaInput}
                                onChange={(e) => { setVerifyWaInput(e.target.value.replace(/\D/g, '')); setVerifyError(''); }}
                                style={{ textAlign: 'center', fontSize: '28px', letterSpacing: '10px', fontWeight: 800, padding: '16px' }}
                            />
                            {verifyAttempts > 0 && !verifyError && (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                                    Percobaan ke-{verifyAttempts} dari 3
                                </p>
                            )}
                            {verifyError && (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent-rose)', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
                                        <AlertCircle style={{ width: '14px', height: '14px' }} />
                                        {verifyError}
                                    </div>
                                    {verifyAttempts >= 3 && (
                                        <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>Ada kendala? Hubungi admin:</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <a
                                                    href="https://wa.me/6285786018422?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20verifikasi%20data%20peserta."
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="pp-wa-btn"
                                                >
                                                    <MessageCircle style={{ width: '15px', height: '15px' }} />
                                                    085786018422
                                                </a>
                                                <a
                                                    href="https://wa.me/6285270033705?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20verifikasi%20data%20peserta."
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

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => { setShowVerifyModal(null); setVerifyError(''); setVerifyWaInput(''); setVerifyAttempts(0); }} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Batal</button>
                            <button onClick={handleVerifyNext} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Verifikasi</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== Edit Form Modal ===== */}
            {editForm && createPortal(
                <div className="modal-overlay" onClick={() => !saving && setEditForm(null)}>
                    <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-blue-light), var(--accent-blue-border))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit3 style={{ width: '18px', height: '18px' }} />
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Suggest Edit Data</h3>
                            </div>
                            <button onClick={() => setEditForm(null)} disabled={saving} style={{
                                background: 'var(--bg-input)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)'
                            }}>
                                <X style={{ width: '18px', height: '18px' }} />
                            </button>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                            Perubahan ini bersifat pengajuan. Data Anda akan terupdate setelah diverifikasi oleh admin.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
                            <div>
                                <label className="form-label">Nama Lengkap</label>
                                <input type="text" className="input" value={editForm.nama} onChange={e => setEditForm({ ...editForm, nama: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div>
                                    <label className="form-label">Tempat Lahir</label>
                                    <input type="text" className="input" placeholder="Bandung" value={editForm.tempatLahir || ''} onChange={e => setEditForm({ ...editForm, tempatLahir: e.target.value })} />
                                </div>
                                <div className="mui-datepicker-container">
                                    <div className={`mui-datepicker-field${editForm.tanggalLahirDate ? ' has-value' : ''}`}>
                                        <label className="mui-datepicker-label">Tanggal Lahir</label>
                                        <DatePicker
                                            selected={editForm.tanggalLahirDate}
                                            onChange={(date) => setEditForm({ ...editForm, tanggalLahirDate: date })}
                                            dateFormat="dd/MM/yyyy"
                                            placeholderText="DD/MM/YYYY"
                                            className="mui-datepicker-input"
                                            maxDate={new Date()}
                                            isClearable
                                            portalId="root-portal"
                                            renderCustomHeader={({
                                                date,
                                                changeYear,
                                                changeMonth,
                                                decreaseMonth,
                                                increaseMonth,
                                                prevMonthButtonDisabled,
                                                nextMonthButtonDisabled,
                                            }) => (
                                                <div className="cd-header">
                                                    <button type="button" onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="cd-nav-btn cd-nav-left"><ChevronLeft size={18} /></button>
                                                    <div className="cd-month-year-group">
                                                        <div className="cd-stepper">
                                                            <span className="cd-stepper-text">{MONTH_NAMES[date.getMonth()]}</span>
                                                            <div className="cd-stepper-arrows">
                                                                <button type="button" onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="cd-step-btn"><ChevronUp size={14} /></button>
                                                                <button type="button" onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="cd-step-btn"><ChevronDown size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div style={{ width: '80px' }}>
                                                            <CustomSelect
                                                                value={date.getFullYear()}
                                                                onChange={(val) => changeYear(Number(val))}
                                                                options={YEARS.map(y => ({ value: y, label: y }))}
                                                            />
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="cd-nav-btn cd-nav-right"><ChevronRight size={18} /></button>
                                                </div>
                                            )}
                                        />
                                        <Calendar size={18} className="mui-datepicker-icon" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Cabang Olahraga</label>
                                <input type="text" className="input" value={editForm.cabor || ''} onChange={e => setEditForm({ ...editForm, cabor: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                                <div>
                                    <label className="form-label">Provinsi</label>
                                    <input type="text" className="input" value={editForm.provinsi || ''} onChange={e => setEditForm({ ...editForm, provinsi: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Size Baju
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setShowSizeChart(true); }}
                                            style={{
                                                background: 'var(--accent-blue-light)', border: 'none', borderRadius: '50%',
                                                width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center',
                                                justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0
                                            }}
                                            title="Lihat Size Chart"
                                        >
                                            <Info style={{ width: '12px', height: '12px', color: 'var(--accent-blue)' }} />
                                        </button>
                                    </label>
                                    <button
                                        type="button"
                                        className="pp-sort-trigger"
                                        onClick={() => setSizeOpen(true)}
                                        style={{ width: '100%', justifyContent: 'space-between' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Shirt style={{ width: '14px', height: '14px', opacity: 0.6 }} />
                                            <span>{editForm.ukuranBaju || 'Pilih'}</span>
                                        </div>
                                        <ChevronRight style={{ width: '14px', height: '14px' }} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Alamat Lengkap</label>
                                <textarea className="input" rows="3" value={editForm.alamat || ''} onChange={e => setEditForm({ ...editForm, alamat: e.target.value })} style={{ resize: 'vertical' }} />
                            </div>
                            {editForm.level?.includes('2') && vc.sertifikatLv1 && (
                                <div>
                                    <label className="form-label">No Sertifikat Lv. 1</label>
                                    <input type="text" className="input" placeholder="Masukkan nomor sertifikat level 1" value={editForm.nomerSertifikatLevel1 || ''} onChange={e => setEditForm({ ...editForm, nomerSertifikatLevel1: e.target.value })} />
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button onClick={() => setEditForm(null)} disabled={saving} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Batal</button>
                            <button onClick={handleEditFormSubmit} disabled={saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
                                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== Size Picker Popup ===== */}
            {sizeOpen && editForm && createPortal(
                <div className="modal-overlay" onClick={() => setSizeOpen(false)} style={{ zIndex: 10001 }}>
                    <div className="modal-content" style={{ maxWidth: '340px', padding: '24px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, var(--accent-blue-light), var(--accent-blue-border))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--accent-blue)'
                                }}>
                                    <Shirt style={{ width: '18px', height: '18px' }} />
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Pilih Ukuran</h3>
                            </div>
                            <button onClick={() => setSizeOpen(false)} style={{
                                background: 'var(--bg-input)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)'
                            }}>
                                <X style={{ width: '18px', height: '18px' }} />
                            </button>
                        </div>
                        <div className="pp-size-grid">
                            {SIZE_OPTIONS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`pp-size-option ${editForm.ukuranBaju === s ? 'active' : ''}`}
                                    onClick={() => { setEditForm({ ...editForm, ukuranBaju: s }); setSizeOpen(false); }}
                                >
                                    {editForm.ukuranBaju === s && <Check style={{ width: '16px', height: '16px', position: 'absolute', top: '6px', right: '6px' }} />}
                                    {s}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowSizeChart(true); setSizeOpen(false); }}
                            style={{
                                marginTop: '16px', width: '100%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px',
                                border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                color: 'var(--accent-blue)', fontSize: '13px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit'
                            }}
                        >
                            <Info style={{ width: '14px', height: '14px' }} />
                            Lihat Size Chart
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== Size Chart Modal ===== */}
            {showSizeChart && createPortal(
                <div className="modal-overlay" onClick={() => setShowSizeChart(false)} style={{ zIndex: 10000 }}>
                    <div className="modal-content" style={{ maxWidth: '520px', padding: '20px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, var(--accent-blue-light), var(--accent-blue-border))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--accent-blue)'
                                }}>
                                    <Shirt style={{ width: '18px', height: '18px' }} />
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Size Chart</h3>
                            </div>
                            <button onClick={() => setShowSizeChart(false)} style={{
                                background: 'var(--bg-input)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)'
                            }}>
                                <X style={{ width: '18px', height: '18px' }} />
                            </button>
                        </div>
                        <img
                            src="/img/sizechart.png"
                            alt="Size Chart"
                            style={{
                                width: '100%', borderRadius: '12px',
                                border: '1px solid var(--border-color)'
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} style={{ zIndex: 9999 }}>
                    <Check style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}
