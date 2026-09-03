import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

    const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_blocked, has_copsefield_access')
      .eq('id', user.id)
      .single()

    if (profile?.is_blocked) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('blocked', '1')
      return NextResponse.redirect(url)
    }

    if (request.nextUrl.pathname.startsWith('/copsefield') && !profile?.has_copsefield_access) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }


      const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/forgot-password')

  const isResetPage = request.nextUrl.pathname.startsWith('/reset-password')

  // The marketing site at /site is private (signed-in accounts only) until this
  // is set to 'true' in the environment - no code change needed to go live,
  // just flip the env var and redeploy.
  const isPublicMarketingPage =
    process.env.MARKETING_SITE_PUBLIC === 'true' && request.nextUrl.pathname.startsWith('/site')

  if (!user && !isAuthPage && !isResetPage && !isPublicMarketingPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    const redirectTo = request.nextUrl.searchParams.get('redirect')
    url.pathname = redirectTo || '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }


  return response
}

export const config = {
  matcher: [
    // The stock-monitor cron routes are called by Vercel's Cron dispatcher
    // with a CRON_SECRET bearer token, not a browser session cookie - they
    // check that secret themselves, so this blanket sign-in gate must not
    // redirect them to /login before they ever reach the route handler.
    // Every other API route keeps going through this middleware unchanged.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/stock-monitor/(?:intraday|backtest|news|tune)-cron).*)',
  ],
}
