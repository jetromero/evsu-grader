'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      router.replace('/login');
      return;
    }
    if (profile.role === 'admin') router.replace('/admin/dashboard');
    else if (profile.role === 'program_head') router.replace('/program-head/results');
    else router.replace('/panelist/dashboard');
  }, [loading, user, profile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-9 h-9 border-[3px] border-evsu-maroon border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

