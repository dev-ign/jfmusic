# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm run lint       # ESLint (eslint-config-next core-web-vitals + typescript)
npm run test       # vitest run (single pass)
npm run test:watch # vitest watch mode
```

Run a single test file:
```bash
npx vitest run src/components/LandingIntro/animationGeometry.test.ts
```

## Architecture

This is a single-page music landing page ("Caramelo" by Jona Ferreira) built with **Next.js 16**, React 19, SCSS Modules, GSAP, and WaveSurfer.js.

**Media protection model:** Cover art and audio preview are never served as public static files. They live under `private/` (gitignored from public serving) and are gated behind Next.js API routes:

- `GET /api/media/cover` → streams `private/images/caramelo-cover.png`
- `GET /api/media/preview` → streams `private/audio/caramelo-preview.mp3` with HTTP Range support

All component references to these assets go through `src/lib/mediaEndpoints.ts` (`MEDIA_ENDPOINTS.cover` / `MEDIA_ENDPOINTS.preview`). To swap to a CDN, update only that file.

**Animation flow (`LandingIntro`):** On load, the page shell is set `inert` and a full-screen overlay shows a GSAP-driven SVG signature draw animation. The animation:
1. Draws SVG stroke paths over the signature using `strokeDashoffset`
2. Moves the signature to the header position via a transform tween
3. Fades in the static header `SignatureLogo` and reveals the page shell

`animationGeometry.ts` contains pure math helpers (`calculatePathSchedule`, `calculateSignatureTransform`) that are fully unit-tested and have no DOM dependency.

**rAF animation loop:** Alongside GSAP, `LandingIntro` runs a separate `requestAnimationFrame` loop that drives three continuous animations: disc tilt (sinusoidal rock on X/Z axes), disc label spin (velocity ramps from 4 to 42 deg/s while audio plays), and cover/meta bob (`sin`-based `translateY`). This loop is independent of GSAP, cancelled on unmount, and skipped entirely under `prefers-reduced-motion`.

**`SignatureLogo` dual-variant:** The same component is used in two roles controlled by the `variant` prop:
- `"intro"` — rendered in the overlay with draw/mask SVG layers for animation
- `"header"` — static accessible `<img>`-equivalent (`role="img"`, `aria-label`)

The animation targets CSS class names (`.signature-draw-path`, `.signature-reveal-mask-path`, `.signature-fill-layer`) not component refs, so the SVG structure must preserve those class names.

**Page modes:** `LandingIntro` maintains a `PageMode` state (`'cover' | 'credits' | 'lyrics'`) that controls three views. `'credits'` flips `CoverCard` to its back face (a `<dl>` of production credits). `'lyrics'` slides the cover stage left and reveals a scrollable lyrics panel. `'cover'` is the home state.

**Post-preview conversion flow:** After a "qualified" audio preview completion (≥85% playback, tracked by `AudioPreview` via `peakPlaybackProgressRef`), `onQualifiedFinish` fires with a `reset` callback (seek-to-zero). `LandingIntro` then:
1. Calls `recordPreviewCompletion()` to timestamp the event in localStorage
2. Checks `canShowPostPreviewPrompt()` — requires a prior completion and a 24-hour cooldown since last shown/dismissed
3. If eligible, waits 450ms settle delay (0ms under reduced motion), then mounts `PostPreviewModal`
4. The `reset` callback is deferred until after the modal opens; if ineligible, it fires immediately

`src/lib/postPreviewPrompt.ts` persists state to `localStorage` (`caramelo:post-preview-prompt:v1`) and suppresses repeat display within a session via `sessionStorage`. It falls back to module-level in-memory state when storage is unavailable and is fully injectable for testing via its optional `storage` parameter.

**`PostPreviewModal`:** Portal-rendered into `document.body` to avoid stacking-context issues. Uses CSS transitions (not GSAP) — exit completion is detected via `transitionend` on the `transform` property, with a timer fallback (`620ms` normal / `120ms` reduced motion). Implements full focus-trap (Tab/Shift+Tab cycle, Escape to close) and restores focus to the previously focused element on close.

**Shell inert management:** The `data-landing-shell` div is set `inert` in two distinct situations: (1) during the GSAP intro animation until `restoreInteraction()` fires, and (2) while `PostPreviewModal` is mounted. Both paths coordinate through `introHasCompletedRef` and `modalMountedRef` to avoid races when the modal mounts before the intro completes.

**Reduced motion:** `LandingIntro` uses `gsap.matchMedia()` to detect `prefers-reduced-motion: reduce` and immediately shows the final state, skipping all animation. The rAF loop and modal settle delay also respect this preference independently.

## Styling

Each component has a co-located `.module.scss` file. Global tokens and resets live in `src/app/globals.scss`. Fonts are loaded via `next/font/google` in `layout.tsx` and exposed as CSS variables (`--font-island-moments`, `--font-schibsted-grotesk`, `--font-inter`).

## Testing

Vitest with jsdom. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom/vitest`). Path alias `@` resolves to `src/`. Most tests use `@testing-library/react`; pure logic modules (`animationGeometry.ts`, `postPreviewPrompt.ts`) are tested without DOM setup. `postPreviewPrompt.ts` exports `resetPostPreviewPromptMemoryForTests()` to clear its module-level state between tests.
