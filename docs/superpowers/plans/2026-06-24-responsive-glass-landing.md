# Responsive Glass Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Caramelo composition fit within the dynamic viewport without document scrolling, while adding premium glass navigation, follow controls, a fixed player app bar, and real social and streaming links.

**Architecture:** Preserve `LandingIntro` as the page-level interaction coordinator and preserve the current absolute stage composition as the visual source of truth. Add small module-level link data, local menu state, semantic state attributes, and responsive CSS custom properties; adapt individual element dimensions and positions rather than scaling or restacking the whole stage. Keep the existing disc requestAnimationFrame loop unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Sass CSS Modules, GSAP, WaveSurfer, Vitest, Testing Library

---

## Baseline and Guardrails

The working tree already contains an uncommitted stage redesign. Treat those files as the baseline and preserve all unrelated edits.

The focused test command currently reports four failures:

```text
LandingIntro > passes preview playback state through to the cover
LandingIntro > reserves an eligible finish, then marks and resets only after the modal commits open
LandingIntro > mounts the final release semantics behind an inert decorative intro
LandingIntro > provides a bounded internally scrollable viewport
```

The first two failures are stale expectations for removed `CoverCard` playback props. The third reflects the redesigned title being a `div` instead of a heading. The fourth expects the old scrollable-page contract. Fix these expectations to match the approved design; do not restore the removed cover playback API.

Do not change the disc loop in `LandingIntro.tsx`, especially:

```ts
const target = playing ? 42 : 4;
discSpeedRef.current += (target - discSpeedRef.current) * Math.min(1, dt * 1.05);
discAngleRef.current += discSpeedRef.current * dt;
```

## File Structure

- Modify `src/components/LandingIntro/LandingIntro.tsx`: link constants, menu state and dismissal, semantic segmented navigation, follow-state hook, real links, and platform menu.
- Modify `src/components/LandingIntro/LandingIntro.module.scss`: responsive stage variables, glass materials, fixed player, segmented navigation, social reveal, menu, and reduced-motion rules.
- Modify `src/components/LandingIntro/LandingIntro.test.tsx`: reconcile stale baseline tests and add interaction/link/style-contract coverage.
- Modify `src/components/AudioPreview/AudioPreview.module.scss`: allow the waveform region to flex within the fixed player without shrinking the play target.
- Modify `src/components/CoverCard/CoverCard.module.scss`: bind the cover dimensions to the stage's responsive `--cover-size` variable while retaining its scale relationship and square geometry.
- Modify `src/app/globals.scss`: lock the document to the viewport and prevent body scrolling.

## Task 1: Reconcile Tests With the Current Stage Architecture

**Files:**

- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`

- [ ] **Step 1: Replace stale `CoverCard` mock props**

Change the mock to represent the current controlled flip API:

```tsx
vi.mock('@/components/CoverCard/CoverCard', () => ({
  default: ({ isFlipped }: { isFlipped?: boolean }) => (
    <div
      data-testid="cover-card"
      data-flipped={String(Boolean(isFlipped))}
    >
      <span
        role="img"
        aria-label="Caramelo single cover art by Jona Ferreira"
      />
    </div>
  ),
}));
```

- [ ] **Step 2: Replace the stale playback-prop test with mode-control tests**

Remove `passes preview playback state through to the cover`. Add:

```tsx
it('controls the cover face from the segmented page mode', () => {
  render(<LandingIntro />);

  expect(screen.getByTestId('cover-card')).toHaveAttribute(
    'data-flipped',
    'false',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Credits' }));
  expect(screen.getByTestId('cover-card')).toHaveAttribute(
    'data-flipped',
    'true',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Back to cover' }));
  expect(screen.getByTestId('cover-card')).toHaveAttribute(
    'data-flipped',
    'false',
  );
});
```

- [ ] **Step 3: Remove the stale settling assertion**

In `reserves an eligible finish, then marks and resets only after the modal commits open`, delete only:

```tsx
expect(screen.getByTestId('cover-card')).toHaveAttribute(
  'data-settling',
  'true',
);
```

Keep every timer, modal, persistence, and reset assertion intact.

- [ ] **Step 4: Update the viewport contract test before implementation**

Replace `provides a bounded internally scrollable viewport` with:

```tsx
it('uses dynamic viewport fallbacks and reserves scrolling for lyrics', () => {
  const css = readFileSync(
    'src/components/LandingIntro/LandingIntro.module.scss',
    'utf8',
  );
  const pageRule = css.match(/\.page\s*\{([^}]*)\}/)?.[1];
  const lyricsScrollRule = css.match(/\.lyrics__scroll\s*\{([^}]*)\}/)?.[1];

  expect(pageRule).toMatch(/height:\s*100vh/);
  expect(pageRule).toMatch(/height:\s*100svh/);
  expect(pageRule).toMatch(/height:\s*100dvh/);
  expect(pageRule).toMatch(/overflow:\s*hidden/);
  expect(lyricsScrollRule).toMatch(/overflow-y:\s*auto/);
  expect(css).not.toMatch(/\.shell\s*\{[^}]*transform:\s*scale\(/s);
});
```

- [ ] **Step 5: Run the focused test and verify the intended RED state**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: failures remain for the missing viewport stack and the missing `Caramelo` level-two heading; stale playback and settling failures are gone.

- [ ] **Step 6: Restore the track-title heading semantics**

In `LandingIntro.tsx`, replace:

```tsx
<div className={styles['track-meta__title']}>Caramelo</div>
```

with:

```tsx
<h2 className={styles['track-meta__title']}>Caramelo</h2>
```

- [ ] **Step 7: Commit the baseline test reconciliation**

```bash
git add src/components/LandingIntro/LandingIntro.test.tsx src/components/LandingIntro/LandingIntro.tsx
git commit -m "test: align landing coverage with current stage"
```

## Task 2: Add Real Social and Streaming Destinations

**Files:**

- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`

- [ ] **Step 1: Write link and menu interaction tests**

Add constants near the tests:

```ts
const SPOTIFY_URL =
  'https://open.spotify.com/track/2sDSnFmxyLvWgXQZm5Mdt2?si=6c58b7c468d24c4d';

const SOCIAL_URLS = {
  Instagram: 'https://www.instagram.com/jonaferreira',
  TikTok: 'https://www.tiktok.com/@jonafmusic',
  YouTube: 'https://www.youtube.com/channel/UCWa1kPIczNX6qKZ8hMbNdsg',
};

const PLATFORM_URLS = {
  'Apple Music':
    'https://music.apple.com/us/album/caramelo/6773485931?i=6773485933',
  Spotify: SPOTIFY_URL,
  YouTube:
    'https://www.youtube.com/watch?v=sb6EryPbY_A&list=OLAK5uy_lsz4B2564DZiRfBbBdES-dz5YEkTmlTn0',
  'Amazon Music':
    'https://amazon.com/music/player/albums/B0H31RQSRH?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_fE6GMFJbRU5FpVcsEpHhibWDN',
  Tidal: 'https://tidal.com/track/528205807/u',
};
```

Add:

```tsx
it('renders only the approved social destinations', () => {
  render(<LandingIntro />);

  fireEvent.click(
    screen.getByRole('button', { name: 'Follow Jona Ferreira' }),
  );

  for (const [label, href] of Object.entries(SOCIAL_URLS)) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href,
    );
  }

  expect(screen.queryByRole('link', { name: 'X / Twitter' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Spotify' })).not.toBeInTheDocument();
});

it('uses Spotify for the primary and heart links', () => {
  render(<LandingIntro />);

  expect(
    screen.getByRole('link', { name: 'Stream Caramelo on Spotify' }),
  ).toHaveAttribute('href', SPOTIFY_URL);
  expect(
    screen.getByRole('link', { name: 'Open Caramelo on Spotify' }),
  ).toHaveAttribute('href', SPOTIFY_URL);
});

it('opens the platform menu and renders all streaming destinations', () => {
  render(<LandingIntro />);
  const trigger = screen.getByRole('button', {
    name: 'More streaming platforms',
  });

  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  for (const [label, href] of Object.entries(PLATFORM_URLS)) {
    expect(screen.getByRole('menuitem', { name: label })).toHaveAttribute(
      'href',
      href,
    );
  }
});

it('closes the platform menu after selection, outside click, and Escape', () => {
  render(<LandingIntro />);
  const trigger = screen.getByRole('button', {
    name: 'More streaming platforms',
  });

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Tidal' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: failures for the current `#` URLs, extra social links, the heart still being a button, and the missing platform menu.

- [ ] **Step 3: Add typed link constants**

After `type PageMode`, add:

```ts
const SPOTIFY_URL =
  'https://open.spotify.com/track/2sDSnFmxyLvWgXQZm5Mdt2?si=6c58b7c468d24c4d';

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/jonaferreira',
    icon: 'instagram',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@jonafmusic',
    icon: 'tiktok',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCWa1kPIczNX6qKZ8hMbNdsg',
    icon: 'youtube',
  },
] as const;

const STREAMING_LINKS = [
  {
    label: 'Apple Music',
    href: 'https://music.apple.com/us/album/caramelo/6773485931?i=6773485933',
  },
  { label: 'Spotify', href: SPOTIFY_URL },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/watch?v=sb6EryPbY_A&list=OLAK5uy_lsz4B2564DZiRfBbBdES-dz5YEkTmlTn0',
  },
  {
    label: 'Amazon Music',
    href: 'https://amazon.com/music/player/albums/B0H31RQSRH?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_fE6GMFJbRU5FpVcsEpHhibWDN',
  },
  { label: 'Tidal', href: 'https://tidal.com/track/528205807/u' },
] as const;
```

- [ ] **Step 4: Add menu state, ref, and dismissal effect**

Inside `LandingIntro`, add:

```ts
const streamMenuRef = useRef<HTMLDivElement>(null);
const [isStreamMenuOpen, setIsStreamMenuOpen] = useState(false);
```

Add this effect after the playback-state synchronization effect:

```ts
useEffect(() => {
  if (!isStreamMenuOpen) return;

  const closeOnOutsidePointer = (event: MouseEvent) => {
    if (
      streamMenuRef.current &&
      !streamMenuRef.current.contains(event.target as Node)
    ) {
      setIsStreamMenuOpen(false);
    }
  };

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setIsStreamMenuOpen(false);
  };

  document.addEventListener('mousedown', closeOnOutsidePointer);
  document.addEventListener('keydown', closeOnEscape);

  return () => {
    document.removeEventListener('mousedown', closeOnOutsidePointer);
    document.removeEventListener('keydown', closeOnEscape);
  };
}, [isStreamMenuOpen]);
```

- [ ] **Step 5: Render only the approved social links**

Replace the five hardcoded social anchors with three anchors generated from `SOCIAL_LINKS`. Keep the existing inline SVG paths, selecting them by `link.icon`, and apply these shared attributes:

```tsx
{SOCIAL_LINKS.map((link) => (
  <a
    key={link.label}
    href={link.href}
    aria-label={link.label}
    className={styles['social-btn']}
    target="_blank"
    rel="noopener noreferrer"
  >
    {link.icon === 'instagram' ? <InstagramIcon /> : null}
    {link.icon === 'tiktok' ? <TikTokIcon /> : null}
    {link.icon === 'youtube' ? <YouTubeIcon /> : null}
  </a>
))}
```

Extract the three existing SVGs into file-local `InstagramIcon`, `TikTokIcon`, and `YouTubeIcon` functions above the component. Do not add an icon package.

- [ ] **Step 6: Wire Spotify controls and the platform menu**

Change the primary link to:

```tsx
<a
  href={SPOTIFY_URL}
  className={styles['btn-stream']}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Stream Caramelo on Spotify"
>
```

Replace the heart button with:

```tsx
<a
  href={SPOTIFY_URL}
  className={styles['btn-icon']}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Open Caramelo on Spotify"
>
  {/* existing heart SVG */}
</a>
```

Wrap the menu trigger in:

```tsx
<div ref={streamMenuRef} className={styles['stream-menu-wrap']}>
  <button
    type="button"
    className={styles['btn-icon']}
    aria-label="More streaming platforms"
    aria-haspopup="menu"
    aria-expanded={isStreamMenuOpen}
    onClick={() => setIsStreamMenuOpen((open) => !open)}
  >
    {/* existing ellipsis SVG */}
  </button>

  {isStreamMenuOpen ? (
    <div className={styles['stream-menu']} role="menu">
      {STREAMING_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className={styles['stream-menu__item']}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          onClick={() => setIsStreamMenuOpen(false)}
        >
          {link.label}
        </a>
      ))}
    </div>
  ) : null}
</div>
```

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: all link and menu tests pass; viewport styling test remains red until Task 4.

Commit:

```bash
git add src/components/LandingIntro/LandingIntro.tsx src/components/LandingIntro/LandingIntro.test.tsx
git commit -m "feat: connect social and streaming destinations"
```

## Task 3: Build the Segmented Navigation Island and Follow Transition

**Files:**

- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.tsx`
- Modify: `src/components/LandingIntro/LandingIntro.module.scss`

- [ ] **Step 1: Write semantic state tests**

Add:

```tsx
it('exposes the selected segment and follow-open state', () => {
  const { container } = render(<LandingIntro />);
  const home = screen.getByRole('button', { name: 'Back to cover' });
  const credits = screen.getByRole('button', { name: 'Credits' });
  const lyrics = screen.getByRole('button', { name: 'Lyrics' });
  const artistSlot = container.querySelector('[data-following]');

  expect(home).toHaveAttribute('aria-pressed', 'true');
  expect(credits).toHaveAttribute('aria-pressed', 'false');
  expect(lyrics).toHaveAttribute('aria-pressed', 'false');
  expect(artistSlot).toHaveAttribute('data-following', 'false');

  fireEvent.click(credits);
  expect(home).toHaveAttribute('aria-pressed', 'false');
  expect(credits).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(
    screen.getByRole('button', { name: 'Follow Jona Ferreira' }),
  );
  expect(artistSlot).toHaveAttribute('data-following', 'true');
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: missing `aria-pressed` and `data-following`.

- [ ] **Step 3: Add state hooks to the rendered structure**

Change the artist slot to:

```tsx
<div
  ref={artistFollowRef}
  className={`${styles['artist-slot']} ${
    following ? styles['artist-slot--following'] : ''
  }`}
  data-following={following}
>
```

Change the control wrapper to:

```tsx
<nav
  ref={actionsRef}
  className={styles['control-row']}
  aria-label="Release views"
>
```

Add to each mode button:

```tsx
aria-pressed={mode === 'cover'}
```

```tsx
aria-pressed={mode === 'credits'}
```

```tsx
aria-pressed={mode === 'lyrics'}
```

- [ ] **Step 4: Convert the control row into one glass island**

Replace the individual pill styling with:

```scss
.control-row {
  position: absolute;
  left: 50%;
  top: var(--nav-top);
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  min-height: 48px;
  padding: 4px;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 999px;
  background: rgba(255, 248, 233, 0.52);
  box-shadow:
    0 16px 34px -18px rgba(56, 29, 7, 0.62),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px) saturate(1.45);
  -webkit-backdrop-filter: blur(22px) saturate(1.45);
}

.actbtn {
  display: inline-flex;
  min-width: 104px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(33, 33, 33, 0.72);
  font: 600 13px/1 var(--font-sans);
  cursor: pointer;
  transition:
    color 240ms ease,
    background 320ms cubic-bezier(0.2, 0.72, 0.18, 1),
    box-shadow 320ms ease,
    transform 180ms ease;

  &:hover {
    color: #212121;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(83, 42, 12, 0.7);
    outline-offset: 2px;
  }
}

.actbtn--active {
  color: #f5e8d3;
  background: rgba(28, 27, 25, 0.94);
  box-shadow:
    0 8px 18px -10px rgba(25, 15, 7, 0.85),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
```

- [ ] **Step 5: Add the artist-name compression and premium social buttons**

Add:

```scss
.name-btn {
  transform-origin: center top;
  transition:
    transform 520ms cubic-bezier(0.2, 0.72, 0.18, 1),
    filter 350ms ease;
}

.artist-slot--following .name-btn {
  transform: scale(0.88) translateY(-3px);
}

.follow-socials {
  margin-top: -4px;
  padding: 5px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 999px;
  background: rgba(30, 28, 25, 0.72);
  box-shadow:
    0 16px 28px -16px rgba(43, 21, 4, 0.68),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(18px) saturate(1.35);
  -webkit-backdrop-filter: blur(18px) saturate(1.35);
}

.social-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);

  &:focus-visible {
    outline: 2px solid rgba(255, 240, 211, 0.92);
    outline-offset: 2px;
  }
}
```

Retain the existing opacity and translate reveal. Ensure the visible social container sits above the cover by keeping `.artist-slot` above `.coverstage`.

- [ ] **Step 6: Extend reduced-motion coverage**

Add the new selectors:

```scss
@media (prefers-reduced-motion: reduce) {
  .name-btn,
  .follow-socials,
  .social-btn,
  .actbtn,
  .stream-menu {
    transition: none;
  }
}
```

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
git add src/components/LandingIntro/LandingIntro.tsx src/components/LandingIntro/LandingIntro.module.scss src/components/LandingIntro/LandingIntro.test.tsx
git commit -m "feat: add segmented glass release controls"
```

Expected: semantic state tests pass.

## Task 4: Fit the Existing Composition Into the Dynamic Viewport

**Files:**

- Modify: `src/components/LandingIntro/LandingIntro.module.scss`
- Modify: `src/components/CoverCard/CoverCard.module.scss`
- Modify: `src/app/globals.scss`
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`

- [ ] **Step 1: Add a style-contract test for stage preservation**

Add:

```tsx
it('preserves the composed stage without whole-stage scaling', () => {
  const css = readFileSync(
    'src/components/LandingIntro/LandingIntro.module.scss',
    'utf8',
  );

  expect(css).toMatch(/--player-reserve:/);
  expect(css).toMatch(/--cover-size:/);
  expect(css).toMatch(/--nav-top:/);
  expect(css).toMatch(/height:\s*calc\(100%\s*-\s*var\(--player-reserve\)\)/);
  expect(css).not.toMatch(/\.shell\s*\{[^}]*transform:\s*scale\(/s);
});
```

- [ ] **Step 2: Run the style tests and verify RED**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: viewport and stage-variable assertions fail.

- [ ] **Step 3: Lock the document to the viewport**

In `globals.scss`, replace the `html, body` and body overflow rules with:

```scss
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background: radial-gradient(
    125% 95% at 50% 14%,
    #fdf4e0 0%,
    #f8e9c8 34%,
    #efd29a 62%,
    #e2ac61 100%
  );
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 4: Define the responsive stage contract**

Replace the `.page` and `.shell` opening rules with:

```scss
.page {
  --page-gutter: clamp(10px, 2.4vw, 24px);
  --player-height: clamp(66px, 8.5vh, 82px);
  --player-bottom: max(10px, env(safe-area-inset-bottom));
  --player-reserve: calc(
    var(--player-height) + var(--player-bottom) + clamp(12px, 2vh, 24px)
  );
  --stage-height: calc(100% - var(--player-reserve));
  --cover-size: clamp(238px, min(76vw, 34vh), 298px);
  --artist-top: clamp(10px, 3.25%, 32px);
  --cover-top: clamp(190px, 28%, 271px);
  --meta-top: clamp(382px, 48%, 466px);
  --lyrics-top: clamp(184px, 30%, 300px);
  --nav-top: clamp(476px, 58%, 566px);
  --disc-top: clamp(532px, 67%, 654px);
  --disc-size: clamp(390px, min(94vw, 58vh), 520px);
  --ground-top: clamp(620px, 79%, 771px);

  width: 100%;
  height: 100vh;
  height: 100svh;
  height: 100dvh;
  display: grid;
  place-items: start center;
  padding-inline: var(--page-gutter);
  overflow: hidden;
}

@supports (height: 100dvh) {
  .page {
    --player-height: clamp(66px, 8.5dvh, 82px);
    --player-reserve: calc(
      var(--player-height) + var(--player-bottom) + clamp(12px, 2dvh, 24px)
    );
    --cover-size: clamp(238px, min(76vw, 34dvh), 298px);
    --disc-size: clamp(390px, min(94vw, 58dvh), 520px);
  }
}

.shell {
  position: relative;
  width: min(760px, calc(100vw - (2 * var(--page-gutter))));
  height: calc(100% - var(--player-reserve));
  min-height: 0;
  flex: none;
}
```

These variables preserve the 760-by-980 composition ratios while allowing decorative dimensions and spacing to compress. Do not add `transform: scale()` to `.shell`.

- [ ] **Step 5: Bind stage elements to the responsive variables**

Update only dimensional/positional properties:

```scss
.artist-slot {
  top: var(--artist-top);
}

.cover-float-wrap {
  top: var(--cover-top);
}

.track-meta-outer {
  top: var(--meta-top);
}

.control-row {
  top: var(--nav-top);
}

.disc-wrap,
.disc-tilt {
  width: var(--disc-size);
  height: var(--disc-size);
}

.disc-wrap {
  top: var(--disc-top);
}

.ground-shadow {
  top: var(--ground-top);
  width: min(520px, 86vw);
}

.disc-glow {
  top: clamp(410px, 54%, 506px);
  width: min(760px, 110vw);
  height: clamp(320px, 50vh, 480px);
}
```

Retain the existing z-indexes, transforms, gradients, bevels, intro reveal refs, and stage relationships.

- [ ] **Step 6: Make the cover inherit the responsive focal size**

In `CoverCard.module.scss`, change:

```scss
.cover-card {
  width: 298px;
  height: 298px;
}
```

to:

```scss
.cover-card {
  width: var(--cover-size, 298px);
  height: var(--cover-size, 298px);
}
```

Do not change the cover's aspect ratio, radius, flip behavior, or visual treatment.

- [ ] **Step 7: Bound the lyrics panel to the stage**

Use:

```scss
.lyrics {
  top: var(--lyrics-top);
  width: min(412px, calc(100vw - (2 * var(--page-gutter))));
  height: min(376px, calc(var(--nav-top) - var(--lyrics-top) - 18px));
  max-height: calc(var(--nav-top) - var(--lyrics-top) - 18px);
}

.lyrics__scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

This keeps the panel above the segmented navigation and leaves its body as the only scrollable page region.

- [ ] **Step 8: Add short-height and landscape compression**

Add:

```scss
@media (max-height: 720px) {
  .page {
    --cover-size: clamp(202px, min(62vw, 32dvh), 252px);
    --cover-top: clamp(152px, 25%, 196px);
    --meta-top: clamp(300px, 47%, 360px);
    --lyrics-top: clamp(126px, 24%, 170px);
    --nav-top: clamp(382px, 60%, 450px);
    --disc-top: clamp(420px, 70%, 510px);
    --disc-size: clamp(320px, min(76vw, 53dvh), 430px);
    --ground-top: clamp(490px, 82%, 580px);
  }

  .track-meta__title {
    font-size: clamp(24px, 4dvh, 30px);
  }

  .track-meta__sub {
    margin-top: 7px;
  }
}

@media (max-height: 520px) and (orientation: landscape) {
  .page {
    --player-height: 62px;
    --cover-size: clamp(176px, 42dvh, 218px);
    --artist-top: 4px;
    --cover-top: clamp(116px, 33%, 150px);
    --meta-top: clamp(218px, 59%, 270px);
    --lyrics-top: clamp(76px, 22%, 108px);
    --nav-top: clamp(286px, 78%, 334px);
    --disc-top: clamp(300px, 82%, 360px);
    --disc-size: clamp(250px, 68dvh, 340px);
    --ground-top: clamp(340px, 92%, 390px);
  }

  .follow-socials {
    position: absolute;
    top: 54px;
  }
}
```

These are compression rules for the same composition, not a stacked alternate layout.

- [ ] **Step 9: Run focused tests and commit**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
git add src/app/globals.scss src/components/CoverCard/CoverCard.module.scss src/components/LandingIntro/LandingIntro.module.scss src/components/LandingIntro/LandingIntro.test.tsx
git commit -m "feat: fit landing composition to dynamic viewport"
```

Expected: viewport and stage-preservation tests pass.

## Task 5: Build the Fixed Glass Player App Bar

**Files:**

- Modify: `src/components/LandingIntro/LandingIntro.module.scss`
- Modify: `src/components/AudioPreview/AudioPreview.module.scss`
- Modify: `src/components/LandingIntro/LandingIntro.test.tsx`

- [ ] **Step 1: Add player and menu style-contract tests**

Add:

```tsx
it('defines a safe-area-aware fixed player and glass platform menu', () => {
  const css = readFileSync(
    'src/components/LandingIntro/LandingIntro.module.scss',
    'utf8',
  );
  const playerRule = css.match(/\.player-row\s*\{([^}]*)\}/)?.[1];

  expect(playerRule).toMatch(/position:\s*fixed/);
  expect(playerRule).toMatch(/var\(--player-bottom\)/);
  expect(playerRule).toMatch(/backdrop-filter:\s*blur/);
  expect(css).toMatch(/\.stream-menu\s*\{/);
  expect(css).toMatch(/\.stream-menu__item\s*\{/);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
```

Expected: player remains absolutely positioned and menu styles are absent.

- [ ] **Step 3: Style the player as one fixed glass bar**

Replace `.player-row` with:

```scss
.player-row {
  position: fixed;
  left: 50%;
  bottom: var(--player-bottom);
  z-index: 40;
  display: flex;
  width: min(820px, calc(100vw - (2 * var(--page-gutter))));
  min-height: var(--player-height);
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.8vw, 16px);
  padding: 10px clamp(10px, 2vw, 18px);
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.64);
  border-radius: clamp(24px, 4vw, 34px);
  background: rgba(255, 248, 235, 0.58);
  box-shadow:
    0 24px 54px -24px rgba(55, 28, 6, 0.68),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(26px) saturate(1.5);
  -webkit-backdrop-filter: blur(26px) saturate(1.5);
}
```

Keep all controls inside this one surface.

- [ ] **Step 4: Make the audio preview consume flexible width**

In `AudioPreview.module.scss`, use:

```scss
.audio-preview {
  display: flex;
  min-width: 0;
  flex: 1 1 360px;
  align-items: center;
  gap: clamp(8px, 1.6vw, 16px);
}

.audio-preview__waveform-area {
  width: auto;
  min-width: 92px;
  height: 46px;
  flex: 1 1 240px;
}
```

Keep `.audio-preview__play-btn` at 46 by 46 pixels.

- [ ] **Step 5: Normalize player controls and menu positioning**

Add:

```scss
.btn-stream,
.btn-icon {
  min-height: 46px;
  flex: none;
}

.btn-icon {
  text-decoration: none;
  color: #212121;

  &:focus-visible {
    outline: 2px solid rgba(73, 36, 10, 0.76);
    outline-offset: 3px;
  }
}

.stream-menu-wrap {
  position: relative;
  flex: none;
}

.stream-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  display: grid;
  min-width: 190px;
  padding: 7px;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 20px;
  background: rgba(32, 29, 25, 0.88);
  box-shadow: 0 22px 46px -18px rgba(43, 21, 4, 0.72);
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
  transform-origin: right bottom;
}

.stream-menu__item {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 14px;
  color: #f5ead8;
  font: 600 14px/1 var(--font-sans);
  text-decoration: none;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 239, 211, 0.9);
    outline-offset: -2px;
  }
}
```

- [ ] **Step 6: Add narrow-width compaction without shrinking touch targets**

Add:

```scss
@media (max-width: 640px) {
  .player-row {
    gap: 8px;
    padding-inline: 9px;
  }

  .btn-stream {
    width: 46px;
    padding: 0;
    justify-content: center;
    font-size: 0;
  }

  .control-row {
    width: min(344px, calc(100vw - (2 * var(--page-gutter))));
  }

  .actbtn {
    min-width: 0;
    padding-inline: 10px;
  }
}

@media (max-width: 430px) {
  .audio-preview__waveform-area {
    min-width: 72px;
  }

  .btn-icon,
  .audio-preview__play-btn {
    width: 44px;
    height: 44px;
  }
}
```

Do not hide the play control, waveform, Spotify control, heart, or platform trigger.

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- src/components/LandingIntro/LandingIntro.test.tsx
git add src/components/LandingIntro/LandingIntro.module.scss src/components/AudioPreview/AudioPreview.module.scss src/components/LandingIntro/LandingIntro.test.tsx
git commit -m "feat: add fixed glass player app bar"
```

Expected: focused tests pass.

## Task 6: Verify Behavior, Accessibility, and Responsive Preservation

**Files:**

- Modify only files required by failures found during verification.

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
```

Expected: all tests pass. If unrelated pre-existing failures remain, record them separately and do not hide them.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Next.js 16 production build succeeds.

- [ ] **Step 4: Start the app for browser verification**

```bash
npm run dev
```

Use the browser-testing skill and inspect these representative viewports:

```text
1440 × 1000  desktop
1366 × 768   short-height desktop
1024 × 768   tablet landscape
768 × 1024   tablet portrait
390 × 844    mobile portrait
844 × 390    mobile landscape
```

At every viewport verify:

- `document.documentElement.scrollHeight === window.innerHeight`.
- The artist signature, cover, metadata, navigation, and player are visible.
- The cover remains the primary focal point.
- The page retains the same composed hierarchy rather than becoming stacked.
- The fixed player does not cover the segmented navigation or lyrics panel.
- The waveform remains usable.
- All controls remain at least 44 pixels in their interactive dimension.
- Follow links appear above the cover after the signature scales down.
- The platform menu stays fully inside the viewport.
- Lyrics scroll internally without moving the page.
- Credits still flips the cover.
- Intro handoff still lands on the header signature.

- [ ] **Step 5: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce` and verify:

- Intro content resolves to its final accessible state.
- Follow, navigation, and menu state changes remain functional.
- New transitions do not animate.
- The existing disc animation remains disabled according to its current behavior.

- [ ] **Step 6: Verify external links**

Inspect rendered anchors and confirm exact destinations:

```text
Instagram
TikTok
YouTube channel
Spotify primary
Spotify heart
Apple Music
Spotify menu item
YouTube release
Amazon Music
Tidal
```

Every external anchor must include:

```html
target="_blank" rel="noopener noreferrer"
```

- [ ] **Step 7: Re-run verification after visual adjustments**

```bash
npm test
npm run lint
npm run build
```

Expected: all commands succeed after responsive tuning.

- [ ] **Step 8: Commit verification fixes**

```bash
git add src/app/globals.scss src/components/LandingIntro src/components/AudioPreview/AudioPreview.module.scss src/components/CoverCard/CoverCard.module.scss
git commit -m "fix: polish responsive landing behavior"
```

Skip this commit if verification required no changes.
