import { SupabaseClient } from '@supabase/supabase-js'
import { WORK_ORDER_TO_TICKET_STATUS } from '@/lib/copsefieldTaxonomy'

export async function logWorkOrderEvent(
  supabase: SupabaseClient,
  workOrderId: string,
  eventType: string,
  description: string,
  userId: string | null
) {
  await supabase.from('copsefield_work_order_events').insert({
    work_order_id: workOrderId,
    event_type: eventType,
    description,
    created_by: userId,
  })
}

// Keeps the linked ticket's status mirroring the work order's status, per
// the mapping in WORK_ORDER_TO_TICKET_STATUS. No-op if the work order
// isn't linked to a ticket.
export async function syncTicketStatus(supabase: SupabaseClient, ticketId: string | null, workOrderStatus: string) {
  if (!ticketId) return
  const ticketStatus = WORK_ORDER_TO_TICKET_STATUS[workOrderStatus] || workOrderStatus
  await supabase.from('copsefield_tickets').update({ status: ticketStatus, updated_at: new Date().toISOString() }).eq('id', ticketId)
}

export function generateQuoteReference(): string {
  return `Q-${Date.now().toString(36).toUpperCase()}`
}
