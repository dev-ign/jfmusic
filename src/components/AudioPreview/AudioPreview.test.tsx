import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AudioPreview from './AudioPreview';

const wavesurferMock = vi.hoisted(() => ({
  create: vi.fn(),
  instances: [] as Array<{
    destroy: ReturnType<typeof vi.fn>;
    getDuration: ReturnType<typeof vi.fn>;
    handlers: Map<string, (...args: unknown[]) => void>;
    load: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    playPause: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('wavesurfer.js', () => ({
  default: {
    create: wavesurferMock.create,
  },
}));

beforeEach(() => {
  wavesurferMock.instances.length = 0;
  wavesurferMock.create.mockReset();
  wavesurferMock.create.mockImplementation(() => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const instance = {
      destroy: vi.fn(),
      getDuration: vi.fn(() => 100),
      handlers,
      load: vi.fn(() => Promise.resolve()),
      on: vi.fn(
        (event: string, handler: (...args: unknown[]) => void) => {
          handlers.set(event, handler);
          return () => handlers.delete(event);
        },
      ),
      playPause: vi.fn(),
      seekTo: vi.fn(),
    };
    wavesurferMock.instances.push(instance);
    return instance;
  });
});

afterEach(cleanup);

function getInstance(index = wavesurferMock.instances.length - 1) {
  const instance = wavesurferMock.instances[index];
  if (!instance) throw new Error(`Missing WaveSurfer instance ${index}`);
  return instance;
}

function emit(event: string, ...args: unknown[]) {
  act(() => {
    getInstance().handlers.get(event)?.(...args);
  });
}

function emitFrom(
  instance: ReturnType<typeof getInstance>,
  event: string,
  ...args: unknown[]
) {
  act(() => {
    instance.handlers.get(event)?.(...args);
  });
}

describe('AudioPreview', () => {
  it('renders a waveform-only preview without time labels', () => {
    render(<AudioPreview audioSrc="/preview.mp3" />);

    expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    expect(wavesurferMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        barGap: 5,
        barWidth: 2,
        height: 36,
      }),
    );
    expect(getInstance().on).not.toHaveBeenCalledWith(
      'timeupdate',
      expect.any(Function),
    );
  });

  it('shows the waveform area by default', () => {
    const { container } = render(<AudioPreview audioSrc="/preview.mp3" />);
    expect(container.querySelector('[class*="waveform-area"]')).not.toBeNull();
  });

  it('suppresses the waveform area when showWaveform is false', () => {
    const { container } = render(
      <AudioPreview audioSrc="/preview.mp3" showWaveform={false} />,
    );
    expect(container.querySelector('[class*="waveform-area"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeInTheDocument();
  });

  it('reports play, pause, replay, and finish state transitions', () => {
    const onPlaybackChange = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onPlaybackChange={onPlaybackChange}
      />,
    );

    emit('play');
    emit('pause');
    emit('play');
    emit('finish');

    expect(onPlaybackChange.mock.calls).toEqual([
      [true],
      [false],
      [true],
      [false],
    ]);
  });

  it('does not report duplicate playback event notifications', () => {
    const onPlaybackChange = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onPlaybackChange={onPlaybackChange}
      />,
    );

    emit('play');
    emit('play');
    emit('pause');
    emit('pause');

    expect(onPlaybackChange.mock.calls).toEqual([[true], [false]]);
  });

  it('does not qualify when real playback remains below 90 percent', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('play');
    emit('audioprocess', 89);

    expect(onQualifiedFinish).not.toHaveBeenCalled();
  });

  it('qualifies as soon as real playback reaches 90 percent', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('play');
    emit('audioprocess', 90);

    expect(onQualifiedFinish).toHaveBeenCalledTimes(1);
    expect(getInstance().seekTo).not.toHaveBeenCalled();
  });

  it('opens only once while the same playback continues', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('play');
    emit('audioprocess', 90);
    emit('audioprocess', 95);
    emit('audioprocess', 100);

    expect(onQualifiedFinish).toHaveBeenCalledTimes(1);
  });

  it('qualifies again on the next playback after finishing', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('play');
    emit('audioprocess', 90);
    emit('finish');
    emit('play');
    emit('audioprocess', 90);

    expect(onQualifiedFinish).toHaveBeenCalledTimes(2);
  });

  it('resets the waveform when playback finishes', () => {
    render(<AudioPreview audioSrc="/preview.mp3" />);

    emit('play');
    emit('audioprocess', 90);
    emit('finish');

    expect(getInstance().seekTo).toHaveBeenCalledWith(0);
  });

  it('ignores audioprocess progress before real playback starts', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('audioprocess', 100);

    expect(onQualifiedFinish).not.toHaveBeenCalled();
  });

  it('ignores audioprocess progress after playback pauses', () => {
    const onQualifiedFinish = vi.fn();

    render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onQualifiedFinish={onQualifiedFinish}
      />,
    );

    emit('play');
    emit('pause');
    emit('audioprocess', 90);

    expect(onQualifiedFinish).not.toHaveBeenCalled();
  });

  it('does not recreate WaveSurfer when parent callback identities change', () => {
    const { rerender } = render(
      <AudioPreview
        audioSrc="/preview.mp3"
        onPlaybackChange={vi.fn()}
        onQualifiedFinish={vi.fn()}
      />,
    );

    rerender(
      <AudioPreview
        audioSrc="/preview.mp3"
        onPlaybackChange={vi.fn()}
        onQualifiedFinish={vi.fn()}
      />,
    );

    expect(wavesurferMock.create).toHaveBeenCalledTimes(1);
    expect(getInstance().destroy).not.toHaveBeenCalled();
  });

  it('preserves ready and error states for the play control', () => {
    render(<AudioPreview audioSrc="/preview.mp3" />);

    const button = screen.getByRole('button', { name: 'Play preview' });
    expect(button).toBeDisabled();

    emit('ready');
    expect(button).toBeEnabled();

    emit('error');
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('recovers from an error when the audio source changes', () => {
    const { container, rerender } = render(
      <AudioPreview audioSrc="/broken-preview.mp3" />,
    );
    const firstInstance = getInstance();

    emitFrom(firstInstance, 'error');
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(container.querySelector('[class*="waveform"]')).not.toBeNull();

    rerender(<AudioPreview audioSrc="/working-preview.mp3" />);
    const secondInstance = getInstance();

    expect(wavesurferMock.create).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Preview unavailable')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();

    emitFrom(secondInstance, 'ready');
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled();
  });

  it('attaches a rejection handler to the load promise', async () => {
    const loadPromise = Promise.reject(new Error('load failed'));
    const catchSpy = vi.spyOn(loadPromise, 'catch');
    wavesurferMock.create.mockImplementationOnce(() => {
      const handlers = new Map<string, (...args: unknown[]) => void>();
      const instance = {
        destroy: vi.fn(),
        getDuration: vi.fn(() => 100),
        handlers,
        load: vi.fn(() => loadPromise),
        on: vi.fn(
          (event: string, handler: (...args: unknown[]) => void) => {
            handlers.set(event, handler);
            return () => handlers.delete(event);
          },
        ),
        playPause: vi.fn(),
        seekTo: vi.fn(),
      };
      wavesurferMock.instances.push(instance);
      return instance;
    });

    render(<AudioPreview audioSrc="/rejected-preview.mp3" />);

    expect(catchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getInstance().load).toHaveBeenCalledWith('/rejected-preview.mp3');
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();
  });
});
