'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import styles from './AudioPreview.module.scss';

interface AudioPreviewProps {
  audioSrc: string;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onQualifiedFinish?: (reset: () => void) => void;
}

interface PendingReset {
  active: boolean;
  generation: number;
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 3.5L16.5 10 5 16.5V3.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="12" y="3" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function AudioPreview({
  audioSrc,
  onPlaybackChange,
  onQualifiedFinish,
}: AudioPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const isPlayingRef = useRef(false);
  const peakPlaybackProgressRef = useRef(0);
  const generationRef = useRef(0);
  const pendingResetRef = useRef<PendingReset | null>(null);
  const onPlaybackChangeRef = useRef(onPlaybackChange);
  const onQualifiedFinishRef = useRef(onQualifiedFinish);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    onPlaybackChangeRef.current = onPlaybackChange;
    onQualifiedFinishRef.current = onQualifiedFinish;
  }, [onPlaybackChange, onQualifiedFinish]);

  useEffect(() => {
    if (!containerRef.current) return;

    const generation = generationRef.current + 1;
    generationRef.current = generation;

    const previousReset = pendingResetRef.current;
    if (previousReset) previousReset.active = false;
    pendingResetRef.current = null;

    if (isPlayingRef.current) {
      onPlaybackChangeRef.current?.(false);
    }
    isPlayingRef.current = false;
    peakPlaybackProgressRef.current = 0;
    setIsPlaying(false);
    setIsLoading(true);
    setHasError(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.35)',
      progressColor: '#c97832',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 5,
      barRadius: 2,
      height: 36,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    void Promise.resolve(ws.load(audioSrc)).catch(() => {
      // WaveSurfer's error event owns the visible error state.
    });

    ws.on('ready', () => {
      setIsLoading(false);
    });

    const reportPlayback = (playing: boolean) => {
      if (isPlayingRef.current === playing) return;

      isPlayingRef.current = playing;
      setIsPlaying(playing);
      onPlaybackChangeRef.current?.(playing);
    };

    ws.on('play', () => {
      const pendingReset = pendingResetRef.current;
      if (pendingReset?.generation === generation) {
        pendingReset.active = false;
        pendingResetRef.current = null;
        peakPlaybackProgressRef.current = 0;
      }

      reportPlayback(true);
    });
    ws.on('pause', () => reportPlayback(false));

    ws.on('audioprocess', (currentTime) => {
      if (!isPlayingRef.current) return;

      const duration = ws.getDuration();
      if (duration <= 0) return;

      peakPlaybackProgressRef.current = Math.max(
        peakPlaybackProgressRef.current,
        Math.min(currentTime / duration, 1),
      );
    });

    ws.on('finish', () => {
      reportPlayback(false);

      const pendingReset: PendingReset = {
        active: true,
        generation,
      };
      pendingResetRef.current = pendingReset;

      const reset = () => {
        if (!pendingReset.active) return;

        pendingReset.active = false;
        if (pendingResetRef.current === pendingReset) {
          pendingResetRef.current = null;
        }
        if (
          generationRef.current !== generation ||
          wavesurferRef.current !== ws
        ) {
          return;
        }

        ws.seekTo(0);
        peakPlaybackProgressRef.current = 0;
      };

      const onQualifiedFinish = onQualifiedFinishRef.current;
      if (peakPlaybackProgressRef.current >= 0.85 && onQualifiedFinish) {
        onQualifiedFinish(reset);
        return;
      }

      reset();
    });

    ws.on('error', () => {
      setHasError(true);
      setIsLoading(false);
    });

    return () => {
      const pendingReset = pendingResetRef.current;
      if (pendingReset?.generation === generation) {
        pendingReset.active = false;
        pendingResetRef.current = null;
      }
      if (wavesurferRef.current === ws) {
        wavesurferRef.current = null;
      }
      ws.destroy();
    };
  }, [audioSrc]);

  function handlePlayPause() {
    wavesurferRef.current?.playPause();
  }

  return (
    <div className={styles['audio-preview']}>
      <button
        className={styles['audio-preview__play-btn']}
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        disabled={isLoading || hasError}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className={styles['audio-preview__waveform-area']}>
        {hasError ? (
          <p className={styles['audio-preview__error']}>Preview unavailable</p>
        ) : null}
        <div
          ref={containerRef}
          className={`${styles['audio-preview__waveform']} ${isLoading ? styles['audio-preview__waveform--loading'] : ''}`}
        />
      </div>
    </div>
  );
}
