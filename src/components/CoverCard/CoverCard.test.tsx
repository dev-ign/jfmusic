import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CoverCard from './CoverCard';

type TweenVars = Record<string, unknown>;

const gsapMock = vi.hoisted(() => ({
  reduceMotion: false,
  registerPlugin: vi.fn(),
  rotationTweens: [] as Array<{
    target: unknown;
    vars: TweenVars;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    timeScale: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
  }>,
  timeScaleTweens: [] as Array<{
    target: unknown;
    vars: TweenVars;
    kill: ReturnType<typeof vi.fn>;
  }>,
  hookCleanups: 0,
}));

vi.mock('@gsap/react', async () => {
  const { useLayoutEffect } = await vi.importActual<typeof import('react')>('react');

  const useGSAP = (
    callback: () => void | (() => void),
    config?: { dependencies?: unknown[] },
  ) => {
    useLayoutEffect(() => {
      const hookCleanup = callback();

      return () => {
        hookCleanup?.();
        gsapMock.hookCleanups += 1;
      };
    }, config?.dependencies ?? []); // eslint-disable-line react-hooks/exhaustive-deps
  };

  return { useGSAP };
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: gsapMock.registerPlugin,
    to: vi.fn((target: unknown, vars: TweenVars) => {
      if (target instanceof HTMLImageElement) {
        const tween = {
          target,
          vars,
          play: vi.fn(),
          pause: vi.fn(),
          timeScale: vi.fn(),
          kill: vi.fn(),
        };
        gsapMock.rotationTweens.push(tween);
        return tween;
      }

      const tween = { target, vars, kill: vi.fn() };
      gsapMock.timeScaleTweens.push(tween);
      return tween;
    }),
  },
}));

afterEach(cleanup);

beforeEach(() => {
  gsapMock.reduceMotion = false;
  gsapMock.rotationTweens.length = 0;
  gsapMock.timeScaleTweens.length = 0;
  gsapMock.hookCleanups = 0;
  gsapMock.registerPlugin.mockClear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: gsapMock.reduceMotion,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('CoverCard', () => {
  it('creates one paused infinite artwork tween and reuses it across state changes', () => {
    const { rerender } = render(<CoverCard coverSrc="/cover.png" />);

    expect(gsapMock.rotationTweens).toHaveLength(1);
    expect(gsapMock.rotationTweens[0]?.target).toBe(
      screen.getByRole('img', {
        name: 'Caramelo single cover art by Jona Ferreira',
      }),
    );
    expect(gsapMock.rotationTweens[0]?.vars).toMatchObject({
      rotation: '+=360',
      duration: 48,
      ease: 'none',
      repeat: -1,
      paused: true,
    });

    rerender(<CoverCard coverSrc="/cover.png" isPlaying />);
    rerender(<CoverCard coverSrc="/cover.png" isSettling />);
    rerender(<CoverCard coverSrc="/cover.png" />);

    expect(gsapMock.rotationTweens).toHaveLength(1);
  });

  it('resumes the existing tween at normal speed when playing', () => {
    const { rerender } = render(<CoverCard coverSrc="/cover.png" />);
    const rotationTween = gsapMock.rotationTweens[0]!;

    rerender(<CoverCard coverSrc="/cover.png" isPlaying />);

    expect(rotationTween.timeScale).toHaveBeenCalledWith(1);
    expect(rotationTween.play).toHaveBeenCalledOnce();
  });

  it('pauses at the current rotation when playback becomes idle', () => {
    const { rerender } = render(<CoverCard coverSrc="/cover.png" isPlaying />);
    const rotationTween = gsapMock.rotationTweens[0]!;
    rotationTween.pause.mockClear();

    rerender(<CoverCard coverSrc="/cover.png" />);

    expect(rotationTween.pause).toHaveBeenCalledOnce();
  });

  it('keeps rotation running while settling its time scale smoothly to zero', () => {
    const { rerender } = render(<CoverCard coverSrc="/cover.png" isPlaying />);
    const rotationTween = gsapMock.rotationTweens[0]!;
    rotationTween.play.mockClear();

    rerender(<CoverCard coverSrc="/cover.png" isSettling />);

    expect(rotationTween.play).toHaveBeenCalledOnce();
    expect(gsapMock.timeScaleTweens).toHaveLength(1);
    expect(gsapMock.timeScaleTweens[0]?.target).toBe(rotationTween);
    expect(gsapMock.timeScaleTweens[0]?.vars).toMatchObject({
      timeScale: 0,
      duration: 1.6,
      ease: 'power3.out',
    });

    rerender(<CoverCard coverSrc="/cover.png" isPlaying />);

    expect(gsapMock.timeScaleTweens[0]?.kill).toHaveBeenCalledOnce();
    expect(rotationTween.timeScale).toHaveBeenLastCalledWith(1);
  });

  it('creates no rotation tween when reduced motion is preferred', () => {
    gsapMock.reduceMotion = true;

    render(<CoverCard coverSrc="/cover.png" isPlaying />);

    expect(gsapMock.rotationTweens).toHaveLength(0);
  });

  it('kills active tweens through useGSAP cleanup', () => {
    const { rerender, unmount } = render(
      <CoverCard coverSrc="/cover.png" isPlaying />,
    );
    const rotationTween = gsapMock.rotationTweens[0]!;

    rerender(<CoverCard coverSrc="/cover.png" isSettling />);
    const timeScaleTween = gsapMock.timeScaleTweens[0]!;
    unmount();

    expect(rotationTween.kill).toHaveBeenCalledOnce();
    expect(timeScaleTween.kill).toHaveBeenCalledOnce();
    expect(gsapMock.hookCleanups).toBeGreaterThan(0);
  });

  it('exposes idle, playing, and settling playback states with settling precedence', () => {
    const { container, rerender } = render(<CoverCard coverSrc="/cover.png" />);
    const coverCard = container.firstElementChild;

    expect(coverCard).toHaveAttribute('data-playback-state', 'idle');

    rerender(<CoverCard coverSrc="/cover.png" isPlaying />);

    expect(coverCard).toHaveAttribute('data-playback-state', 'playing');

    rerender(<CoverCard coverSrc="/cover.png" isSettling />);

    expect(coverCard).toHaveAttribute('data-playback-state', 'settling');

    rerender(<CoverCard coverSrc="/cover.png" isPlaying isSettling />);

    expect(coverCard).toHaveAttribute('data-playback-state', 'settling');
  });

  it('flips between the cover art and credits back side', () => {
    const { container } = render(<CoverCard coverSrc="/cover.png" />);

    expect(
      screen.getByRole('img', {
        name: 'Caramelo single cover art by Jona Ferreira',
      }),
    ).toHaveAttribute('src', '/cover.png');
    expect(screen.getByText('Written')).toBeInTheDocument();
    expect(screen.getAllByText('Jona Ferreira')).toHaveLength(2);

    const button = screen.getByRole('button', { name: 'Show credits' });
    expect(button).toHaveTextContent('Credits');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(container.firstElementChild?.className).not.toContain('flipped');

    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'Show cover art' })).toHaveTextContent(
      'Cover',
    );
    expect(screen.getByRole('button', { name: 'Show cover art' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.firstElementChild?.className).toContain('flipped');

    fireEvent.click(screen.getByRole('button', { name: 'Show cover art' }));

    expect(screen.getByRole('button', { name: 'Show credits' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
