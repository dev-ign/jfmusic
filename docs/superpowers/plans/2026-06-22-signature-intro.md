# Signature Intro Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real SVG handwriting intro for “Jona Ferreira” that resolves into the final header signature and reveals the Caramelo landing page.

**Architecture:** A generated Island Moments SVG provides exact filled glyph outlines, while `SignatureLogo` exposes reusable intro and header variants. A client-only `LandingIntro` owns a scoped GSAP timeline, uses pure geometry helpers for the FLIP-style move, and keeps the existing release components mounted in their final layout from the first render.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, SCSS modules, GSAP, `@gsap/react`, Vitest, Testing Library, fontkit, SVG.

---

## File Map

- Create `scripts/generate-signature-svg.mjs`: shape Island Moments text and export glyph outline paths.
- Create `src/components/SignatureLogo/signature-logo.svg`: canonical generated vector reference.
- Create `src/components/SignatureLogo/signaturePaths.ts`: inline path/viewBox data consumed by React.
- Create `src/components/SignatureLogo/SignatureLogo.tsx`: reusable accessible intro/header SVG.
- Create `src/components/SignatureLogo/SignatureLogo.module.scss`: variant, fill, and stroke presentation.
- Create `src/components/SignatureLogo/SignatureLogo.test.tsx`: component semantics and layer tests.
- Create `src/components/LandingIntro/animationGeometry.ts`: pure path timing and rectangle transform helpers.
- Create `src/components/LandingIntro/animationGeometry.test.ts`: geometry and timing tests.
- Create `src/components/LandingIntro/LandingIntro.tsx`: GSAP timeline and semantic page composition.
- Create `src/components/LandingIntro/LandingIntro.module.scss`: overlay, hidden-state, interaction-lock, and responsive layout styles.
- Modify `src/components/ArtistHeader/ArtistHeader.tsx`: render the shared header signature and expose metadata separately.
- Modify `src/components/ArtistHeader/ArtistHeader.module.scss`: size the SVG header mark.
- Modify `src/app/page.tsx`: delegate the landing page to `LandingIntro`.
- Modify `src/app/page.module.scss`: remove layout rules migrated to `LandingIntro`.
- Modify `package.json` and lockfile: add runtime, vector-generation, and test dependencies/scripts.
- Create `vitest.config.ts` and `src/test/setup.ts`: browser-like component test environment.

The current workspace has no Git metadata. Commit steps below become actionable only if the user initializes or restores the repository; do not initialize Git without authorization.

### Task 1: Add Animation and Test Tooling

**Files:**
- Modify: `package.json`
- Modify: package lockfile selected by the existing package manager
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Confirm the package manager and preserve the existing lockfile family**

Run:

```bash
ls package-lock.json pnpm-lock.yaml yarn.lock 2>/dev/null
```

Expected: exactly one existing lockfile, or no output. Use npm when no lockfile exists because the supplied brief uses `npm install`.

- [ ] **Step 2: Install runtime and development dependencies**

Run with the selected package manager; npm form:

```bash
npm install gsap @gsap/react
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom fontkit
```

Expected: dependencies are added without peer-dependency errors.

- [ ] **Step 3: Add test scripts to `package.json`**

Merge these entries into `scripts` without removing the existing commands:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Create the Vitest configuration**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Run the empty test suite and lint**

Run:

```bash
npm test -- --passWithNoTests
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit when Git metadata is available**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts
git commit -m "chore: add signature animation tooling"
```

### Task 2: Generate the Canonical Island Moments SVG

**Files:**
- Create: `scripts/generate-signature-svg.mjs`
- Create: `src/components/SignatureLogo/signature-logo.svg`
- Create: `src/components/SignatureLogo/signaturePaths.ts`

- [ ] **Step 1: Locate the Latin Island Moments subset produced by Next.js**

Run:

```bash
rg -o "font-family:Island Moments[^}]+src:url\\(\\.\\./media/[^)]+" .next/static/chunks/*.css
```

Expected: three Island Moments subset declarations. Select the declaration paired with the `U+??` Latin range in the same generated CSS. In the current build its path is `.next/static/media/34b920cb1c5d0545-s.p.30pl85_cncuko.woff2`; re-read generated CSS rather than assuming the hash remains stable.

- [ ] **Step 2: Create a deterministic generator**

Create `scripts/generate-signature-svg.mjs` with these responsibilities:

```js
import fs from 'node:fs';
import path from 'node:path';
import fontkit from 'fontkit';

const text = 'Jona Ferreira';
const fontPath = process.argv[2];
if (!fontPath) throw new Error('Usage: node scripts/generate-signature-svg.mjs <font.woff2>');

const font = fontkit.openSync(fontPath);
const run = font.layout(text);
let cursorX = 0;
const glyphs = run.glyphs.map((glyph, index) => {
  const position = run.positions[index];
  const transform = `translate(${cursorX + position.xOffset} ${-position.yOffset}) scale(1 -1)`;
  cursorX += position.xAdvance;
  return { id: `glyph-${index + 1}`, d: glyph.path.toSVG(), transform };
});

const bounds = run.glyphs.reduce((box, glyph, index) => {
  const position = run.positions[index];
  const x = run.positions.slice(0, index).reduce((sum, item) => sum + item.xAdvance, 0);
  const b = glyph.path.bbox;
  return {
    minX: Math.min(box.minX, x + position.xOffset + b.minX),
    minY: Math.min(box.minY, -position.yOffset - b.maxY),
    maxX: Math.max(box.maxX, x + position.xOffset + b.maxX),
    maxY: Math.max(box.maxY, -position.yOffset - b.minY),
  };
}, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

const pad = font.unitsPerEm * 0.04;
const viewBox = [bounds.minX - pad, bounds.minY - pad, bounds.maxX - bounds.minX + pad * 2, bounds.maxY - bounds.minY + pad * 2];
const paths = glyphs.map(({ id, d, transform }) => `  <path id="${id}" class="signature-path" d="${d}" transform="${transform}" />`).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}">\n${paths}\n</svg>\n`;

fs.mkdirSync('src/components/SignatureLogo', { recursive: true });
fs.writeFileSync('src/components/SignatureLogo/signature-logo.svg', svg);
fs.writeFileSync('src/components/SignatureLogo/signaturePaths.ts', `export const SIGNATURE_VIEW_BOX = '${viewBox.join(' ')}';\nexport const SIGNATURE_PATHS = ${JSON.stringify(glyphs, null, 2)} as const;\n`);
```

- [ ] **Step 3: Generate both canonical asset forms**

Run:

```bash
node scripts/generate-signature-svg.mjs .next/static/media/34b920cb1c5d0545-s.p.30pl85_cncuko.woff2
```

Expected: `signature-logo.svg` renders “Jona Ferreira,” and `signaturePaths.ts` contains one entry per shaped glyph with no `<text>` elements.

- [ ] **Step 4: Inspect generated structure**

Run:

```bash
rg -n "<text|signature-path|SIGNATURE_VIEW_BOX|SIGNATURE_PATHS" src/components/SignatureLogo
```

Expected: zero `<text>` matches and path data in both generated artifacts.

- [ ] **Step 5: Commit when Git metadata is available**

```bash
git add scripts/generate-signature-svg.mjs src/components/SignatureLogo/signature-logo.svg src/components/SignatureLogo/signaturePaths.ts
git commit -m "feat: add Island Moments signature paths"
```

### Task 3: Build and Test `SignatureLogo`

**Files:**
- Create: `src/components/SignatureLogo/SignatureLogo.test.tsx`
- Create: `src/components/SignatureLogo/SignatureLogo.tsx`
- Create: `src/components/SignatureLogo/SignatureLogo.module.scss`

- [ ] **Step 1: Write failing semantic and layer tests**

Create `SignatureLogo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import SignatureLogo from './SignatureLogo';
import { SIGNATURE_PATHS } from './signaturePaths';

describe('SignatureLogo', () => {
  it('renders an accessible static header signature from SVG paths', () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<SignatureLogo ref={ref} variant="header" />);
    expect(screen.getByRole('img', { name: 'Jona Ferreira' })).toBeVisible();
    expect(container.querySelectorAll('.signature-fill-path')).toHaveLength(SIGNATURE_PATHS.length);
    expect(container.querySelector('text')).not.toBeInTheDocument();
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
  });

  it('renders decorative draw and fill layers for the intro', () => {
    const { container } = render(<SignatureLogo variant="intro" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.signature-draw-path')).toHaveLength(SIGNATURE_PATHS.length);
    expect(container.querySelectorAll('.signature-fill-path')).toHaveLength(SIGNATURE_PATHS.length);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- src/components/SignatureLogo/SignatureLogo.test.tsx
```

Expected: FAIL because `SignatureLogo` does not exist.

- [ ] **Step 3: Implement the reusable inline SVG**

Create `SignatureLogo.tsx` with a `forwardRef<SVGSVGElement, { variant: 'intro' | 'header'; className?: string }>` component. Render:

```tsx
<svg
  ref={ref}
  viewBox={SIGNATURE_VIEW_BOX}
  role={variant === 'header' ? 'img' : undefined}
  aria-label={variant === 'header' ? 'Jona Ferreira' : undefined}
  aria-hidden={variant === 'intro' ? true : undefined}
  className={`${styles.logo} ${styles[`logo--${variant}`]} ${className ?? ''}`}
>
  {variant === 'intro' && (
    <g className="signature-draw-layer">
      {SIGNATURE_PATHS.map((path) => (
        <path key={`draw-${path.id}`} className="signature-draw-path" d={path.d} transform={path.transform} />
      ))}
    </g>
  )}
  <g className="signature-fill-layer">
    {SIGNATURE_PATHS.map((path) => (
      <path key={`fill-${path.id}`} className="signature-fill-path" d={path.d} transform={path.transform} />
    ))}
  </g>
</svg>
```

Use `display: block`, `overflow: visible`, `fill: #843a09` for fill paths, and `fill: none; stroke: #843a09; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke` for draw paths. The intro fill layer starts transparent via CSS; the header draw layer is absent.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/components/SignatureLogo/SignatureLogo.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit when Git metadata is available**

```bash
git add src/components/SignatureLogo
git commit -m "feat: add reusable signature logo"
```

### Task 4: Test and Implement Animation Geometry

**Files:**
- Create: `src/components/LandingIntro/animationGeometry.test.ts`
- Create: `src/components/LandingIntro/animationGeometry.ts`

- [ ] **Step 1: Write failing geometry tests**

Create `animationGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateSignatureTransform, calculatePathSchedule } from './animationGeometry';

describe('calculateSignatureTransform', () => {
  it('moves center to center and scales by width', () => {
    expect(calculateSignatureTransform(
      { left: 100, top: 200, width: 400, height: 120 },
      { left: 40, top: 32, width: 200, height: 60 },
    )).toEqual({ x: -160, y: -198, scale: 0.5 });
  });
});

describe('calculatePathSchedule', () => {
  it('allocates 2.1 seconds proportionally with overlap', () => {
    const schedule = calculatePathSchedule([100, 200], 2.1, 0.08);
    expect(schedule).toHaveLength(2);
    expect(schedule[0].duration).toBeCloseTo(0.7);
    expect(schedule[1].duration).toBeCloseTo(1.4);
    expect(schedule[1].at).toBeCloseTo(0.62);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/components/LandingIntro/animationGeometry.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `animationGeometry.ts`:

```ts
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function calculateSignatureTransform(from: RectLike, to: RectLike) {
  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: to.width / from.width,
  };
}

export function calculatePathSchedule(lengths: number[], totalDuration: number, overlap: number) {
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let cursor = 0;
  return lengths.map((length) => {
    const duration = totalLength === 0 ? 0 : totalDuration * (length / totalLength);
    const item = { at: Math.max(0, cursor), duration };
    cursor += duration - overlap;
    return item;
  });
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/components/LandingIntro/animationGeometry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit when Git metadata is available**

```bash
git add src/components/LandingIntro/animationGeometry.ts src/components/LandingIntro/animationGeometry.test.ts
git commit -m "test: cover signature animation geometry"
```

### Task 5: Integrate the Static Header Signature

**Files:**
- Modify: `src/components/ArtistHeader/ArtistHeader.tsx`
- Modify: `src/components/ArtistHeader/ArtistHeader.module.scss`

- [ ] **Step 1: Replace font text with the shared header SVG**

Change `ArtistHeader` to accept `signatureRef` and `metadataRef` props, preserve the `h1`, and render:

```tsx
<header className={styles['artist-header']}>
  <h1 className={styles['artist-header__name']}>
    <SignatureLogo ref={signatureRef} variant="header" />
  </h1>
  <p ref={metadataRef} className={styles['artist-header__meta']}>
    <span>Latest Release</span>
    <span className={styles['artist-header__dot']} aria-hidden="true" />
    <span>Latin</span>
  </p>
</header>
```

Use typed `RefObject<SVGSVGElement | null>` and `RefObject<HTMLParagraphElement | null>` props.

- [ ] **Step 2: Size the header SVG without layout shift**

Set the name wrapper and SVG to a stable responsive box:

```scss
.artist-header__name {
  width: clamp(180px, 28vw, 300px);
  line-height: 0;
}

.artist-header__name svg {
  width: 100%;
  height: auto;
}
```

- [ ] **Step 3: Run tests and lint**

Run:

```bash
npm test
npm run lint
```

Expected: PASS and no lint errors.

- [ ] **Step 4: Commit when Git metadata is available**

```bash
git add src/components/ArtistHeader
git commit -m "feat: use signature SVG in artist header"
```

### Task 6: Build the Scoped GSAP Landing Timeline

**Files:**
- Create: `src/components/LandingIntro/LandingIntro.tsx`
- Create: `src/components/LandingIntro/LandingIntro.module.scss`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.scss`

- [ ] **Step 1: Create the semantic composition and refs**

In `LandingIntro.tsx`, add `'use client'`, register `useGSAP`, and render the full final structure plus a fixed decorative intro overlay. Use refs for root, intro signature, header signature, metadata, cover wrapper, track wrapper, audio wrapper, and action wrapper. Pass `MEDIA_ENDPOINTS` as serializable props from `page.tsx` or import the constants directly if they remain plain strings.

- [ ] **Step 2: Set initial states synchronously inside `useGSAP`**

Within a root-scoped `useGSAP`, select `.signature-draw-path`, `.signature-fill-layer`, and the five reveal refs. For normal motion:

```ts
gsap.set(headerSignatureRef.current, { autoAlpha: 0 });
gsap.set(revealTargets, { autoAlpha: 0, y: 12 });
gsap.set(coverRef.current, { y: 18 });
gsap.set(rootRef.current, { pointerEvents: 'none' });
gsap.set(fillLayer, { autoAlpha: 0 });
```

Set each draw path's `strokeDasharray` and `strokeDashoffset` to `path.getTotalLength()`.

- [ ] **Step 3: Implement reduced motion before creating the main timeline**

Use `gsap.matchMedia()` conditions for `(prefers-reduced-motion: reduce)`. In the reduced branch, set header and reveal targets visible, hide the intro overlay, clear transforms, and restore root pointer events immediately. Return `mm.revert()` from the hook cleanup path.

- [ ] **Step 4: Construct the handwriting and fill sequence**

Use `calculatePathSchedule()` and add one tween per draw path:

```ts
schedule.forEach(({ at, duration }, index) => {
  timeline.to(drawPaths[index], {
    strokeDashoffset: 0,
    duration,
    ease: 'power2.out',
  }, at);
});

timeline
  .to(fillLayer, { autoAlpha: 1, duration: 0.4, ease: 'power1.out' })
  .to(drawLayer, { opacity: 0.18, duration: 0.3 }, '<');
```

- [ ] **Step 5: Measure and animate into the header**

Wait for `document.fonts.ready` before creating the motion portion. Immediately before the move tween, call `getBoundingClientRect()` on both SVGs, pass them to `calculateSignatureTransform`, and tween the intro SVG with `transformOrigin: 'center center'`, `x`, `y`, and `scale` over 1 second using `power3.inOut`.

- [ ] **Step 6: Handoff and reveal content**

At the move completion point, set the header SVG visible and intro overlay hidden in the same timeline position. Reveal metadata, cover, track, audio, and actions using `autoAlpha: 1`, `y: 0`, `duration: 0.6`, `stagger: 0.1`, `ease: 'power2.out'`. Restore root pointer events and dispatch `window.dispatchEvent(new Event('resize'))` after reveal so WaveSurfer remeasures without autoplay.

- [ ] **Step 7: Move page composition into `LandingIntro`**

Replace the current page body with:

```tsx
export default function Home() {
  return <LandingIntro />;
}
```

Move the current `release-page` and `release-shell` rules into `LandingIntro.module.scss`, preserving `100svh`, desktop centering, and mobile scrolling. Add fixed overlay centering, `will-change: transform`, and `pointer-events: none` for the intro mark.

- [ ] **Step 8: Run automated checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit when Git metadata is available**

```bash
git add src/components/LandingIntro src/app/page.tsx src/app/page.module.scss
git commit -m "feat: animate signature landing intro"
```

### Task 7: Rendered QA and Centerline Acceptance Gate

**Files:**
- Potentially modify: `src/components/SignatureLogo/signature-logo.svg`
- Potentially modify: `src/components/SignatureLogo/signaturePaths.ts`
- Potentially modify: `src/components/SignatureLogo/SignatureLogo.tsx`
- Potentially modify: `src/components/SignatureLogo/SignatureLogo.module.scss`

- [ ] **Step 1: Load the Browser skill and define the target flow**

Target flow: `/` loads with only the centered signature visible → handwriting completes → the same signature lands exactly in the header → metadata and release content reveal → controls become interactive without console errors.

- [ ] **Step 2: Start the app and capture normal-speed desktop evidence**

Run `npm run dev`, open the exact local URL in the in-app Browser, and verify page identity, nonblank DOM, no framework overlay, and console health. Capture screenshots during the draw phase and after the final handoff at a desktop viewport.

- [ ] **Step 3: Apply the handwriting quality gate**

Watch the draw once at normal speed. Pass only if it reads as a single pen movement through letterforms. Fail if both sides of closed shapes visibly trace, counters are outlined, or letters appear mechanically perimeter-drawn.

- [ ] **Step 4: If the quality gate fails, create a centerline draw layer**

In a vector editor, place `signature-logo.svg` as the locked reference, trace open centerlines in natural writing order with round caps, and export them into the same viewBox as `.signature-stroke-path` elements. Preserve the generated glyph outlines unchanged as the fill layer. Add the centerline path data to `signaturePaths.ts` as `SIGNATURE_STROKE_PATHS`, render those paths only in the intro draw layer, and update the component test to expect `SIGNATURE_STROKE_PATHS.length` draw paths. The fill layer must still use `SIGNATURE_PATHS`.

- [ ] **Step 5: Re-run the full desktop animation after any centerline change**

Expected: the centerline writes naturally, crossfades into the exact Island Moments filled outlines, and the filled signature—not the centerline—moves into the header.

- [ ] **Step 6: Verify responsive and reduced-motion states**

At one mobile viewport, verify no clipping, overlap, scroll trap, or header misalignment. Emulate reduced motion, reload, and verify the overlay never appears, all content is immediately visible, and controls are interactive.

- [ ] **Step 7: Verify audio and interactions**

Confirm no audio starts automatically. After reveal, click the play control and verify its visible state changes; click one action-menu control and verify its menu opens. Confirm the same controls cannot receive pointer input before the reveal completes.

- [ ] **Step 8: Record the mismatch ledger**

Document observed versus intended results for signature stroke quality, final header bounds, desktop layout, mobile layout, reduced motion, waveform sizing, and console health. Fix every nonintentional mismatch before completion.

- [ ] **Step 9: Commit centerline refinements when Git metadata is available**

```bash
git add src/components/SignatureLogo
git commit -m "refine: use natural signature centerline strokes"
```

Skip this commit when the outline draw passes the visual gate unchanged.

### Task 8: Final Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run the complete automated suite from a clean dev-server state**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0 with no relevant warnings.

- [ ] **Step 2: Repeat the Browser smoke flow against the final build**

Run `npm start` after the build and repeat page identity, blank-page, framework overlay, console, screenshot, and interaction checks at desktop and mobile sizes.

- [ ] **Step 3: Confirm scope and accessibility**

Verify there is no `<text>` element inside either signature SVG, the header signature has the accessible name “Jona Ferreira,” the decorative intro is hidden from assistive technology, focus is not trapped, audio does not autoplay, and no animation repeats.

- [ ] **Step 4: Commit the verified result when Git metadata is available**

```bash
git add src scripts package.json package-lock.json vitest.config.ts
git commit -m "feat: complete Caramelo signature intro"
```

Do not run this step in the current workspace unless Git metadata is restored or the user explicitly asks to initialize a repository.
