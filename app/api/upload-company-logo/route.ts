import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { companyName, fileName, fileBase64, mimeType } = await req.json()

    if (!companyName || !fileName || !fileBase64) {
      return NextResponse.json({ error: 'Missing file or company name' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_admin, company_name, is_platform_admin')
      .eq('id', user.id)
      .single()

    const isAuthorized =
      !!profile?.is_platform_admin ||
      (!!profile?.company_admin && profile.company_name?.toLowerCase() === String(companyName).toLowerCase())

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not authorized to update this company\'s branding' }, { status: 403 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )

    const path = `${companyName}/${Date.now()}-${fileName}`
    const buffer = Buffer.from(fileBase64, 'base64')

    const { error: uploadError } = await supabaseAdmin.storage
      .from('company-branding')
      .upload(path, buffer, { contentType: mimeType || 'application/octet-stream', upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('company-branding').getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    return NextResponse.json({ error: 'Logo upload failed' }, { status: 500 })
  }
}
