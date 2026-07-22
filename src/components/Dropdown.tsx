import { useEffect, useRef, useState } from 'react'

import './dropdown.css'

export type DropdownOption = { value: string; label: string }

type Props = {
  /** Plain strings when the value and the label are the same thing. */
  options: (DropdownOption | string)[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  /** "bare" drops the border for triggers nested inside another field. */
  variant?: 'field' | 'bare'
  /** Right-align the menu when the trigger sits at the end of a row. */
  align?: 'left' | 'right'
  className?: string
}

const normalize = (option: DropdownOption | string): DropdownOption =>
  typeof option === 'string' ? { value: option, label: option } : option

export function Dropdown({
  align = 'left',
  ariaLabel,
  className = '',
  onChange,
  options,
  value,
  variant = 'field',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const items = options.map(normalize)
  const selectedIndex = items.findIndex((item) => item.value === value)
  const selected = items[selectedIndex]

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Opening lands the highlight on whatever is already selected, so arrow keys
  // step from the current value rather than from the top of the list.
  const open = () => {
    setActiveIndex(selectedIndex === -1 ? 0 : selectedIndex)
    setIsOpen(true)
  }

  const choose = (next: string) => {
    onChange(next)
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => {
        const next = current + step
        if (next < 0) return items.length - 1
        if (next >= items.length) return 0
        return next
      })
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = items[activeIndex]
      if (item) choose(item.value)
    }
  }

  // Keep the highlighted option in view when arrow keys walk past the edge of a
  // scrolling menu.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return
    const option = menuRef.current?.children[activeIndex] as HTMLElement | undefined
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  return (
    <div
      className={`ic-dropdown ic-dropdown--${variant} ${className}`.trim()}
      data-open={isOpen}
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="ic-dropdown-trigger"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        type="button"
      >
        {selected?.label ?? value}
        <svg
          className="ic-dropdown-chevron"
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width="14"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          aria-label={ariaLabel}
          className={`ic-dropdown-menu menu-pop ${align === 'right' ? 'ic-dropdown-menu--right' : ''}`.trim()}
          ref={menuRef}
          role="listbox"
        >
          {items.map((item, index) => (
            <button
              aria-selected={item.value === value}
              className={`ic-dropdown-option ${item.value === value ? 'is-selected' : ''} ${
                index === activeIndex ? 'is-active' : ''
              }`.trim()}
              key={item.value}
              onClick={() => choose(item.value)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
