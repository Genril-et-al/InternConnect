import { useCallback, useEffect, useState } from 'react'

/**
 * Coverflow carousel for the login/sign-up brand panel.
 *
 * Slides sit in a horizontal ring: the active one is centred, front-most and
 * full size, while its neighbours shrink, fade and rotate away into the
 * distance. Advancing slides everything one slot to the right, so the incoming
 * image grows into the centre as the outgoing one retreats — then it loops.
 *
 * Adding images: drop any .jpg/.jpeg/.png/.webp/.avif into ./slides. They are
 * picked up at build time and ordered by filename (so 01-, 02-, … controls the
 * sequence). No code change needed to add, reorder or remove a photo.
 */

const modules = import.meta.glob<{ default: string }>(
  './slides/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
)

const SLIDES = Object.keys(modules)
  .sort()
  .map((key) => modules[key].default)

/** Lets the panel keep its headline until real images exist (see LoginPage). */
export const hasHeroSlides = SLIDES.length > 0

const AUTOPLAY_MS = 1750
/** Slots either side of centre that stay visible; the rest park off-stage. */
const VISIBLE = 2

/**
 * Shortest signed distance from `active` to slide `i` around the ring, so slide
 * 0 sits just right of the last slide instead of rewinding through the middle.
 */
function ringOffset(i: number, active: number, total: number): number {
  let offset = i - active
  if (offset > total / 2) offset -= total
  if (offset < -total / 2) offset += total
  return offset
}

export function HeroCarousel() {
  /**
   * The previous index is kept alongside the current one so each slide's former
   * position is *derived* rather than remembered — a ref read during render is
   * unsafe under concurrent rendering, and a ref written during render breaks
   * outright in StrictMode, which renders twice and would compare a value
   * against itself. Deriving both offsets from state keeps the render pure.
   */
  const [slide, setSlide] = useState({ current: 0, previous: 0 })
  const [paused, setPaused] = useState(false)
  const total = SLIDES.length

  const goTo = useCallback((next: number) => {
    setSlide((s) => (next === s.current ? s : { current: next, previous: s.current }))
  }, [])

  const advance = useCallback(() => {
    setSlide((s) => ({ current: (s.current + 1) % total, previous: s.current }))
  }, [total])

  // Autoplay, paused while the pointer rests on the panel. Skipped entirely for
  // users who ask for reduced motion — content that moves on its own is exactly
  // what that preference is about.
  //
  // Deliberately NOT gated on document.hidden: browsers already throttle timers
  // in background tabs to about once a minute, so the guard saves almost
  // nothing, and it leaves the carousel frozen in embedded browser views that
  // report themselves as permanently hidden.
  useEffect(() => {
    if (total < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(advance, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [advance, paused, total])

  if (total === 0) return null

  return (
    <div
      aria-label="InternConnect highlights"
      aria-roledescription="carousel"
      className="cf"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
    >
      <div className="cf-stage">
        {SLIDES.map((src, i) => {
          const offset = ringOffset(i, slide.current, total)
          const distance = Math.abs(offset)
          const offStage = distance > VISIBLE

          // A slide that crossed the back of the ring would otherwise animate
          // all the way across the panel. A genuine move is at most half the
          // ring, so anything larger is a wrap — drop its transition and let it
          // reappear instantly, which is invisible at opacity 0. Comparing
          // against half the ring rather than one slot keeps multi-slot dot
          // jumps animating normally.
          const wrapped =
            Math.abs(offset - ringOffset(i, slide.previous, total)) > total / 2

          return (
            <div
              className={`cf-item${offset === 0 ? ' is-active' : ''}`}
              key={src}
              style={{
                opacity: offStage ? 0 : 1 - distance * 0.3,
                // translate(-50%,-50%) centres the slide; the percentages after
                // it are relative to the slide's own width, so one step across
                // is just over half a card — the overlap that makes the stack
                // read as depth rather than a row.
                transform:
                  `translate(-50%, -50%) translateX(${offset * 54}%) ` +
                  `translateZ(${-distance * 120}px) ` +
                  `rotateY(${offset * -22}deg) ` +
                  `scale(${Math.max(1 - distance * 0.14, 0.4)})`,
                transition: wrapped ? 'none' : undefined,
                zIndex: total - distance,
              }}
            >
              {/* Eager, not lazy: every slide is already inside the viewport,
                  so lazy loading defers nothing useful and risks blank cards on
                  first paint — the whole set is only a few hundred KB. */}
              <img alt="" decoding="async" draggable={false} src={src} />
            </div>
          )
        })}
      </div>

      {total > 1 && (
        <div className="cf-dots">
          {SLIDES.map((src, i) => (
            <button
              aria-current={i === slide.current}
              aria-label={`Show image ${i + 1} of ${total}`}
              className={`cf-dot${i === slide.current ? ' is-active' : ''}`}
              key={src}
              onClick={() => goTo(i)}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  )
}
