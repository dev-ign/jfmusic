# Mobile Scale and Type Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the mobile cover to a 1.4 scale target, enlarge and lower mobile player controls, strengthen navigation and Lyrics typography, and expand mobile Lyrics without reaching the navigation.

**Architecture:** Keep the change CSS-only inside `LandingIntro.module.scss`. Use a proportional breakpoint ladder at 700px, 560px, 430px, and 380px so local scaling compensates for the existing stage scale while preserving all transforms, GSAP behavior, and component markup.

**Tech Stack:** Next.js 16, React, CSS Modules/SCSS, Vitest

---

### Task 1: Lock the responsive visual contract

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`

- [ ] Add a stylesheet contract test for the 1.4 small-phone cover target, progressively larger controls and labels, premium Lyrics weight, and expanded mobile Lyrics height.
- [ ] Run `npm test -- src/components/LandingIntro/LandingIntro.test.tsx` and confirm the new test fails because the requested values are absent.

### Task 2: Implement proportional breakpoint tuning

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] Increase desktop nav typography and move the nav upward through existing custom properties only.
- [ ] Add a proportional cover scale ladder ending at `1.4` at 430px and below.
- [ ] Increase control and icon dimensions progressively and increase `--control-gap` slightly on mobile.
- [ ] Increase mobile nav label typography progressively.
- [ ] Give Lyrics stronger weight/contrast and progressively greater mobile height while keeping its bottom above the nav.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Verify rendering

**Files:**
- Verify only

- [ ] Check desktop and 390×667 rendering in the browser.
- [ ] Confirm no page scrolling, Lyrics/nav separation, and visible controls.
- [ ] Run ESLint, `git diff --check`, and the production build.
