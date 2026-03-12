'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  LayoutDashboard, Users, CalendarDays, GraduationCap,
  ClipboardList, LogOut, Menu, X, ChevronLeft, ChevronRight,
  ChevronDown, Trophy, ScrollText, BookOpen
} from 'lucide-react';

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/students', label: 'Students', icon: GraduationCap },
  { href: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
  { href: '/admin/panelists', label: 'Accounts', icon: Users },
  { href: '/admin/programs', label: 'Programs', icon: BookOpen },
  { href: '/admin/results', label: 'Results', icon: Trophy },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
];

const panelistLinks = [
  { href: '/panelist/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/panelist/dashboard', label: 'My Sessions', icon: ClipboardList },
];

const programHeadLinks = [
  { href: '/program-head/results', label: 'Results', icon: Trophy },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const { profile, signOut, loggingOut } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  const links = profile?.role === 'admin' ? adminLinks
    : profile?.role === 'program_head' ? programHeadLinks
    : panelistLinks;

  const roleLabel = profile?.role === 'admin' ? 'Admin'
    : profile?.role === 'program_head' ? 'Program Head'
    : 'Panelist';

  const handleSignOut = async () => {
    await signOut();
    setShowSignOutConfirm(false);
  };

  const sidebarW = collapsed ? 'lg:w-[68px]' : 'lg:w-[260px]';

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-40 bg-evsu-maroon text-white overflow-hidden sidebar-transition ${sidebarW}`}
      >
        {/* Logo area */}
        <div className={`flex items-center h-16 border-b border-white/10 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'gap-3 px-5'}`}>
          <Image
            src="/EVSU_logo.png"
            alt="EVSU"
            width={34}
            height={34}
            className="rounded-full flex-shrink-0 ring-2 ring-white/20"
          />
          {!collapsed && (
            <div className="min-w-0 nav-label">
              <p className="text-sm font-bold font-heading leading-tight truncate">EVSU Ormoc</p>
              <p className="text-[11px] text-white/50 truncate">Latin Honors Grader</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
          {links.map(link => {
            const isActive = pathname.startsWith(link.href);
            return (
              <div key={link.href + link.label} className="relative group/nav">
                <Link
                  href={link.href}
                  className={`flex items-center h-10 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    collapsed ? 'justify-center w-full px-0' : 'gap-3 px-3'
                  } ${
                    isActive
                      ? 'bg-white/[0.14] text-white'
                      : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <link.icon size={18} className="flex-shrink-0" />
                  {!collapsed && (
                    <span className="nav-label truncate">{link.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                </Link>
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="sidebar-tooltip absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover/nav:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">
                    {link.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom: user + collapse toggle */}
        <div className={`border-t border-white/10 flex-shrink-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          {/* Collapse toggle */}
          <button
            onClick={toggle}
            className={`flex items-center h-9 w-full rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer mb-2 ${
              collapsed ? 'justify-center' : 'gap-2.5 px-3'
            }`}
          >
            {collapsed ? (
              <ChevronRight size={17} />
            ) : (
              <>
                <ChevronLeft size={17} />
                <span className="text-sm nav-label">Collapse</span>
              </>
            )}
          </button>

          {/* User row */}
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-colors">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                {profile?.full_name?.[0] ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-tight">{profile?.full_name}</p>
                <p className="text-[11px] text-white/40">{roleLabel}</p>
              </div>
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="relative group/signout">
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="flex items-center justify-center w-full h-9 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
              >
                <LogOut size={17} />
              </button>
              <div className="sidebar-tooltip absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover/signout:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">
                Sign Out
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-evsu-maroon text-white flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <Image src="/EVSU_logo.png" alt="EVSU" width={28} height={28} className="rounded-full ring-1 ring-white/20" />
          <span className="text-sm font-bold font-heading tracking-wide">EVSU Grader</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="cursor-pointer p-1">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile drawer (slides from right) ─────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[280px] h-full bg-evsu-maroon text-white flex flex-col shadow-2xl ml-auto animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Image src="/EVSU_logo.png" alt="EVSU" width={28} height={28} className="rounded-full ring-1 ring-white/20" />
                <span className="text-sm font-bold font-heading">EVSU Grader</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="cursor-pointer text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {links.map(link => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white/[0.14] text-white'
                        : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <link.icon size={18} className="flex-shrink-0" />
                    {link.label}
                    {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
                  </Link>
                );
              })}
            </nav>

            {/* User foot */}
            <div className="border-t border-white/10 px-3 py-3 flex-shrink-0">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {profile?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                  <p className="text-[11px] text-white/40">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={() => { setMobileOpen(false); setShowSignOutConfirm(true); }}
                className="flex items-center gap-3 w-full h-10 px-3 mt-1 rounded-xl text-sm text-white/60 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
              >
                <LogOut size={17} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Modal */}
      <ConfirmModal
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        confirmText="Sign Out"
        loading={loggingOut}
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to sign out?
        </p>
      </ConfirmModal>
    </>
  );
}
