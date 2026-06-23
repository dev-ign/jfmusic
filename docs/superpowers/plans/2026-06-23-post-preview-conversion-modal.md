# Post-Preview Conversion Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an accessible, cinematic conversion dialog after a natural preview finish when real playback reached at least 85%, while respecting session and 24-hour prompt suppression.

**Architecture:** `AudioPreview` reports playback state and qualifying completion through callbacks without owning page UI. `LandingIntro` coordinates cover motion, delayed waveform reset, persistence, inert state, and modal visibility. A storage utility owns the versioned prompt policy, while `PostPreviewModal` owns dialog semantics, focus behavior, placeholder actions, and entrance/exit presentation.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript, WaveSurfer 7.12, GSAP 3.15, Sass modules, Vitest, React Testing Library.

---

## File map

- Create `src/lib/postPreviewPrompt.ts`: versioned local/session storage policy with safe in-memory fallback.
- Create `src/lib/postPreviewPrompt.test.ts`: policy boundary, malformed storage, and unavailable storage tests.
- Modify `src/components/AudioPreview/AudioPreview.tsx`: report active playback and 85%-qualified natural completion; expose delayed reset.
- Modify `src/components/AudioPreview/AudioPreview.test.tsx`: exercise WaveSurfer event callbacks and reset timing.
- Modify `src/components/CoverCard/CoverCard.tsx`: receive `isPlaying` and `isSettling` visual state.
- Modify `src/components/CoverCard/CoverCard.module.scss`: rotate the artwork during playback and ease it to rest on completion.
- Modify `src/components/CoverCard/CoverCard.test.tsx`: assert visual state classes and existing flip behavior.
- Create `src/components/PostPreviewModal/PostPreviewModal.tsx`: accessible dialog, focus trap/restore, dismissal, and inert placeholder actions.
- Create `src/components/PostPreviewModal/PostPreviewModal.module.scss`: warm artwork-derived glass surface and responsive/reduced-motion styles.
- Create `src/components/PostPreviewModal/PostPreviewModal.test.tsx`: dialog semantics, focus behavior, dismissal, and placeholder action tests.
- Modify `src/components/LandingIntro/LandingIntro.tsx`: orchestrate eligibility, settling delay, modal state, reset callback, and shell accessibility fallback.
- Modify `src/components/LandingIntro/LandingIntro.module.scss`: pointer-blocked shell state and atmospheric modal layering.
- Modify `src/components/LandingIntro/LandingIntro.test.tsx`: integration tests for completion, suppression, delayed reset, and shell state.

## Task 1: Implement the prompt persistence policy

**Files:**
- Create: `src/lib/postPreviewPrompt.test.ts`
- Create: `src/lib/postPreviewPrompt.ts`

- [ ] **Step 1: Write failing tests for first-show, session suppression, cooldown, malformed data, and blocked storage**

Create tests around this public API:

```ts
export interface PromptStorage {
  local: Storage;
  session: Storage;
}

export function recordPreviewCompletion(
  storage?: PromptStorage,
  now?: number,
): void;

export function canShowPostPreviewPrompt(
  storage?: PromptStorage,
  now?: number,
): boolean;

export function markPostPreviewPromptShown(
  storage?: PromptStorage,
  now?: number,
): void;

export function recordPostPreviewDismissal(
  storage?: PromptStorage,
  now?: number,
): void;
```

Use fixed timestamps and verify:

```ts
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 5, 23, 12);

recordPreviewCompletion(storage, now);
expect(canShowPostPreviewPrompt(storage, now)).toBe(true);

markPostPreviewPromptShown(storage, now);
expect(canShowPostPreviewPrompt(storage, now + DAY_MS + 1)).toBe(false);

storage.session.clear();
expect(canShowPostPreviewPrompt(storage, now + DAY_MS - 1)).toBe(false);
expect(canShowPostPreviewPrompt(storage, now + DAY_MS + 1)).toBe(true);
```

Also assert that malformed JSON is ignored and storage methods that throw do not propagate.

- [ ] **Step 2: Run the utility tests and verify RED**

Run:

```bash
npm test -- src/lib/postPreviewPrompt.test.ts
```

Expected: FAIL because `postPreviewPrompt.ts` and its exported functions do not exist.

- [ ] **Step 3: Implement the minimal versioned storage utility**

Use these constants and state shape:

```ts
const LOCAL_KEY = 'caramelo:post-preview-prompt:v1';
const SESSION_KEY = 'caramelo:post-preview-prompt-shown:v1';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface PromptRecord {
  version: 1;
  completedAt?: number;
  shownAt?: number;
  dismissedAt?: number;
}
```

Requirements:

- Resolve browser storage lazily so server rendering never touches `window`.
- Parse only objects with `version === 1`.
- Treat the newest of `shownAt` and `dismissedAt` as the cooldown anchor.
- Require `completedAt` before permitting display.
- Set session suppression when shown.
- Catch every storage read/write error.
- Keep a module-level in-memory record and boolean fallback so blocked storage still suppresses repeated prompts during the mounted app lifetime.
- Export `resetPostPreviewPromptMemoryForTests()` only for deterministic test cleanup.

- [ ] **Step 4: Run the utility tests and verify GREEN**

Run:

```bash
npm test -- src/lib/postPreviewPrompt.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the persistence utility**

```bash
git add src/lib/postPreviewPrompt.ts src/lib/postPreviewPrompt.test.ts
git commit -m "feat: add post-preview prompt policy"
```

## Task 2: Report qualified completion from AudioPreview

**Files:**
- Modify: `src/components/AudioPreview/AudioPreview.test.tsx`
- Modify: `src/components/AudioPreview/AudioPreview.tsx`

- [ ] **Step 1: Extend the WaveSurfer mock and write failing callback tests**

Capture event handlers by name:

```ts
const handlers = new Map<string, (...args: never[]) => void>();
wavesurferMock.instance.on.mockImplementation((event, handler) => {
  handlers.set(event, handler);
  return () => handlers.delete(event);
});
wavesurferMock.instance.getDuration.mockReturnValue(100);
```

Add tests for this prop contract:

```ts
interface AudioPreviewProps {
  audioSrc: string;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onQualifiedFinish?: (reset: () => void) => void;
}
```

Verify:

- `play` reports `true`; `pause` and `finish` report `false`.
- `audioprocess(84)` followed by `finish` does not qualify for a 100-second preview.
- `audioprocess(85)` while playing followed by `finish` calls `onQualifiedFinish`.
- `audioprocess` before `play` does not count.
- `finish` does not call `seekTo(0)` immediately.
- Calling the supplied reset function calls `seekTo(0)` and clears peak progress for the next listen.

- [ ] **Step 2: Run AudioPreview tests and verify RED**

Run:

```bash
npm test -- src/components/AudioPreview/AudioPreview.test.tsx
```

Expected: FAIL because the callbacks and real-playback qualification are not implemented.

- [ ] **Step 3: Implement active-playback peak tracking**

Add refs:

```ts
const isPlayingRef = useRef(false);
const peakPlaybackProgressRef = useRef(0);
```

Implement:

```ts
const reportPlayback = (playing: boolean) => {
  isPlayingRef.current = playing;
  setIsPlaying(playing);
  onPlaybackChange?.(playing);
};

ws.on('audioprocess', (currentTime) => {
  if (!isPlayingRef.current) return;
  const duration = ws.getDuration();
  if (duration <= 0) return;

  peakPlaybackProgressRef.current = Math.max(
    peakPlaybackProgressRef.current,
    Math.min(currentTime / duration, 1),
  );
});
```

On `finish`, report stopped playback and call `onQualifiedFinish(reset)` only when the peak is at least `0.85`. The reset callback performs `ws.seekTo(0)` and resets the peak ref. If completion does not qualify, reset immediately because no modal transition needs the completed waveform.

Use callback refs or effect dependencies that avoid recreating WaveSurfer solely because a parent callback identity changed.

- [ ] **Step 4: Run AudioPreview tests and verify GREEN**

Run:

```bash
npm test -- src/components/AudioPreview/AudioPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit playback reporting**

```bash
git add src/components/AudioPreview/AudioPreview.tsx src/components/AudioPreview/AudioPreview.test.tsx
git commit -m "feat: report qualified preview completion"
```

## Task 3: Add cover playback and settling states

**Files:**
- Modify: `src/components/CoverCard/CoverCard.test.tsx`
- Modify: `src/components/CoverCard/CoverCard.tsx`
- Modify: `src/components/CoverCard/CoverCard.module.scss`

- [ ] **Step 1: Write failing class-state tests**

Render:

```tsx
<CoverCard coverSrc="/cover.png" isPlaying />
<CoverCard coverSrc="/cover.png" isSettling />
```

Assert the root receives stable state hooks:

```ts
expect(root).toHaveAttribute('data-playback-state', 'playing');
expect(root).toHaveAttribute('data-playback-state', 'settling');
```

Retain the existing credits-flip test.

- [ ] **Step 2: Run CoverCard tests and verify RED**

Run:

```bash
npm test -- src/components/CoverCard/CoverCard.test.tsx
```

Expected: FAIL because the visual state props and attribute do not exist.

- [ ] **Step 3: Add visual state props and CSS animation**

Use:

```ts
interface CoverCardProps {
  coverSrc: string;
  isPlaying?: boolean;
  isSettling?: boolean;
}

const playbackState = isSettling
  ? 'settling'
  : isPlaying
    ? 'playing'
    : 'idle';
```

Apply `data-playback-state={playbackState}` to the root.

In the Sass module:

- Animate `.cover-card__image` with a slow `rotate(360deg)` only for `playing`.
- Use a long cubic-bezier transition and a subtle scale/rotation finish for `settling`.
- Keep the square cover mask and flip mechanics intact.
- Disable rotation and transform choreography under `prefers-reduced-motion: reduce`.

The motion should be restrained because the artwork is square rather than a literal vinyl disc.

- [ ] **Step 4: Run CoverCard tests and verify GREEN**

Run:

```bash
npm test -- src/components/CoverCard/CoverCard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the cover motion state**

```bash
git add src/components/CoverCard/CoverCard.tsx src/components/CoverCard/CoverCard.module.scss src/components/CoverCard/CoverCard.test.tsx
git commit -m "feat: add preview cover motion states"
```

## Task 4: Build the accessible conversion modal

**Files:**
- Create: `src/components/PostPreviewModal/PostPreviewModal.test.tsx`
- Create: `src/components/PostPreviewModal/PostPreviewModal.tsx`
- Create: `src/components/PostPreviewModal/PostPreviewModal.module.scss`

- [ ] **Step 1: Write failing dialog semantics and placeholder action tests**

Render the modal with `isOpen`, `onRequestClose`, and `onExited`.

Assert:

```ts
expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
expect(screen.getByRole('heading', { name: 'Thanks for listening.' }))
  .toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Listen Full Song' })).toHaveFocus();
```

Click each `href="#"` action with a cancelable event and verify:

- `defaultPrevented` is true.
- `onRequestClose` is not called.
- The modal remains rendered.

- [ ] **Step 2: Write failing focus and dismissal tests**

Verify:

- Escape calls `onRequestClose`.
- Clicking the backdrop calls `onRequestClose`.
- Clicking the dialog surface does not close.
- Tab from the final action wraps to the primary action.
- Shift+Tab from the primary action wraps to the final action.
- Focus returns to the element active before opening after `onExited`.

- [ ] **Step 3: Run modal tests and verify RED**

Run:

```bash
npm test -- src/components/PostPreviewModal/PostPreviewModal.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement dialog behavior**

Use a mounted/exiting state so CSS exit motion can finish:

```ts
interface PostPreviewModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  onExited?: () => void;
}
```

Implementation requirements:

- Render via `createPortal(..., document.body)` after mount.
- Store the previously focused element when opening.
- Focus the primary action in an effect.
- Query focusable anchors/buttons inside the dialog for the Tab trap.
- Listen for Escape only while mounted.
- Use `event.target === event.currentTarget` for backdrop dismissal.
- Prevent default on all placeholder actions and keep the modal open.
- In development only, `console.info('[post-preview-action]', actionName)`.
- Use `transitionend` plus a short timeout fallback to call `onExited` after closing.
- Restore prior focus in the exit completion path.

- [ ] **Step 5: Implement the glassmorphism visual system**

Use CSS custom properties derived from the cover palette:

```scss
--modal-cream: 249 236 211;
--modal-caramel: 132 58 9;
--modal-amber: 201 120 50;
--modal-gold: 228 164 94;
```

Style:

- Fixed viewport overlay above the intro.
- Multiple diffuse radial gradients plus a dark translucent veil.
- `backdrop-filter: blur(18px) saturate(0.9)`.
- Warm semi-transparent dialog with a low-opacity white border.
- `border-radius: clamp(24px, 4vw, 36px)`.
- Primary dark pill and secondary translucent pills.
- 44px minimum targets, visible focus rings, responsive stacking.
- Entrance from `opacity: 0`, `translateY(16px)`, `scale(0.965)` to rest.
- Exit opacity/translate reversal.
- Reduced-motion block that removes transform and shortens transitions.

- [ ] **Step 6: Run modal tests and verify GREEN**

Run:

```bash
npm test -- src/components/PostPreviewModal/PostPreviewModal.test.tsx
```

Expected: PASS with no React act warnings.

- [ ] **Step 7: Commit the modal**

```bash
git add src/components/PostPreviewModal
git commit -m "feat: add accessible post-preview modal"
```

## Task 5: Orchestrate completion in LandingIntro

**Files:**
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] **Step 1: Write failing integration tests with mocked child contracts**

Mock `AudioPreview` to expose buttons that invoke:

```ts
onPlaybackChange?.(true);
onQualifiedFinish?.(resetMock);
```

Mock the prompt utility and modal to keep tests focused on orchestration.

Verify:

- Playback state reaches `CoverCard`.
- Eligible completion records completion, marks shown, and opens the modal.
- Ineligible persistence leaves the modal closed and resets the waveform immediately.
- Eligible completion does not reset the waveform until the modal has opened after the settling delay.
- Closing records dismissal.
- The shell has `inert`, `aria-hidden="true"`, and the blocked CSS class while the modal is open.
- The shell returns to its post-intro accessibility state after modal exit.
- A second qualifying completion in the same mounted session does not reopen.

- [ ] **Step 2: Run LandingIntro tests and verify RED**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: FAIL because completion orchestration and modal rendering are absent.

- [ ] **Step 3: Add page-level state and completion handlers**

Add:

```ts
const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
const [isCoverSettling, setIsCoverSettling] = useState(false);
const [isModalOpen, setIsModalOpen] = useState(false);
const [isModalMounted, setIsModalMounted] = useState(false);
const promptShownInMemoryRef = useRef(false);
const pendingResetRef = useRef<(() => void) | null>(null);
```

Use a completion delay constant near `450ms` for standard motion and `0ms` for reduced motion.

The qualifying finish handler must:

1. Record completion.
2. If already shown in the mounted page or persistence denies display, call reset immediately.
3. Mark prompt shown before scheduling UI.
4. Store the reset callback.
5. Set cover settling.
6. After the delay, mount/open the modal and call the pending reset.

The close handler records dismissal and sets `isModalOpen` false. The modal exit callback clears mounted/settling state.

Clear pending timers on unmount.

- [ ] **Step 4: Preserve intro inert state while adding modal inert fallback**

Do not replace the current intro logic with a single React boolean because the GSAP intro independently owns its interaction lifecycle.

Add a helper that applies modal blocking only after render:

```ts
useEffect(() => {
  const shell = shellRef.current;
  if (!shell) return;

  if (isModalMounted) {
    shell.inert = true;
    shell.setAttribute('inert', '');
    shell.setAttribute('aria-hidden', 'true');
  } else {
    shell.removeAttribute('aria-hidden');
    if (introHasCompletedRef.current) {
      shell.inert = false;
      shell.removeAttribute('inert');
    }
  }
}, [isModalMounted]);
```

Update the existing intro completion paths to set `introHasCompletedRef.current = true`. Apply a module class while modal-mounted to force `pointer-events: none` as the fallback.

- [ ] **Step 5: Render the coordinated children**

Pass:

```tsx
<CoverCard
  coverSrc={MEDIA_ENDPOINTS.cover}
  isPlaying={isPreviewPlaying}
  isSettling={isCoverSettling}
/>

<AudioPreview
  audioSrc={MEDIA_ENDPOINTS.preview}
  onPlaybackChange={setIsPreviewPlaying}
  onQualifiedFinish={handleQualifiedFinish}
/>

<PostPreviewModal
  isOpen={isModalOpen}
  onRequestClose={handleModalClose}
  onExited={handleModalExited}
/>
```

Keep the modal outside the landing shell so shell inertness cannot disable the dialog.

- [ ] **Step 6: Run LandingIntro tests and verify GREEN**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: PASS, including all existing intro animation tests.

- [ ] **Step 7: Commit orchestration**

```bash
git add src/components/LandingIntro/LandingIntro.tsx src/components/LandingIntro/LandingIntro.module.scss src/components/LandingIntro/LandingIntro.test.tsx
git commit -m "feat: orchestrate post-preview conversion moment"
```

## Task 6: Full verification and visual QA

**Files:**
- Modify only files required by failures discovered during verification.

- [ ] **Step 1: Run the complete unit suite**

Run:

```bash
npm test
```

Expected: all tests pass with no unhandled errors or act warnings.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: Next.js 16 production build completes successfully.

- [ ] **Step 4: Start the app and perform browser QA**

Run:

```bash
npm run dev
```

Verify in the in-app browser:

- Desktop and mobile widths.
- Preview reaches a visually complete waveform before reset.
- Modal does not appear before natural finish.
- Warm gradient backdrop preserves a faint view of the artwork.
- Focus starts on Listen Full Song.
- Tab/Shift+Tab remain inside the modal.
- Escape and backdrop dismiss.
- Placeholder actions do not navigate or dismiss.
- Replaying during the same session does not reopen.
- Reduced-motion emulation removes rotation/spring behavior.

- [ ] **Step 5: Re-run automated verification after any QA fixes**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected: all commands succeed.

- [ ] **Step 6: Commit verification fixes, if any**

```bash
git add src
git commit -m "fix: polish post-preview modal experience"
```

