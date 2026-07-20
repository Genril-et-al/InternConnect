# Login panel slideshow

Drop images in this folder and they appear in the coverflow carousel on the
login / sign-up page. Nothing else to edit.

- **Formats:** `.jpg` `.jpeg` `.png` `.webp` `.avif`
- **Order:** by filename — prefix with `01-`, `02-`, … to control the sequence
- **Shape:** cards render at 4:3 and are cropped to fill (`object-fit: cover`),
  so keep the subject near the centre. Around 1200×900 is plenty; anything
  larger is wasted bytes since the card is never more than ~380px wide.
- **How many:** 5 or more looks best. The ring needs room to hide slides
  wrapping around the back — with fewer than 5 you may catch one re-entering.

Vite fingerprints and optimises these at build time (`import.meta.glob` in
`../HeroCarousel.tsx`), so they are cached properly in production.

If this folder has no images, the panel falls back to its original headline
instead of rendering an empty stage.
