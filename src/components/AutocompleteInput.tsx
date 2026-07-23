import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../profile/profile.css'

/**
 * A single-value text input with a floating autocomplete dropdown.
 */
export function AutocompleteInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  required = false,
  style,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  suggestions?: string[]
  required?: boolean
  style?: React.CSSProperties
}) {
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside the whole component.
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [showDropdown])

  // Filtered & ranked suggestions.
  const filtered = useMemo(() => {
    if (!value.trim() || suggestions.length === 0) return []
    const q = value.trim().toLowerCase()

    const starts: string[] = []
    const contains: string[] = []

    for (const s of suggestions) {
      if (s.toLowerCase() === q) continue // Exact match, don't suggest
      const sLower = s.toLowerCase()
      if (sLower.startsWith(q)) starts.push(s)
      else if (sLower.includes(q)) contains.push(s)
    }
    return [...starts, ...contains].slice(0, 8)
  }, [value, suggestions])

  // Show/hide dropdown based on filtered results.
  useEffect(() => {
    setShowDropdown(filtered.length > 0)
    setHighlightIndex(-1)
  }, [filtered])

  // Scroll highlighted item into view.
  useEffect(() => {
    if (highlightIndex < 0 || !dropdownRef.current) return
    const item = dropdownRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const selectSuggestion = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue)
      setShowDropdown(false)
      setHighlightIndex(-1)
    },
    [onChange],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1))
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlightIndex >= 0) {
        e.preventDefault()
        selectSuggestion(filtered[highlightIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowDropdown(false)
      }
    }
  }

  return (
    <div className="tag-input-wrapper" ref={wrapperRef} style={{ width: '100%' }}>
      <input
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => {
          if (filtered.length > 0) setShowDropdown(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        style={{ ...style }}
        value={value}
      />

      {/* Floating autocomplete dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div className="tag-autocomplete" ref={dropdownRef} role="listbox">
          {filtered.map((item, i) => (
            <div
              aria-selected={i === highlightIndex}
              className={`tag-autocomplete-item${i === highlightIndex ? ' highlighted' : ''}`}
              key={item}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent input blur
                selectSuggestion(item)
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              role="option"
            >
              {highlightLabel(item, value)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Bold the portion of `label` that matches `query`. */
function highlightLabel(label: string, query: string) {
  if (!query.trim()) return label
  const idx = label.toLowerCase().indexOf(query.trim().toLowerCase())
  if (idx === -1) return label
  const before = label.slice(0, idx)
  const match = label.slice(idx, idx + query.trim().length)
  const after = label.slice(idx + query.trim().length)
  return (
    <>
      {before}
      <strong>{match}</strong>
      {after}
    </>
  )
}
