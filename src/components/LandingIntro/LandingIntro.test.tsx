import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import LandingIntro from './LandingIntro';

type TweenVars = Record<string, unknown> & { onComplete?: () => void };

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
    ) => {
      useLayoutEffect(() => {
        if (!gsapMock.enabled) return;
        return callback(
          {},
          gsapMock.omitContextSafe ? undefined : (safeCallback) => safeCallback,
        );
      }, [callback]);
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

beforeEach(() => {
  gsapMock.enabled = false;
  gsapMock.reduceMotion = false;
  gsapMock.omitContextSafe = false;
  gsapMock.sets.length = 0;
  gsapMock.timelines.length = 0;
  gsapMock.moves.length = 0;
  gsapMock.mediaHandlers.length = 0;
  gsapMock.mediaConditions.length = 0;
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
