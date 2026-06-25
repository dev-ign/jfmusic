# Thin Nav and Lyrics Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oval nav surface with a thin floating glass rail, make only the active segment raised, color the heart red, and remove the Lyrics card treatment without changing Home, Credits, controls, disc motion, or navigation behavior.

**Architecture:** Keep existing markup, refs, interactions, transforms, GSAP logic, and disc animation untouched. Use scoped SCSS changes for the nav rail and Lyrics state, plus a dedicated heart modifier class and a small `--nav-offset-y` adjustment.

**Tech Stack:** Next.js 16, React 19, TypeScript, SCSS modules, Vitest, Testing Library, Browser/IAB.

---

### Task 1: Add visual contract tests

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`

- [ ] Add assertions that the nav is no taller than 36px, uses a pill radius, has a translucent background, and retains the existing perspective transform tokens.
- [ ] Add assertions that only `.disc-nav-band__btn--active` has the filled capsule treatment.
- [ ] Add assertions that Lyrics has transparent background, no border, no box shadow, and no backdrop filter.
- [ ] Add an assertion that the Spotify heart link receives a dedicated heart class.
- [ ] Run `npm test -- src/components/LandingIntro/LandingIntro.test.tsx` and confirm failure.

### Task 2: Implement the scoped refinement

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] Add the heart modifier class to the existing heart link only.
- [ ] Reduce the nav height, switch to a thin pill radius, lighten the rail background, and preserve the existing `perspective`, `rotateX`, and `scaleY` transform values.
- [ ] Move the rail slightly upward only through `--nav-offset-y`.
- [ ] Keep inactive segments transparent and retain the raised filled treatment only on the active segment.
- [ ] Make the Lyrics container transparent with no border, blur, radius, or shadow; retain its position, transition, and internal minimal scrolling/fade masks.
- [ ] Match Lyrics typography and alignment to the existing Credits content language.
- [ ] Run the focused tests and confirm pass.

### Task 3: Verify boundaries and rendering

**Files:**
- Verify: `src/components/LandingIntro/LandingIntro.tsx`
- Verify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] Run targeted LandingIntro and AudioPreview tests.
- [ ] Run lint and production build.
- [ ] Use Browser/IAB at desktop and 390×667 to inspect Home, Credits, and Lyrics.
- [ ] Confirm Home and Credits remain unchanged, Lyrics has no card surface, controls retain size/position, and the nav floats above the disc.
- [ ] Confirm the diff contains no changes to nav interaction, GSAP indicator logic, or disc rotation code.
