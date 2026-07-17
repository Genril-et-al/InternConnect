import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ic:sidebar-collapsed'

/**
 * Collapse state for the fixed sidebar, shared by the student/company shell
 * and the admin shell. Persisted to localStorage so the choice sticks across
 * reloads and between portals.
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return [collapsed, () => setCollapsed((c) => !c)]
}
