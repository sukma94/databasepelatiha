import React, { useState, useEffect } from 'react';
import { addPemesananJersey, getAppSettings } from '../utils/storage';
import { sanitizeFormData } from '../utils/inputValidation';
import { canSubmit, getCooldownRemaining } from '../utils/rateLimit';
import { getProvinsi, getKabupaten, getKecamatan, getKelurahan, searchWilayah } from '../utils/wilayahIndonesia';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import {
    MapPin, Search, Save, Check, Loader2, X, AlertCircle, 
    Sun, Moon, Upload, File as FileIcon, Copy, ShoppingBag, Shirt, CreditCard,
    Maximize2
} from 'lucide-react';
import './FormulirUpdatePeserta.css';
import './PublicPeserta.css';
import './PublicPemesananJersey.css';

export default function PublicPemesananJersey() {
    const { dark, toggle } = useTheme();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAppSettings().then(s => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    // Form state
    const emptyForm = {
        namaPemesan: '', 
        nomorWA: '',
        jumlahOrder: 1,
        ukuran1: 'L',
        ukuran2: 'L',
        ukuran3: 'L',
        namaPenerima: '',
        nomorPenerima: '',
        provinsiId: '', provinsiName: '',
        kabupatenId: '', kabupatenName: '',
        kecamatanId: '', kecamatanName: '',
        kelurahanId: '', kelurahanName: '',
        kodePos: '',
        alamatDetail: '',
        pembayaran: 'Lunas', // DP atau Lunas
    };
    const [form, setForm] = useState({ ...emptyForm });
    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const [fileBukti, setFileBukti] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileMimeType, setFileMimeType] = useState('');

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmInfo, setConfirmInfo] = useState(false);
    const [showSizeChart, setShowSizeChart] = useState(false);

    // Wilayah data
    const [provinsiList, setProvinsiList] = useState([]);
    const [kabupatenList, setKabupatenList] = useState([]);
    const [kecamatanList, setKecamatanList] = useState([]);
    const [kelurahanList, setKelurahanList] = useState([]);
    const [loadingWilayah, setLoadingWilayah] = useState({ prov: false, kab: false, kec: false, kel: false });
    const [kodePosAutoFilled, setKodePosAutoFilled] = useState(false);
    const [searchingKodePos, setSearchingKodePos] = useState(false);

    const showToastMsg = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load provinsi
    useEffect(() => {
        setLoadingWilayah(prev => ({ ...prev, prov: true }));
        getProvinsi().then(data => {
            setProvinsiList(data);
            setLoadingWilayah(prev => ({ ...prev, prov: false }));
        });
    }, []);

    // Wilayah Cascading
    const handleProvinsiChange = async (e) => {
        const id = e.target.value;
        const selected = provinsiList.find(p => p.id === id);
        setForm(prev => ({
            ...prev,
            provinsiId: id, provinsiName: selected?.name || '',
            kabupatenId: '', kabupatenName: '',
            kecamatanId: '', kecamatanName: '',
            kelurahanId: '', kelurahanName: '',
        }));
        setKabupatenList([]); setKecamatanList([]); setKelurahanList([]);

        if (id) {
            setLoadingWilayah(prev => ({ ...prev, kab: true }));
            const data = await getKabupaten(id);
            setKabupatenList(data);
            setLoadingWilayah(prev => ({ ...prev, kab: false }));
        }
    };

    const handleKabupatenChange = async (e) => {
        const id = e.target.value;
        const selected = kabupatenList.find(k => k.id === id);
        setForm(prev => ({
            ...prev,
            kabupatenId: id, kabupatenName: selected?.name || '',
            kecamatanId: '', kecamatanName: '',
            kelurahanId: '', kelurahanName: '',
        }));
        setKecamatanList([]); setKelurahanList([]);

        if (id) {
            setLoadingWilayah(prev => ({ ...prev, kec: true }));
            const data = await getKecamatan(id);
            setKecamatanList(data);
            setLoadingWilayah(prev => ({ ...prev, kec: false }));
        }
    };

    const handleKecamatanChange = async (e) => {
        const id = e.target.value;
        const selected = kecamatanList.find(k => k.id === id);
        setForm(prev => ({
            ...prev,
            kecamatanId: id, kecamatanName: selected?.name || '',
            kelurahanId: '', kelurahanName: '',
        }));
        setKelurahanList([]);

        if (id) {
            setLoadingWilayah(prev => ({ ...prev, kel: true }));
            const data = await getKelurahan(id);
            setKelurahanList(data);
            setLoadingWilayah(prev => ({ ...prev, kel: false }));
        }
    };

    const handleKelurahanChange = (e) => {
        const id = e.target.value;
        const selected = kelurahanList.find(k => k.id === id);
        const autoKodePos = selected?.raw?.postal_codes?.[0] || '';
        setForm(prev => ({
            ...prev,
            kelurahanId: id,
            kelurahanName: selected?.name || '',
            kodePos: autoKodePos || prev.kodePos,
        }));
        setKodePosAutoFilled(!!autoKodePos);
    };

    // Search seluruh wilayah berdasarkan kode pos
    const handleSearchByKodePos = async () => {
        const kodePos = form.kodePos.trim();
        if (kodePos.length !== 5) {
            showToastMsg('Masukkan 5 digit kode pos terlebih dahulu!', 'error');
            return;
        }
        setSearchingKodePos(true);
        try {
            const results = await searchWilayah(kodePos);
            if (!results || results.length === 0) {
                showToastMsg('Kode pos tidak ditemukan.', 'error');
                return;
            }
            const r = results[0];
            setForm(prev => ({
                ...prev,
                provinsiId: r.province_code || '',
                provinsiName: r.province || '',
                kabupatenId: r.city_code || '',
                kabupatenName: r.city || '',
                kecamatanId: r.district_code || '',
                kecamatanName: r.district || '',
                kelurahanId: r.village_code || '',
                kelurahanName: r.village || '',
                kodePos: r.postal_code || kodePos,
            }));
            setKodePosAutoFilled(true);

            if (r.province_code) {
                setLoadingWilayah(prev => ({ ...prev, kab: true }));
                const kabs = await getKabupaten(r.province_code);
                setKabupatenList(kabs);
                setLoadingWilayah(prev => ({ ...prev, kab: false }));
            }
            if (r.city_code) {
                setLoadingWilayah(prev => ({ ...prev, kec: true }));
                const kecs = await getKecamatan(r.city_code);
                setKecamatanList(kecs);
                setLoadingWilayah(prev => ({ ...prev, kec: false }));
            }
            if (r.district_code) {
                setLoadingWilayah(prev => ({ ...prev, kel: true }));
                const kels = await getKelurahan(r.district_code);
                setKelurahanList(kels);
                setLoadingWilayah(prev => ({ ...prev, kel: false }));
            }
            showToastMsg('Wilayah berhasil diisi otomatis dari kode pos!', 'success');
        } catch (err) {
            console.error('Search kode pos error:', err);
            showToastMsg('Gagal mencari kode pos. Coba lagi.', 'error');
        } finally {
            setSearchingKodePos(false);
        }
    };

    const handleFileChange = (e) => {
        let file = null;
        if (e.target && e.target.files) {
            file = e.target.files[0];
        } else if (e.dataTransfer && e.dataTransfer.files) {
            file = e.dataTransfer.files[0];
        }

        if (file) {
            if (file.size > 2097152) { // 2MB
                showToastMsg('Ukuran file maksimal 2MB!', 'error');
                if (e.target && e.target.value) e.target.value = '';
                return;
            }
            setFileName(file.name);
            setFileMimeType(file.type);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64Data = ev.target.result.split(',')[1];
                setFileBukti(base64Data);
            };
            reader.readAsDataURL(file);
        } else {
            setFileName('');
            setFileMimeType('');
            setFileBukti(null);
        }
    };

    const handleClickKirim = async (e) => {
        e.preventDefault();
        
        if (!form.namaPemesan.trim()) { showToastMsg('Nama pemesan wajib diisi!', 'error'); return; }
        if (!form.nomorWA.trim()) { showToastMsg('Nomor WA wajib diisi!', 'error'); return; }
        if (!form.provinsiId) { showToastMsg('Provinsi wajib dipilih!', 'error'); return; }
        if (!form.kabupatenId) { showToastMsg('Kabupaten/Kota wajib dipilih!', 'error'); return; }
        if (!form.kecamatanId) { showToastMsg('Kecamatan wajib dipilih!', 'error'); return; }
        if (!form.kelurahanId) { showToastMsg('Kelurahan/Desa wajib dipilih!', 'error'); return; }
        if (!form.namaPenerima.trim()) { showToastMsg('Nama penerima wajib diisi!', 'error'); return; }
        if (!form.nomorPenerima.trim()) { showToastMsg('Nomor penerima wajib diisi!', 'error'); return; }
        if (!form.kodePos.trim()) { showToastMsg('Kode pos wajib diisi!', 'error'); return; }
        if (!form.alamatDetail.trim()) { showToastMsg('Alamat lengkap wajib diisi!', 'error'); return; }
        if (!fileBukti) { showToastMsg('Bukti pembayaran wajib diunggah!', 'error'); return; }
        if (!confirmInfo) { showToastMsg('Harap centang persetujuan sebelum mengirim pesanan!', 'error'); return; }

        if (!canSubmit('jersey_' + form.nomorWA, 60000)) {
            const remaining = getCooldownRemaining('jersey_' + form.nomorWA, 60000);
            showToastMsg(`Harap tunggu ${remaining} detik sebelum mengirim lagi.`, 'error');
            return;
        }

        setSubmitting(true);
        let buktiUrl = '';

        if (fileBukti) {
            try {
                // Menggunakan URL Google Apps Script yang baru untuk upload bukti jersey
                const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1ISItTCnz_mkcWGEoE3Ioi1jleyz3Dkh1UnujI-7MGr6Ogs2613D9EFBk6cpN5Iz2/exec';
                
                if (SCRIPT_URL) {
                    const fileExtension = fileName.split('.').pop();
                    const newFileName = `Jersey_${form.namaPemesan.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExtension}`;
                    
                    const res = await fetch(SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            fileName: newFileName,
                            mimeType: fileMimeType,
                            file: fileBukti
                        })
                    });
                    const data = await res.json();
                    if (data.url) {
                        buktiUrl = data.url;
                    }
                }
            } catch (err) {
                console.error("Gagal mengunggah gambar bukti", err);
                showToastMsg('Gagal mengunggah gambar bukti pembayaran. Silakan coba lagi.', 'error');
                setSubmitting(false);
                return; 
            }
        }

        // Format ukuran
        const ukuranArr = [];
        if (form.jumlahOrder >= 1) ukuranArr.push(form.ukuran1);
        if (form.jumlahOrder >= 2) ukuranArr.push(form.ukuran2);
        if (form.jumlahOrder >= 3) ukuranArr.push(form.ukuran3);

        const dataToSave = sanitizeFormData({
            namaPemesan: form.namaPemesan.trim(),
            nomorWA: form.nomorWA.trim(),
            jumlahOrder: form.jumlahOrder,
            ukuran: ukuranArr,
            provinsi: form.provinsiName,
            kabupaten: form.kabupatenName,
            kecamatan: form.kecamatanName,
            kelurahan: form.kelurahanName,
            kodePos: form.kodePos.trim(),
            namaPenerima: form.namaPenerima.trim(),
            nomorPenerima: form.nomorPenerima.trim(),
            alamatDetail: form.alamatDetail.trim(),
            pembayaran: form.pembayaran,
            buktiPembayaranUrl: buktiUrl,
        });

        const result = await addPemesananJersey(dataToSave);
        
        setSubmitting(false);
        if (result) {
            setSubmitted(true);
        } else {
            showToastMsg('Gagal mengirim pesanan. Silakan coba lagi nanti.', 'error');
        }
    };

    const logoSrc = dark 
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png") 
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    if (loading) return <div className="ppj-loading-screen"><div className="login-spinner" /></div>;

    if (submitted) {
        return (
            <div className="ppj-success-screen">
                <div className="ppj-success-card">
                    <div className="ppj-success-icon">
                        <Check size={36} strokeWidth={3} />
                    </div>
                    <h2 className="ppj-success-title">Pesanan Berhasil!</h2>
                    <p className="ppj-success-msg">
                        Terima kasih, pesanan jersey Anda telah kami terima. Kami akan segera memprosesnya dan menghubungi Anda melalui WhatsApp jika ada informasi lebih lanjut.
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="ppj-success-btn btn-outline"
                    >
                        Buat Pesanan Baru
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fup-container">
            {/* Header */}
            <header className="pp-hero">
                <div className="pp-hero-inner">
                    <div className="pp-hero-brand">
                        <img src={logoSrc} alt="Logo" />
                        <div>
                            <h1>{settings?.appTitle || 'DATABASE PELATIHAN'}</h1>
                            <p>Formulir Pemesanan Jersey Publik</p>
                        </div>
                    </div>
                    <button onClick={toggle} className="pp-theme-btn" aria-label="Toggle theme">
                        {dark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            <main className="fup-main">
                <div className="fup-page-header">
                    <h2 className="fup-page-title">Pemesanan Jersey Exclusive</h2>
                    <p className="fup-page-subtitle">Silakan isi formulir di bawah ini dengan data yang valid untuk keperluan pemesanan dan pengiriman.</p>
                </div>

                {/* Hero Image Jersey */}
                <div className="ppj-hero-banner animated fadeIn">
                    <div className="ppj-hero-img-wrapper">
                        <img 
                            src="/img/Jersey.png" 
                            alt="Jersey Exclusive" 
                            className="ppj-hero-img"
                        />
                        <div className="ppj-hero-overlay">
                            <span className="ppj-hero-badge">🔥 Exclusive Edition</span>
                        </div>
                    </div>
                </div>

                {/* Size Chart Modal */}
                {showSizeChart && (
                    <div className="ppj-sizechart-overlay" onClick={() => setShowSizeChart(false)}>
                        <div className="ppj-sizechart-modal" onClick={e => e.stopPropagation()}>
                            <div className="ppj-sizechart-header">
                                <h3>Size Chart Jersey</h3>
                                <button 
                                    type="button" 
                                    className="ppj-sizechart-close" 
                                    onClick={() => setShowSizeChart(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="ppj-sizechart-body">
                                <img 
                                    src="/img/sizechart-jersey.jpeg" 
                                    alt="Size Chart Jersey" 
                                    className="ppj-sizechart-img"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleClickKirim}>
                    {/* Card 1: Data Pemesanan */}
                    <div className="fup-card animated fadeIn">
                        <div className="fup-card-header">
                            <div className="fup-card-header-icon blue">
                                <ShoppingBag size={16} />
                            </div>
                            <h3 className="fup-card-title">Data Pesanan & Identitas</h3>
                        </div>
                        <div className="fup-card-body fup-grid-2">
                            <div>
                                <label className="fup-field-label">
                                    Nama Lengkap Pemesan <span className="fup-required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="fup-input"
                                    placeholder="Masukkan nama lengkap Anda"
                                    value={form.namaPemesan}
                                    onChange={e => update('namaPemesan', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="fup-field-label">
                                    Nomor WhatsApp <span className="fup-required">*</span>
                                </label>
                                <input
                                    type="tel"
                                    className="fup-input"
                                    placeholder="Contoh: 08123456789"
                                    value={form.nomorWA}
                                    onChange={e => update('nomorWA', e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Nomor aktif untuk konfirmasi</p>
                            </div>
                            
                            <div className="fup-full-span">
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1', minWidth: '150px' }}>
                                        <label className="fup-field-label">Jumlah Order <span className="fup-required">*</span></label>
                                        <select 
                                            className="fup-input" 
                                            value={form.jumlahOrder} 
                                            onChange={e => update('jumlahOrder', parseInt(e.target.value))}
                                        >
                                            <option value={1}>1 Pcs</option>
                                            <option value={2}>2 Pcs</option>
                                            <option value={3}>3 Pcs</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="fup-col-2">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '2px' }}>
                                    <label className="fup-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                        <Shirt size={16} /> Pilih Ukuran Jersey <span className="fup-required">*</span>
                                    </label>
                                    <button 
                                        type="button" 
                                        className="ppj-sizechart-btn-sm" 
                                        onClick={() => setShowSizeChart(true)}
                                    >
                                        <Maximize2 size={13} />
                                        Size Chart
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    {form.jumlahOrder >= 1 && (
                                        <div style={{ flex: 1, minWidth: '100px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jersey ke-1</div>
                                            <select className="fup-input" value={form.ukuran1} onChange={e => update('ukuran1', e.target.value)}>
                                                <option value="S">S</option>
                                                <option value="M">M</option>
                                                <option value="L">L</option>
                                                <option value="XL">XL</option>
                                                <option value="XXL">XXL</option>
                                                <option value="XXXL">XXXL</option>
                                            </select>
                                        </div>
                                    )}
                                    {form.jumlahOrder >= 2 && (
                                        <div style={{ flex: 1, minWidth: '100px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jersey ke-2</div>
                                            <select className="fup-input" value={form.ukuran2} onChange={e => update('ukuran2', e.target.value)}>
                                                <option value="S">S</option>
                                                <option value="M">M</option>
                                                <option value="L">L</option>
                                                <option value="XL">XL</option>
                                                <option value="XXL">XXL</option>
                                                <option value="XXXL">XXXL</option>
                                            </select>
                                        </div>
                                    )}
                                    {form.jumlahOrder >= 3 && (
                                        <div style={{ flex: 1, minWidth: '100px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jersey ke-3</div>
                                            <select className="fup-input" value={form.ukuran3} onChange={e => update('ukuran3', e.target.value)}>
                                                <option value="S">S</option>
                                                <option value="M">M</option>
                                                <option value="L">L</option>
                                                <option value="XL">XL</option>
                                                <option value="XXL">XXL</option>
                                                <option value="XXXL">XXXL</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {/* Keterangan biaya tambahan XXL / XXXL */}
                                {((form.jumlahOrder >= 1 && ['XXL','XXXL'].includes(form.ukuran1)) ||
                                  (form.jumlahOrder >= 2 && ['XXL','XXXL'].includes(form.ukuran2)) ||
                                  (form.jumlahOrder >= 3 && ['XXL','XXXL'].includes(form.ukuran3))) && (
                                    <div style={{
                                        marginTop: '10px',
                                        padding: '10px 14px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}>
                                        <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                            Ukuran <strong>XXL</strong> dan <strong>XXXL</strong> dikenakan biaya tambahan sebesar <strong style={{ color: '#f59e0b' }}>Rp 10.000</strong> per jersey.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Alamat Pengiriman */}
                    <div className="fup-card animated fadeIn" style={{ animationDelay: '0.1s' }}>
                        <div className="fup-card-header">
                            <div className="fup-card-header-icon amber">
                                <MapPin size={16} />
                            </div>
                            <h3 className="fup-card-title">Alamat Pengiriman</h3>
                        </div>
                        <div className="fup-card-body fup-grid-2">
                            <div>
                                <label className="fup-field-label">Nama Penerima <span className="fup-required">*</span></label>
                                <input type="text" className="fup-input" placeholder="Nama penerima paket" value={form.namaPenerima} onChange={e => update('namaPenerima', e.target.value)} required />
                            </div>
                            <div>
                                <label className="fup-field-label">Nomor WA / HP Penerima <span className="fup-required">*</span></label>
                                <input type="tel" className="fup-input" placeholder="Contoh: 08123456789" value={form.nomorPenerima} onChange={e => update('nomorPenerima', e.target.value.replace(/\D/g, ''))} required />
                            </div>
                            <div>
                                <label className="fup-field-label">Provinsi <span className="fup-required">*</span></label>
                                <select value={form.provinsiId} onChange={handleProvinsiChange} className="fup-input" required>
                                    <option value="">-- Pilih Provinsi --</option>
                                    {provinsiList.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <label className="fup-field-label">Kabupaten/Kota <span className="fup-required">*</span></label>
                                <select value={form.kabupatenId} onChange={handleKabupatenChange} disabled={!form.provinsiId} className="fup-input" required>
                                    <option value="">{form.provinsiId ? '-- Pilih Kab/Kota --' : 'Pilih Provinsi dahulu'}</option>
                                    {kabupatenList.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {loadingWilayah.kab && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat...</span>}
                            </div>
                            
                            <div>
                                <label className="fup-field-label">Kecamatan <span className="fup-required">*</span></label>
                                <select value={form.kecamatanId} onChange={handleKecamatanChange} disabled={!form.kabupatenId} className="fup-input" required>
                                    <option value="">{form.kabupatenId ? '-- Pilih Kecamatan --' : 'Pilih Kota dahulu'}</option>
                                    {kecamatanList.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {loadingWilayah.kec && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat...</span>}
                            </div>
                            
                            <div>
                                <label className="fup-field-label">Kelurahan/Desa <span className="fup-required">*</span></label>
                                <select value={form.kelurahanId} onChange={handleKelurahanChange} disabled={!form.kecamatanId} className="fup-input" required>
                                    <option value="">{form.kecamatanId ? '-- Pilih Kelurahan --' : 'Pilih Kecamatan dahulu'}</option>
                                    {kelurahanList.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {loadingWilayah.kel && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat...</span>}
                            </div>

                            <div className="fup-col-2">
                                <label className="fup-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Kode Pos <span className="fup-required">*</span>
                                    {kodePosAutoFilled && (
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Check size={10} strokeWidth={3} /> Terisi otomatis
                                        </span>
                                    )}
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="fup-input"
                                        placeholder="Contoh: 12345"
                                        value={form.kodePos}
                                        maxLength={5}
                                        onChange={e => { update('kodePos', e.target.value.replace(/\D/g, '')); setKodePosAutoFilled(false); }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearchByKodePos}
                                        disabled={searchingKodePos || form.kodePos.length !== 5}
                                        style={{
                                            padding: '0 16px', height: '42px',
                                            background: (searchingKodePos || form.kodePos.length !== 5) ? 'var(--bg-input)' : 'var(--accent-blue)',
                                            color: (searchingKodePos || form.kodePos.length !== 5) ? 'var(--text-muted)' : 'white',
                                            border: '1px solid var(--border-color)', borderRadius: '8px',
                                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                            fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s'
                                        }}
                                    >
                                        {searchingKodePos ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                                        Cari
                                    </button>
                                </div>
                            </div>
                            
                            <div className="fup-full-span">
                                <label className="fup-field-label">Alamat Lengkap & Patokan <span className="fup-required">*</span></label>
                                <textarea
                                    className="fup-input fup-textarea"
                                    rows="3"
                                    placeholder="Contoh: Jl. Sudirman No 123 RT 01/RW 02, Rumah pagar hitam depan alfamart"
                                    value={form.alamatDetail}
                                    onChange={e => update('alamatDetail', e.target.value)}
                                    required
                                />
                            </div>

                            {/* Keterangan biaya pengiriman */}
                            <div className="fup-full-span" style={{
                                padding: '12px 16px',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                            }}>
                                <AlertCircle size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '1px' }} />
                                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                    <strong style={{ color: 'var(--accent-blue)' }}>Informasi Pengiriman:</strong>
                                    <br />Biaya pengiriman <strong>ditanggung oleh pemesan</strong> dan dibayarkan pada saat barang sampai (COD ongkir). Anda juga bisa menghubungi admin terlebih dahulu untuk mendapatkan <strong>estimasi ongkir terbaik</strong> sebelum melakukan pemesanan.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Pembayaran */}
                    <div className="fup-card animated fadeIn" style={{ animationDelay: '0.2s' }}>
                        <div className="fup-card-header">
                            <div className="fup-card-header-icon rose">
                                <CreditCard size={16} color="#e11d48"/>
                            </div>
                            <h3 className="fup-card-title">Pembayaran Transaksi</h3>
                        </div>
                        <div className="fup-card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Metode Pembayaran */}
                                <div>
                                    <label className="fup-field-label">Metode Pembayaran <span className="fup-required">*</span></label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        {[
                                            { val: 'Lunas', label: 'Lunas', sub: 'Bayar penuh di awal', icon: '✅' },
                                            { val: 'DP', label: 'Uang Muka (DP)', sub: 'Minimal 50%', icon: '💳' },
                                        ].map(opt => (
                                            <label key={opt.val} className={`ppj-payment-option ${form.pembayaran === opt.val ? 'active' : ''}`}>
                                                <input 
                                                    type="radio" name="pembayaran" value={opt.val} 
                                                    checked={form.pembayaran === opt.val} 
                                                    onChange={() => update('pembayaran', opt.val)}
                                                    style={{ display: 'none' }}
                                                />
                                                <span className="ppj-payment-radio">
                                                    {form.pembayaran === opt.val && <Check size={12} strokeWidth={3} />}
                                                </span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{opt.icon} {opt.label}</span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.sub}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Keterangan harga belum termasuk ongkir */}
                                <div style={{
                                    padding: '10px 14px',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}>
                                    <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                        Harga <strong style={{ color: '#f59e0b' }}>Rp 120.000</strong>/pcs adalah harga jersey saja, <strong>belum termasuk biaya pengiriman</strong>.
                                    </span>
                                </div>

                                {/* Rincian & Transfer Info */}
                                {(() => {
                                    const HARGA_NORMAL = 120000;
                                    const SURCHARGE = 10000;
                                    const sizes = [];
                                    if (form.jumlahOrder >= 1) sizes.push(form.ukuran1);
                                    if (form.jumlahOrder >= 2) sizes.push(form.ukuran2);
                                    if (form.jumlahOrder >= 3) sizes.push(form.ukuran3);
                                    const totalHarga = sizes.reduce((sum, s) => {
                                        return sum + HARGA_NORMAL + (['XXL','XXXL'].includes(s) ? SURCHARGE : 0);
                                    }, 0);
                                    const jumlahTransfer = form.pembayaran === 'DP' ? Math.ceil(totalHarga * 0.5) : totalHarga;
                                    const fmt = (n) => 'Rp ' + n.toLocaleString('id-ID');

                                    return (
                                        <div className="ppj-transfer-card">
                                            {/* Header */}
                                            <div className="ppj-transfer-header">
                                                <span className="ppj-transfer-title">📋 Rincian Pembayaran</span>
                                            </div>

                                            {/* Body */}
                                            <div className="ppj-transfer-body">
                                                {/* Price breakdown */}
                                                <div className="ppj-price-list">
                                                    {sizes.map((s, i) => {
                                                        const extra = ['XXL','XXXL'].includes(s);
                                                        const harga = HARGA_NORMAL + (extra ? SURCHARGE : 0);
                                                        return (
                                                            <div key={i} className="ppj-price-row">
                                                                <span className="ppj-price-label">
                                                                    <Shirt size={13} style={{ opacity: 0.5 }} />
                                                                    Jersey ke-{i + 1} <span className="ppj-size-tag">{s}</span>
                                                                    {extra && <span className="ppj-surcharge-tag">+10rb</span>}
                                                                </span>
                                                                <span className="ppj-price-value">{fmt(harga)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="ppj-price-divider" />

                                                <div className="ppj-price-row ppj-price-total">
                                                    <span>Subtotal</span>
                                                    <span>{fmt(totalHarga)}</span>
                                                </div>

                                                {form.pembayaran === 'DP' && (
                                                    <div className="ppj-price-row ppj-price-dp">
                                                        <span>DP 50%</span>
                                                        <span>{fmt(jumlahTransfer)}</span>
                                                    </div>
                                                )}

                                                {/* Transfer amount highlight */}
                                                <div className="ppj-transfer-highlight">
                                                    <span className="ppj-transfer-highlight-label">
                                                        {form.pembayaran === 'DP' ? 'Nominal DP Transfer' : 'Total Transfer'}
                                                    </span>
                                                    <span className="ppj-transfer-highlight-amount">
                                                        {fmt(jumlahTransfer)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* BNI Bank Card */}
                                            <div className="ppj-bank-card">
                                                <div className="ppj-bank-card-top">
                                                    <img src="/img/BNI_logo.svg.png" alt="BNI" className="ppj-bank-logo" />
                                                    <span className="ppj-bank-label">Bank Transfer</span>
                                                </div>
                                                <div className="ppj-bank-card-number">
                                                    <span>0970815714</span>
                                                    <button
                                                        type="button"
                                                        className="ppj-copy-btn"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText('0970815714');
                                                            showToastMsg('Nomor rekening disalin!', 'success');
                                                        }}
                                                        title="Salin Rekening"
                                                    >
                                                        <Copy size={14} strokeWidth={2.5} /> Salin
                                                    </button>
                                                </div>
                                                <div className="ppj-bank-card-name">
                                                    a/n <strong>Glady Sukma Perdana</strong>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Upload Bukti Transfer */}
                                <div>
                                    <label className="fup-field-label">
                                        Upload Bukti Transfer <span className="fup-required">*</span>
                                    </label>
                                    <label htmlFor="file-upload" className="ppj-upload-area"
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; handleFileChange(e); }}
                                    >
                                        <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.7 }} />
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            Klik atau drag & drop file
                                        </p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Maks. 2MB (JPG, PNG)</p>
                                        <input
                                            id="file-upload" type="file" accept="image/*"
                                            onChange={handleFileChange}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                        />
                                    </label>

                                    {fileName && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', marginTop: '12px' }}>
                                            <div style={{ padding: '8px', background: 'var(--accent-amber-light, rgba(245, 158, 11, 0.1))', borderRadius: '8px', display: 'flex' }}>
                                                <FileIcon size={18} style={{ color: 'var(--accent-amber, #f59e0b)' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</p>
                                                <p style={{ fontSize: '11px', color: 'var(--accent-emerald)', margin: 0, marginTop: '2px' }}>Siap diunggah</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setFileName(''); setFileMimeType(''); setFileBukti(null); document.getElementById('file-upload').value = ''; }}
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="fup-submit-section">
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--bg-card)', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '20px', cursor: 'pointer', textAlign: 'left' }}>
                            <input
                                type="checkbox" required checked={confirmInfo} onChange={(e) => setConfirmInfo(e.target.checked)}
                                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                Saya menyatakan bahwa data pemesanan jersey dan alamat pengiriman di atas adalah benar. <span className="fup-required">*</span>
                            </span>
                        </label>
                        <button type="submit" className="fup-submit-btn" disabled={submitting}>
                            {submitting ? <><Loader2 size={18} className="spin" /> Memproses...</> : <><Save size={18} /> Pesan Jersey Sekarang</>}
                        </button>
                    </div>

                </form>
            </main>

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}
