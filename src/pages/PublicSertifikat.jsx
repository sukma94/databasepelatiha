import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getAppSettings, getSertifikatData, getLevels, getPeserta, slugify, logCertView } from '../utils/storage';
import { Search, Users, Sun, Moon, Award, ExternalLink, ArrowLeft, Dumbbell, MapPin, GraduationCap, Lock, ArrowUpDown, ChevronDown, X, MessageCircle, AlertTriangle } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import './PublicSertifikat.css';

export default function PublicSertifikat() {
    const { levelSlug } = useParams();
    const [settings, setSettings] = useState(null);
    const [allData, setAllData] = useState([]);
    const [levels, setLevels] = useState({});
    const [search, setSearch] = useState('');
    const [loaded, setLoaded] = useState(false);
    const { dark, toggle } = useTheme();

    // Sort state
    const [sortBy, setSortBy] = useState('default');
    const [sortDir, setSortDir] = useState('asc');

    // Password modal state
    const [passwordModal, setPasswordModal] = useState(null); // { peserta, href, label }
    const [passwordDigits, setPasswordDigits] = useState(['', '', '']);
    const [passwordError, setPasswordError] = useState('');
    const [shakeError, setShakeError] = useState(false);
    const [passwordAttempts, setPasswordAttempts] = useState(0);
    const digitRefs = [useRef(null), useRef(null), useRef(null)];



    // Peserta WA lookup map (nama → wa)
    const [waMap, setWaMap] = useState({});

    useEffect(() => {
        const load = async () => {
            const [s, d, l, pesertaList] = await Promise.all([
                getAppSettings(), getSertifikatData(), getLevels(), getPeserta()
            ]);
            setSettings(s);
            setAllData(d);
            setLevels(l);

            // Build WA lookup map from peserta database
            // Key = normalized name (lowercase trimmed), Value = WA number
            const map = {};
            pesertaList.forEach(p => {
                if (p.nama && p.wa) {
                    const key = p.nama.trim().toLowerCase();
                    map[key] = String(p.wa).replace(/\D/g, '');
                }
            });
            setWaMap(map);

            requestAnimationFrame(() => setLoaded(true));
        };
        load();
    }, []);

    // Find the matching level name from slug
    const levelName = useMemo(() => {
        if (!levelSlug) return null;
        const allLevelNames = [...new Set(allData.map(p => p.level).filter(Boolean))];
        return allLevelNames.find(name => slugify(name) === levelSlug) || null;
    }, [levelSlug, allData]);

    // Filter data by level + attach WA from peserta database
    const data = useMemo(() => {
        if (!levelName) return [];
        return allData
            .filter(p => p.level === levelName)
            .map(p => {
                // Look up WA from peserta database by name
                const nameKey = (p.nama || '').trim().toLowerCase();
                const waFromDb = waMap[nameKey] || '';
                return { ...p, _wa: waFromDb };
            });
    }, [allData, levelName, waMap]);

    // Check if any row has linkSportunys
    const hasSportunys = useMemo(() => {
        return data.some(p => p.linkSportunys);
    }, [data]);

    // Filtered + sorted data
    const filtered = useMemo(() => {
        let result = data;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                (p.nama || '').toLowerCase().includes(q) ||
                (p.cabor || '').toLowerCase().includes(q) ||
                (p.provinsi || '').toLowerCase().includes(q)
            );
        }
        if (sortBy !== 'default') {
            result = [...result].sort((a, b) => {
                let valA = '', valB = '';
                if (sortBy === 'nama') {
                    valA = (a.nama || '').toLowerCase();
                    valB = (b.nama || '').toLowerCase();
                } else if (sortBy === 'cabor') {
                    valA = (a.cabor || '').toLowerCase();
                    valB = (b.cabor || '').toLowerCase();
                } else if (sortBy === 'provinsi') {
                    valA = (a.provinsi || '').toLowerCase();
                    valB = (b.provinsi || '').toLowerCase();
                }
                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, search, sortBy, sortDir]);

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    // ===== Password modal handlers =====
    const handleCertClick = (peserta, href, label) => {
        // Show password modal if peserta has a WA number (from peserta DB)
        if (peserta._wa) {
            setPasswordModal({ peserta, href, label });
            setPasswordDigits(['', '', '']);
            setPasswordError('');
            setShakeError(false);
            setPasswordAttempts(0);
            setTimeout(() => digitRefs[0].current?.focus(), 100);
        } else {
            // No WA number — open directly in new tab & log view
            window.open(href, '_blank');
            logCertView({
                sertifikatId: peserta.id,
                nama: peserta.nama,
                level: peserta.level,
                certType: label,
            });
        }
    };

    const closePasswordModal = () => {
        setPasswordModal(null);
        setPasswordDigits(['', '', '']);
        setPasswordError('');
        setShakeError(false);
        setPasswordAttempts(0);
    };

    const handleDigitChange = (index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newDigits = [...passwordDigits];
        newDigits[index] = digit;
        setPasswordDigits(newDigits);
        setPasswordError('');
        setShakeError(false);

        if (digit && index < 2) {
            digitRefs[index + 1].current?.focus();
        }

        // Auto-submit when all 3 digits entered
        if (digit && index === 2 && passwordModal) {
            const entered = newDigits.join('');
            const waNumber = String(passwordModal.peserta._wa || '').replace(/\D/g, '');
            const last3 = waNumber.slice(-3);

            if (entered === last3) {
                // Password correct — open in new tab & log view
                window.open(passwordModal.href, '_blank');
                logCertView({
                    sertifikatId: passwordModal.peserta.id,
                    nama: passwordModal.peserta.nama,
                    level: passwordModal.peserta.level,
                    certType: passwordModal.label,
                });
                closePasswordModal();
            } else {
                setPasswordAttempts(prev => prev + 1);
                setPasswordError('3 digit terakhir No. WA tidak cocok.');
                setShakeError(true);
                setTimeout(() => {
                    setPasswordDigits(['', '', '']);
                    setShakeError(false);
                    digitRefs[0].current?.focus();
                }, 600);
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !passwordDigits[index] && index > 0) {
            digitRefs[index - 1].current?.focus();
        }
        if (e.key === 'Escape') {
            closePasswordModal();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 3);
        if (pasted.length === 3 && passwordModal) {
            const newDigits = pasted.split('');
            setPasswordDigits(newDigits);
            setPasswordError('');

            const waNumber = String(passwordModal.peserta._wa || '').replace(/\D/g, '');
            const last3 = waNumber.slice(-3);

            if (pasted === last3) {
                window.open(passwordModal.href, '_blank');
                logCertView({
                    sertifikatId: passwordModal.peserta.id,
                    nama: passwordModal.peserta.nama,
                    level: passwordModal.peserta.level,
                    certType: passwordModal.label,
                });
                closePasswordModal();
            } else {
                setPasswordAttempts(prev => prev + 1);
                setPasswordError('3 digit terakhir No. WA tidak cocok.');
                setShakeError(true);
                setTimeout(() => {
                    setPasswordDigits(['', '', '']);
                    setShakeError(false);
                    digitRefs[0].current?.focus();
                }, 600);
            }
        }
    };

    // Sort toggle
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDir('asc');
        }
    };

    if (!settings) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div className="login-spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    // Not found
    if (loaded && !levelName) {
        return (
            <div className={`ps-root ps-loaded`}>
                <nav className="ps-navbar">
                    <div className="ps-navbar-inner">
                        <div className="ps-navbar-brand">
                            <img src={logoSrc} alt="Logo" className="ps-navbar-logo" />
                            <span className="ps-navbar-title">{settings.appTitle || 'DATABASE PELATIHAN'}</span>
                        </div>
                        <div className="ps-navbar-actions">
                            <Link to="/sertifikat" className="ps-back-btn" title="Kembali">
                                <ArrowLeft size={18} />
                            </Link>
                            <button onClick={toggle} className="ps-theme-toggle" aria-label="Toggle theme">
                                {dark ? <Sun key="sun" className="theme-icon-anim" size={18} /> : <Moon key="moon" className="theme-icon-anim" size={18} />}
                            </button>
                        </div>
                    </div>
                </nav>
                <div className="ps-content" style={{ paddingTop: '40px' }}>
                    <div className="ps-empty-state">
                        <div className="ps-empty-icon">
                            <Award size={32} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Halaman Tidak Ditemukan
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            Data sertifikat untuk pelatihan ini belum tersedia.
                        </p>
                        <Link to="/sertifikat" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', borderRadius: '12px',
                            background: 'var(--accent-blue)', color: 'white',
                            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
                        }}>
                            <ArrowLeft size={16} />
                            Kembali ke Daftar Pelatihan
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // CertButton component
    const CertButton = ({ peserta, href, label, className }) => {
        if (!href) return null;
        const needsPassword = !!peserta._wa;
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCertClick(peserta, href, label);
                }}
                className={`ps-cert-btn ${className}`}
                title={needsPassword ? 'Konfirmasi 3 digit terakhir No. WA' : `Lihat ${label}`}
            >
                {needsPassword ? <Lock size={12} /> : <ExternalLink size={12} />}
                {label}
            </button>
        );
    };

    // Sort options config
    const sortOptions = [
        { value: 'default', label: 'Urutan Default' },
        { value: 'nama', label: 'Nama (A-Z)' },
        { value: 'cabor', label: 'Cabang Olahraga' },
        { value: 'provinsi', label: 'Provinsi' },
    ];

    return (
        <div className={`ps-root ${loaded ? 'ps-loaded' : ''}`}>
            {/* Background mesh */}
            <div className="ps-bg-mesh">
                <div className="ps-mesh-orb ps-mesh-orb-1" />
                <div className="ps-mesh-orb ps-mesh-orb-2" />
                <div className="ps-mesh-orb ps-mesh-orb-3" />
            </div>

            {/* Navbar */}
            <nav className="ps-navbar">
                <div className="ps-navbar-inner">
                    <div className="ps-navbar-brand">
                        <img src={logoSrc} alt="Logo" className="ps-navbar-logo" />
                        <span className="ps-navbar-title">{settings.appTitle || 'DATABASE PELATIHAN'}</span>
                    </div>
                    <div className="ps-navbar-actions">
                        <Link to="/sertifikat" className="ps-back-btn" title="Kembali">
                            <ArrowLeft size={18} />
                        </Link>
                        <button onClick={toggle} className="ps-theme-toggle" aria-label="Toggle theme">
                            {dark
                                ? <Sun key="sun" className="theme-icon-anim" size={18} />
                                : <Moon key="moon" className="theme-icon-anim" size={18} />
                            }
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="ps-hero-section">
                <div className="ps-hero-content">
                    <div className="ps-hero-badge">
                        <GraduationCap size={14} />
                        <span>Sertifikat — {levelName}</span>
                    </div>
                    <h1 className="ps-hero-title">
                        Sertifikat<br />
                        <span className="ps-hero-gradient-text">{levelName}</span>
                    </h1>
                    <p className="ps-hero-subtitle">
                        Akses dan unduh sertifikat pelatihan {levelName} yang telah diterbitkan oleh LP2O Lankor, ICCA{hasSportunys ? ', dan Sportunys' : ''}.
                    </p>
                </div>
            </section>

            {/* Content */}
            <div className="ps-content">
                {data.length === 0 ? (
                    <div className="ps-empty-state">
                        <div className="ps-empty-icon">
                            <Award size={32} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Belum Ada Data Sertifikat
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                            Admin belum mengunggah data sertifikat untuk pelatihan {levelName}.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Search + Sort */}
                        <div className="ps-search-section">
                            <div className="ps-search-row">
                                <div className="ps-search-input-wrap">
                                    <Search className="ps-search-icon" />
                                    <input
                                        type="text"
                                        className="ps-search-input"
                                        placeholder="Cari berdasarkan nama, cabor, atau provinsi..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="ps-sort-wrap">
                                    <ArrowUpDown className="ps-sort-icon-prefix" />
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <CustomSelect
                                            value={sortBy}
                                            onChange={(val) => {
                                                setSortBy(val);
                                                setSortDir('asc');
                                            }}
                                            options={sortOptions}
                                        />
                                    </div>
                                    <ChevronDown className="ps-sort-chevron" />
                                </div>
                                {sortBy !== 'default' && (
                                    <button
                                        onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        className="ps-sort-dir-btn"
                                        title={sortDir === 'asc' ? 'A → Z' : 'Z → A'}
                                    >
                                        {sortDir === 'asc' ? '↑' : '↓'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Warning Info */}
                        <div className="ps-warning-notice" style={{
                            display: 'flex',
                            gap: '12px',
                            background: 'rgba(255, 170, 0, 0.1)',
                            border: '1px solid rgba(255, 170, 0, 0.3)',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            alignItems: 'flex-start'
                        }}>
                            <AlertTriangle size={20} style={{ color: '#ffaa00', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#ffaa00', fontWeight: 700 }}>Penting: Simpan Sertifikat Anda</h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Harap download dan simpan file sertifikat Anda di perangkat masing-masing. Data cloud sertifikat pada sistem ini dapat dihapus sewaktu-waktu untuk pemeliharaan ruang penyimpanan, jadi harap simpan baik-baik.
                                </p>
                            </div>
                        </div>

                        {/* Results Count */}
                        <div className="ps-results-info">
                            <span className="ps-results-count">
                                <Users size={14} />
                                {filtered.length} dari {data.length} peserta
                            </span>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="ps-empty-state">
                                <div className="ps-empty-icon">
                                    <Search size={32} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    Tidak ada data ditemukan
                                </h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Coba ubah kata kunci pencarian
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="ps-table-wrap">
                                    <table className="ps-table">
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th className="ps-th-sortable" onClick={() => handleSort('nama')}>
                                                    Nama Peserta
                                                    {sortBy === 'nama' && <span className="ps-sort-indicator">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                                                </th>
                                                <th className="ps-th-sortable" onClick={() => handleSort('cabor')}>
                                                    Cabang Olahraga
                                                    {sortBy === 'cabor' && <span className="ps-sort-indicator">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                                                </th>
                                                <th className="ps-th-sortable" onClick={() => handleSort('provinsi')}>
                                                    Provinsi
                                                    {sortBy === 'provinsi' && <span className="ps-sort-indicator">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                                                </th>
                                                <th>Sertifikat</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((p, i) => (
                                                <tr key={p.id}>
                                                    <td>{i + 1}</td>
                                                    <td className="ps-nama-cell">{(p.nama || '').toUpperCase()}</td>
                                                    <td>{(p.cabor || '').toUpperCase()}</td>
                                                    <td>{(p.provinsi || '').toUpperCase()}</td>
                                                    <td>
                                                        <div className="ps-cert-links">
                                                            <CertButton peserta={p} href={p.linkLankor} label="Lankor" className="ps-cert-lankor" />
                                                            <CertButton peserta={p} href={p.linkICCA} label="ICCA" className="ps-cert-icca" />
                                                            {hasSportunys && (
                                                                <CertButton peserta={p} href={p.linkSportunys} label="Sportunys" className="ps-cert-sportunys" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="ps-cards">
                                    {filtered.map((p, i) => (
                                        <div key={p.id} className="ps-card" style={{ animationDelay: `${Math.min(i * 0.02, 0.2)}s` }}>
                                            <div className="ps-card-header">
                                                <div className="ps-card-number">{i + 1}</div>
                                                <div className="ps-card-name">{(p.nama || '').toUpperCase()}</div>
                                            </div>
                                            <div className="ps-card-details">
                                                {p.cabor && (
                                                    <div className="ps-card-detail-item">
                                                        <Dumbbell />
                                                        <span>{(p.cabor || '').toUpperCase()}</span>
                                                    </div>
                                                )}
                                                {p.provinsi && (
                                                    <div className="ps-card-detail-item">
                                                        <MapPin />
                                                        <span>{(p.provinsi || '').toUpperCase()}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ps-card-certs">
                                                <CertButton peserta={p} href={p.linkLankor} label="Lankor" className="ps-cert-lankor" />
                                                <CertButton peserta={p} href={p.linkICCA} label="ICCA" className="ps-cert-icca" />
                                                {hasSportunys && (
                                                    <CertButton peserta={p} href={p.linkSportunys} label="Sportunys" className="ps-cert-sportunys" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Password Confirmation Modal */}
            {passwordModal && (
                <div className="ps-modal-overlay" onClick={closePasswordModal}>
                    <div className={`ps-password-card ${shakeError ? 'ps-shake' : ''}`} onClick={e => e.stopPropagation()}>
                        <button type="button" className="ps-modal-close" onClick={closePasswordModal}>
                            <X size={18} />
                        </button>
                        <div className="ps-password-icon">
                            <Lock size={28} />
                        </div>
                        <h2 className="ps-password-title">Konfirmasi Akses</h2>
                        <p className="ps-password-subtitle">
                            Masukkan <strong>3 digit terakhir</strong> nomor WhatsApp Anda untuk membuka sertifikat <strong>{passwordModal.label}</strong>
                        </p>
                        <p className="ps-password-nama">{(passwordModal.peserta.nama || '').toUpperCase()}</p>

                        <div className="ps-password-inputs">
                            {[0, 1, 2].map(i => (
                                <input
                                    key={i}
                                    ref={digitRefs[i]}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    className={`ps-password-digit ${passwordDigits[i] ? 'ps-digit-filled' : ''} ${passwordError ? 'ps-digit-error' : ''}`}
                                    value={passwordDigits[i]}
                                    onChange={(e) => handleDigitChange(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    onPaste={i === 0 ? handlePaste : undefined}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        {passwordError && (
                            <p className="ps-password-error">{passwordError}</p>
                        )}

                        {passwordAttempts > 0 && passwordAttempts < 3 && !passwordError && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                                Percobaan ke-{passwordAttempts} dari 3
                            </p>
                        )}

                        {passwordAttempts >= 3 && (
                            <div className="ps-admin-help">
                                <p className="ps-admin-help-title">Ada kendala? Hubungi admin:</p>
                                <div className="ps-admin-help-buttons">
                                    <a
                                        href="https://wa.me/6285786018422?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20akses%20sertifikat."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ps-admin-wa-btn"
                                    >
                                        <MessageCircle size={15} />
                                        085786018422
                                    </a>
                                    <a
                                        href="https://wa.me/6285270033705?text=Halo%20admin%2C%20saya%20mengalami%20kendala%20akses%20sertifikat."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ps-admin-wa-btn"
                                    >
                                        <MessageCircle size={15} />
                                        085270033705
                                    </a>
                                </div>
                            </div>
                        )}

                        <p className="ps-password-hint">
                            Contoh: No. WA 0812345678<strong>9</strong> → masukkan <strong>789</strong>
                        </p>
                    </div>
                </div>
            )}



            {/* Footer */}
            <footer className="ps-footer">
                <p>© {new Date().getFullYear()} {settings.appTitle || 'Database Pelatihan'}. All rights reserved.</p>
            </footer>
        </div>
    );
}
