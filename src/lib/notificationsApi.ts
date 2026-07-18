import { supabase } from './supabase'
import { formatDate } from './listingsApi'

/**
 * In-app notifications (all portals). Rows are written by database triggers
 * on domain events; the client only reads and marks them read.
 */

export type AppNotification = {
  id: string
  message: string
  date: string
  read: boolean
  /** 'Applications' | 'Applicants' | 'Listings' | 'Profile' | 'admin:<index>' */
  navHint: string | null
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, nav_hint, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    message: r.message as string,
    date: formatDate(r.created_at as string),
    read: Boolean(r.is_read),
    navHint: (r.nav_hint as string | null) ?? null,
  }))
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw new Error(error.message)
}
