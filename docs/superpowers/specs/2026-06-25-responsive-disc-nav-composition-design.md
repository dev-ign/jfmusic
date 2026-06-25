# Responsive Disc Navigation Composition Design

## Goal

Refine the existing Caramelo landing composition so the cover, title, metadata,
disc, navigation, and controls form one centered premium vertical arrangement.
The complete composition must fit without page scrolling, including short mobile
viewports around 667px tall.

The existing disc and cover rotation behavior must remain unchanged.

## Scope

This change covers:

- Vertical spacing and stage positioning.
- Responsive scaling of the visual composition.
- A curved glass navigation island integrated with the disc perspective.
- A clearer premium active navigation state.
- Desktop, mobile, short-mobile, and reduced-motion tuning.
- Tests for layout contracts and accessible navigation state.

This change does not alter:

- Playback behavior.
- Disc rotation speed, easing, timing, or animation state.
- The disc element's transform stack.
- Modal behavior.
- Navigation labels or destinations.
- Lyrics, credits, streaming, or follow-menu behavior.

## Architecture

### Scalable composition wrapper

Add a parent wrapper around the visual stage content. This wrapper owns only the
responsive stage scale and centering transform.

The wrapper must sit outside the animated disc transform chain. The existing
rotating and tilting disc elements retain their current refs, JavaScript writes,
and transforms without modification.

The transform hierarchy is:

1. Page viewport and no-scroll frame.
2. Scalable composition wrapper.
3. Existing positioned stage.
4. Existing disc wrapper and perspective context.
5. Existing animated tilt and rotating label elements.

Scaling the composition parent must not compose with, replace, or overwrite the
disc's animation transforms.

### CSS layout controls

Responsive geometry is controlled through CSS custom properties defined on the
composition wrapper or stage:

- `--stage-scale`: overall composition scale.
- `--stage-offset-y`: vertical placement of the scaled composition.
- `--cover-offset-y`: cover position within the stage.
- `--title-offset-y`: title and metadata position.
- `--disc-offset-y`: disc center position.
- `--nav-offset-y`: navigation position relative to the disc.
- `--control-gap`: distance between the disc/navigation group and controls.

Additional custom properties may be introduced only when they describe a
repeated layout relationship. JavaScript animation constants and transform
logic must not be used for responsive layout tuning.

Desktop, compact desktop, mobile, and short-mobile media queries adjust these
properties. This keeps the layout tunable without touching markup or animation
code.

## Vertical composition

The visual hierarchy remains:

1. Signature.
2. Cover art.
3. Caramelo title and metadata.
4. Disc with integrated navigation.
5. Playback and destination controls.

Desktop spacing should:

- Leave more breathing room between the title area and the disc.
- Add more space between the cover art and the Caramelo title.
- Push the disc lower than its current position.
- Preserve one centered vertical axis across every visible element.

Short mobile spacing should:

- Scale the cover, disc, navigation, and controls proportionally.
- Tighten internal vertical gaps after scaling.
- Keep every primary element fully visible.
- Avoid cropping the disc.
- Keep the controls above the viewport bottom safe area.

## No-scroll behavior

The document and landing page remain viewport-bound.

- The page uses dynamic viewport units.
- The landing surface clips overflow.
- The global document must not create vertical scrolling while this page is
  active.
- The scaled composition is calculated to fit both available viewport width and
  height.
- Safe-area insets are included in the available height calculation.

The lyrics panel may retain its internal scroll area. The document itself must
not scroll.

## Disc navigation

### Placement and perspective

Move the Home, Lyrics, and Credits navigation from below the visible disc edge
to the front/top region of the disc.

The navigation becomes a narrow curved glass island:

- Elliptical border radius matching the disc silhouette.
- Subtle perspective and `rotateX`.
- Mild vertical compression with `scaleY`.
- Optional very small skew only if needed to align with the disc ellipse.
- A counter-adjustment on the label layer if necessary to keep text crisp.

The perspective effect must remain restrained. Labels should read as normal
text at a glance rather than strongly foreshortened text.

### Suspended depth

The island should appear slightly above the disc surface through:

- A soft caramel contact shadow immediately beneath it.
- A restrained warm glow.
- A fine light inner edge.
- Transparent warm glass with backdrop blur.

The nav must not resemble a conventional rectangular tab bar.

## Active and interaction states

The active item uses a small luminous glass capsule behind its label:

- Warm caramel/gold tint.
- Semi-transparent cream highlight.
- Fine inner border.
- Soft outer glow and contact shadow.
- Enough contrast to make selection immediately clear.

Inactive items remain quiet and low contrast. Hover may raise contrast slightly
without adding a full button surface.

Existing button semantics and `aria-pressed` selected state remain intact.
Keyboard focus uses a clear warm focus ring that remains visible over both the
active capsule and inactive glass background.

The existing moving indicator may be restyled into the active capsule or
replaced by a dedicated decorative capsule element. Any decorative indicator is
non-interactive and hidden from assistive technology.

## Responsive behavior

### Wide and standard desktop

- Use the largest stage scale that fits the viewport.
- Preserve generous cover/title and title/disc breathing room.
- Keep the disc centered and fully visible.

### Compact-height desktop and tablet

- Reduce `--stage-scale`.
- Tighten the major vertical offsets modestly.
- Preserve the same visual hierarchy and nav perspective.

### Mobile

- Scale from both viewport width and height constraints.
- Reduce control sizes and gaps proportionally with the stage.
- Keep the curved nav aligned to the visible front/top disc area.

### Short mobile around 667px

- Use a dedicated compact property set.
- Prioritize complete visibility over desktop-sized spacing.
- Keep signature, cover, title/meta, disc/nav, and controls inside the viewport.
- Do not crop the disc or place controls below the viewport.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- Preserve the same stage scale, positions, perspective, and active styling.
- Disable active-capsule and navigation transition motion.
- Do not modify the existing reduced-motion behavior of the disc or intro.
- Keep navigation and layout static and fully readable.

## Markup and file boundaries

Expected changes:

- Modify `LandingIntro.tsx` only to add the scalable composition wrapper and, if
  required, a decorative active-capsule element.
- Modify `LandingIntro.module.scss` for all geometry, scaling, perspective,
  glass treatment, active states, and responsive rules.
- Modify `LandingIntro.test.tsx` for wrapper, layout-property, accessible-state,
  no-scroll, and reduced-motion contracts.

No changes are expected in the disc animation loop, `AudioPreview`, `CoverCard`,
or modal code.

## Testing

Automated tests verify:

- The scalable wrapper exists outside the animated disc transform chain.
- Required CSS custom properties exist and drive the relevant positions.
- Navigation buttons retain `aria-pressed`.
- Active navigation receives the premium capsule state.
- Focus-visible styling remains present.
- Reduced-motion rules disable nav transitions without changing layout.
- The page and stage enforce no-scroll behavior.
- Existing navigation interaction tests continue to pass.
- Existing playback and modal tests continue to pass.

Rendered QA verifies:

- Standard desktop.
- Compact-height desktop.
- Mobile width.
- A short mobile viewport around 390×667.
- The disc is fully visible.
- Controls stay on-screen.
- The composition remains centered.
- The nav sits over the front/top disc surface.
- Text remains crisp despite perspective.
- Existing disc rotation behavior is visually unchanged.
