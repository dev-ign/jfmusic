# Post-Preview Conversion Modal Design

## Goal

Create a premium, artist-first conversion moment that appears only after a listener naturally finishes the Caramelo preview and has reached at least 85% peak progress during real playback. The experience should extend the listening moment without interrupting playback or repeatedly prompting the listener.

## Scope

This feature adds:

- Playback progress and natural-completion reporting from `AudioPreview`.
- Page-level orchestration in `LandingIntro`.
- A coordinated cover-disc slowdown and page-darkening transition.
- An accessible post-preview dialog.
- Versioned browser-storage rules for first completion, same-session suppression, dismissal, and a 24-hour cooldown.
- Placeholder destinations for Listen, Save, Follow, and Share actions.

This feature does not add analytics, production streaming links, native Web Share behavior, server-side persistence, authentication, or cross-device suppression.

## Architecture

The implementation uses page-level orchestration.

### `AudioPreview`

`AudioPreview` remains responsible only for audio playback and reporting:

- Report whether playback is active.
- Observe progress updates while the audio is actively playing.
- Track the highest progress ratio reached during real playback.
- Report a qualifying completion only from WaveSurfer's natural `finish` event.
- Qualify completion only when peak real-playback progress is at least `0.85`.
- Reset WaveSurfer to the beginning after reporting completion.

Seeking while paused does not count toward peak progress. Reaching 85% without a natural `finish` event does not open the modal.

### `LandingIntro`

`LandingIntro` coordinates the page-wide experience:

- Receive playback-state and qualifying-completion callbacks from `AudioPreview`.
- Decide whether prompt persistence permits the modal to open.
- Trigger the cover-disc slowdown and background-darkening sequence.
- Open and close the modal.
- Mark the current session as prompted when the modal is shown.
- Record dismissal and the 24-hour cooldown when the modal closes.

The existing introductory animation remains independent from this feature.

### Prompt persistence utility

A focused utility owns all browser-storage behavior. It uses a versioned schema and treats unavailable or malformed storage as a safe, non-fatal condition.

`localStorage` stores:

- Schema version.
- Whether the release preview has ever been completed.
- Last modal presentation timestamp.
- Last dismissal timestamp.

`sessionStorage` stores:

- Whether the modal has already been presented in the current tab session.

The utility exposes intent-based functions rather than raw storage access:

- Record a qualifying preview completion.
- Decide whether the prompt may be shown.
- Mark the prompt as shown for this session.
- Record dismissal.

### `PostPreviewModal`

The modal is a focused client component responsible for:

- Dialog semantics and accessible labeling.
- Focus trapping.
- Initial focus placement.
- Restoring focus to the previously focused element.
- Escape-key dismissal.
- Backdrop-click dismissal.
- Preventing backdrop dismissal when the dialog surface is clicked.
- Entrance and exit animation.
- Reduced-motion behavior.
- Rendering the four conversion actions.

## Trigger and persistence behavior

The trigger sequence is:

1. The listener starts real playback.
2. `AudioPreview` tracks the highest progress observed while playing.
3. WaveSurfer emits its natural `finish` event.
4. `AudioPreview` confirms peak progress was at least 85%.
5. `LandingIntro` records completion and asks the persistence utility whether the prompt may open.
6. If permitted, the cover slows, the background darkens, and the modal opens.

The modal is permitted only when all of the following are true:

- A qualifying completion has occurred.
- It has not already been presented in the current tab session.
- It has not been presented or dismissed during the prior 24 hours.

The first qualifying completed listen presents the modal immediately unless storage already contains a valid cooldown from an earlier visit.

When the modal is shown, same-session suppression is recorded immediately. When dismissed by any method, the dismissal timestamp is recorded. Closing and replaying the preview in the same session never reopens the modal.

If browser storage is blocked, the page still functions. In that case, in-memory state prevents repeated prompts for the lifetime of the mounted page.

## Visual design

### Backdrop

The modal layer covers the viewport with:

- A low-opacity dark veil.
- Backdrop blur that softens the page without erasing it.
- Warm radial gradients derived from the Caramelo artwork palette.
- The rotating cover/disc remaining faintly visible beneath the overlay.

The initial palette uses artwork-derived warm tones:

- Caramel brown.
- Cream.
- Soft amber.
- Muted gold.

The gradients are large, diffuse, and low saturation. They avoid hard color boundaries and high-contrast promotional styling.

### Modal surface

The dialog uses:

- A semi-transparent warm glass surface.
- Strong backdrop blur.
- A subtle low-opacity white border.
- Rounded corners consistent with the release artwork.
- A soft amber edge glow and deep ambient shadow.
- Restrained typography with generous spacing.

The surface should feel atmospheric and integrated with the album artwork, not like a generic white card.

### Content

Headline:

> Thanks for listening.

Body:

> If you enjoyed Caramelo, here's how you can support the release.

Actions:

- Primary: Listen Full Song
- Secondary: Save Song
- Secondary: Follow Artist
- Secondary: Share Track

All destinations use `#` placeholders in this implementation. The primary action receives the strongest tonal contrast. Secondary actions use lighter glass pills with clear hover and focus-visible states.

## Motion

For standard motion preferences:

1. Natural preview playback finishes.
2. The waveform remains visually complete for the transition.
3. The cover/disc rotation eases toward a stop.
4. The page darkens and blurs.
5. The modal fades in, scales from slightly smaller, and moves upward into position.
6. A restrained spring-like settle completes the entrance.

Dismissal reverses the modal opacity and vertical movement, then removes the overlay. The cover returns to its resting visual state.

The sequence must not delay audio completion reporting or reset the waveform before the listener sees it complete.

For `prefers-reduced-motion: reduce`:

- Do not rotate or spring.
- Use a short opacity transition or immediate state change.
- Preserve all persistence, dialog, focus, and dismissal behavior.

## Accessibility

The modal uses:

- `role="dialog"`.
- `aria-modal="true"`.
- `aria-labelledby` and `aria-describedby`.
- A logical DOM order matching the visual order.
- Initial focus on the primary action.
- Tab and Shift+Tab wrapping within the dialog.
- Escape dismissal.
- Focus restoration after exit.
- Visible focus indicators with sufficient contrast.
- Minimum 44px interactive targets.

While open, the underlying landing shell is inert and unavailable to assistive technology and pointer interaction. The modal remains usable by keyboard without relying on animation.

## Component and file boundaries

Expected files:

- Modify `src/components/AudioPreview/AudioPreview.tsx` for playback, progress, and completion callbacks.
- Modify `src/components/AudioPreview/AudioPreview.test.tsx` for progress qualification and natural-finish tests.
- Modify `src/components/LandingIntro/LandingIntro.tsx` for orchestration and inert-state management.
- Modify `src/components/LandingIntro/LandingIntro.module.scss` for page transition hooks.
- Modify `src/components/LandingIntro/LandingIntro.test.tsx` for modal orchestration tests.
- Modify `src/components/CoverCard/CoverCard.tsx` to accept visual playback/settling state without owning audio behavior.
- Modify `src/components/CoverCard/CoverCard.module.scss` for the disc slowdown/resting transition.
- Create `src/components/PostPreviewModal/PostPreviewModal.tsx`.
- Create `src/components/PostPreviewModal/PostPreviewModal.module.scss`.
- Create `src/components/PostPreviewModal/PostPreviewModal.test.tsx`.
- Create `src/lib/postPreviewPrompt.ts`.
- Create `src/lib/postPreviewPrompt.test.ts`.

The final implementation may adjust exact names to match discovered code constraints, but responsibilities remain separated as described.

## Error handling

- WaveSurfer errors retain the existing unavailable-preview state and never open the modal.
- Storage read/write errors are caught and do not break playback or modal interaction.
- Malformed or outdated stored data is ignored and replaced when the next valid event is recorded.
- Missing action URLs remain safe placeholder links and do not trigger application errors.

## Testing strategy

Unit and component tests cover:

- Progress under 85% followed by `finish` does not qualify.
- Progress at or above 85% during active playback followed by `finish` qualifies.
- Seeking while paused does not raise peak real-playback progress.
- Completion is reported only from `finish`.
- Storage records completion, session presentation, and dismissal.
- The 24-hour cooldown is enforced at its boundary.
- Malformed and unavailable storage fail safely.
- The modal opens after an eligible completion.
- The modal does not reopen in the same session.
- Escape, backdrop click, and action activation dismiss correctly.
- Focus is trapped and restored.
- Underlying content becomes inert while the modal is open.
- Reduced-motion behavior avoids the full entrance choreography.

Final verification includes:

- Vitest.
- ESLint.
- Next.js production build.
- Browser testing at desktop and mobile widths.
- Keyboard-only interaction.
- Reduced-motion emulation.
- Visual confirmation that the cover remains faintly visible under the warm glass overlay.

