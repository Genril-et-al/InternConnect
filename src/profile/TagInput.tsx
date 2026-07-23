import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Chip-style multi-value input. Tags render as chips with a "+" button at the
 * end; clicking it reveals a text field to type a new value. Press Enter or
 * comma to add it, or click × on a chip to remove it. Locked tags can't be
 * removed and never render a remove button.
 *
 * When `suggestions` are provided, a floating autocomplete dropdown appears as
 * the user types. Results that start with the query rank first, then partial
 * matches. Already-added tags are excluded from suggestions.
 */
export function TagInput({
  tags,
  onChange,
  placeholder,
  lockedTags = [],
  suggestions = [],
}: {
  tags: string[]
  lockedTags?: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

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
    if (!draft.trim() || suggestions.length === 0) return []
    const q = draft.trim().toLowerCase()
    const tagsLower = new Set(tags.map((t) => t.toLowerCase()))

    const starts: string[] = []
    const contains: string[] = []

    for (const s of suggestions) {
      if (tagsLower.has(s.toLowerCase())) continue
      const sLower = s.toLowerCase()
      if (sLower.startsWith(q)) starts.push(s)
      else if (sLower.includes(q)) contains.push(s)
    }
    return [...starts, ...contains].slice(0, 8)
  }, [draft, suggestions, tags])

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

  function add(raw: string) {
    const rawValues = raw.split(',').map(v => v.trim()).filter(Boolean)
    if (rawValues.length === 0) return

    const nextTags = [...tags]
    let changed = false
    
    for (const value of rawValues) {
      if (!nextTags.some((t) => t.toLowerCase() === value.toLowerCase())) {
        nextTags.push(value)
        changed = true
      }
    }
    
    if (changed) {
      onChange(nextTags)
    }
    setDraft('')
    setShowDropdown(false)
    setHighlightIndex(-1)
  }

  const selectSuggestion = useCallback(
    (value: string) => {
      add(value)
      // Keep focus on the input so the user can continue adding.
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tags, onChange],
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
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Escape') {
      if (showDropdown) {
        setShowDropdown(false)
      } else {
        setDraft('')
        setAdding(false)
      }
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      const lastTag = tags[tags.length - 1]
      const isLocked = lockedTags.some((t) => t.toLowerCase() === lastTag.toLowerCase())
      if (!isLocked) {
        onChange(tags.slice(0, -1))
      }
    }
  }

  function handleBlur() {
    // Small delay so that clicking a dropdown item registers before the blur
    // closes the dropdown and commits the draft.
    setTimeout(() => {
      if (dropdownRef.current?.matches(':hover')) return
      add(draft)
      setDraft((current) => {
        if (!current.trim()) setAdding(false)
        return current
      })
      setShowDropdown(false)
    }, 150)
  }

  return (
    <div className="tag-input-wrapper" ref={wrapperRef}>
      <div className="tag-input">
        {tags.map((tag) => {
          const isLocked = lockedTags.some((t) => t.toLowerCase() === tag.toLowerCase())
          return (
            <span className={`tag-chip${isLocked ? ' locked' : ''}`} key={tag}>
              {tag}
              {!isLocked && (
                <button
                  aria-label={`Remove ${tag}`}
                  onClick={() => onChange(tags.filter((t) => t !== tag))}
                  type="button"
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
        {adding ? (
          <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
            <input
              autoComplete="off"
              onBlur={handleBlur}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData('Text')
                if (pastedText.includes(',')) {
                  e.preventDefault()
                  add(pastedText)
                }
              }}
              placeholder={tags.length ? 'Add a skill…' : placeholder}
              ref={inputRef}
              value={draft}
              style={{ width: '100%' }}
            />
            {/* Floating autocomplete dropdown anchored to the input */}
            {showDropdown && filtered.length > 0 && (
              <div className="tag-autocomplete" ref={dropdownRef} role="listbox" style={{ minWidth: '200px' }}>
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
                    {highlightLabel(item, draft)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            aria-label="Add a skill"
            className="tag-add"
            onClick={() => setAdding(true)}
            type="button"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
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
