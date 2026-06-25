import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import LandingIntro from './LandingIntro';

type TweenVars = Record<string, unknown> & { onComplete?: () => void };

const SPOTIFY_URL =
  'https://open.spotify.com/track/2sDSnFmxyLvWgXQZm5Mdt2?si=6c58b7c468d24c4d';

const SOCIAL_URLS = {
  Instagram: 'https://www.instagram.com/jonaferreira',
  TikTok: 'https://www.tiktok.com/@jonafmusic',
  YouTube: 'https://www.youtube.com/channel/UCWa1kPIczNX6qKZ8hMbNdsg',
} as const;

const PLATFORM_URLS = {
  'Apple Music':
    'https://music.apple.com/us/album/caramelo/6773485931?i=6773485933',
  Spotify: SPOTIFY_URL,
  YouTube:
    'https://www.youtube.com/watch?v=sb6EryPbY_A&list=OLAK5uy_lsz4B2564DZiRfBbBdES-dz5YEkTmlTn0',
  'Amazon Music':
    'https://amazon.com/music/player/albums/B0H31RQSRH?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_fE6GMFJbRU5FpVcsEpHhibWDN',
  Tidal: 'https://tidal.com/track/528205807/u',
} as const;

const orchestrationMock = vi.hoisted(() => ({
  canShow: true,
  reset: vi.fn(),
  recordCompletion: vi.fn(),
  markShown: vi.fn(),
  recordDismissal: vi.fn(),
  animationFrames: [] as FrameRequestCallback[],
}));

const isRevealMaskPath = (target: unknown): target is Element =>
  target instanceof Element &&
  target.tagName.toLowerCase() === 'path' &&
  target.classList.contains('signature-reveal-mask-path');

const isFillLayer = (target: unknown): target is Element =>
  target instanceof Element &&
  target.classList.contains('signature-fill-layer');

const gsapMock = vi.hoisted(() => ({
  enabled: false,
  reduceMotion: false,
  omitContextSafe: false,
  sets: [] as Array<{ targets: unknown; vars: TweenVars }>,
  timelines: [] as Array<{
    config: TweenVars;
    tweens: Array<{ targets: unknown; vars: TweenVars; position?: unknown }>;
    kill: ReturnType<typeof vi.fn>;
  }>,
  moves: [] as Array<{
    targets: unknown;
    vars: TweenVars;
    kill: ReturnType<typeof vi.fn>;
  }>,
  mediaHandlers: [] as Array<(context: {
    conditions: { reduceMotion: boolean };
  }) => void | (() => void)>,
  mediaConditions: [] as Array<Record<string, string>>,
}));

const originalGetTotalLength = Object.getOwnPropertyDescriptor(
  SVGElement.prototype,
  'getTotalLength',
);
const originalDocumentFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
let rectSpy: { mockRestore: () => void } | undefined;

vi.mock('@gsap/react', async () => {
  const { useLayoutEffect } = await vi.importActual<typeof import('react')>('react');

  return {
    useGSAP: (
      callback: (
        context: unknown,
        contextSafe?: <T extends (...args: never[]) => unknown>(callback: T) => T,
      ) => void | (() => void),
      config?: { dependencies?: unknown[] },
    ) => {
      useLayoutEffect(() => {
        if (!gsapMock.enabled) return;
        return callback(
          {},
          gsapMock.omitContextSafe ? undefined : (safeCallback) => safeCallback,
        );
        // Production useGSAP runs once when no dependencies are supplied.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, config?.dependencies ?? []);
    },
  };
});

vi.mock('gsap', () => {
  const applyAutoAlpha = (targets: unknown, vars: TweenVars) => {
    const elements = (Array.isArray(targets) ? targets : [targets]).filter(
      (target): target is HTMLElement | SVGElement => target instanceof Element,
    );

    if (typeof vars.autoAlpha === 'number') {
      elements.forEach((element) => {
        element.style.opacity = String(vars.autoAlpha);
        element.style.visibility = vars.autoAlpha === 0 ? 'hidden' : 'visible';
      });
    }
  };

  return {
    default: {
      registerPlugin: vi.fn(),
      set: vi.fn((targets: unknown, vars: TweenVars) => {
        gsapMock.sets.push({ targets, vars });
        applyAutoAlpha(targets, vars);
      }),
      to: vi.fn((targets: unknown, vars: TweenVars) => {
        const move = { targets, vars, kill: vi.fn() };
        gsapMock.moves.push(move);
        return move;
      }),
      timeline: vi.fn((config: TweenVars = {}) => {
        const record = {
          config,
          tweens: [] as Array<{
            targets: unknown;
            vars: TweenVars;
            position?: unknown;
          }>,
          kill: vi.fn(),
        };
        gsapMock.timelines.push(record);

        return {
          kill: record.kill,
          to(targets: unknown, vars: TweenVars, position?: unknown) {
            record.tweens.push({ targets, vars, position });
            return this;
          },
        };
      }),
      matchMedia: vi.fn(() => ({
        add: vi.fn((
          conditions: Record<string, string>,
          handler: (context: { conditions: { reduceMotion: boolean } }) => void,
        ) => {
          gsapMock.mediaConditions.push(conditions);
          gsapMock.mediaHandlers.push(handler);
          const noPreferenceMatches =
            !gsapMock.reduceMotion && 'noPreference' in conditions;

          if (gsapMock.reduceMotion || noPreferenceMatches || 'all' in conditions) {
            return handler({
              conditions: { reduceMotion: gsapMock.reduceMotion },
            });
          }
        }),
        revert: vi.fn(),
      })),
    },
  };
});

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => ({
      destroy: vi.fn(),
      getDuration: vi.fn(() => 0),
      load: vi.fn(),
      on: vi.fn(),
      playPause: vi.fn(),
      seekTo: vi.fn(),
    })),
  },
}));

vi.mock('@/components/AudioPreview/AudioPreview', () => ({
  default: ({
    onPlaybackChange,
    onQualifiedFinish,
  }: {
    onPlaybackChange?: (isPlaying: boolean) => void;
    onQualifiedFinish?: (reset: () => void) => void;
    showWaveform?: boolean;
  }) => (
    <div>
      <button type="button" aria-label="Play preview" disabled />
      <button
        type="button"
        onClick={() => onPlaybackChange?.(true)}
      >
        Report preview playing
      </button>
      <button
        type="button"
        onClick={() => onQualifiedFinish?.(orchestrationMock.reset)}
      >
        Report qualified finish
      </button>
    </div>
  ),
}));

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

vi.mock('@/components/PostPreviewModal/PostPreviewModal', () => ({
  default: ({
    isOpen,
    onRequestClose,
    onExited,
  }: {
    isOpen: boolean;
    onRequestClose: () => void;
    onExited?: () => void;
  }) => (
    <div data-testid="post-preview-modal" data-open={String(isOpen)}>
      <button type="button" onClick={onRequestClose}>
        Close post-preview modal
      </button>
      <button type="button" onClick={onExited}>
        Complete modal exit
      </button>
    </div>
  ),
}));

vi.mock('@/lib/postPreviewPrompt', () => ({
  canShowPostPreviewPrompt: vi.fn(() => orchestrationMock.canShow),
  markPostPreviewPromptShown: orchestrationMock.markShown,
  recordPostPreviewDismissal: orchestrationMock.recordDismissal,
  recordPreviewCompletion: orchestrationMock.recordCompletion,
}));

beforeEach(() => {
  gsapMock.enabled = false;
  gsapMock.reduceMotion = false;
  gsapMock.omitContextSafe = false;
  gsapMock.sets.length = 0;
  gsapMock.timelines.length = 0;
  gsapMock.moves.length = 0;
  gsapMock.mediaHandlers.length = 0;
  gsapMock.mediaConditions.length = 0;
  orchestrationMock.canShow = true;
  orchestrationMock.reset.mockReset();
  orchestrationMock.recordCompletion.mockReset();
  orchestrationMock.markShown.mockReset();
  orchestrationMock.recordDismissal.mockReset();
  orchestrationMock.animationFrames.length = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      orchestrationMock.animationFrames.push(callback);
      return orchestrationMock.animationFrames.length;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalGetTotalLength) {
    Object.defineProperty(
      SVGElement.prototype,
      'getTotalLength',
      originalGetTotalLength,
    );
  } else {
    delete (SVGElement.prototype as Partial<SVGGeometryElement>).getTotalLength;
  }
  rectSpy?.mockRestore();
  rectSpy = undefined;
  if (originalDocumentFonts) {
    Object.defineProperty(document, 'fonts', originalDocumentFonts);
  } else {
    Reflect.deleteProperty(document, 'fonts');
  }
});

describe('LandingIntro', () => {
  it('controls the cover face from the arc nav buttons', () => {
    render(<LandingIntro />);

    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-flipped',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Credits view' }));
    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-flipped',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cover view' }));
    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-flipped',
      'false',
    );
  });

  it('exposes the selected release view and follow-open state', () => {
    render(<LandingIntro />);
    const home = screen.getByRole('button', { name: 'Cover view' });
    const credits = screen.getByRole('button', { name: 'Credits view' });
    const lyrics = screen.getByRole('button', { name: 'Lyrics view' });
    const followBtn = screen.getByRole('button', { name: 'Follow Jona Ferreira' });

    expect(home).toHaveAttribute('aria-pressed', 'true');
    expect(credits).toHaveAttribute('aria-pressed', 'false');
    expect(lyrics).toHaveAttribute('aria-pressed', 'false');
    expect(followBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(credits);
    expect(home).toHaveAttribute('aria-pressed', 'false');
    expect(credits).toHaveAttribute('aria-pressed', 'true');
    expect(lyrics).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(lyrics);
    expect(home).toHaveAttribute('aria-pressed', 'false');
    expect(credits).toHaveAttribute('aria-pressed', 'false');
    expect(lyrics).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(home);
    expect(home).toHaveAttribute('aria-pressed', 'true');
    expect(credits).toHaveAttribute('aria-pressed', 'false');
    expect(lyrics).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(followBtn);
    expect(followBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the artist heading outside the follow button and puts follow in the player row', () => {
    render(<LandingIntro />);
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Jona Ferreira',
    });
    const followButton = screen.getByRole('button', {
      name: 'Follow Jona Ferreira',
    });

    // Heading must not be inside any button
    expect(heading.closest('button')).toBeNull();
    // Follow button must not contain the heading
    expect(followButton).not.toContainElement(heading);

    // Opening the follow menu shows the social links as menu items
    fireEvent.click(followButton);
    expect(followButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Instagram' })).toBeInTheDocument();
  });

  it('styles arc nav and follow controls with premium material language', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const dotRule = css.match(/\.disc-nav-band__dot\s*\{([^}]*)\}/)?.[1];
    const lblRule = css.match(/\.disc-nav-band__btn\s*\{([^}]*)\}/)?.[1];
    const bandRule = css.match(/\.disc-nav-band\s*\{([^}]*)\}/)?.[1];
    const followMenuRule = css.match(/\.follow-menu\s*\{([^}]*)\}/)?.[1];

    // Indicator is a bronze dot
    expect(dotRule).toMatch(/background:/);
    // Band is a pill shape with 3D perspective
    expect(bandRule).toMatch(/border-radius:\s*999px/);
    // Inactive labels stay transparent while the active state owns the capsule
    expect(lblRule).toMatch(/text-transform:\s*uppercase/);
    expect(lblRule).toMatch(/background:\s*transparent/);
    // Follow menu uses glass treatment
    expect(followMenuRule).toMatch(/backdrop-filter:\s*blur\(/);
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.stream-menu[\s\S]*transition:\s*none/,
    );
  });

  it('renders no waveform in the player row', () => {
    const { container } = render(<LandingIntro />);
    const playerRow = container.querySelector('[data-player-row]');
    expect(playerRow).not.toBeNull();
    expect(playerRow?.querySelector('[class*="waveform-area"]')).toBeNull();
  });

  it('mounts a compact nav band with all three navigation buttons inside it', () => {
    const { container } = render(<LandingIntro />);
    const band = container.querySelector('[data-disc-nav-band]');
    expect(band).not.toBeNull();

    const lyricsBtn = screen.getByRole('button', { name: 'Lyrics view' });
    const homeBtn = screen.getByRole('button', { name: 'Cover view' });
    const creditsBtn = screen.getByRole('button', { name: 'Credits view' });

    expect(lyricsBtn.closest('[data-disc-nav-band]')).toBe(band);
    expect(homeBtn.closest('[data-disc-nav-band]')).toBe(band);
    expect(creditsBtn.closest('[data-disc-nav-band]')).toBe(band);
  });

  it('scales the stage outside the existing disc transform chain', () => {
    const { container } = render(<LandingIntro />);
    const stageScale = container.querySelector('[data-stage-scale]');
    const shell = container.querySelector('[data-landing-shell]');
    const discTilt = container.querySelector('[data-disc-tilt]');

    expect(stageScale).not.toBeNull();
    expect(stageScale).toContainElement(shell);
    expect(shell).toContainElement(discTilt);
    expect(stageScale).not.toBe(discTilt);
  });

  it('drives responsive composition geometry through stage custom properties', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );

    for (const property of [
      '--stage-scale',
      '--stage-offset-y',
      '--cover-offset-y',
      '--title-offset-y',
      '--disc-offset-y',
      '--nav-offset-y',
      '--control-gap',
    ]) {
      expect(css).toContain(property);
    }

    expect(css).toMatch(
      /\.stage-scale\s*\{[\s\S]*transform:[^;]*scale\(var\(--stage-scale\)\)/,
    );
    expect(css).toMatch(
      /\.disc-wrap\s*\{[\s\S]*top:\s*calc\([\s\S]*var\(--disc-offset-y\)[\s\S]*var\(--mobile-content-shift,\s*0px\)/,
    );
  });

  it('integrates a curved premium nav with responsive and reduced-motion tuning', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const globals = readFileSync('src/app/globals.scss', 'utf8');
    const bandRule = css.match(/\.disc-nav-band\s*\{([^}]*)\}/)?.[1];
    const activeRule = css.match(
      /\.disc-nav-band__btn--active\s*\{([^}]*)\}/,
    )?.[1];

    expect(bandRule).toMatch(/perspective\(/);
    expect(bandRule).toMatch(/rotateX\(/);
    expect(bandRule).toMatch(/scaleY\(/);
    expect(bandRule).toMatch(/transform-origin:/);
    expect(bandRule).toMatch(/border-radius:\s*999px/);

    expect(activeRule).toMatch(/background:/);
    expect(activeRule).toMatch(/border:/);
    expect(activeRule).toMatch(/box-shadow:/);

    expect(css).toMatch(
      /@media\s*\(max-height:\s*667px\)[\s\S]*--stage-scale:[\s\S]*--disc-offset-y:[\s\S]*--control-gap:/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.disc-nav-band[\s\S]*transition:\s*none/,
    );
    expect(globals).toMatch(
      /html,\s*body\s*\{[\s\S]*height:\s*100%[\s\S]*overflow:\s*hidden/,
    );
    expect(css).toMatch(
      /\.page\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*overflow:\s*clip;/,
    );
  });

  it('uses a thin glass rail, a Lyrics-only transparent stage, and a red heart modifier', () => {
    const { container } = render(<LandingIntro />);
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const bandRule = css.match(/\.disc-nav-band\s*\{([^}]*)\}/)?.[1];
    const buttonRule = css.match(/\.disc-nav-band__btn\s*\{([^}]*)\}/)?.[1];
    const activeRule = css.match(
      /\.disc-nav-band__btn--active\s*\{([^}]*)\}/,
    )?.[1];
    const lyricsRule = css.match(/\.lyrics\s*\{([^}]*)\}/)?.[1];
    const heartRule = css.match(/\.btn-icon--heart\s*\{([^}]*)\}/)?.[1];

    expect(bandRule).toMatch(/height:\s*(?:3[0-9]|4[0-4])px/);
    expect(bandRule).toMatch(/border-radius:\s*999px/);
    expect(bandRule).toMatch(/perspective\(800px\)/);
    expect(bandRule).toMatch(/rotateX\(14deg\)/);
    expect(bandRule).toMatch(/scaleY\(0\.86\)/);
    expect(bandRule).toMatch(/rgba\([^)]*,\s*0\.(?:0[4-9]|[1-3][0-9])\)/);

    expect(buttonRule).toMatch(/background:\s*transparent/);
    expect(activeRule).toMatch(/background:/);
    expect(activeRule).toMatch(/box-shadow:/);

    expect(lyricsRule).toMatch(/background:\s*transparent/);
    expect(lyricsRule).toMatch(/border:\s*0/);
    expect(lyricsRule).toMatch(/box-shadow:\s*none/);
    expect(lyricsRule).toMatch(/backdrop-filter:\s*none/);

    expect(heartRule).toMatch(/color:\s*#d83b32/);
    expect(
      container.querySelector('[data-heart-control]'),
    ).not.toBeNull();
  });

  it('scales mobile artwork, controls, navigation, and Lyrics proportionally', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const lyricsBodyRule = css.match(/\.lyrics__body\s*\{([^}]*)\}/)?.[1];

    expect(lyricsBodyRule).toMatch(/font-weight:\s*650/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?\.cover-float-wrap\s*\{[\s\S]*?scale\(1\.2\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*560px\)[\s\S]*?\.cover-float-wrap\s*\{[\s\S]*?scale\(1\.3\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?\.cover-float-wrap\s*\{[\s\S]*?scale\(1\.4\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?--control-gap:\s*54px[\s\S]*?\.btn-icon\s*\{[\s\S]*?width:\s*72px[\s\S]*?height:\s*72px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?\.disc-nav-band__btn\s*\{[\s\S]*?font-size:\s*12px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?\.lyrics\s*\{[\s\S]*?height:\s*480px/,
    );
  });

  it('shifts the mobile composition below the cover without changing desktop', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const baseStageRule = css.match(/\.stage-scale\s*\{([^}]*)\}/)?.[1];

    expect(baseStageRule).not.toMatch(/--mobile-content-shift/);
    expect(css).toMatch(
      /\.track-meta-outer\s*\{[\s\S]*?top:\s*calc\([\s\S]*?var\(--title-offset-y\)[\s\S]*?var\(--mobile-content-shift,\s*0px\)[\s\S]*?\)/,
    );
    expect(css).toMatch(
      /\.disc-wrap\s*\{[\s\S]*?top:\s*calc\([\s\S]*?var\(--disc-offset-y\)[\s\S]*?var\(--mobile-content-shift,\s*0px\)[\s\S]*?\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?--mobile-content-shift:\s*20px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*560px\)[\s\S]*?--mobile-content-shift:\s*22px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?--mobile-content-shift:\s*50px/,
    );
  });

  it('enlarges only the responsive play button and its icon proportionally', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );

    expect(css).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?audio-preview__play-btn\)\s*\{[\s\S]*?width:\s*76px[\s\S]*?height:\s*76px[\s\S]*?audio-preview__play-btn svg\)\s*\{[\s\S]*?width:\s*29px[\s\S]*?height:\s*29px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*560px\)[\s\S]*?audio-preview__play-btn\)\s*\{[\s\S]*?width:\s*86px[\s\S]*?height:\s*86px[\s\S]*?audio-preview__play-btn svg\)\s*\{[\s\S]*?width:\s*32px[\s\S]*?height:\s*32px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?audio-preview__play-btn\)\s*\{[\s\S]*?width:\s*96px[\s\S]*?height:\s*96px[\s\S]*?audio-preview__play-btn svg\)\s*\{[\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*380px\)[\s\S]*?audio-preview__play-btn\)\s*\{[\s\S]*?width:\s*100px[\s\S]*?height:\s*100px[\s\S]*?audio-preview__play-btn svg\)\s*\{[\s\S]*?width:\s*38px[\s\S]*?height:\s*38px/,
    );
  });

  it('lowers the player row on desktop and proportionally across mobile', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const baseStageRule = css.match(/\.stage-scale\s*\{([^}]*)\}/)?.[1];

    expect(baseStageRule).toMatch(/--control-gap:\s*44px/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*700px\)[\s\S]*?--control-gap:\s*48px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*560px\)[\s\S]*?--control-gap:\s*51px/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*430px\)[\s\S]*?--control-gap:\s*54px/,
    );
  });

  it('provides a handwritten JF app icon using signature glyph paths', () => {
    const iconSource = readFileSync('src/app/icon.tsx', 'utf8');

    expect(iconSource).toContain('SIGNATURE_PATHS[0]');
    expect(iconSource).toContain('SIGNATURE_PATHS[4]');
    expect(iconSource).toContain('#843a09');
    expect(iconSource).toContain('JF favicon');
  });

  it('reserves an eligible finish, then marks and resets only after the modal commits open', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    orchestrationMock.markShown.mockImplementation(() => {
      expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
        'data-open',
        'true',
      );
    });
    orchestrationMock.reset.mockImplementation(() => {
      expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
        'data-open',
        'true',
      );
    });

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(orchestrationMock.recordCompletion).toHaveBeenCalledOnce();
    expect(orchestrationMock.markShown).not.toHaveBeenCalled();
    expect(screen.queryByTestId('post-preview-modal')).not.toBeInTheDocument();
    expect(orchestrationMock.markShown).not.toHaveBeenCalled();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(449);
    });

    expect(screen.queryByTestId('post-preview-modal')).not.toBeInTheDocument();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(orchestrationMock.markShown).toHaveBeenCalledOnce();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(orchestrationMock.reset).toHaveBeenCalledOnce();
  });

  it('opens immediately for reduced motion but resets after the open commit', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(orchestrationMock.markShown).toHaveBeenCalledOnce();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();

    act(() => {
      orchestrationMock.animationFrames.shift()?.(0);
    });

    expect(orchestrationMock.reset).toHaveBeenCalledOnce();
  });

  it('opens on playback even when an earlier cooldown would have denied it', () => {
    orchestrationMock.canShow = false;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(orchestrationMock.recordCompletion).toHaveBeenCalledOnce();
    expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
      'data-open',
      'true',
    );
  });

  it('does not mark shown or reset when unmounted during the cinematic delay', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));

    const { unmount } = render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(orchestrationMock.markShown).not.toHaveBeenCalled();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();
  });

  it('reopens after a second playback on the same mounted page', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );
    act(() => {
      orchestrationMock.animationFrames.shift()?.(0);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close post-preview modal' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete modal exit' }));

    orchestrationMock.reset.mockClear();
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(orchestrationMock.markShown).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
      'data-open',
      'true',
    );
  });

  it('records dismissal when the modal requests close', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close post-preview modal' }),
    );

    expect(orchestrationMock.recordDismissal).toHaveBeenCalledOnce();
    expect(screen.getByTestId('post-preview-modal')).toHaveAttribute(
      'data-open',
      'false',
    );
  });

  it('resets exactly once when closed after commit but before the reset frame', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(orchestrationMock.markShown).toHaveBeenCalledOnce();
    expect(orchestrationMock.reset).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close post-preview modal' }),
    );

    expect(orchestrationMock.reset).toHaveBeenCalledOnce();

    act(() => {
      orchestrationMock.animationFrames.shift()?.(0);
    });

    expect(orchestrationMock.reset).toHaveBeenCalledOnce();
  });

  it('records dismissal only once for repeated close requests in one exit cycle', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    const closeButton = screen.getByRole('button', {
      name: 'Close post-preview modal',
    });
    fireEvent.click(closeButton);
    fireEvent.click(closeButton);

    expect(orchestrationMock.recordDismissal).toHaveBeenCalledOnce();
  });

  it('blocks the shell while mounted and restores completed-intro interaction after exit', () => {
    gsapMock.enabled = true;
    gsapMock.reduceMotion = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    const { container } = render(<LandingIntro />);
    const shell = container.querySelector('[data-landing-shell]');

    expect(shell).not.toHaveAttribute('inert');

    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(shell).toHaveAttribute('inert');
    expect(shell).toHaveAttribute('aria-hidden', 'true');
    expect(shell?.className).toContain('shell--blocked');
    expect(shell?.contains(screen.getByTestId('post-preview-modal'))).toBe(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Close post-preview modal' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete modal exit' }));

    expect(shell).not.toHaveAttribute('inert');
    expect(shell).not.toHaveAttribute('aria-hidden');
    expect(shell?.className).not.toContain('shell--blocked');
  });

  it('keeps the shell inert after modal exit when the intro has not completed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    const { container } = render(<LandingIntro />);
    const shell = container.querySelector('[data-landing-shell]');

    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close post-preview modal' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete modal exit' }));

    expect(shell).toHaveAttribute('inert');
    expect(shell).not.toHaveAttribute('aria-hidden');
    expect(shell?.className).not.toContain('shell--blocked');
  });

  it('mounts the final release semantics behind an inert decorative intro', () => {
    const { container } = render(<LandingIntro />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Jona Ferreira' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Caramelo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Caramelo single cover art by Jona Ferreira',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'Stream Caramelo on Spotify' }),
    ).toBeInTheDocument();

    const shell = container.querySelector('[data-landing-shell]');
    const overlay = container.querySelector('[data-landing-intro]');
    const introSignature = overlay?.querySelector('svg');
    const headerSignature = screen.getByRole('img', { name: 'Jona Ferreira' });

    expect(shell).toHaveAttribute('inert');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(introSignature).toHaveAttribute('aria-hidden', 'true');
    expect(introSignature).not.toHaveAttribute('role');
    expect(introSignature?.querySelector('.signature-draw-layer')).toBeInTheDocument();
    expect(headerSignature.querySelector('.signature-draw-layer')).not.toBeInTheDocument();
  });

  it('renders only the approved social destinations', () => {
    render(<LandingIntro />);

    // Social links are not in the DOM until the follow menu opens
    for (const label of Object.keys(SOCIAL_URLS)) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByRole('button', { name: 'Follow Jona Ferreira' }),
    );

    for (const [label, href] of Object.entries(SOCIAL_URLS)) {
      // Social links use role="menuitem" inside the follow menu
      const item = screen.getByRole('menuitem', { name: label });
      expect(item).toHaveAttribute('href', href);
      expect(item).toHaveAttribute('target', '_blank');
      expect(item).toHaveAttribute('rel', 'noopener noreferrer');
      // Menu items use tabIndex=-1 (roving focus via arrow keys per ARIA menu pattern)
      expect(item).toHaveAttribute('tabindex', '-1');
    }

    expect(
      screen.queryByRole('menuitem', { name: 'X / Twitter' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Spotify' }),
    ).not.toBeInTheDocument();
  });

  it('uses Spotify for the primary and heart links', () => {
    render(<LandingIntro />);

    const primaryLink = screen.getByRole('link', {
      name: 'Stream Caramelo on Spotify',
    });
    const heartLink = screen.getByRole('link', {
      name: 'Open Caramelo on Spotify',
    });

    for (const link of [primaryLink, heartLink]) {
      expect(link).toHaveAttribute('href', SPOTIFY_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('opens the platform menu and renders all streaming destinations', () => {
    render(<LandingIntro />);
    const trigger = screen.getByRole('button', {
      name: 'More streaming platforms',
    });

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(5);
    expect(screen.getByRole('menuitem', { name: 'Apple Music' })).toHaveFocus();

    for (const [label, href] of Object.entries(PLATFORM_URLS)) {
      const link = screen.getByRole('menuitem', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('cycles platform menu focus with arrow, Home, and End keys', () => {
    render(<LandingIntro />);
    const trigger = screen.getByRole('button', {
      name: 'More streaming platforms',
    });

    fireEvent.click(trigger);

    const menu = screen.getByRole('menu');
    const appleMusic = screen.getByRole('menuitem', { name: 'Apple Music' });
    const spotify = screen.getByRole('menuitem', { name: 'Spotify' });
    const tidal = screen.getByRole('menuitem', { name: 'Tidal' });

    expect(appleMusic).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(spotify).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(appleMusic).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(tidal).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(appleMusic).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'End' });
    expect(tidal).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(appleMusic).toHaveFocus();
  });

  it.each([
    ['Tab', false],
    ['Shift+Tab', true],
  ])('closes the platform menu on %s without preventing default', (_, shiftKey) => {
    render(<LandingIntro />);
    const trigger = screen.getByRole('button', {
      name: 'More streaming platforms',
    });

    fireEvent.click(trigger);

    const appleMusic = screen.getByRole('menuitem', { name: 'Apple Music' });
    expect(appleMusic).toHaveFocus();

    const defaultAllowed = fireEvent.keyDown(appleMusic, {
      key: 'Tab',
      shiftKey,
    });

    expect(defaultAllowed).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveFocus();
  });

  it('closes the platform menu after selection, outside click, and Escape', () => {
    render(<LandingIntro />);
    const trigger = screen.getByRole('button', {
      name: 'More streaming platforms',
    });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tidal' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('removes platform menu document listeners when unmounted while open', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<LandingIntro />);

    fireEvent.click(
      screen.getByRole('button', { name: 'More streaming platforms' }),
    );

    const mousedownListener = addEventListenerSpy.mock.calls.find(
      ([type]) => type === 'mousedown',
    )?.[1];
    const keydownListener = addEventListenerSpy.mock.calls.find(
      ([type]) => type === 'keydown',
    )?.[1];

    expect(mousedownListener).toBeTypeOf('function');
    expect(keydownListener).toBeTypeOf('function');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousedown',
      mousedownListener,
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      keydownListener,
    );
  });

  it('restores interaction immediately when reduced motion is preferred', () => {
    gsapMock.enabled = true;
    gsapMock.reduceMotion = true;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const resizeListener = vi.fn();
    window.addEventListener('resize', resizeListener);

    const { container } = render(<LandingIntro />);

    expect(container.querySelector('[data-landing-shell]')).not.toHaveAttribute('inert');
    expect(container.querySelector('[data-landing-intro]')).toHaveStyle({
      opacity: '0',
      visibility: 'hidden',
    });
    expect(screen.getByRole('img', { name: 'Jona Ferreira' })).toHaveStyle({
      opacity: '1',
      visibility: 'visible',
    });
    expect(resizeListener).toHaveBeenCalledOnce();

    window.removeEventListener('resize', resizeListener);
  });

  it('reveals the filled logo along the handwriting path before handoff', async () => {
    gsapMock.enabled = true;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });
    rectSpy = vi.spyOn(
      SVGSVGElement.prototype,
      'getBoundingClientRect',
    ).mockImplementation(
      function getBoundingClientRect(this: SVGSVGElement) {
        const isIntro = this.getAttribute('aria-hidden') === 'true';
        return {
          left: isIntro ? 100 : 20,
          top: isIntro ? 200 : 30,
          width: isIntro ? 400 : 200,
          height: isIntro ? 60 : 30,
          bottom: 0,
          right: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      },
    );

    const { container } = render(<LandingIntro />);
    const shell = container.querySelector('[data-landing-shell]');
    const dashSetup = gsapMock.sets.find(
      ({ vars }) => vars.strokeDasharray === 120,
    );
    const revealMaskSetup = gsapMock.sets.find(
      ({ targets, vars }) =>
        isRevealMaskPath(targets) &&
        vars.strokeDasharray === 120,
    );
    const fillLayerSetup = gsapMock.sets.find(
      ({ targets, vars }) => isFillLayer(targets) && vars.autoAlpha === 1,
    );

    expect(dashSetup?.vars).toMatchObject({
      strokeDasharray: 120,
      strokeOpacity: 0,
    });
    expect(Number(dashSetup?.vars.strokeDashoffset)).toBeGreaterThan(120);
    expect(revealMaskSetup?.vars).toMatchObject({
      strokeDasharray: 120,
      strokeOpacity: 0,
    });
    expect(Number(revealMaskSetup?.vars.strokeDashoffset)).toBeGreaterThan(120);
    expect(fillLayerSetup?.vars).toMatchObject({ autoAlpha: 1 });

    await waitFor(() => expect(gsapMock.timelines).toHaveLength(1));

    const drawTween = gsapMock.timelines[0].tweens.find(
      ({ vars }) => vars.strokeDashoffset === 0,
    );
    const drawOpacityTween = gsapMock.timelines[0].tweens.find(
      ({ targets, vars, position }) =>
        targets instanceof Element &&
        targets.classList.contains('signature-draw-path') &&
        vars.strokeOpacity === 1 &&
        vars.duration === 0.01 &&
        position === drawTween?.position,
    );
    const revealTween = gsapMock.timelines[0].tweens.find(
      ({ targets, vars, position }) =>
        isRevealMaskPath(targets) &&
        vars.strokeDashoffset === 0 &&
        position === drawTween?.position,
    );
    const revealOpacityTween = gsapMock.timelines[0].tweens.find(
      ({ targets, vars, position }) =>
        isRevealMaskPath(targets) &&
        vars.strokeOpacity === 1 &&
        vars.duration === 0.01 &&
        position === drawTween?.position,
    );

    expect(drawOpacityTween?.vars).toMatchObject({
      duration: 0.01,
      ease: 'none',
      strokeOpacity: 1,
    });
    expect(drawTween?.vars).toMatchObject({
      duration: expect.any(Number),
      ease: 'sine.inOut',
    });
    expect(Number(drawTween?.vars.duration)).toBeGreaterThan(0.25);
    expect(revealTween?.vars).toMatchObject({
      duration: drawTween?.vars.duration,
      ease: 'sine.inOut',
    });
    expect(revealOpacityTween?.vars).toMatchObject({
      duration: 0.01,
      ease: 'none',
      strokeOpacity: 1,
    });
    expect(shell).toHaveAttribute('inert');

    gsapMock.timelines[0].config.onComplete?.();

    const handoffMove = gsapMock.moves.find(
      ({ vars }) =>
        vars.duration === 1.25 &&
        vars.ease === 'power3.inOut' &&
        vars.transformOrigin === 'center center' &&
        typeof vars.onComplete === 'function',
    );

    expect(handoffMove?.vars).toMatchObject({
      duration: 1.25,
      ease: 'power3.inOut',
      transformOrigin: 'center center',
    });
    expect(shell).toHaveAttribute('inert');

    handoffMove?.vars.onComplete?.();

    expect(gsapMock.timelines).toHaveLength(2);
    expect(shell).toHaveAttribute('inert');

    gsapMock.timelines[1].config.onComplete?.();

    expect(shell).not.toHaveAttribute('inert');
  });

  it('registers an all-condition fallback so normal motion starts reliably', async () => {
    gsapMock.enabled = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });

    render(<LandingIntro />);

    await waitFor(() =>
      expect(gsapMock.mediaConditions[0]).toMatchObject({
        all: 'all',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      }),
    );
  });

  it('starts normal motion when useGSAP does not provide contextSafe', async () => {
    gsapMock.enabled = true;
    gsapMock.omitContextSafe = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });

    render(<LandingIntro />);

    await waitFor(() => expect(gsapMock.timelines).toHaveLength(1));
  });

  it('finalizes and kills active motion when reduced motion switches on', async () => {
    gsapMock.enabled = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });

    const { container } = render(<LandingIntro />);
    const shell = container.querySelector('[data-landing-shell]');

    await waitFor(() => expect(gsapMock.timelines).toHaveLength(1));
    expect(shell).toHaveAttribute('inert');

    gsapMock.mediaHandlers[0]({ conditions: { reduceMotion: true } });

    expect(gsapMock.timelines[0].kill).toHaveBeenCalledOnce();
    expect(shell).not.toHaveAttribute('inert');
    expect(container.querySelector('[data-landing-intro]')).toHaveStyle({
      visibility: 'hidden',
    });

    gsapMock.mediaHandlers[0]({ conditions: { reduceMotion: false } });
    await Promise.resolve();

    expect(gsapMock.timelines).toHaveLength(1);
  });

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
    expect(css).not.toMatch(/\.shell\s*\{[\s\S]*?transform:\s*scale\(/);
  });

  it('does not create a timeline when unmounted before fonts are ready', async () => {
    gsapMock.enabled = true;
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });
    let resolveFonts: (() => void) | undefined;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: fontsReady },
    });

    const { unmount } = render(<LandingIntro />);
    unmount();
    resolveFonts?.();
    await fontsReady;
    await Promise.resolve();

    expect(gsapMock.timelines).toHaveLength(0);

  });

  it('starts the intro if font readiness never resolves', async () => {
    vi.useFakeTimers();
    gsapMock.enabled = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: vi.fn(() => 120),
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>(() => undefined) },
    });

    render(<LandingIntro />);
    await Promise.resolve();
    expect(gsapMock.timelines).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(gsapMock.timelines).toHaveLength(1);
  });
});
