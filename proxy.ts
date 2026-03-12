import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Allow login page without auth
  if (pathname === '/login') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const redirect =
        profile?.role === 'admin' ? '/admin/dashboard' :
        profile?.role === 'program_head' ? '/program-head/results' :
        '/panelist/dashboard';
      return NextResponse.redirect(new URL(redirect, request.url));
    }
    return supabaseResponse;
  }

  // Root redirect
  if (pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const redirect =
        profile?.role === 'admin' ? '/admin/dashboard' :
        profile?.role === 'program_head' ? '/program-head/results' :
        '/panelist/dashboard';
      return NextResponse.redirect(new URL(redirect, request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based access
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const redirect =
        profile?.role === 'program_head' ? '/program-head/results' : '/panelist/dashboard';
      return NextResponse.redirect(new URL(redirect, request.url));
    }
  }

  if (pathname.startsWith('/program-head')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'program_head' && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/panelist/dashboard', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/panelist/:path*', '/program-head/:path*'],
};
