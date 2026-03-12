'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Profile } from '@/types';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  loggingOut: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  loggingOut: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Track which user's profile is already loaded to avoid redundant fetches
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe,
    // which replaces the need for a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          setUser(session.user);
          // Skip profile re-fetch if it's the same user (e.g. TOKEN_REFRESHED)
          if (loadedUserIdRef.current !== session.user.id) {
            loadedUserIdRef.current = session.user.id;
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            setProfile(data);
          }
        } else {
          loadedUserIdRef.current = null;
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push('/login');
    setLoggingOut(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loggingOut, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
