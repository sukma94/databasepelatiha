import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { Sun, Moon, Award, ArrowRight, ArrowLeft, GraduationCap, Users, Calendar } from 'lucide-react';
import { getAppSettings, getSertifikatData, getLevels } from '../utils/storage';
import { slugify } from '../utils/storage';
import './PublicPeserta.css';
import './PublicLanding.css';

export default function SertifikatLanding() {
    const [settings, setSettings] = useState(null);
    const [data, setData] = useState([]);
    const [levels, setLevels] = useState({});
    const [loaded, setLoaded] = useState(false);
    const { dark, toggle } = useTheme();

    useEffect(() => {
        const load = async () => {
            const [s, d, l] = await Promise.all([getAppSettings(), getSertifikatData(), getLevels()]);
            setSettings(s);
            setData(d);
            setLevels(l);
            requestAnimationFrame(() => setLoaded(true));
        };
        load();
    }, []);

    // Group sertifikat by level and count
    const levelCards = useMemo(() => {
        const levelMap = {};
        data.forEach(p => {
            const lvl = p.level || 'Lainnya';
            if (!levelMap[lvl]) levelMap[lvl] = 0;
            levelMap[lvl]++;
        });
        return Object.entries(levelMap).map(([levelName, count]) => ({
            levelName,
            slug: slugify(levelName),
            count,
            tanggal: levels[levelName]?.tanggal || '',
        }));
    }, [data, levels]);

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    if (!settings) {
        return (
            <div className="pl-loading-screen">
                <div className="pl-loading-spinner">
                    <div className="pl-spinner-ring" />
                </div>
            </div>
        );
    }

    return (
        <div className={`pl-root ${loaded ? 'pl-loaded' : ''}`}>
            {/* Background mesh */}
            <div className="pl-bg-mesh">
                <div className="pl-mesh-orb pl-mesh-orb-1" />
                <div className="pl-mesh-orb pl-mesh-orb-2" />
                <div className="pl-mesh-orb pl-mesh-orb-3" />
            </div>

            {/* Navbar */}
            <nav className="pl-navbar">
                <div className="pl-navbar-inner">
                    <div className="pl-navbar-brand">
                        <img src={logoSrc} alt="Logo" className="pl-navbar-logo" />
                        <span className="pl-navbar-title">{settings.appTitle || 'DATABASE PELATIHAN'}</span>
                    </div>
                    <div className="pl-navbar-actions">
                        <Link to="/" className="pl-theme-toggle" title="Kembali" aria-label="Kembali">
                            <ArrowLeft size={18} />
                        </Link>
                        <button onClick={toggle} className="pl-theme-toggle" aria-label="Toggle theme">
                            {dark
                                ? <Sun key="sun" className="theme-icon-anim" size={18} />
                                : <Moon key="moon" className="theme-icon-anim" size={18} />
                            }
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pl-hero-section">
                <div className="pl-hero-content">
                    <div className="pl-hero-badge">
                        <GraduationCap size={14} />
                        <span>Sertifikat Pelatihan</span>
                    </div>
                    <h1 className="pl-hero-title">
                        Sertifikat<br />
                        <span className="pl-hero-gradient-text">Peserta Pelatihan</span>
                    </h1>
                    <p className="pl-hero-subtitle">
                        Pilih jenis pelatihan untuk melihat dan mengunduh sertifikat yang telah diterbitkan.
                    </p>

                    {levelCards.length > 0 && (
                        <div className="pl-hero-stats">
                            <div className="pl-hero-stat">
                                <span className="pl-hero-stat-value">{levelCards.length}</span>
                                <span className="pl-hero-stat-label">Pelatihan</span>
                            </div>
                            <div className="pl-hero-stat-divider" />
                            <div className="pl-hero-stat">
                                <span className="pl-hero-stat-value">{data.length}</span>
                                <span className="pl-hero-stat-label">Total Sertifikat</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Cards Section */}
            <section className="pl-cards-section">
                <div className="pl-cards-container">
                    {levelCards.length === 0 ? (
                        <div className="pl-empty-state">
                            <div className="pl-empty-icon">
                                <Award size={32} />
                            </div>
                            <h2 className="pl-empty-title">Belum Ada Data Sertifikat</h2>
                            <p className="pl-empty-desc">
                                Admin belum mengunggah data sertifikat peserta pelatihan.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="pl-section-header">
                                <h2 className="pl-section-title">Pilih Pelatihan</h2>
                                <p className="pl-section-desc">Klik salah satu untuk melihat sertifikat peserta</p>
                            </div>

                            <div className="pl-cards-grid">
                                {levelCards.map((level, idx) => (
                                    <Link
                                        key={level.slug}
                                        to={`/sertifikat/${level.slug}`}
                                        className="pl-card"
                                        style={{ '--card-delay': `${idx * 0.08}s` }}
                                    >
                                        <div className="pl-card-glow" />
                                        <div className="pl-card-accent" />

                                        <div className="pl-card-body">
                                            <div className="pl-card-icon-wrap">
                                                <Award size={24} />
                                            </div>

                                            <h3 className="pl-card-title">{level.levelName}</h3>

                                            <div className="pl-card-info">
                                                <div className="pl-card-info-item">
                                                    <Users size={14} />
                                                    <span>{level.count} Sertifikat</span>
                                                </div>
                                                {level.tanggal && (
                                                    <div className="pl-card-info-item">
                                                        <Calendar size={14} />
                                                        <span>{level.tanggal}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pl-card-footer">
                                            <span>Lihat Sertifikat</span>
                                            <ArrowRight size={16} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="pl-footer">
                <p>© {new Date().getFullYear()} {settings.appTitle || 'Database Pelatihan'}. All rights reserved.</p>
            </footer>
        </div>
    );
}
