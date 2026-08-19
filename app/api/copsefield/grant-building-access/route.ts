import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { buildingId, email }: { buildingId: string; email: string } = await req.json()
    if (!buildingId || !email?.trim()) {
      return NextResponse.json({ error: 'Building and email are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('has_copsefield_access, copsefield_role')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.has_copsefield_access || callerProfile.copsefield_role !== 'staff') {
      return NextResponse.json({ error: 'Only Copsefield staff can grant building access' }, { status: 403 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, has_copsefield_access, copsefield_role')
      .ilike('email', email.trim())
      .maybeSingle()

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'No account found with that email - they need to sign up first' },
        { status: 404 }
      )
    }

    if (!targetProfile.has_copsefield_access) {
      await supabaseAdmin
        .from('profiles')
        .update({ has_copsefield_access: true, copsefield_role: 'owner' })
        .eq('id', targetProfile.id)
    }

    const { error: linkError } = await supabaseAdmin
      .from('copsefield_building_access')
      .insert({ building_id: buildingId, user_id: targetProfile.id })

    if (linkError && !linkError.message.includes('duplicate')) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      alreadyStaff: targetProfile.has_copsefield_access && targetProfile.copsefield_role === 'staff',
    })
  } catch (err) {
    return NextResponse.json({ error: 'Could not grant access' }, { status: 500 })
  }
}
