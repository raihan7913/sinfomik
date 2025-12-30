import React, { useState, useEffect } from 'react';
import './DashboardPage.css'; // Impor CSS yang baru

// Import semua komponen fitur
import TASemester from '../features/admin/TASemester';
import Student from '../features/admin/student';
import Teacher from '../features/admin/teacher';
import ClassManagement from '../features/admin/classManagement';
import Course from '../features/admin/course';
// import GradeType from '../features/admin/grade'; // DISABLED - Fitur manajemen tipe nilai dihilangkan
import StudentClassEnroll from '../features/admin/studentClassEnroll';
import TeacherClassEnroll from '../features/admin/teacherClassEnroll';
import ClassPromote from '../features/admin/classPromote';
import CapaianPembelajaranManagement from '../features/admin/capaianPembelajaranManagement';
import AdminAnalytics from '../features/admin/analytics';
import InputNilai from '../features/guru/inputNilai';
import RekapNilai from '../features/guru/rekapNilai';
// import PenilaianCapaianPembelajaran from '../features/guru/cp'; // DISABLED - Fitur dihilangkan
import WaliKelasGradeView from '../features/guru/WaliKelasGradeView';
// import GuruAnalytics from '../features/guru/analytics'; // DISABLED - Merged into WaliKelasGradeView
import ChangePassword from '../features/guru/changePassword';

import * as adminApi from '../api/admin';
import * as guruApi from '../api/guru';

function DashboardPage({ userRole, username, userId, onLogout, isSuperAdmin }) {
    const [activeMenuItem, setActiveMenuItem] = useState('');
    const [activeTASemester, setActiveTASemester] = useState(null);
    const [loadingTAS, setLoadingTAS] = useState(true);
    const [errorTAS, setErrorTAS] = useState(null);
    // Detect if mobile on initial load
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            return window.innerWidth <= 1024 || isTouchDevice;
        }
        return false;
    });
    
    // Initialize sidebar state: closed on mobile, open on desktop
    const [isSidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const mobile = window.innerWidth <= 1024 || isTouchDevice;
            return !mobile; // Open on desktop, closed on mobile
        }
        return true;
    });
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Handle window resize and detect mobile
    useEffect(() => {
        const handleResize = () => {
            // Deteksi mobile: lebar <= 1024px ATAU touchscreen device
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const mobile = window.innerWidth <= 1024 || isTouchDevice;
            
            console.log('Resize detected:', {
                width: window.innerWidth,
                isTouchDevice,
                mobile,
                currentSidebarOpen: isSidebarOpen
            });
            
            setIsMobile(mobile);
            
            // JANGAN auto-close sidebar saat resize, biarkan user yang control
            // if (!mobile) {
            //     setSidebarOpen(true); // Always open on desktop
            // } else {
            //     setSidebarOpen(false); // Always closed on mobile initially
            // }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Call once on mount

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchActiveTASemester = async () => {
            setLoadingTAS(true);
            try {
                // Use appropriate API based on user role
                const data = userRole === 'admin' 
                    ? await adminApi.getTASemester()
                    : await guruApi.getTASemester();
                    
                const active = data.find(ta => ta.is_aktif);
                setActiveTASemester(active || null);
            } catch (error) {
                console.error("Error fetching active TA/Semester:", error);
                setErrorTAS(error.message);
            } finally {
                setLoadingTAS(false);
            }
        };
        fetchActiveTASemester();
    }, [userRole]);

    // Tambahkan ikon ke item menu
    const adminMenuItems = [
        { name: "Tahun Ajaran & Semester", key: "ta-semester", component: TASemester, icon: "fas fa-calendar" },
        { name: "Manajemen Siswa", key: "manajemen-siswa", component: Student, icon: "fas fa-users" },
        { name: "Manajemen Guru", key: "manajemen-guru", component: Teacher, icon: "fas fa-chalkboard-teacher" },
        { name: "Manajemen Kelas", key: "manajemen-kelas", component: ClassManagement, icon: "fas fa-door-open" },
        { name: "Manajemen Mata Pelajaran", key: "manajemen-mapel", component: Course, icon: "fas fa-book" },
        // { name: "Manajemen Tipe Nilai", key: "manajemen-tipe-nilai", component: GradeType, icon: "fas fa-star" }, // DISABLED - Fitur dihilangkan
        { name: "Manajemen Capaian Pembelajaran", key: "manajemen-cp", component: CapaianPembelajaranManagement, icon: "fas fa-bullseye" },
        { name: "Penugasan Siswa ke Kelas", key: "penugasan-siswa-kelas", component: StudentClassEnroll, icon: "fas fa-user-graduate" },
        { name: "Penugasan Guru ke Mapel & Kelas", key: "penugasan-guru-mapel-kelas", component: TeacherClassEnroll, icon: "fas fa-tasks" },
        { name: "Pindah Semester Kelas", key: "pindah-semester-kelas", component: ClassPromote, icon: "fas fa-level-up-alt" },
        { name: "Analytics & Laporan", key: "analytics", component: AdminAnalytics, icon: "fas fa-chart-line" },
    ];

    const guruMenuItems = [
        { name: "Input Nilai", key: "input-nilai", component: InputNilai, icon: "fas fa-edit" },
        { name: "Rekap Nilai", key: "rekap-nilai", component: RekapNilai, icon: "fas fa-chart-bar" },
        // { name: "Penilaian CP", key: "penilaian-cp", component: PenilaianCapaianPembelajaran, icon: "fas fa-check-circle" }, // DISABLED
        { name: "Nilai Wali Kelas", key: "nilai-wali-kelas", component: WaliKelasGradeView, icon: "fas fa-eye" },
        // { name: "Analytics Kelas", key: "analytics-guru", component: () => <GuruAnalytics idGuru={userId} />, icon: "fas fa-chart-line" }, // DISABLED - Use Nilai Kelas Wali instead
        { name: "Ganti Password", key: "ganti-password", component: ChangePassword, icon: "fas fa-key" },
    ];

    const siswaMenuItems = [
        { name: "Lihat Nilai", key: "lihat-nilai", component: () => <p>Fitur Lihat Nilai untuk Siswa akan segera hadir.</p>, icon: "fas fa-poll" },
    ];

    useEffect(() => {
        // Choose initial menu item based on role and superadmin flag (avoid showing hidden items to non-superadmin admins)
        let initialKey = '';
        if (userRole === 'admin') {
            const visible = isSuperAdmin ? adminMenuItems : adminMenuItems.filter(item => ['analytics','manajemen-cp'].includes(item.key));
            initialKey = visible[0]?.key || '';
        } else if (userRole === 'guru') {
            initialKey = guruMenuItems[0]?.key;
        } else if (userRole === 'siswa') {
            initialKey = siswaMenuItems[0]?.key;
        }
        setActiveMenuItem(initialKey);
    }, [userRole, isSuperAdmin]);

    const handleMenuClick = (menuKey) => {
        setActiveMenuItem(menuKey);
        // Close sidebar on mobile after menu selection
        if (isMobile) {
            setSidebarOpen(false);
        }
    };    const renderContentComponent = () => {
        // Determine visible items for the current user (same logic as sidebar)
        const visibleItems = userRole === 'admin' ? (isSuperAdmin ? adminMenuItems : adminMenuItems.filter(item => ['analytics','manajemen-cp'].includes(item.key))) : userRole === 'guru' ? guruMenuItems : siswaMenuItems;

        // Find selected item among visible items; fall back to first visible item if needed
        let selectedItem = visibleItems.find(item => item.key === activeMenuItem);
        if (!selectedItem && visibleItems.length > 0) selectedItem = visibleItems[0];

        const ActiveComponent = selectedItem ? selectedItem.component : null;

        if (!ActiveComponent) {
            return <p>Pilih menu di sidebar.</p>;
        }

        let componentProps = { userId, isSuperAdmin };
        if (activeTASemester) {
            componentProps.activeTASemester = activeTASemester;
        }
        
        // Khusus untuk TASemester component, tambahkan setActiveTASemester
        if (selectedItem.key === 'ta-semester') {
            componentProps.setActiveTASemester = setActiveTASemester;
        }

        return <ActiveComponent {...componentProps} />;
    };

    // If user is admin but NOT superadmin, show limited admin menu (only analytics & CP)
    const adminVisibleItems = isSuperAdmin ? adminMenuItems : adminMenuItems.filter(item => ['analytics','manajemen-cp'].includes(item.key));
    const menuItems = userRole === 'admin' ? adminVisibleItems : userRole === 'guru' ? guruMenuItems : siswaMenuItems;

    return (
        <div className="dashboard-container">
            <button 
                id="mobileMenuBtn" 
                className={`mobile-menu-btn ${isSidebarOpen ? 'active' : ''}`} 
                onClick={() => {
                    console.log('🍔 Burger clicked! Current:', isSidebarOpen, '-> Next:', !isSidebarOpen);
                    setSidebarOpen(!isSidebarOpen);
                }}
                type="button"
            >
                <i className="fas fa-bars"></i>
            </button>

            {/* Overlay untuk menutup sidebar - selalu render tapi visibility diatur CSS */}
            {isSidebarOpen && (
                <div 
                    className="sidebar-overlay" 
                    onClick={() => {
                        console.log('📱 Overlay clicked! Closing sidebar');
                        setSidebarOpen(false);
                    }}
                ></div>
            )}


            <div className={`app-sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
                 data-sidebar-open={isSidebarOpen ? 'true' : 'false'}
                 style={isMobile ? { 
                     transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                     transition: 'transform 0.3s ease'
                 } : {}}>
                <div className="sidebar-header">
                    <div 
                        className={`school-logo ${isSidebarCollapsed ? 'clickable' : ''}`}
                        onClick={isSidebarCollapsed ? () => setSidebarCollapsed(false) : undefined}
                        title={isSidebarCollapsed ? "Expand sidebar" : ""}
                    >
                        <img 
                            src="/logo-binekas.svg" 
                            alt="Sekolah Binekas" 
                            className="logo-image"
                            onError={(e) => {
                                // Fallback if logo not found
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                            }}
                        />
                        <div className="logo-fallback" style={{display: 'none'}}>
                            <i className="fas fa-graduation-cap"></i>
                        </div>
                    </div>
                    {/* Desktop collapse button - only shown when not collapsed and not mobile */}
                    {!isSidebarCollapsed && !isMobile && (
                        <button 
                            className="desktop-collapse-btn"
                            onClick={() => setSidebarCollapsed(true)}
                            title="Collapse sidebar"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                    )}

                    {/* removed in-header expand button; a fixed expand button is rendered outside the sidebar */}
                </div>
                <div className="sidebar-content">
                    <div className="user-info">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium truncate">{username}</span>
                            <span className="role-badge">
                                {userRole}
                            </span>
                        </div>
                    </div>
                    <div className="active-ta">
                        {loadingTAS ? (
                            <div className="flex items-center">
                                <span className="loading-spinner"></span> 
                                <span className="ml-2">Memuat...</span>
                            </div>
                        ) : errorTAS ? (
                            <div className="flex items-center">
                                <i className="fas fa-exclamation-triangle mr-2 text-red-400"></i> 
                                <span>Error</span>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <i className="fas fa-calendar-alt mr-2"></i>
                                <span>{activeTASemester ? `${activeTASemester.tahun_ajaran} ${activeTASemester.semester}` : 'TA Belum Aktif'}</span>
                            </div>
                        )}
                    </div>
                    <nav className="mt-4 flex-grow">
                        {menuItems.map(item => (
                            <button
                                key={item.key}
                                className={`app-nav-button ${activeMenuItem === item.key ? 'active' : ''}`}
                                onClick={() => handleMenuClick(item.key)}
                            >
                                <i className={item.icon}></i>
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                <button onClick={onLogout} className="logout-btn">
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Keluar</span>
                </button>
            
            </div>

            {/* Fixed expand button for desktop when sidebar is collapsed (always visible) */}
            {isSidebarCollapsed && !isMobile && (
                <button
                    className="desktop-expand-fixed"
                    onClick={() => setSidebarCollapsed(false)}
                    aria-label="Expand sidebar"
                >
                    <i className="fas fa-bars"></i>
                </button>
            )}

            {/* PERBARUI: Main content area dengan class conditional */}
            <div className={`main-content-area ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <div className="dashboard-header">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <i className={`fas ${userRole === 'admin' ? 'fa-shield-alt' : userRole === 'guru' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'} text-white`}></i>
                                </div>
                                Dasbor {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                            </h1>
                            <p className="text-gray-600 flex items-center gap-2">
                                <i className="fas fa-calendar-alt text-indigo-600"></i>
                                <span className="font-medium">
                                    {activeTASemester 
                                        ? `${activeTASemester.tahun_ajaran} - Semester ${activeTASemester.semester}` 
                                        : 'Tahun Ajaran Belum Aktif'}
                                </span>
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-xl shadow-md border border-gray-100">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                    {username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">{username}</p>
                                    <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200 font-medium border border-red-200"
                                title="Keluar"
                            >
                                <i className="fas fa-sign-out-alt"></i>
                                <span>Keluar</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="feature-container">
                    {renderContentComponent()}
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;