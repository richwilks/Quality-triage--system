import { SupabaseClient } from '@supabase/supabase-js'

const ADMIN_COMPANY_NAME = 'inspectiq'

export async function syncCompanyAccess(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, is_platform_admin, email')
    .eq('id', user.id)
    .single()

  if (!profile) return

  if (profile.company_name && profile.company_name.trim().toLowerCase() === ADMIN_COMPANY_NAME && !profile.is_platform_admin) {
    await supabase.from('profiles').update({ is_platform_admin: true }).eq('id', user.id)
  }

  if (!profile.email) return

  const { data: invites } = await supabase
    .from('project_invites')
    .select('id, project_id, project_role')
    .ilike('email', profile.email)
    .is('accepted_at', null)

  if (invites && invites.length > 0) {
    for (const invite of invites) {
      await supabase.from('project_members').insert({
        project_id: invite.project_id,
        user_id: user.id,
        project_role: invite.project_role,
      })
      await supabase
        .from('project_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
    }
  }
}
