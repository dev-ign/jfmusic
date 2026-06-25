# Signature Intro Animation Design

## Goal

Add a first-load landing animation in which the “Jona Ferreira” signature writes itself on the caramel background, resolves into its filled logo form, and moves smoothly into the final header position before the remaining release content appears.

## Signature Asset

- Convert the existing Island Moments rendering of “Jona Ferreira” into SVG glyph outline paths.
- Store the source asset at `src/components/SignatureLogo/signature-logo.svg`.
- Keep each character or logical glyph group as a separately targetable `.signature-path` so the writing can progress in reading order with slight overlaps.
- Use `#843a09` for both the animated stroke and final fill.
- Use the same geometry for the intro and header variants to make the transition visually continuous.

SVG glyph outlines are closed contours rather than true pen centerlines. Sequential character timing and overlapping strokes are the first implementation attempt because they preserve an exact match to the selected font. During rendered visual verification, if this reads as contour tracing instead of natural handwriting, create a separate set of open centerline stroke paths that follow the apparent pen movement through each letter. Use those centerline paths only for the draw-on phase, then fade into the exact filled glyph-outline paths for the final signature.

## Component Architecture

### `SignatureLogo`

Create a reusable component under `src/components/SignatureLogo/` with:

- `variant="intro"` for the large inline SVG with animated stroke and fill layers.
- `variant="header"` for the final static inline SVG.
- Forwarded refs or explicit element refs required by the animation coordinator.
- An accessible “Jona Ferreira” label for the meaningful header instance.
- `aria-hidden="true"` for the decorative intro duplicate.

The SVG is inlined in React so GSAP can address individual paths and call `getTotalLength()`.

### `LandingIntro`

Create a client component that renders the existing final semantic page structure and owns:

- The fixed, centered intro signature overlay.
- The destination header signature.
- Refs for metadata, cover art, track information, audio preview, and action buttons.
- The scoped GSAP timeline and lifecycle cleanup.
- The temporary interaction lock used while the intro is active.

Existing content components remain focused on their current content and behavior. The page delegates animation coordination to `LandingIntro`.

## Animation Sequence

1. Render the caramel background and centered intro signature. Keep the destination signature and all other content visually hidden without removing their layout space.
2. Measure every `.signature-path` with `getTotalLength()`. Set `strokeDasharray` and `strokeDashoffset` to each measured length.
3. Draw character paths in reading order over approximately 2.1 seconds with small timing overlaps and a `power2.out` feel.
4. Fade in the identical filled paths over approximately 0.4 seconds while reducing stroke opacity.
5. Read the current bounding rectangles of the intro and destination SVGs. Calculate center-to-center `x` and `y` translation plus the destination-to-intro width scale.
6. Move and scale the fixed intro SVG into the header bounds over approximately 1 second with `power3.inOut`.
7. In one timeline handoff, reveal the static header instance and hide the intro duplicate so there is no visible swap.
8. Reveal metadata, cover, track information, audio preview, and action buttons over 0.5–0.7 seconds with a short 0.08–0.12 second stagger and small upward movement.
9. Remove the interaction lock and the decorative overlay from pointer and visual participation.

If the first rendered pass visibly traces both sides of the closed glyph contours, replace the draw layer with separate `.signature-stroke-path` centerlines. Measure and animate those open paths with the same dash technique, keep the filled glyph outlines hidden during drawing, and crossfade from centerline strokes to the filled outline layer before the move-to-header tween.

The intro runs once per full page load. It does not autoplay audio and contains no infinite animation.

## Layout and Measurement

- Preserve the complete final layout from the first render so content does not jump when revealed.
- Keep the landing surface within `100svh` at supported viewport sizes.
- Wait for document fonts before the first destination measurement.
- Measure the destination again immediately before the move tween so late image, font, or waveform layout changes cannot introduce an offset.
- Use transform-based movement and scaling for smooth rendering.
- Keep the intro overlay non-interactive and prevent hidden controls from receiving pointer input until reveal completion.

## Accessibility

- Respect `prefers-reduced-motion: reduce` by skipping the timeline and immediately showing the complete final state.
- Keep the decorative intro signature out of the accessibility tree.
- Give the header signature the same semantic meaning as the current `h1` text.
- Do not trap focus in the overlay.
- Preserve normal keyboard access once the final state is shown.

## Waveform and Audio

- Audio must never autoplay.
- WaveSurfer may initialize while visually hidden because its layout space remains present.
- If rendered waveform dimensions are stale after reveal, trigger the existing supported redraw or resize behavior after the content reveal completes.

## Verification

- Run lint and a production build.
- Verify the initial centered-signature state, drawn stroke progression, filled-signature handoff, final header alignment, and staggered content reveal in a rendered browser.
- Judge the draw-on phase at normal playback speed. It must read as a pen stroke rather than a contour being outlined; if it does not, implement and re-verify the centerline draw layer before accepting the animation.
- Verify desktop and mobile viewport behavior.
- Verify hidden controls cannot be clicked during the intro.
- Verify reduced-motion visitors receive the complete final state immediately.
- Verify audio does not autoplay and the waveform has valid dimensions after reveal.
- Check for framework overlays and relevant console warnings or errors.

## Scope

This change adds the signature asset, reusable signature component, landing animation coordinator, required styling, GSAP dependencies, and focused verification. It does not redesign the existing landing content, change audio behavior, or add repeat/infinite animation.
