import { useState } from 'react'

/**
 * Chip-style multi-value input. Type a value and press Enter or comma to add;
 * click × or press Backspace on an empty field to remove.
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
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      const lastTag = tags[tags.length - 1]
      const isLocked = lockedTags.some((t) => t.toLowerCase() === lastTag.toLowerCase())
      if (!isLocked) {
        onChange(tags.slice(0, -1))
      }
    }
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
      <input
        onBlur={() => add(draft)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length ? '' : placeholder}
        value={draft}
      />
    </div>
  )
}
