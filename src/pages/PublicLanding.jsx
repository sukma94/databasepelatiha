import React, { useState, useEffect, useMemo } from 'react';
import { usePublicData } from '../utils/usePublicData';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { Users, Sun, Moon, ChevronRight, Calendar, Award, GraduationCap, ArrowRight } from 'lucide-react';
import './PublicPeserta.css';
import './PublicLanding.css';
import { isLevelArchived } from '../utils/dateUtils';

export default function PublicLanding() {
    const { peserta, levels, settings, allPublicSettings } = usePublicData({ fetchAll: true });
    const [loaded, setLoaded] = useState(false);

    const { dark, toggle } = useTheme();

    useEffect(() => {
        if (settings && allPublicSettings) {
            requestAnimationFrame(() => setLoaded(true));
        }
    }, [settings, allPublicSettings]);

    const publishedLevels = useMemo(() => {
        if (!allPublicSettings || !levels) return [];
        return Object.entries(allPublicSettings)
            .filter(([slug, s]) => s.isPublished && s.levelName && !isLevelArchived(levels[s.levelName]))
            .map(([slug, s]) => {
                const levelData = levels[s.levelName] || {};
                const levelPeserta = peserta.filter(p =>
                    p.level === s.levelName && p.statusKepesertaan !== 'Batal'
                );
                let publishedCount;
                if (s.publishAll) {
                    publishedCount = levelPeserta.length;
                } else {
                    const publishedIds = new Set(s.publishedIds || []);
                    publishedCount = levelPeserta.filter(p => publishedIds.has(p.id)).length;
                }
                return {
                    slug,
                    levelName: s.levelName,
                    tanggal: levelData.tanggal || '',
                    pesertaCount: publishedCount,
                };
            })
            .filter(l => l.pesertaCount > 0);
    }, [allPublicSettings, levels, peserta]);

    const totalPeserta = useMemo(() =>
        publishedLevels.reduce((sum, l) => sum + l.pesertaCount, 0),
        [publishedLevels]
    );

    const logoSrc = dark
        ? (settings?.logoDark || "/logo/sportunys 2 Putih.png")
        : (settings?.logoLight || "/logo/sportunys 2 Hitam.png");

    if (!settings || !allPublicSettings) {
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
            {/* Animated background mesh */}
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
                    <button onClick={toggle} className="pl-theme-toggle" aria-label="Toggle theme">
                        {dark
                            ? <Sun key="sun" className="theme-icon-anim" size={18} />
                            : <Moon key="moon" className="theme-icon-anim" size={18} />
                        }
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pl-hero-section">
                <div className="pl-hero-content">
                    <div className="pl-hero-badge">
                        <GraduationCap size={14} />
                        <span>Portal Data Peserta</span>
                    </div>
                    <h1 className="pl-hero-title">
                        Data Peserta<br />
                        <span className="pl-hero-gradient-text">Pelatihan</span>
                    </h1>
                    <p className="pl-hero-subtitle">
                        Akses informasi dan data peserta pelatihan yang telah dipublikasikan secara transparan.
                    </p>

                    {publishedLevels.length > 0 && (
                        <div className="pl-hero-stats">
                            <div className="pl-hero-stat">
                                <span className="pl-hero-stat-value">{publishedLevels.length}</span>
                                <span className="pl-hero-stat-label">Pelatihan</span>
                            </div>
                            <div className="pl-hero-stat-divider" />
                            <div className="pl-hero-stat">
                                <span className="pl-hero-stat-value">{totalPeserta}</span>
                                <span className="pl-hero-stat-label">Total Peserta</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Cards Section */}
            <section className="pl-cards-section">
                <div className="pl-cards-container">
                    {publishedLevels.length === 0 ? (
                        <div className="pl-empty-state">
                            <div className="pl-empty-icon">
                                <Users size={32} />
                            </div>
                            <h2 className="pl-empty-title">Belum Ada Data Dipublikasikan</h2>
                            <p className="pl-empty-desc">
                                Admin belum mempublikasikan data peserta pelatihan.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="pl-section-header">
                                <h2 className="pl-section-title">Pilih Pelatihan</h2>
                                <p className="pl-section-desc">Klik salah satu untuk melihat daftar peserta</p>
                            </div>

                            <div className="pl-cards-grid">
                                {publishedLevels.map((level, idx) => (
                                    <Link
                                        key={level.slug}
                                        to={`/peserta/${level.slug}`}
                                        className="pl-card"
                                        style={{ '--card-delay': `${idx * 0.08}s` }}
                                    >
                                        {/* Card glow effect on hover */}
                                        <div className="pl-card-glow" />

                                        {/* Top gradient bar */}
                                        <div className="pl-card-accent" />

                                        <div className="pl-card-body">
                                            <div className="pl-card-icon-wrap">
                                                <Award size={24} />
                                            </div>

                                            <h3 className="pl-card-title">{level.levelName}</h3>

                                            <div className="pl-card-info">
                                                <div className="pl-card-info-item">
                                                    <Users size={14} />
                                                    <span>{level.pesertaCount} Peserta</span>
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
                                            <span>Lihat Detail</span>
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
