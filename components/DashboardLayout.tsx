'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context';
import Navbar from '@/components/Navbar';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { loading, loggingOut, profile } = useAuth();
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();

  // Role-based route guard — redirect to the correct section after auth loads
  useEffect(() => {
    if (loading || loggingOut || !profile) return;
    const onAdmin = pathname.startsWith('/admin');
    const onPanelist = pathname.startsWith('/panelist');
    const onProgramHead = pathname.startsWith('/program-head');
    if (profile.role === 'admin' && !onAdmin) {
      router.replace('/admin/dashboard');
    } else if (profile.role === 'program_head' && !onProgramHead) {
      router.replace('/program-head/results');
    } else if (profile.role === 'panelist' && !onPanelist) {
      router.replace('/panelist/dashboard');
    }
  }, [loading, profile, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-evsu-maroon border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  const contentMargin = collapsed ? 'lg:ml-[68px]' : 'lg:ml-[260px]';

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <main className={`pt-14 lg:pt-0 sidebar-transition ${contentMargin}`}>
        <div className="max-w-[1400px] mx-auto px-5 py-6 sm:px-7 sm:py-8">
          {children}
        </div>
      </main>

      {loggingOut && (
        <div className="fixed inset-0 z-[100] bg-white/75 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-[3px] border-evsu-maroon border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-muted font-medium">Signing out…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardInner>{children}</DashboardInner>
    </SidebarProvider>
  );
}

