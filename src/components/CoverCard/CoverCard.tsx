'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import styles from './CoverCard.module.scss';

gsap.registerPlugin(useGSAP);

interface CoverCardProps {
  coverSrc: string;
  isPlaying?: boolean;
  isSettling?: boolean;
}

export default function CoverCard({
  coverSrc,
  isPlaying = false,
  isSettling = false,
}: CoverCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rotationTweenRef = useRef<gsap.core.Tween | null>(null);
  const timeScaleTweenRef = useRef<gsap.core.Tween | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const actionLabel = showCredits ? 'Show cover art' : 'Show credits';
  const playbackState = isSettling ? 'settling' : isPlaying ? 'playing' : 'idle';

  useGSAP(
    () => {
      const image = imageRef.current;
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

      if (!image || prefersReducedMotion) return;

      const rotationTween = gsap.to(image, {
        rotation: '+=360',
        duration: 48,
        ease: 'none',
        repeat: -1,
        paused: true,
      });
      rotationTweenRef.current = rotationTween;

      return () => {
        rotationTween.kill();
        rotationTweenRef.current = null;
      };
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      const rotationTween = rotationTweenRef.current;

      if (!rotationTween) return;

      timeScaleTweenRef.current?.kill();
      timeScaleTweenRef.current = null;

      if (playbackState === 'playing') {
        rotationTween.timeScale?.(1);
        rotationTween.play?.();
        return;
      }

      if (playbackState === 'settling') {
        rotationTween.play?.();
        const timeScaleTween = gsap.to(rotationTween, {
          timeScale: 0,
          duration: 1.6,
          ease: 'power3.out',
        });
        timeScaleTweenRef.current = timeScaleTween;

        return () => {
          timeScaleTween.kill();
          if (timeScaleTweenRef.current === timeScaleTween) {
            timeScaleTweenRef.current = null;
          }
        };
      }

      rotationTween.pause?.();
    },
    {
      dependencies: [playbackState],
      scope: rootRef,
      revertOnUpdate: true,
    },
  );

  return (
    <div
      ref={rootRef}
      className={`${styles['cover-card']} ${showCredits ? styles['cover-card--flipped'] : ''}`}
      data-playback-state={playbackState}
    >
      <div className={styles['cover-card__stage']}>
        <div className={styles['cover-card__inner']}>
          <div className={`${styles['cover-card__face']} ${styles['cover-card__face--front']}`}>
            {/* Context menu is suppressed as a UI-layer gesture. This is not true DRM:
                the browser delivers the asset and it can be extracted by determined users.
                Real protection is the 30s preview limit and future signed URL rotation. */}
            <img
              ref={imageRef}
              src={coverSrc}
              alt="Caramelo single cover art by Jona Ferreira"
              className={styles['cover-card__image']}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          <div
            className={`${styles['cover-card__face']} ${styles['cover-card__face--back']}`}
            aria-hidden={!showCredits}
          >
            <dl className={styles['cover-card__credits']}>
              <div className={styles['cover-card__credit']}>
                <dt>Written</dt>
                <dd>Jona Ferreira</dd>
              </div>
              <div className={styles['cover-card__credit']}>
                <dt>Composed</dt>
                <dd>Jona Ferreira</dd>
              </div>
              <div className={styles['cover-card__credit']}>
                <dt>Produced</dt>
                <dd>SbFaraon</dd>
              </div>
              <div className={styles['cover-card__credit']}>
                <dt>Mixed</dt>
                <dd>SbFaraon</dd>
              </div>
              <div className={styles['cover-card__credit']}>
                <dt>Mastered</dt>
                <dd>SbFaraon</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className={styles['cover-card__pills']}>
        <button
          type="button"
          className={styles['cover-card__pill']}
          aria-label={actionLabel}
          aria-pressed={showCredits}
          onClick={() => setShowCredits((value) => !value)}
        >
          {showCredits ? 'Cover' : 'Credits'}
        </button>
      </div>
    </div>
  );
}
