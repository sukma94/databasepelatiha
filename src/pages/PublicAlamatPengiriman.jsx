import React, { useState, useEffect, useMemo } from 'react';
import { usePublicData } from '../utils/usePublicData';
import { addAlamatPengiriman, updateAlamatPengiriman, getAlamatByPesertaId } from '../utils/storage';
import { sanitizeFormData } from '../utils/inputValidation';
import { canSubmit, getCooldownRemaining } from '../utils/rateLimit';
import { getProvinsi, getKabupaten, getKecamatan, getKelurahan, searchWilayah } from '../utils/wilayahIndonesia';
import { formatString } from '../utils/formatters';
import { isLevelArchived } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { Link, useParams } from 'react-router-dom';
import {
    MapPin, Search, Save, RotateCcw, CheckCircle, ChevronDown,
    Package, User, Phone, Home, Loader2, X, AlertCircle, Lock, Sun, Moon, Check, MessageCircle, Users, ArrowLeft, Printer, Upload, File as FileIcon, Copy
} from 'lucide-react';
import './AlamatPengiriman.css';
import './PublicPeserta.css';
import './FormulirUpdatePeserta.css';
import './PublicAlamatPengiriman.css';
import './PublicPemesananJersey.css';
import PrintAlamatPengiriman from './PrintAlamatPengiriman';

export default function PublicAlamatPengiriman() {
    const { levelSlug } = useParams();
    const { peserta, levels, settings, publicSettings, notFound } = usePublicData({ levelSlug });
    const { dark, toggle, textFormat } = useTheme();

    // Form state
    const emptyForm = {
        pesertaId: '', namaPeserta: '', namaPenerima: '', nomorHP: '',
        provinsiId: '', provinsiName: '',
        kabupatenId: '', kabupatenName: '',
        kecamatanId: '', kecamatanName: '',
        kelurahanId: '', kelurahanName: '',
        kodePos: '',
        alamatDetail: '',
    };
    const [form, setForm] = useState({ ...emptyForm });
    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const [fileBukti, setFileBukti] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileMimeType, setFileMimeType] = useState('');
    const [existingBuktiUrl, setExistingBuktiUrl] = useState('');

    const [selectedPeserta, setSelectedPeserta] = useState(null);
    const [searchNama, setSearchNama] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [existingAlamatId, setExistingAlamatId] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirmInfo, setConfirmInfo] = useState(false);

    // WA Verification
    const [showVerifyWa, setShowVerifyWa] = useState(false);
    const [verifyWaInput, setVerifyWaInput] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [verifyAttempts, setVerifyAttempts] = useState(0);

    // Wilayah data
    const [provinsiList, setProvinsiList] = useState([]);
    const [kabupatenList, setKabupatenList] = useState([]);
    const [kecamatanList, setKecamatanList] = useState([]);
    const [kelurahanList, setKelurahanList] = useState([]);
    const [loadingWilayah, setLoadingWilayah] = useState({ prov: false, kab: false, kec: false, kel: false });
    const [kodePosAutoFilled, setKodePosAutoFilled] = useState(false);

    // Search by kode pos
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

    // Filter Peserta lists
    const publishedPeserta = useMemo(() => {
        if (!publicSettings) return [];
        const levelName = publicSettings.levelName;
        let list = peserta.filter(p => p.level === levelName);
        if (!publicSettings.publishAll) {
            const publishedIds = new Set(publicSettings.publishedIds || []);
            list = list.filter(p => publishedIds.has(p.id));
        }
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
        setForm(prev => ({
            ...prev,
            pesertaId: p.id,
            namaPeserta: p.nama || '',
            namaPenerima: '', // Kosongkan form nama penerima 
            nomorHP: '', // Kosongkan nomor HP
        }));
        setShowDropdown(false);
        setExistingAlamatId(null);
        setAlreadySubmitted(false);
        setFileBukti(null);
        setFileName('');
        setFileMimeType('');
        setExistingBuktiUrl('');
        setConfirmInfo(false);

        // Check if already submitted and get data
        const priorData = await getAlamatByPesertaId(p.id);
        if (priorData) {
            setAlreadySubmitted(true);
            setExistingAlamatId(priorData.id);
            if (priorData.buktiPembayaranUrl) {
                setExistingBuktiUrl(priorData.buktiPembayaranUrl);
            }
            setForm(prev => ({
                ...prev,
                namaPenerima: priorData.namaPenerima || '',
                nomorHP: priorData.nomorHP || '',
                alamatDetail: priorData.alamatDetail || '',
                kodePos: priorData.kodePos || '',
                provinsiName: priorData.provinsi || '',
                kabupatenName: priorData.kabupaten || '',
                kecamatanName: priorData.kecamatan || '',
                kelurahanName: priorData.kelurahan || '',
            }));

            // Coba pulihkan ID wilayah dari kodepos agar field select langsung terisi
            if (priorData.kodePos && priorData.kodePos.length === 5) {
                searchWilayah(priorData.kodePos).then(async (results) => {
                    if (results && results.length > 0) {
                        // Jika ada beberapa kelurahan dengan kodepos sama, cari yang namanya cocok
                        let r = results[0];
                        if (priorData.kelurahan) {
                            const match = results.find(x => x.village?.toLowerCase() === priorData.kelurahan.toLowerCase());
                            if (match) r = match;
                        }
                        setForm(prev => ({
                            ...prev,
                            provinsiId: r.province_code || '',
                            provinsiName: r.province || prev.provinsiName,
                            kabupatenId: r.city_code || '',
                            kabupatenName: r.city || prev.kabupatenName,
                            kecamatanId: r.district_code || '',
                            kecamatanName: r.district || prev.kecamatanName,
                            kelurahanId: r.village_code || '',
                            kelurahanName: r.village || prev.kelurahanName,
                        }));
                        setKodePosAutoFilled(true);

                        // Muat daftar kabupaten/kecamatan/kelurahan agar dropdown tidak kosong
                        if (r.province_code) {
                            getKabupaten(r.province_code).then(setKabupatenList);
                        }
                        if (r.city_code) {
                            getKecamatan(r.city_code).then(setKecamatanList);
                        }
                        if (r.district_code) {
                            getKelurahan(r.district_code).then(setKelurahanList);
                        }
                    }
                }).catch(err => console.error("Gagal memulihkan data wilayah", err));
            }
        }
    };

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
        // Auto-fill kode pos dari postal_codes field (fitur premium api.co.id)
        const autoKodePos = selected?.raw?.postal_codes?.[0] || '';
        setForm(prev => ({
            ...prev,
            kelurahanId: id,
            kelurahanName: selected?.name || '',
            kodePos: autoKodePos || prev.kodePos,
        }));
        setKodePosAutoFilled(!!autoKodePos);
    };

    // Search seluruh wilayah berdasarkan kode pos (premium)
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
            // Isi form dengan hasil search
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

            // Load cascading lists agar dropdown terlihat ter-select dengan benar
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
            if (file.size > 1048576) {
                showToastMsg('Ukuran file maksimal 1MB!', 'error');
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

    // Submission via verification
    const handleClickKirim = (e) => {
        e.preventDefault();
        if (!selectedPeserta) { showToastMsg('Pilih nama Anda terlebih dahulu!', 'error'); return; }
        // Remove the block that throws an error when alreadySubmitted so they can proceed modifying.
        if (alreadySubmitted && !existingAlamatId) {
            // Failsafe
            showToastMsg('Batas pengisian hanya 1x. Jika mau perbaikan harap hubungi Admin WA: 085786018422.', 'error');
            return;
        }
        if (!form.namaPenerima.trim()) { showToastMsg('Nama penerima wajib diisi!', 'error'); return; }
        if (!form.nomorHP.trim()) { showToastMsg('Nomor HP penerima wajib diisi!', 'error'); return; }
        if (!form.provinsiId) { showToastMsg('Provinsi wajib dipilih!', 'error'); return; }
        if (!form.kabupatenId) { showToastMsg('Kabupaten/Kota wajib dipilih!', 'error'); return; }
        if (!form.kecamatanId) { showToastMsg('Kecamatan wajib dipilih!', 'error'); return; }
        if (!form.kelurahanId) { showToastMsg('Kelurahan/Desa wajib dipilih!', 'error'); return; }
        if (!form.kodePos.trim()) { showToastMsg('Kode pos wajib diisi!', 'error'); return; }
        if (!form.alamatDetail.trim()) { showToastMsg('Alamat rumah wajib diisi!', 'error'); return; }
        if (!fileBukti && !existingBuktiUrl) { showToastMsg('Bukti pembayaran ongkir wajib diunggah!', 'error'); return; }
        if (!confirmInfo) { showToastMsg('Harap centang persetujuan sebelum mengirim alamat!', 'error'); return; }

        setShowVerifyWa(true);
        setVerifyWaInput('');
        setVerifyError('');
        setVerifyAttempts(0);
    };

    const handleVerifyAndSubmit = () => {
        const waClean = (selectedPeserta.wa || '').replace(/\D/g, '');
        const last3 = waClean.slice(-3);
        if (!waClean || waClean.length < 3) {
            setVerifyError('Sistem tidak menemukan nomor WhatsApp yang valid untuk Anda. Hubungi Admin.');
            return;
        }
        if (verifyWaInput !== last3) {
            setVerifyAttempts(prev => prev + 1);
            setVerifyError('3 digit terakhir WhatsApp salah.');
            return;
        }

        setShowVerifyWa(false);
        doSubmit();
    };

    const doSubmit = async () => {
        if (!canSubmit('alamat_' + selectedPeserta.id, 60000)) {
            const remaining = getCooldownRemaining('alamat_' + selectedPeserta.id, 60000);
            showToastMsg(`Harap tunggu ${remaining} detik sebelum mengirim lagi.`, 'error');
            return;
        }
        setSubmitting(true);

        let buktiUrl = existingBuktiUrl;

        // Jika ada file bukti baru, upload ke Google Apps Script
        if (fileBukti) {
            try {
                // URL Web App Google Apps Script
                const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeapEW7igD6eNl5GrPZlxWVSfMv4XFRT2mRfpVLPEGW713TGd_q-4TCHTE_-SQ13cJ/exec';

                if (SCRIPT_URL) {
                    // Ambil ekstensi asli dari nama file
                    const fileExtension = fileName.split('.').pop();

                    // Tambahkan penomeran jika ini adalah form perbaikan (re-upload)
                    const suffix = existingAlamatId ? `_${Math.floor(Math.random() * 90) + 10}` : '';
                    const newFileName = `${selectedPeserta.nama}_${form.provinsiName || selectedPeserta.provinsi || 'Provinsi'}${suffix}.${fileExtension}`;

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
                } else {
                    console.warn("URL Google Apps Script belum disetel. File tidak diunggah.");
                }
            } catch (err) {
                console.error("Gagal mengunggah gambar bukti", err);
                showToastMsg('Gagal mengunggah gambar bukti pembayaran. Silakan coba lagi.', 'error');
                setSubmitting(false);
                return; // Stop eksekusi agar form tidak disimpan
            }
        }

        const dataToSave = sanitizeFormData({
            pesertaId: selectedPeserta.id,
            namaPeserta: selectedPeserta.nama,
            namaPenerima: form.namaPenerima.trim(),
            nomorHP: form.nomorHP.trim(),
            provinsi: form.provinsiName,
            kabupaten: form.kabupatenName,
            kecamatan: form.kecamatanName,
            kelurahan: form.kelurahanName,
            kodePos: form.kodePos.trim(),
            alamatDetail: form.alamatDetail.trim(),
            level: publicSettings?.levelName || levelSlug,
            buktiPembayaranUrl: buktiUrl,
        });

        let result;
        if (existingAlamatId) {
            result = await updateAlamatPengiriman(existingAlamatId, dataToSave);
        } else {
            result = await addAlamatPengiriman(dataToSave);
        }

        setSubmitting(false);

        if (result) {
            setSubmitted(true);
            setAlreadySubmitted(true);
        } else {
            showToastMsg('Gagal mengirim alamat data. Silakan coba lagi nanti.', 'error');
        }
    };

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");


    // Component renders
    if (!settings) return <div className="pap-loading-screen"><div className="login-spinner" /></div>;

    if (notFound) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
                <header className="pp-hero">
                    <div className="pp-hero-inner">
                        <div className="pp-hero-brand">
                            <img src={logoSrc} alt="Logo" />
                            <div>
                                <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                                <p>Alamat Pengiriman</p>
                            </div>
                        </div>
                        <button onClick={toggle} className="pp-theme-btn" aria-label="Toggle theme">
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
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
                        <Link to="/formulir" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                            <ArrowLeft style={{ width: '16px', height: '16px' }} />
                            Kembali
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        // Prepare data matching exactly what PrintAlamatPengiriman needs
        const printData = [{
            id: 'current',
            namaPeserta: form.namaPeserta || selectedPeserta?.nama || '',
            namaPenerima: form.namaPenerima,
            nomorHP: form.nomorHP,
            kelurahan: form.kelurahanName,
            kecamatan: form.kecamatanName,
            kabupaten: form.kabupatenName,
            provinsi: form.provinsiName,
            kodePos: form.kodePos,
            alamatDetail: form.alamatDetail,
        }];

        return (
            <div className="pap-success-screen">
                <div className="pap-success-card" style={{ position: 'relative' }}>
                    <button
                        onClick={() => { window.location.reload(); }}
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <X size={20} />
                    </button>
                    <div className="pap-success-icon">
                        <Check size={36} strokeWidth={3} />
                    </div>
                    <h2 className="pap-success-title">Alamat Terkirim!</h2>
                    <p className="pap-success-msg">
                        Terima kasih, <strong>{selectedPeserta?.nama}</strong>. Alamat pengiriman Anda telah berhasil tersimpan di dalam sistem kami.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={() => window.print()} className="pap-success-btn" style={{ background: 'var(--accent-blue)' }}>
                            <Printer size={18} />
                            <span>Cetak Alamat Pengiriman (PDF)</span>
                        </button>

                    </div>
                </div>
                {/* Hidden Layout specifically for windows.print() */}
                <PrintAlamatPengiriman alamatList={printData} />
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
                            <h1>{settings.appTitle || 'DATABASE PELATIHAN'}</h1>
                            <p>Alamat Pengiriman — {publicSettings?.levelName || levelSlug}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link to={`/public/${levelSlug}`} className="pp-theme-btn" title="Kembali" style={{ textDecoration: 'none' }}>
                            <ArrowLeft style={{ width: '18px', height: '18px' }} />
                        </Link>
                        <button onClick={toggle} className="pp-theme-btn" aria-label="Toggle theme">
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="fup-main">
                <div className="fup-page-header">
                    <h2 className="fup-page-title">Alamat Pengiriman Paket</h2>
                    <p className="fup-page-subtitle">Silakan isi alamat lengkap Anda untuk pengiriman paket pelatihan.</p>
                </div>

                <div className="fup-notice">
                    <div className="fup-notice-icon">
                        <AlertCircle size={20} />
                    </div>
                    <div className="fup-notice-body">
                        <p><strong>Pastikan alamat pengiriman valid dan lengkap.</strong></p>
                        <p>Paket sertifikat / peralatan pelatihan akan dikirim melalui jasa ekspedisi ke alamat yang Anda berikan berikut ini.</p>
                        <p>Jika ada pertanyaan atau perubahan bisa menghubungi Admin (<a href="https://wa.me/6285786018422" target="_blank" rel="noopener noreferrer">+6285786018422</a>)</p>
                    </div>
                </div>

                <form onSubmit={handleClickKirim}>
                    {/* Pencarian Peserta */}
                    <div className="fup-card">
                        <div className="fup-card-header">
                            <div className="fup-card-header-icon blue">
                                <Search size={16} />
                            </div>
                            <h3 className="fup-card-title">Identitas Peserta</h3>
                        </div>
                        <div className="fup-card-body">
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
                                                <p className="fup-dropdown-item-name">{formatString(p.nama, textFormat)}</p>
                                                {p.cabor && (
                                                    <span className="badge badge-blue" style={{ fontSize: '10px', marginTop: '4px' }}>{p.cabor}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedPeserta && (
                                    <div className="pap-selected-peserta">
                                        <div className="pap-selected-icon">
                                            <Check size={16} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)' }}>{selectedPeserta.nama}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedPeserta.cabor || selectedPeserta.provinsi || '-'}</p>
                                        </div>
                                        <button type="button" onClick={() => { setSelectedPeserta(null); setSearchNama(''); setAlreadySubmitted(false); setExistingAlamatId(null); setForm({ ...emptyForm }); }} className="pap-selected-clear" title="Ganti Nama">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                                {alreadySubmitted && (
                                    <div className="pap-already-alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertCircle size={16} />
                                            <span>Batas pengisian alamat pengiriman hanya 1x.</span>
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                                            Kami menemukan data profil pengiriman Anda sebelumnya. Jika Anda ingin memperbaiki data tersebut, silakan perbarui pada formulir di bawah dan kirim kembali.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Alamat */}
                    {selectedPeserta && (
                        <div className="fup-card animated fadeIn">
                            <div className="fup-card-header">
                                <div className="fup-card-header-icon amber">
                                    <Package size={16} />
                                </div>
                                <h3 className="fup-card-title">Rincian Alamat</h3>
                            </div>
                            <div className="fup-card-body fup-grid-2">
                                <div>
                                    <label className="fup-field-label">
                                        Nama Penerima <span className="fup-required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="fup-input"
                                        placeholder={`Contoh: ${selectedPeserta.nama.split(' ')[0]}`}
                                        value={form.namaPenerima}
                                        onChange={e => update('namaPenerima', e.target.value)}
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                        *Boleh berbeda dengan nama peserta pelatihan
                                    </p>
                                </div>
                                <div>
                                    <label className="fup-field-label">
                                        Nomor HP Penerima <span className="fup-required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        className="fup-input"
                                        placeholder={`Contoh: ${(selectedPeserta.wa && selectedPeserta.wa !== '-' && selectedPeserta.wa.length > 3) ? selectedPeserta.wa.slice(0, -3) + '***' : '081234567***'}`}
                                        value={form.nomorHP}
                                        onChange={e => update('nomorHP', e.target.value)}
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Nomor yang bisa dihubungi kurir</p>
                                </div>
                                <div>
                                    <label className="fup-field-label">Provinsi <span className="fup-required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={form.provinsiId}
                                            onChange={handleProvinsiChange}
                                            className="fup-input"
                                            style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            <option value="">-- Pilih Provinsi --</option>
                                            {provinsiList.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                </div>

                                <div className="fup-col-2">
                                    <label className="fup-field-label">Kabupaten/Kota <span className="fup-required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={form.kabupatenId}
                                            onChange={handleKabupatenChange}
                                            disabled={!form.provinsiId}
                                            className="fup-input"
                                            style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            <option value="">{form.provinsiId ? '-- Pilih Kab/Kota --' : 'Pilih Provinsi dahulu'}</option>
                                            {kabupatenList.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                    {loadingWilayah.kab && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat kota...</span>}
                                </div>

                                <div className="fup-col-2">
                                    <label className="fup-field-label">Kecamatan <span className="fup-required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={form.kecamatanId}
                                            onChange={handleKecamatanChange}
                                            disabled={!form.kabupatenId}
                                            className="fup-input"
                                            style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            <option value="">{form.kabupatenId ? '-- Pilih Kecamatan --' : 'Pilih Kota dahulu'}</option>
                                            {kecamatanList.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                    {loadingWilayah.kec && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat kecamatan...</span>}
                                </div>

                                <div className="fup-col-2">
                                    <label className="fup-field-label">Kelurahan/Desa <span className="fup-required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={form.kelurahanId}
                                            onChange={handleKelurahanChange}
                                            disabled={!form.kecamatanId}
                                            className="fup-input"
                                            style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                        >
                                            <option value="">{form.kecamatanId ? '-- Pilih Kelurahan --' : 'Pilih Kecamatan dahulu'}</option>
                                            {kelurahanList.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                    {loadingWilayah.kel && <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>Memuat desa...</span>}
                                </div>
                                <div className="fup-col-2">
                                    <label className="fup-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Kode Pos <span className="fup-required">*</span>
                                        {kodePosAutoFilled && (
                                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '1px 6px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
                                            title="Isi otomatis wilayah dari kode pos"
                                            style={{
                                                flexShrink: 0,
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '0 14px', height: '42px',
                                                background: (searchingKodePos || form.kodePos.length !== 5) ? 'var(--bg-input)' : 'var(--accent-blue)',
                                                color: (searchingKodePos || form.kodePos.length !== 5) ? 'var(--text-muted)' : 'white',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px', cursor: (searchingKodePos || form.kodePos.length !== 5) ? 'not-allowed' : 'pointer',
                                                fontSize: '12px', fontWeight: 600,
                                                transition: 'all 0.2s', whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {searchingKodePos
                                                ? <><Loader2 size={14} className="spin" /> Mencari...</>
                                                : <><Search size={14} /> Cari Wilayah</>
                                            }
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                        *Kode pos terisi otomatis saat pilih Kelurahan, atau klik &ldquo;Cari Wilayah&rdquo; untuk isi wilayah dari kode pos
                                    </p>
                                </div>

                                <div className="fup-full-span">
                                    <label className="fup-field-label" style={{ marginBottom: '6px' }}>
                                        Alamat Rumah & Patokan <span className="fup-required">*</span>
                                    </label>
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                                        padding: '10px 12px', background: 'var(--accent-amber-light, rgba(245, 158, 11, 0.08))',
                                        border: '1px solid var(--accent-amber-border, rgba(245, 158, 11, 0.2))',
                                        borderRadius: '8px', marginBottom: '12px'
                                    }}>
                                        <AlertCircle size={16} style={{ color: 'var(--accent-amber, #f59e0b)', flexShrink: 0, marginTop: '2px' }} />
                                        <p style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.4 }}>
                                            Perhatian: Tidak perlu menulis Kelurahan, Kecamatan, Kota, & Provinsi lagi karena sudah dipilih di atas!
                                        </p>
                                    </div>
                                    <textarea
                                        className="fup-input fup-textarea"
                                        rows="3"
                                        placeholder="Contoh: Jl. Sudirman No 123 RT 01/RW 02, Rumah pagar hitam depan alfamart"
                                        value={form.alamatDetail}
                                        onChange={e => update('alamatDetail', e.target.value)}
                                    />
                                </div>

                                <div className="fup-full-span" style={{ marginTop: '8px' }}>
                                    {/* Redesigned Payment Info Card */}
                                    <div className="ppj-transfer-card" style={{ marginBottom: '20px' }}>
                                        <div className="ppj-transfer-header">
                                            <span className="ppj-transfer-title">📋 Biaya Pengiriman Paket</span>
                                        </div>
                                        <div className="ppj-transfer-body">
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                                                Berikut rincian biaya ongkos kirim paket pelatihan:
                                            </p>
                                            <div className="ppj-price-list">
                                                <div className="ppj-price-row">
                                                    <span className="ppj-price-label">
                                                        <Package size={13} style={{ opacity: 0.5 }} />
                                                        Wilayah Jawa & Bali
                                                    </span>
                                                    <span className="ppj-price-value">Rp 25.000</span>
                                                </div>
                                                <div className="ppj-price-row">
                                                    <span className="ppj-price-label">
                                                        <Package size={13} style={{ opacity: 0.5 }} />
                                                        Luar Jawa & Bali
                                                    </span>
                                                    <span className="ppj-price-value">Rp 50.000</span>
                                                </div>
                                            </div>
                                            <div className="ppj-price-divider" />
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                                                Transfer sesuai wilayah tujuan pengiriman Anda.
                                            </p>
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

                                    {/* Upload Bukti */}
                                    <label className="fup-field-label">
                                        Bukti Pembayaran Ongkir {!existingAlamatId && <span className="fup-required">*</span>}
                                        {existingAlamatId && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '6px' }}>(Opsional)</span>}
                                    </label>

                                    <label htmlFor="file-upload" className="ppj-upload-area"
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            handleFileChange(e);
                                        }}
                                    >
                                        <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.7 }} />
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            Klik atau drag & drop gambar ke sini
                                        </p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Maksimal ukuran file: 1MB (Format: JPG, PNG)
                                        </p>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            accept="image/*"
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
                                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {fileName}
                                                </p>
                                                <p style={{ fontSize: '11px', color: 'var(--accent-emerald)', margin: 0, marginTop: '2px' }}>Siap untuk diunggah</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setFileName(''); setFileMimeType(''); setFileBukti(null); setExistingBuktiUrl(''); document.getElementById('file-upload').value = ''; }}
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                                title="Hapus file"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedPeserta && (
                        <div className="fup-submit-section">
                            <label style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                background: 'var(--bg-card)', padding: '16px',
                                border: '1px solid var(--border-color)', borderRadius: '10px',
                                marginBottom: '20px', cursor: 'pointer', textAlign: 'left'
                            }}>
                                <input
                                    type="checkbox"
                                    required
                                    checked={confirmInfo}
                                    onChange={(e) => setConfirmInfo(e.target.checked)}
                                    style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    Harap cek kembali isian alamat Anda di atas, data yang masuk ke sistem adalah data yang akan dikirim, <strong style={{ color: 'var(--accent-rose)' }}>panitia tidak bertanggung jawab atas kesalahan penulisan atau perpindahan alamat</strong>. <span className="fup-required">*</span>
                                </span>
                            </label>
                            <button type="submit" className="fup-submit-btn" disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 size={18} className="spin" /> Menyimpan...</>
                                ) : existingAlamatId ? (
                                    <><RotateCcw size={18} /> Perbarui Alamat</>
                                ) : (
                                    <><Save size={18} /> Kirim Alamat</>
                                )}
                            </button>
                        </div>
                    )}

                </form>
            </main>

            {showVerifyWa && (
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
                                                <a href="https://wa.me/6285786018422?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20verifikasi%20saat%20isi%20alamat%20pengiriman." target="_blank" rel="noopener noreferrer" className="pp-wa-btn">
                                                    <MessageCircle style={{ width: '15px', height: '15px' }} /> 085786018422
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
            )}

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}
