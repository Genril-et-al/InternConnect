import { supabase } from './supabase'

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

export async function insertNotification(
  userId: string,
  message: string,
  navHint?: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    message,
    nav_hint: navHint || null,
  })
  if (error) throw new Error(error.message)
}

/**
 * Rows per page. The panel shows about five at a time on either layout — the
 * 60vh mobile card less its header over ~98px rows, and the 360px desktop list
 * over ~70px rows — so ten is two screenfuls: "Load more" is never on screen
 * when the panel opens, but is one flick away.
 */
export const NOTIFICATIONS_PAGE_SIZE = 10

export type NotificationPage = {
  items: AppNotification[]
  /** True when older rows exist beyond this page. */
  hasMore: boolean
}

export async function fetchNotifications(
  offset = 0,
  limit = NOTIFICATIONS_PAGE_SIZE,
): Promise<NotificationPage> {
  // Ask for one extra row: if it comes back there is another page. Cheaper and
  // race-free compared with a separate count query, which can disagree with the
  // page when a trigger inserts between the two.
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, nav_hint, is_read, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const hasMore = rows.length > limit
  return {
    items: rows.slice(0, limit).map((r) => ({
      id: r.id as string,
      message: r.message as string,
      date: r.created_at as string,
      read: Boolean(r.is_read),
      navHint: (r.nav_hint as string | null) ?? null,
    })),
    hasMore,
  }
}

/**
 * Unread total across every row, not just the loaded page. The badge has to
 * count rows the user has not paged to yet — and unread rows can sit below the
 * first page when newer ones have already been read.
 */
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  return count ?? 0
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

export async function removeNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function removeAllNotifications(): Promise<void> {
  // We can't do a blanket delete without a filter in Supabase usually,
  // but we can filter by the user's own ID which RLS covers anyway, 
  // or use a dummy filter like id is not null.
  const { error } = await supabase.from('notifications').delete().not('id', 'is', null)
  if (error) throw new Error(error.message)
}

