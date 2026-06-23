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
  default: ({
    isPlaying,
    isSettling,
  }: {
    isPlaying?: boolean;
    isSettling?: boolean;
  }) => (
    <div
      data-testid="cover-card"
      data-playing={String(Boolean(isPlaying))}
      data-settling={String(Boolean(isSettling))}
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
  it('passes preview playback state through to the cover', () => {
    render(<LandingIntro />);

    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-playing',
      'false',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Report preview playing' }),
    );

    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-playing',
      'true',
    );
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
    expect(screen.getByTestId('cover-card')).toHaveAttribute(
      'data-settling',
      'true',
    );
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

  it('resets immediately without mounting the modal when eligibility is denied', () => {
    orchestrationMock.canShow = false;

    render(<LandingIntro />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Report qualified finish' }),
    );

    expect(orchestrationMock.recordCompletion).toHaveBeenCalledOnce();
    expect(orchestrationMock.markShown).not.toHaveBeenCalled();
    expect(orchestrationMock.reset).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('post-preview-modal')).not.toBeInTheDocument();
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

  it('does not reopen after a second qualified finish on the same mounted page', () => {
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

    expect(orchestrationMock.markShown).toHaveBeenCalledOnce();
    expect(orchestrationMock.reset).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('post-preview-modal')).not.toBeInTheDocument();
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
      screen.getByRole('link', { name: 'Listen to Caramelo on Spotify' }),
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

  it('provides a bounded internally scrollable viewport', () => {
    const css = readFileSync(
      'src/components/LandingIntro/LandingIntro.module.scss',
      'utf8',
    );
    const pageRule = css.match(/\.page\s*\{([^}]*)\}/)?.[1];

    expect(pageRule).toMatch(/height:\s*100svh/);
    expect(pageRule).toMatch(/overflow-y:\s*auto/);
    expect(pageRule).toMatch(/overflow-x:\s*hidden/);
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
