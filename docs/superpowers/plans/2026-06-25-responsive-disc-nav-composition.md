# Responsive Disc Navigation Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit the complete Caramelo composition without document scrolling while integrating a premium curved navigation island over the disc, without changing the existing disc rotation behavior.

**Architecture:** Add a scale-only wrapper outside the existing `.shell`, then drive stage scale and vertical geometry through CSS custom properties. Keep `tiltElRef`, `labelElRef`, `.disc-tilt`, and `.disc__label` unchanged so the existing animation transform stack is isolated from responsive scaling.

**Tech Stack:** Next.js 16, React 19, TypeScript, SCSS modules, Vitest, Testing Library, GSAP, Browser/IAB.

---

### Task 1: Lock the wrapper and CSS-variable contract

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] **Step 1: Write failing tests**

Add tests that require:

```tsx
const stageScale = container.querySelector('[data-stage-scale]');
const shell = container.querySelector('[data-landing-shell]');
const discTilt = container.querySelector('[data-disc-tilt]');

expect(stageScale).not.toBeNull();
expect(stageScale).toContainElement(shell);
expect(shell).toContainElement(discTilt);
expect(stageScale).not.toBe(discTilt);
```

Read the SCSS and assert it defines `--stage-scale`, `--stage-offset-y`,
`--cover-offset-y`, `--title-offset-y`, `--disc-offset-y`, `--nav-offset-y`,
and `--control-gap`, and that `.stage-scale` owns `scale(var(--stage-scale))`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: FAIL because the scale wrapper, data attributes, and custom-property
contract do not exist.

- [ ] **Step 3: Add the scale wrapper**

Wrap the existing shell:

```tsx
<div className={styles['stage-scale']} data-stage-scale>
  <div ref={shellRef} data-landing-shell>{/* existing stage */}</div>
</div>
```

Add `data-disc-tilt` to the existing `.disc-tilt` element only. Do not move or
change `tiltElRef` or `labelElRef`.

- [ ] **Step 4: Add the base custom properties**

Define all required properties on `.stage-scale`, apply scale and vertical
translation there, and replace hard-coded stage positions with the matching
variables.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: PASS.

### Task 2: Implement the curved disc nav and responsive fit

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`
- Modify: `src/app/globals.scss`

- [ ] **Step 1: Write failing style-contract tests**

Assert the nav uses perspective/rotate/scale, active buttons have a background,
border, and glow, reduced motion disables nav transitions, and responsive media
queries include a short-height rule for `667px`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: FAIL because the current nav is below the disc and has only a colored
text active state.

- [ ] **Step 3: Implement desktop geometry and nav styling**

Move the cover/title/disc/control positions to custom properties, place the nav
over the front/top disc area, add the elliptical glass island, contact shadow,
and active luminous capsule. Keep the existing GSAP dot movement compatible by
restyling the dot as a subtle active glow marker rather than changing its logic.

- [ ] **Step 4: Implement responsive scale presets**

Use width- and height-aware `--stage-scale` values and dedicated compact rules
for short viewports. Tune offsets and control gap so 390×667 preserves:
signature → cover → title/meta → disc/nav → controls.

- [ ] **Step 5: Lock document scrolling**

Set `html` and `body` to viewport height with hidden overflow while preserving
the lyrics panel's internal scrolling.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: PASS.

### Task 3: Verify behavior and rendered layout

**Files:**
- Verify: `src/components/LandingIntro/LandingIntro.tsx`
- Verify: `src/components/LandingIntro/LandingIntro.module.scss`
- Verify: `src/app/globals.scss`

- [ ] **Step 1: Run targeted regression tests**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx src/components/AudioPreview/AudioPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run lint and production build**

```bash
npm run lint
npx next build --webpack
```

Expected: no lint errors and a successful build.

- [ ] **Step 3: Run Browser/IAB desktop QA**

At the default viewport verify page identity, no framework overlay, no document
scroll, centered composition, curved nav placement, active-state clarity, and
Home/Lyrics/Credits interaction.

- [ ] **Step 4: Run Browser/IAB short-mobile QA**

Set viewport to 390×667 and verify the whole composition fits, the disc is not
cropped, controls remain visible, labels stay readable, and the document does
not scroll.

- [ ] **Step 5: Confirm animation isolation**

Inspect the final diff and browser behavior to verify that no code inside the
disc rAF loop, `tiltElRef` transform writes, or `labelElRef` rotation writes was
changed.
