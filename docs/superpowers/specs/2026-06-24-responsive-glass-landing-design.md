# Responsive Glass Landing Page Design

## Goal

Polish the existing Caramelo landing page so the full interactive experience visually fits within the current viewport, while introducing premium glass controls, a fixed player app bar, real social and streaming links, and responsive behavior that preserves the existing composition.

The existing disc rotation behavior is explicitly out of scope. Its current idle, playing, and paused speed interpolation will remain unchanged.

## Scope

This design covers:

- A non-scrolling, viewport-fitted landing page.
- A fixed glassmorphism player app bar.
- A shared segmented glass navigation island for Home, Credits, and Lyrics.
- A compact follow-links reveal containing Instagram, TikTok, and YouTube.
- Artist-name scaling while follow links are open.
- Real outbound social and streaming destinations.
- A glass platform menu opened from the player app bar.
- Responsive and reduced-motion behavior.
- Automated interaction and styling-contract tests.

This design does not cover:

- Changes to disc rotation speed or interpolation.
- Spotify authentication or saving a track to a user's Spotify library.
- New audio-preview behavior.
- Changes to the post-preview conversion modal.
- A broad rewrite of the existing intro animation or page composition.

## Viewport and Responsive Layout

The document must not scroll in normal operation. The page will use a progressive viewport-height declaration:

```scss
height: 100vh;
height: 100svh;
height: 100dvh;
```

`100dvh` is the preferred value on browsers that support dynamic viewport units. The earlier declarations provide fallbacks. The page and document body will use `overflow: hidden`.

The existing 760-by-980 visual stage will remain the composition reference, but it will no longer be rendered as an inflexible 980-pixel-tall canvas. Responsive CSS variables and `clamp()` values will adapt the stage and major element positions to:

- Available viewport height after reserving space for the fixed player.
- Available viewport width and horizontal gutters.
- Mobile safe-area insets.
- Short desktop and landscape viewports.

The composition must remain legible and interactive without shrinking controls below accessible touch sizes. The artwork, disc, spacing, and decorative atmosphere may scale more aggressively than text and controls.

The lyrics panel is the only content region allowed to scroll. Its height will be bounded by the available stage space, with `overflow-y: auto`.

## Player App Bar

The existing `player-row` becomes a fixed glassmorphism app bar:

- Fixed above `env(safe-area-inset-bottom)`.
- Horizontally centered.
- Wider than the current intrinsic row, while constrained by responsive side gutters.
- Rounded with an app-bar silhouette rather than separate uncontained controls.
- Built from translucent light material, backdrop blur, saturation, a subtle border, inner highlight, and soft shadow.
- Layered above the stage and below modal UI.

The bar contains:

1. The existing audio preview play/pause control and waveform.
2. A “Stream Now” link that opens the supplied Spotify track.
3. A heart control that also opens the supplied Spotify track. It is an outbound link for now; it does not claim to save the track.
4. A three-dot button that toggles the streaming-platform menu.

On narrower screens, the app bar will compact spacing and waveform width while retaining the controls. It must remain a single usable bottom bar rather than causing page overflow.

## Streaming Platform Menu

The three-dot control opens an anchored glass menu above the app bar. It contains:

- Apple Music: `https://music.apple.com/us/album/caramelo/6773485931?i=6773485933`
- Spotify: `https://open.spotify.com/track/2sDSnFmxyLvWgXQZm5Mdt2?si=6c58b7c468d24c4d`
- YouTube: `https://www.youtube.com/watch?v=sb6EryPbY_A&list=OLAK5uy_lsz4B2564DZiRfBbBdES-dz5YEkTmlTn0`
- Amazon Music: `https://amazon.com/music/player/albums/B0H31RQSRH?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_fE6GMFJbRU5FpVcsEpHhibWDN`
- Tidal: `https://tidal.com/track/528205807/u`

Every destination opens in a new tab with `rel="noopener noreferrer"`.

The menu uses button/menu semantics, reports its expanded state, closes after a platform is selected, and closes when the user clicks outside or presses Escape. Focus-visible styling must remain clear against the glass surface.

## Segmented Navigation Island

Home, Credits, and Lyrics will become one shared segmented glass control rather than three separate pills.

The control uses:

- A single rounded, translucent glass container.
- Three equal or content-balanced segments.
- Icons and labels retained for clarity.
- A dark or strongly tinted active segment with a subtle sliding/settling transition.
- Clear hover and keyboard-focus states.
- `aria-pressed` on each mode button to expose the selected state.

The current behavior remains:

- Home selects the cover view.
- Credits flips the cover card.
- Lyrics reveals the internally scrollable lyrics panel.

The island stays within the responsive stage and above the fixed player bar.

## Follow Links and Artist Header

The artist signature remains the trigger for follow links.

When the follow container opens:

- The name button transitions smoothly to a slightly smaller scale.
- The scaling creates vertical room beneath the signature.
- The social controls appear above the cover art rather than overlapping it.
- The transition uses the existing `following` state and a state modifier class on the artist area or name button.

The follow container contains only:

- Instagram: `https://www.instagram.com/jonaferreira`
- TikTok: `https://www.tiktok.com/@jonafmusic`
- YouTube: `https://www.youtube.com/channel/UCWa1kPIczNX6qKZ8hMbNdsg`

Spotify and X/Twitter will be removed from this follow container.

Each link uses its recognizable icon, an accessible label, a minimum 44-by-44-pixel interactive target, and safe new-tab attributes. The buttons use a compact dark-glass or premium translucent treatment consistent with the segmented island.

## Component Responsibilities

### `LandingIntro`

`LandingIntro` remains the page-level interactive coordinator. It will:

- Retain page mode, follow state, preview playback state, intro animation, and modal orchestration.
- Render the real social and streaming URLs.
- Own the streaming-platform menu's open state and dismissal behavior.
- Apply semantic state attributes and modifier classes needed by the responsive design.
- Leave the current disc animation loop unchanged.

Small link arrays may be declared as module constants to keep the JSX readable and prevent URL duplication.

### `LandingIntro.module.scss`

The landing-page stylesheet will own:

- The viewport-height fallback stack.
- Non-scrolling page behavior.
- Responsive stage sizing and positioning.
- Safe-area-aware fixed player positioning.
- Player, menu, navigation-island, and follow-button glass materials.
- Header scaling while follow links are visible.
- Mobile, short-height, and landscape adaptations.
- Reduced-motion overrides.

### `AudioPreview`

`AudioPreview` retains WaveSurfer and playback ownership. Its styles may become more fluid so the waveform can shrink within the fixed app bar. No playback logic changes are required.

## Accessibility and Interaction

- All outbound destinations are semantic links.
- The platform trigger is a semantic button with `aria-expanded` and `aria-haspopup="menu"`.
- Platform items use menu-compatible semantics without trapping focus.
- Escape and outside-click dismissal are supported.
- The segmented navigation exposes the active mode using `aria-pressed`.
- Social buttons retain descriptive accessible names.
- Touch targets remain at least 44 by 44 pixels.
- Focus-visible rings remain distinguishable on translucent surfaces.
- The page remains usable when backdrop filters are unavailable by providing opaque-enough fallback backgrounds.

## Motion

The existing disc rotation implementation remains untouched.

New motion is limited to:

- Artist-name scale when follow links open or close.
- Follow-link opacity and position.
- Active navigation-segment treatment.
- Platform-menu entrance and exit.
- Minor hover elevation.

Under `prefers-reduced-motion: reduce`, these transitions are removed or made immediate. State changes and visibility remain fully functional.

## Testing

Automated tests will verify:

- The page stylesheet contains the `100vh`, `100svh`, and `100dvh` height stack and disables page scrolling.
- The lyrics region remains internally scrollable.
- Only Instagram, TikTok, and YouTube appear in the follow container.
- All supplied social URLs are rendered correctly.
- “Stream Now” and the heart link both target the supplied Spotify URL.
- The platform menu contains all five supplied streaming URLs.
- The platform trigger reports expanded state and the menu closes on selection, outside click, and Escape.
- Home, Credits, and Lyrics expose the correct selected state and preserve their existing view behavior.
- Follow state applies the class or state hook used to scale the artist name.
- New transitions are disabled under reduced-motion preferences.

Visual browser verification during implementation will cover representative desktop, short desktop, mobile portrait, and mobile landscape viewport sizes, ensuring the document does not scroll and the fixed app bar does not obscure interactive content.

## Files Expected to Change

- `src/components/LandingIntro/LandingIntro.tsx`
- `src/components/LandingIntro/LandingIntro.module.scss`
- `src/components/LandingIntro/LandingIntro.test.tsx`
- `src/components/AudioPreview/AudioPreview.module.scss`
- Potentially `src/app/globals.scss` for document-level viewport overflow enforcement.

No disc-animation implementation file is expected to change.
