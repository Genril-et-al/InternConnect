import { Search } from 'lucide-react'

export function AdBadge({
  text,
  variant,
}: {
  text: string
  variant: 'success' | 'pending' | 'rejected' | 'neutral'
}) {
  return <span className={`ad-badge ${variant}`}>{text}</span>
}

export function AdSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="ad-search">
      <Search size={14} />
      <input
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        value={value}
      />
    </div>
  )
}
