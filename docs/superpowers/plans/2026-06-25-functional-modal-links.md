# Functional Modal Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every post-preview modal action functional using the player-row destinations, replace Follow Artist with social icon links, and remove Share Track.

**Architecture:** Move release and social destinations into a shared data module and move the existing social SVGs into a shared component. LandingIntro and PostPreviewModal will consume the same exports so URLs and logos cannot drift.

**Tech Stack:** Next.js 16, React, TypeScript, CSS Modules, Vitest

---

### Task 1: Define the modal link contract

**Files:**
- Modify: `src/components/PostPreviewModal/PostPreviewModal.test.tsx`

- [ ] Assert Listen Full Song and Save Song use the Spotify player-row URL.
- [ ] Assert Instagram, YouTube, and TikTok use the player-row social URLs and secure new-tab attributes.
- [ ] Assert Follow Artist and Share Track are absent.
- [ ] Update the focus-loop test so TikTok is the final focusable action.
- [ ] Run the modal test and confirm failure against placeholder links.

### Task 2: Share release links and social icons

**Files:**
- Create: `src/lib/releaseLinks.ts`
- Create: `src/components/SocialIcons/SocialIcons.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`

- [ ] Export Spotify, streaming, and social destinations from `releaseLinks.ts`.
- [ ] Export the existing Instagram, YouTube, and TikTok SVG implementations from `SocialIcons.tsx`.
- [ ] Replace LandingIntro-local constants and icon functions with the shared exports.

### Task 3: Implement functional modal actions

**Files:**
- Modify: `src/components/PostPreviewModal/PostPreviewModal.tsx`
- Modify: `src/components/PostPreviewModal/PostPreviewModal.module.scss`

- [ ] Replace placeholder action mapping with two functional Spotify actions.
- [ ] Render an icon-only social row for Instagram, YouTube, and TikTok.
- [ ] Remove the placeholder click-prevention handler and Share Track.
- [ ] Keep accessible labels, secure new-tab behavior, focus trapping, and responsive centering.

### Task 4: Verify

**Files:**
- Verify only

- [ ] Run modal, LandingIntro, and AudioPreview tests.
- [ ] Run ESLint and `git diff --check`.
- [ ] Run the production build.
