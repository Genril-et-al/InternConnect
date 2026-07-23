import { useEffect, useState } from 'react'

/**
 * The brand panel's sub-headline, cycling through a few taglines.
 *
 * Every line is rendered at once, stacked in a single grid cell, and all but
 * the current one is faded out. Stacking rather than swapping means the block
 * is always as tall as the longest line, so the panel never reflows mid-fade —
 * and the outgoing line can fade out while the incoming one fades in.
 */

const TAGLINES = [
  'Explore verified opportunities, apply with ease, and track your internship journey—all in one platform designed for students and the industry.',
  'Browse internships from companies the university has already vetted, so every listing you see is one you can actually trust.',
  'Apply in a few clicks, keep your requirements in one place, and watch each application move from submitted to accepted.',
  'Companies post roles, students find their fit, and coordinators keep the whole program in view—one system for all three.',
]

const ROTATE_MS = 8000

export function HeroTagline() {
  const [active, setActive] = useState(0)

  // Rotation is motion the user didn't ask for, so honour reduced-motion by
  // simply leaving the first line up for good.
  useEffect(() => {
    if (TAGLINES.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(
      () => setActive((i) => (i + 1) % TAGLINES.length),
      ROTATE_MS,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    // aria-live is deliberately off: the copy is decorative, and announcing a
    // fresh paragraph every few seconds would talk over the login form.
    <div aria-live="off" className="auth-hero-taglines">
      {TAGLINES.map((line, i) => (
        <p
          aria-hidden={i !== active}
          className={`auth-hero-sub${i === active ? ' is-active' : ''}`}
          key={line}
        >
          {line}
        </p>
      ))}
    </div>
  )
}
