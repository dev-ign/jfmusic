'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import ActionButtons from '@/components/ActionButtons/ActionButtons';
import ArtistHeader from '@/components/ArtistHeader/ArtistHeader';
import AudioPreview from '@/components/AudioPreview/AudioPreview';
import CoverCard from '@/components/CoverCard/CoverCard';
import PostPreviewModal from '@/components/PostPreviewModal/PostPreviewModal';
import SignatureLogo from '@/components/SignatureLogo/SignatureLogo';
import TrackInfo from '@/components/TrackInfo/TrackInfo';
import { MEDIA_ENDPOINTS } from '@/lib/mediaEndpoints';
import {
  canShowPostPreviewPrompt,
  markPostPreviewPromptShown,
  recordPostPreviewDismissal,
  recordPreviewCompletion,
} from '@/lib/postPreviewPrompt';

import { calculatePathSchedule, calculateSignatureTransform } from './animationGeometry';
import styles from './LandingIntro.module.scss';

gsap.registerPlugin(useGSAP);

const DRAW_DURATION = 4.2;
const DRAW_OVERLAP = 0.12;
const HANDOFF_DURATION = 1.25;
const RESOLVE_DURATION = 0.65;
const HIDDEN_DASH_PADDING = 40;
const FONT_READY_FALLBACK_MS = 800;
const POST_PREVIEW_SETTLE_MS = 450;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export default function LandingIntro() {
  const rootRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const introSignatureRef = useRef<SVGSVGElement>(null);
  const headerSignatureRef = useRef<SVGSVGElement>(null);
  const metadataRef = useRef<HTMLParagraphElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const promptReservedInMemoryRef = useRef(false);
  const pendingResetRef = useRef<(() => void) | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const resetFrameRef = useRef<number | null>(null);
  const introHasCompletedRef = useRef(false);
  const modalMountedRef = useRef(false);
  const modalCommitHandledRef = useRef(false);
  const dismissalRecordedRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isCoverSettling, setIsCoverSettling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalMounted, setIsModalMounted] = useState(false);

  const consumePendingReset = () => {
    if (resetFrameRef.current !== null) {
      window.cancelAnimationFrame(resetFrameRef.current);
      resetFrameRef.current = null;
    }

    const pendingReset = pendingResetRef.current;
    pendingResetRef.current = null;
    pendingReset?.();
  };

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      modalMountedRef.current = false;
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (modalCommitHandledRef.current) {
        consumePendingReset();
      } else {
        if (resetFrameRef.current !== null) {
          window.cancelAnimationFrame(resetFrameRef.current);
          resetFrameRef.current = null;
        }
        pendingResetRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (isModalMounted) {
      shell.inert = true;
      shell.setAttribute('inert', '');
      shell.setAttribute('aria-hidden', 'true');
      return;
    }

    shell.removeAttribute('aria-hidden');
    if (introHasCompletedRef.current) {
      shell.inert = false;
      shell.removeAttribute('inert');
    }
  }, [isModalMounted]);

  useEffect(() => {
    if (!isModalMounted || !isModalOpen) return;

    if (!modalCommitHandledRef.current) {
      modalCommitHandledRef.current = true;
      markPostPreviewPromptShown();
    }

    const pendingReset = pendingResetRef.current;
    if (!pendingReset || resetFrameRef.current !== null) return;

    const resetFrame = window.requestAnimationFrame(() => {
      if (resetFrameRef.current === resetFrame) {
        resetFrameRef.current = null;
      }
      if (isUnmountedRef.current) return;
      consumePendingReset();
    });
    resetFrameRef.current = resetFrame;

    return () => {
      if (resetFrameRef.current === resetFrame) {
        window.cancelAnimationFrame(resetFrame);
        resetFrameRef.current = null;
      }
    };
  }, [isModalMounted, isModalOpen]);

  const handleQualifiedFinish = (reset: () => void) => {
    recordPreviewCompletion();

    if (promptReservedInMemoryRef.current || !canShowPostPreviewPrompt()) {
      reset();
      return;
    }

    promptReservedInMemoryRef.current = true;
    modalCommitHandledRef.current = false;
    dismissalRecordedRef.current = false;
    pendingResetRef.current = reset;
    setIsCoverSettling(true);

    const prefersReducedMotion =
      window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
    const settleDelay = prefersReducedMotion ? 0 : POST_PREVIEW_SETTLE_MS;

    const showModal = () => {
      settleTimerRef.current = null;
      if (isUnmountedRef.current) return;

      modalMountedRef.current = true;
      setIsModalMounted(true);
      setIsModalOpen(true);
    };

    if (settleDelay === 0) {
      showModal();
      return;
    }

    settleTimerRef.current = window.setTimeout(showModal, settleDelay);
  };

  const handleModalClose = () => {
    if (dismissalRecordedRef.current) return;

    dismissalRecordedRef.current = true;
    consumePendingReset();
    recordPostPreviewDismissal();
    setIsModalOpen(false);
  };

  const handleModalExited = () => {
    modalMountedRef.current = false;
    pendingResetRef.current = null;
    setIsModalMounted(false);
    setIsCoverSettling(false);
  };

  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const shell = shellRef.current;
      const overlay = overlayRef.current;
      const introSignature = introSignatureRef.current;
      const headerSignature = headerSignatureRef.current;
      const metadata = metadataRef.current;
      const revealTargets = [
        coverRef.current,
        trackRef.current,
        audioRef.current,
        actionsRef.current,
      ].filter((target): target is HTMLDivElement => target !== null);

      if (
        !root ||
        !shell ||
        !overlay ||
        !introSignature ||
        !headerSignature ||
        !metadata
      ) {
        return;
      }

      const contextSafeCallback =
        contextSafe ??
        (<T extends (...args: never[]) => unknown>(callback: T) => callback);
      let cancelled = false;
      let finalized = false;
      let normalMotionStarted = false;
      let fontReadyFallback: number | undefined;
      const activeAnimations: Array<{ kill: () => void }> = [];

      const killActiveAnimations = () => {
        activeAnimations.splice(0).forEach((animation) => animation.kill());
      };

      const restoreInteraction = () => {
        introHasCompletedRef.current = true;
        if (modalMountedRef.current) return;

        shell.inert = false;
        shell.removeAttribute('inert');
        window.dispatchEvent(new Event('resize'));
      };

      const showFinalState = () => {
        if (cancelled) return;

        finalized = true;
        killActiveAnimations();
        gsap.set(headerSignature, { autoAlpha: 1, clearProps: 'transform' });
        gsap.set(introSignature, { willChange: 'auto' });
        gsap.set([metadata, ...revealTargets], {
          autoAlpha: 1,
          y: 0,
          clearProps: 'transform',
        });
        gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'none' });
        restoreInteraction();
      };

      gsap.set(headerSignature, { autoAlpha: 0 });
      gsap.set(metadata, { autoAlpha: 0 });
      gsap.set(coverRef.current, { autoAlpha: 0, y: 18 });
      gsap.set([trackRef.current, audioRef.current, actionsRef.current], {
        autoAlpha: 0,
        y: 12,
      });
      gsap.set(overlay, { autoAlpha: 1 });

      const startNormalMotion = contextSafeCallback(() => {
        if (cancelled || finalized || normalMotionStarted) return;
        normalMotionStarted = true;

        const drawPaths = Array.from(
          introSignature.querySelectorAll<SVGPathElement>('.signature-draw-path'),
        )
          .map((path) => ({ path, length: path.getTotalLength() }))
          .filter(({ length }) => length > 0);
        const revealMaskPaths = Array.from(
          introSignature.querySelectorAll<SVGPathElement>(
            '.signature-reveal-mask-path',
          ),
        );
        const fillLayer = introSignature.querySelector<SVGGElement>(
          '.signature-fill-layer',
        );

        drawPaths.forEach(({ path, length }) => {
          gsap.set(path, {
            strokeDasharray: length,
            strokeDashoffset: length + HIDDEN_DASH_PADDING,
            strokeOpacity: 0,
          });
        });
        revealMaskPaths.forEach((path) => {
          const length = path.getTotalLength();

          gsap.set(path, {
            strokeDasharray: length,
            strokeDashoffset: length + HIDDEN_DASH_PADDING,
            strokeOpacity: 0,
          });
        });
        if (fillLayer) {
          gsap.set(fillLayer, { autoAlpha: 1 });
        }

        const buildIntro = contextSafeCallback(() => {
          if (cancelled || finalized) return;

          const schedule = calculatePathSchedule(
            drawPaths.map(({ length }) => length),
            DRAW_DURATION,
            DRAW_OVERLAP,
          );

          const moveToHeader = contextSafeCallback(() => {
            if (cancelled || finalized) return;

            const transform = calculateSignatureTransform(
              introSignature.getBoundingClientRect(),
              headerSignature.getBoundingClientRect(),
            );

            const movement = gsap.to(introSignature, {
              ...transform,
              duration: HANDOFF_DURATION,
              ease: 'power3.inOut',
              transformOrigin: 'center center',
              onComplete: contextSafeCallback(() => {
                if (cancelled || finalized) return;

                gsap.set(headerSignature, { autoAlpha: 1 });
                gsap.set(introSignature, { willChange: 'auto' });
                gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'none' });

                const revealTimeline = gsap.timeline({
                  defaults: { duration: 0.6, ease: 'power2.out' },
                  onComplete: contextSafeCallback(() => {
                    if (cancelled || finalized) return;
                    finalized = true;
                    restoreInteraction();
                  }),
                });
                activeAnimations.push(revealTimeline);
                revealTimeline
                  .to(metadata, { autoAlpha: 1, y: 0 }, 0)
                  .to(
                    revealTargets,
                    { autoAlpha: 1, y: 0, stagger: 0.1 },
                    0.1,
                  );
              }),
            });
            activeAnimations.push(movement);
          });

          const drawTimeline = gsap.timeline({ onComplete: moveToHeader });
          activeAnimations.push(drawTimeline);

          drawPaths.forEach(({ path }, index) => {
            const revealMaskPath = revealMaskPaths[index];

            drawTimeline.to(
              path,
              {
                strokeOpacity: 1,
                duration: 0.01,
                ease: 'none',
              },
              schedule[index].at,
            );

            drawTimeline.to(
              path,
              {
                strokeDashoffset: 0,
                duration: schedule[index].duration,
                ease: 'sine.inOut',
              },
              schedule[index].at,
            );

            if (revealMaskPath) {
              drawTimeline.to(
                revealMaskPath,
                {
                  strokeOpacity: 1,
                  duration: 0.01,
                  ease: 'none',
                },
                schedule[index].at,
              );

              drawTimeline.to(
                revealMaskPath,
                {
                  strokeDashoffset: 0,
                  duration: schedule[index].duration,
                  ease: 'sine.inOut',
                },
                schedule[index].at,
              );
            }
          });

          drawTimeline.to(
            drawPaths.map(({ path }) => path),
            {
              strokeOpacity: 0,
              duration: RESOLVE_DURATION,
              ease: 'power2.out',
            },
            '>-0.05',
          );
        });

        const startIntro = contextSafeCallback(() => {
          if (!cancelled && !finalized) buildIntro();
        });

        const fontReady = document.fonts?.ready ?? Promise.resolve();
        const fallbackReady = new Promise<void>((resolve) => {
          fontReadyFallback = window.setTimeout(resolve, FONT_READY_FALLBACK_MS);
        });

        void Promise.race([fontReady, fallbackReady]).then(startIntro);
      });

      const finalizeForMotionPreference = contextSafeCallback(showFinalState);
      const motionPreference = gsap.matchMedia();

      motionPreference.add(
        {
          all: 'all',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (mediaContext) => {
          if (mediaContext.conditions?.reduceMotion) {
            finalizeForMotionPreference();
          } else if (!finalized) {
            startNormalMotion();
          }
        },
      );

      return () => {
        cancelled = true;
        if (fontReadyFallback) {
          window.clearTimeout(fontReadyFallback);
        }
        motionPreference.revert();
        killActiveAnimations();
      };
    },
    { scope: rootRef },
  );

  return (
    <main ref={rootRef} className={styles.page}>
      <div
        ref={overlayRef}
        className={styles.overlay}
        data-landing-intro
        aria-hidden="true"
      >
        <div className={styles['overlay__signature']}>
          <SignatureLogo ref={introSignatureRef} variant="intro" />
        </div>
      </div>

      <div
        ref={shellRef}
        className={`${styles.shell} ${isModalMounted ? styles['shell--blocked'] : ''}`}
        data-landing-shell
        inert
      >
        <div className={styles['artist-slot']}>
          <ArtistHeader
            signatureRef={headerSignatureRef}
            metadataRef={metadataRef}
          />
        </div>
        <div ref={coverRef} className={styles.item}>
          <CoverCard
            coverSrc={MEDIA_ENDPOINTS.cover}
            isPlaying={isPreviewPlaying}
            isSettling={isCoverSettling}
          />
        </div>
        <div ref={trackRef} className={styles.item}>
          <TrackInfo />
        </div>
        <div ref={audioRef} className={styles.item}>
          <AudioPreview
            audioSrc={MEDIA_ENDPOINTS.preview}
            onPlaybackChange={setIsPreviewPlaying}
            onQualifiedFinish={handleQualifiedFinish}
          />
        </div>
        <div ref={actionsRef} className={styles.item}>
          <ActionButtons />
        </div>
      </div>

      {isModalMounted ? (
        <PostPreviewModal
          isOpen={isModalOpen}
          onRequestClose={handleModalClose}
          onExited={handleModalExited}
        />
      ) : null}
    </main>
  );
}
