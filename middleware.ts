import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const COPSEFIELD_HOSTS = ['copsefield.com', 'www.copsefield.com']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const isCopsefieldDomain = COPSEFIELD_HOSTS.includes(host)

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

    // copsefield.com only serves Copsefield - an account with no Copsefield
    // access has nothing to land on here, unlike on the shared domain where
    // it can fall back to InspectIQ.
    if (isCopsefieldDomain && !profile?.has_copsefield_access) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('no_access', '1')
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

  if (!user && !isAuthPage && !isResetPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    const redirectTo = request.nextUrl.searchParams.get('redirect')
    url.pathname = redirectTo || (isCopsefieldDomain ? '/copsefield' : '/choose')
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Host-based routing: copsefield.com serves the Copsefield app directly,
  // without visitors ever needing to know about the /copsefield path.
  if (
    isCopsefieldDomain &&
    !isAuthPage &&
    !isResetPage &&
    !request.nextUrl.pathname.startsWith('/copsefield') &&
    !request.nextUrl.pathname.startsWith('/api')
  ) {
    const url = request.nextUrl.clone()

    if (request.nextUrl.pathname === '/') {
      url.pathname = '/copsefield'
      const rewritten = NextResponse.rewrite(url, { request })
      response.cookies.getAll().forEach((c) => rewritten.cookies.set(c))
      return rewritten
    }

    url.pathname = `/copsefield${request.nextUrl.pathname}`
    const redirected = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirected.cookies.set(c))
    return redirected
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
