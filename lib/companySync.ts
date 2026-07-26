import { SupabaseClient } from '@supabase/supabase-js'

const ADMIN_COMPANY_NAME = 'inspectiq'

export async function syncCompanyAccess(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_name, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.company_name) return

  const isAdminCompany = profile.company_name.trim().toLowerCase() === ADMIN_COMPANY_NAME

  if (isAdminCompany && !profile.is_platform_admin) {
    await supabase.from('profiles').update({ is_platform_admin: true }).eq('id', user.id)
  }

  if (profile.role === 'internal' && !isAdminCompany) {
    const { data: matchingProjects } = await supabase
      .from('projects')
      .select('id')
      .ilike('company_name', profile.company_name)

    if (matchingProjects && matchingProjects.length > 0) {
      const rows = matchingProjects.map((p) => ({
        project_id: p.id,
        user_id: user.id,
        project_role: 'member',
      }))
      await supabase
        .from('project_members')
        .upsert(rows, { onConflict: 'project_id,user_id', ignoreDuplicates: true })
    }
  }
}
