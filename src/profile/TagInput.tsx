import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Chip-style multi-value input. Tags render as chips with a "+" button at the
 * end; clicking it reveals a text field to type a new value. Press Enter or
 * comma to add it, or click × on a chip to remove it. Locked tags can't be
 * removed and never render a remove button.
 */
export function TagInput({
  tags,
  onChange,
  placeholder,
  lockedTags = [],
}: {
  tags: string[]
  lockedTags?: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function add(raw: string) {
    const value = raw.trim().replace(/,$/, '').trim()
    if (!value) return
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...tags, value])
    setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Escape') {
      setDraft('')
      setAdding(false)
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      const lastTag = tags[tags.length - 1]
      const isLocked = lockedTags.some((t) => t.toLowerCase() === lastTag.toLowerCase())
      if (!isLocked) {
        onChange(tags.slice(0, -1))
      }
    }
  }

  function handleBlur() {
    add(draft)
    setDraft((current) => {
      if (!current.trim()) setAdding(false)
      return current
    })
  }

  return (
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
        <input
          onBlur={handleBlur}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length ? 'Add a skill…' : placeholder}
          ref={inputRef}
          value={draft}
        />
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
  )
}
