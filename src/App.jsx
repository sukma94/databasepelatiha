import * as React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserPlus, Users, Settings as SettingsIcon, Menu, Layout, Sun, Moon, Wallet, Shirt, TrendingDown, CaseUpper, CaseSensitive, CaseLower, ChevronLeft, ChevronRight, LogOut, Globe, MessageSquare, FileText, X, Award, MapPin, ShoppingBag } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
// ... imports
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const TambahPeserta = React.lazy(() => import('./pages/TambahPeserta'));
const DaftarPeserta = React.lazy(() => import('./pages/DaftarPeserta'));
const DaftarPembayaran = React.lazy(() => import('./pages/DaftarPembayaran'));
const RekapSize = React.lazy(() => import('./pages/RekapSize'));
const CashFlow = React.lazy(() => import('./pages/CashFlow'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AppSettings = React.lazy(() => import('./pages/AppSettings'));
const Login = React.lazy(() => import('./pages/Login'));
const PublicPeserta = React.lazy(() => import('./pages/PublicPeserta'));
const PublicLanding = React.lazy(() => import('./pages/PublicLanding'));
const PublishPeserta = React.lazy(() => import('./pages/PublishPeserta'));
const SaranEdit = React.lazy(() => import('./pages/SaranEdit'));
const FormulirUpdatePeserta = React.lazy(() => import('./pages/FormulirUpdatePeserta'));
const FormulirLanding = React.lazy(() => import('./pages/FormulirLanding'));
const DaftarFormulir = React.lazy(() => import('./pages/DaftarFormulir'));
const PublicAlamatPengiriman = React.lazy(() => import('./pages/PublicAlamatPengiriman'));
const PublicSertifikat = React.lazy(() => import('./pages/PublicSertifikat'));
const SertifikatLanding = React.lazy(() => import('./pages/SertifikatLanding'));
const ImportSertifikat = React.lazy(() => import('./pages/ImportSertifikat'));
const AlamatPengiriman = React.lazy(() => import('./pages/AlamatPengiriman'));
const AdminPemesananJersey = React.lazy(() => import('./pages/AdminPemesananJersey'));
const PublicPemesananJersey = React.lazy(() => import('./pages/PublicPemesananJersey'));
import { getAppSettings } from './utils/storage';
import { DataProvider, useData } from './context/DataContext';

const navItems = [
  { to: '/pengelola', label: 'Dashboard', icon: LayoutDashboard, color: '#6366f1' },
  { to: '/pengelola/settings', label: 'Kategori Pelatihan', icon: SettingsIcon, color: '#64748b' },
  { to: '/pengelola/tambah', label: 'Tambah Peserta', icon: UserPlus, color: '#10b981' },
  { to: '/pengelola/publish', label: 'Publish Peserta', icon: Globe, color: '#06b6d4' },
  { to: '/pengelola/peserta', label: 'Daftar Peserta', icon: Users, color: '#3b82f6' },
  { to: '/pengelola/pembayaran', label: 'Pembayaran', icon: Wallet, color: '#f59e0b' },
  { to: '/pengelola/cashflow', label: 'Cash Flow', icon: TrendingDown, color: '#ef4444' },
  { to: '/pengelola/rekap-size', label: 'Size Baju', icon: Shirt, color: '#8b5cf6' },
  { to: '/pengelola/saran-edit', label: 'Saran Edit', icon: MessageSquare, color: '#f97316' },
  { to: '/pengelola/formulir-responses', label: 'Update Formulir', icon: FileText, color: '#14b8a6' },
  { to: '/pengelola/import-sertifikat', label: 'Import Sertifikat', icon: Award, color: '#f59e0b' },
  { to: '/pengelola/alamat-pengiriman', label: 'Alamat Pengiriman', icon: MapPin, color: '#ef4444' },
  { to: '/pengelola/app-settings', label: 'Pengaturan', icon: Layout, color: '#a855f7' },
  { to: '/pengelola/pemesanan-jersey', label: 'Pemesanan Jersey', icon: ShoppingBag, color: '#10b981' },
];

function Sidebar({ open, onClose, settings, collapsed, setCollapsed }) {
  const { dark, toggle } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const logoSrc = dark
    ? (settings.logoDark || "/logo/sportunys 2 Putih.png")
    : (settings.logoLight || "/logo/sportunys 2 Hitam.png");

  const sidebarWidth = collapsed ? '100px' : '280px';
  const sidebarWidthPx = collapsed ? 100 : 280;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Position tooltip at the vertical center of the hovered element
  const handleTooltipHover = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    el.style.setProperty('--tt-top', `${centerY}px`);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'var(--bg-modal-overlay)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:sticky lg:top-0 shadow-xl`}
        style={{ width: sidebarWidth, minWidth: sidebarWidth, '--sidebar-tooltip-left': `${sidebarWidthPx + 12}px` }}
      >
        <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: collapsed ? 0.3 : 1, transition: 'opacity 0.2s' }}>
            <img
              src={logoSrc}
              alt="Logo"
              style={{ height: collapsed ? '32px' : '52px', width: 'auto', objectFit: 'contain', transition: 'all 0.3s' }}
            />
            {!collapsed && (
              <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-blue)', textAlign: 'center', letterSpacing: '0.5px' }}>
                {settings.appTitle || 'DATABASE PELATIHAN'}
              </h1>
            )}
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="sidebar-close-btn"
            aria-label="Tutup menu"
          >
            <X size={16} />
          </button>

          {/* Collapse toggle for desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="lg:flex hidden"
            style={{
              position: 'absolute', right: '-14px', top: '32px',
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--accent-blue)', color: 'white',
              border: '4px solid var(--bg-sidebar)',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100,
              boxShadow: 'var(--shadow-md)', transition: 'all 0.2s'
            }}
            data-tooltip={collapsed ? "Buka Sidebar" : "Tutup Sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/pengelola'}
                onClick={onClose}
                {...(collapsed ? { "data-tooltip-right": item.label, onMouseEnter: handleTooltipHover } : {})}
                style={{ textDecoration: 'none', '--nav-accent': item.color }}
                className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <div className="sidebar-nav-icon" style={{
                      background: isActive ? item.color : `${item.color}15`,
                      color: isActive ? '#fff' : item.color,
                    }}>
                      <item.icon style={{ width: '18px', height: '18px', minWidth: '18px' }} />
                    </div>
                    {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav >

        {/* Preferences + Theme Toggle + Logout + Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            {...(collapsed ? { "data-tooltip-right": dark ? 'Mode Terang' : 'Mode Gelap', onMouseEnter: handleTooltipHover } : {})}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
              padding: collapsed ? '12px 0' : '10px 14px', borderRadius: '12px', background: 'var(--bg-input)',
              cursor: collapsed ? 'pointer' : 'default'
            }}
            onClick={collapsed ? toggle : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {dark ? <Moon key="moon" className="theme-icon-anim" style={{ width: '18px', height: '18px', color: 'var(--accent-blue)' }} /> : <Sun key="sun" className="theme-icon-anim" style={{ width: '18px', height: '18px', color: 'var(--accent-amber)' }} />}
              {!collapsed && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {dark ? 'Dark Mode' : 'Light Mode'}
                </span>
              )}
            </div>
            {!collapsed && <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" />}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            {...(collapsed ? { "data-tooltip-right": "Logout", onMouseEnter: handleTooltipHover } : {})}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? '0' : '10px',
              padding: collapsed ? '12px 0' : '10px 14px', borderRadius: '12px',
              background: 'var(--accent-rose-light)', border: '1px solid var(--accent-rose-border)',
              color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              transition: 'all 0.2s ease', width: '100%'
            }}
          >
            <LogOut style={{ width: '18px', height: '18px', minWidth: '18px' }} />
            {!collapsed && <span>Logout</span>}
          </button>

          {!collapsed && (
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
              © 2026 GSP Projects
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

const { useState, useEffect } = React;

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { dark, toggle } = useTheme();
  const { appSettings: settings, loading } = useData();

  useEffect(() => {
    if (settings) {
      document.body.style.fontFamily = settings.fontFamily;
      document.title = settings.appTitle || 'Database Pelatihan';

      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      
      const faviconUrl = (dark ? settings.logoDark : settings.logoLight) || '/logo/sportunys 2 Hitam.png';
      link.href = faviconUrl;
    }
  }, [settings, dark]);

  if (loading || !settings) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        settings={settings}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <main style={{ flex: 1, minHeight: '100vh', minWidth: 0, transition: 'all 0.3s ease' }}>
        {/* Mobile Top Bar */}
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-topbar-btn"
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-topbar-brand">
            <img
              src={dark ? (settings.logoDark || '/logo/sportunys 2 Putih.png') : (settings.logoLight || '/logo/sportunys 2 Hitam.png')}
              alt="Logo"
              style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
            />
            <span className="mobile-topbar-title">{settings.appTitle || 'DATABASE PELATIHAN'}</span>
          </div>
          <div style={{ width: '40px' }} />{/* Spacer for centering */}
        </div>

        <div className="admin-content-wrapper">
          <React.Suspense fallback={
            <div style={{ display: 'flex', height: '50vh', alignItems: 'center', justifyContent: 'center' }}>
              <div className="login-spinner" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tambah" element={<TambahPeserta />} />
              <Route path="/peserta" element={<DaftarPeserta />} />
              <Route path="/pembayaran" element={<DaftarPembayaran />} />
              <Route path="/cashflow" element={<CashFlow />} />
              <Route path="/rekap-size" element={<RekapSize />} />
              <Route path="/publish" element={<PublishPeserta />} />
              <Route path="/saran-edit" element={<SaranEdit />} />
              <Route path="/formulir-responses" element={<DaftarFormulir />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/import-sertifikat" element={<ImportSertifikat />} />
              <Route path="/alamat-pengiriman" element={<AlamatPengiriman />} />
              <Route path="/pemesanan-jersey" element={<AdminPemesananJersey />} />
              <Route path="/app-settings" element={<AppSettings />} />
              <Route path="*" element={<Navigate to="/pengelola" replace />} />
            </Routes>
          </React.Suspense>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <React.Suspense fallback={
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
              <div className="login-spinner" />
            </div>
          }>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<PublicLanding />} />
              <Route path="/peserta/:levelSlug" element={<PublicPeserta />} />
              <Route path="/formulir" element={<FormulirLanding />} />
              <Route path="/formulir/:levelSlug" element={<FormulirUpdatePeserta />} />
              <Route path="/sertifikat" element={<SertifikatLanding />} />
              <Route path="/sertifikat/:levelSlug" element={<PublicSertifikat />} />
              <Route path="/alamat-pengiriman/:levelSlug" element={<PublicAlamatPengiriman />} />
              <Route path="/pesan-jersey" element={<PublicPemesananJersey />} />
              <Route path="/login" element={<Login />} />

              {/* Protected admin routes */}
              <Route path="/pengelola/*" element={
                <ProtectedRoute>
                  <DataProvider>
                    <AdminLayout />
                  </DataProvider>
                </ProtectedRoute>
              } />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
