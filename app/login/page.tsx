'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { LogIn, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Let the auth context load the profile and route guard redirect to correct dashboard
      router.push('/');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">

      {/* ── Full-screen campus background ─────────────── */}
      <Image
        src="/EVSU_Campus.png"
        alt="EVSU Ormoc Campus"
        fill
        className="object-cover object-center"
        priority
        quality={90}
      />

      {/* Dark maroon overlay — matches EVSU brand */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#3D0A12]/80 via-[#5C1420]/75 to-[#3D0A12]/85" />

      {/* Subtle vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
      }} />

      {/* ── Content ────────────────────────────────────── */}
      <div className={`relative z-10 w-full max-w-sm sm:max-w-[420px] mx-auto px-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Logo + name */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 mb-5 relative">
            <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
            <Image
              src="/EVSU_logo.png"
              alt="EVSU Logo"
              width={96}
              height={96}
              className="relative rounded-full ring-[3px] ring-white/30 shadow-2xl"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-white font-heading leading-tight drop-shadow">
            EVSU Ormoc Campus
          </h1>
          <p className="text-white/55 text-xs font-medium tracking-[0.18em] uppercase mt-1">
            Eastern Visayas State University
          </p>
        </div>

        {/* Welcome */}
        <div className="text-center mb-7">
          <h2 className="text-3xl font-bold text-white font-heading drop-shadow">Welcome Back!</h2>
          <p className="text-white/60 text-sm mt-1.5">Sign in to the Latin Honors Interview Grading System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">

          {/* Email field */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <Mail size={17} className="text-white/50" />
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="glass-input w-full pl-11 pr-4 py-3.5 bg-white/[0.12] backdrop-blur-md border border-white/25 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 focus:bg-white/[0.18] transition-all"
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <Lock size={17} className="text-white/50" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="glass-input w-full pl-11 pr-12 py-3.5 bg-white/[0.12] backdrop-blur-md border border-white/25 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 focus:bg-white/[0.18] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-xs font-medium select-none cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Sign in button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/[0.15] hover:bg-white/[0.25] active:bg-white/[0.1] backdrop-blur-md border border-white/40 hover:border-white/60 rounded-xl text-white font-semibold text-sm tracking-wide transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-black/20 cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </div>
        </form>

        {/* Footer note */}
        <p className="text-center text-white/30 text-[11px] mt-8 leading-relaxed tracking-wide">
          Authorized personnel only &middot; Academic Affairs Office<br />
          AY 2025–2026
        </p>
      </div>
    </div>
  );
}
