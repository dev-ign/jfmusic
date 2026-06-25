'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import ArtistHeader from '@/components/ArtistHeader/ArtistHeader';
import AudioPreview from '@/components/AudioPreview/AudioPreview';
import CoverCard from '@/components/CoverCard/CoverCard';
import PostPreviewModal from '@/components/PostPreviewModal/PostPreviewModal';
import SignatureLogo from '@/components/SignatureLogo/SignatureLogo';
import SocialIcon from '@/components/SocialIcons/SocialIcons';
import { MEDIA_ENDPOINTS } from '@/lib/mediaEndpoints';
import {
  markPostPreviewPromptShown,
  recordPostPreviewDismissal,
  recordPreviewCompletion,
} from '@/lib/postPreviewPrompt';
import {
  SOCIAL_LINKS,
  SPOTIFY_URL,
  STREAMING_LINKS,
} from '@/lib/releaseLinks';

import { calculatePathSchedule, calculateSignatureTransform } from './animationGeometry';
import styles from './LandingIntro.module.scss';

gsap.registerPlugin(useGSAP);

const DRAW_DURATION = 4.2;
const DRAW_OVERLAP = 0.12;
const HANDOFF_DURATION = 1.25;
const RESOLVE_DURATION = 0.65;
const CROSSFADE_DURATION = 0.4;
const HIDDEN_DASH_PADDING = 40;
const FONT_READY_FALLBACK_MS = 800;
const POST_PREVIEW_SETTLE_MS = 450;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type PageMode = 'cover' | 'credits' | 'lyrics';

export default function LandingIntro() {
  // ── GSAP intro animation refs ──────────────────────────────────────────
  const rootRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const introSignatureRef = useRef<SVGSVGElement>(null);
  const headerSignatureRef = useRef<SVGSVGElement>(null);

  // Reveal targets (GSAP fades these in after intro)
  const atmosGroupRef = useRef<HTMLDivElement>(null);
  const artistFollowRef = useRef<HTMLDivElement>(null);
  const discSectionRef = useRef<HTMLDivElement>(null);
  const coverRevealRef = useRef<HTMLDivElement>(null);
  const trackRevealRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const navBandDotRef = useRef<HTMLDivElement>(null);
  const navBandRef = useRef<HTMLDivElement>(null);
  const navLabelRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const streamMenuRef = useRef<HTMLDivElement>(null);
  const streamMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const streamMenuItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const followMenuRef = useRef<HTMLDivElement>(null);
  const followMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const followMenuItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  // ── Disc + cover rAF animation refs ───────────────────────────────────
  const tiltElRef = useRef<HTMLDivElement>(null);
  const labelElRef = useRef<HTMLDivElement>(null);
  const coverBobRef = useRef<HTMLDivElement>(null);
  const metaBobRef = useRef<HTMLDivElement>(null);

  const discAngleRef = useRef(0);
  const discSpeedRef = useRef(4);
  const discIdleFactorRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const rafStartRef = useRef(0);
  const rafLastRef = useRef(0);
  const isPlayingRafRef = useRef(false);

  // ── Modal orchestration refs ───────────────────────────────────────────
  const promptReservedInMemoryRef = useRef(false);
  const pendingResetRef = useRef<(() => void) | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const resetFrameRef = useRef<number | null>(null);
  const introHasCompletedRef = useRef(false);
  const modalMountedRef = useRef(false);
  const modalCommitHandledRef = useRef(false);
  const dismissalRecordedRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // ── UI state ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<PageMode>('cover');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isStreamMenuOpen, setIsStreamMenuOpen] = useState(false);
  const [isFollowMenuOpen, setIsFollowMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalMounted, setIsModalMounted] = useState(false);

  // Keep rAF ref in sync with playing state
  useEffect(() => {
    isPlayingRafRef.current = isPreviewPlaying;
  }, [isPreviewPlaying]);

  useEffect(() => {
    if (!isStreamMenuOpen) return;

    streamMenuItemRefs.current[0]?.focus();

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (
        streamMenuRef.current &&
        !streamMenuRef.current.contains(event.target as Node)
      ) {
        setIsStreamMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setIsStreamMenuOpen(false);
      streamMenuTriggerRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isStreamMenuOpen]);

  useEffect(() => {
    if (!isFollowMenuOpen) return;

    followMenuItemRefs.current[0]?.focus();

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (
        followMenuRef.current &&
        !followMenuRef.current.contains(event.target as Node)
      ) {
        setIsFollowMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFollowMenuOpen(false);
      followMenuTriggerRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFollowMenuOpen]);

  // ── Nav band indicator — position on mount, slide to active label on mode change ──
  // Dot starts at band center (Home). On mode change, measure the active label's
  // screen position and translate the dot to align with it.

  useEffect(() => {
    const dot = navBandDotRef.current;
    if (!dot) return;
    gsap.set(dot, { x: 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!introHasCompletedRef.current) return;
    const dot = navBandDotRef.current;
    const band = navBandRef.current;
    if (!dot || !band) return;

    const modeIndex = mode === 'lyrics' ? 0 : mode === 'cover' ? 1 : 2;
    const label = navLabelRefs.current[modeIndex];
    let offset = 0;

    if (label) {
      const bandRect = band.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      offset =
        labelRect.left + labelRect.width / 2 - (bandRect.left + bandRect.width / 2);
    }

    gsap.to(dot, { x: offset, duration: 0.7, ease: 'power4.out' });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF animation loop (disc tilt + label spin + cover bob) ───────────
  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (prefersReducedMotion) {
      if (tiltElRef.current) {
        tiltElRef.current.style.transform = 'rotateX(80deg)';
      }
      return;
    }

    const now = performance.now();
    rafStartRef.current = now;
    rafLastRef.current = now;

    const loop = (ts: number) => {
      let dt = (ts - rafLastRef.current) / 1000;
      rafLastRef.current = ts;
      if (dt > 0.1) dt = 0.1;
      const t = (ts - rafStartRef.current) / 1000;

      const playing = isPlayingRafRef.current;
      const target = playing ? 42 : 4;
      discSpeedRef.current += (target - discSpeedRef.current) * Math.min(1, dt * 1.05);
      discAngleRef.current += discSpeedRef.current * dt;
      discIdleFactorRef.current +=
        ((playing ? 0 : 1) - discIdleFactorRef.current) * Math.min(1, dt * 1.4);

      const rockX = Math.sin(t * 0.6) * 1.4 * discIdleFactorRef.current;
      const rockZ = Math.sin(t * 0.43 + 1) * 1.1 * discIdleFactorRef.current;

      if (tiltElRef.current) {
        tiltElRef.current.style.transform = `rotateX(${(80 + rockX).toFixed(3)}deg) rotateZ(${rockZ.toFixed(3)}deg)`;
      }
      if (labelElRef.current) {
        labelElRef.current.style.transform = `rotateZ(${discAngleRef.current.toFixed(3)}deg)`;
      }

      const cbob = Math.sin(t * 0.7 + 1.4) * 7;
      if (coverBobRef.current) {
        coverBobRef.current.style.transform = `translateY(${cbob.toFixed(2)}px)`;
      }
      if (metaBobRef.current) {
        metaBobRef.current.style.transform = `translateY(${(cbob * 0.45).toFixed(2)}px)`;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Modal orchestration ────────────────────────────────────────────────
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
      if (resetFrameRef.current === resetFrame) resetFrameRef.current = null;
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

    if (promptReservedInMemoryRef.current) {
      reset();
      return;
    }

    promptReservedInMemoryRef.current = true;
    modalCommitHandledRef.current = false;
    dismissalRecordedRef.current = false;
    pendingResetRef.current = reset;

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
    promptReservedInMemoryRef.current = false;
    setIsModalMounted(false);
  };

  // ── GSAP intro animation ───────────────────────────────────────────────
  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const shell = shellRef.current;
      const overlay = overlayRef.current;
      const introSignature = introSignatureRef.current;
      const headerSignature = headerSignatureRef.current;
      const revealTargets = [
        atmosGroupRef.current,
        artistFollowRef.current,
        discSectionRef.current,
        coverRevealRef.current,
        trackRevealRef.current,
        audioRef.current,
      ].filter((t): t is HTMLDivElement => t !== null);

      if (!root || !shell || !overlay || !introSignature || !headerSignature) return;

      const contextSafeCallback =
        contextSafe ??
        (<T extends (...args: never[]) => unknown>(callback: T) => callback);
      let cancelled = false;
      let finalized = false;
      let normalMotionStarted = false;
      let fontReadyFallback: number | undefined;
      const activeAnimations: Array<{ kill: () => void }> = [];

      const killActiveAnimations = () => {
        activeAnimations.splice(0).forEach((a) => a.kill());
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
        gsap.set(revealTargets, { autoAlpha: 1, y: 0, clearProps: 'transform' });
        gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'none' });
        restoreInteraction();
      };

      gsap.set(headerSignature, { autoAlpha: 0 });
      gsap.set(atmosGroupRef.current, { autoAlpha: 0 });
      gsap.set([artistFollowRef.current, discSectionRef.current], { autoAlpha: 0, y: 24 });
      gsap.set(coverRevealRef.current, { autoAlpha: 0, y: 18 });
      gsap.set([trackRevealRef.current, audioRef.current], {
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
          introSignature.querySelectorAll<SVGPathElement>('.signature-reveal-mask-path'),
        );
        const fillLayer = introSignature.querySelector<SVGGElement>('.signature-fill-layer');

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
        if (fillLayer) gsap.set(fillLayer, { autoAlpha: 1 });

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

                // Crossfade: header fades in as overlay fades out — total opacity stays constant, no pop
                const cfHeader = gsap.to(headerSignature, {
                  autoAlpha: 1,
                  duration: CROSSFADE_DURATION,
                  ease: 'none',
                });
                const cfOverlay = gsap.to(overlay, {
                  autoAlpha: 0,
                  duration: CROSSFADE_DURATION,
                  ease: 'none',
                  onComplete: () => {
                    gsap.set(introSignature, { willChange: 'auto' });
                  },
                });
                activeAnimations.push(cfHeader, cfOverlay);

                const revealTimeline = gsap.timeline({
                  delay: 0.15,
                  defaults: { duration: 0.6, ease: 'power2.out' },
                  onComplete: contextSafeCallback(() => {
                    if (cancelled || finalized) return;
                    finalized = true;
                    restoreInteraction();
                  }),
                });
                activeAnimations.push(revealTimeline);
                revealTimeline
                  .to(atmosGroupRef.current, { autoAlpha: 1 }, 0)
                  .to(artistFollowRef.current, { autoAlpha: 1, y: 0 }, 0.08)
                  .to(coverRevealRef.current, { autoAlpha: 1, y: 0 }, 0.18)
                  .to(trackRevealRef.current, { autoAlpha: 1, y: 0 }, 0.28)
                  .to(discSectionRef.current, { autoAlpha: 1, y: 0, duration: 0.85 }, 0.36)
                  .to(audioRef.current, { autoAlpha: 1, y: 0 }, 0.58);
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
              { strokeOpacity: 1, duration: 0.01, ease: 'none' },
              schedule[index].at,
            );
            drawTimeline.to(
              path,
              { strokeDashoffset: 0, duration: schedule[index].duration, ease: 'sine.inOut' },
              schedule[index].at,
            );

            if (revealMaskPath) {
              drawTimeline.to(
                revealMaskPath,
                { strokeOpacity: 1, duration: 0.01, ease: 'none' },
                schedule[index].at,
              );
              drawTimeline.to(
                revealMaskPath,
                { strokeDashoffset: 0, duration: schedule[index].duration, ease: 'sine.inOut' },
                schedule[index].at,
              );
            }
          });

          drawTimeline.to(
            drawPaths.map(({ path }) => path),
            { strokeOpacity: 0, duration: RESOLVE_DURATION, ease: 'power2.out' },
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
        { all: 'all', reduceMotion: '(prefers-reduced-motion: reduce)' },
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
        if (fontReadyFallback) window.clearTimeout(fontReadyFallback);
        motionPreference.revert();
        killActiveAnimations();
      };
    },
    { scope: rootRef },
  );

  // ── Mode handlers ──────────────────────────────────────────────────────
  const goCredits = () => setMode((m) => (m === 'credits' ? 'cover' : 'credits'));
  const goLyrics = () => setMode((m) => (m === 'lyrics' ? 'cover' : 'lyrics'));
  const goHome = () => setMode('cover');

  const handleFollowMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Tab') {
      setIsFollowMenuOpen(false);
      return;
    }
    const items = followMenuItemRefs.current.filter(
      (item): item is HTMLAnchorElement => item !== null,
    );
    if (items.length === 0) return;
    const activeIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    items[nextIndex].focus();
  };
  const handleStreamMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Tab') {
      setIsStreamMenuOpen(false);
      return;
    }

    const items = streamMenuItemRefs.current.filter(
      (item): item is HTMLAnchorElement => item !== null,
    );
    if (items.length === 0) return;

    const activeIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown') {
      nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex =
        activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    items[nextIndex].focus();
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main ref={rootRef} className={styles.page}>
      {/* INTRO ANIMATION OVERLAY */}
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

      {/* STAGE */}
      <div className={styles['stage-scale']} data-stage-scale>
        <div
          ref={shellRef}
          className={`${styles.shell} ${isModalMounted ? styles['shell--blocked'] : ''}`}
          data-landing-shell
          inert
        >
        {/* Atmosphere layers — hidden during intro, fade in first */}
        <div ref={atmosGroupRef} aria-hidden="true">
          <div className={styles.atmos} aria-hidden="true" />
          <div className={styles['ground-shadow']} aria-hidden="true" />
          <div className={styles['disc-glow']} aria-hidden="true" />
        </div>

        {/* DISC MEDALLION + ARC NAVIGATION */}
        <div ref={discSectionRef} className={styles['disc-wrap']}>
          <div
            ref={tiltElRef}
            className={styles['disc-tilt']}
            data-disc-tilt
          >
            <div className={styles.disc}>
              <div ref={labelElRef} className={styles['disc__label']}>
                <img
                  src={MEDIA_ENDPOINTS.cover}
                  alt=""
                  aria-hidden="true"
                  className={styles['disc__label-img']}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
              <div className={styles['disc__seating']} aria-hidden="true" />
              <div className={styles['disc__bevel']} aria-hidden="true" />
              <div className={styles['disc__specular']} aria-hidden="true" />
              <div className={styles['disc__sheen']} aria-hidden="true" />
              <div className={styles['disc__boss']} aria-hidden="true" />
            </div>
          </div>

          {/* Compact glass nav band — sits at the disc near-rim, indicator slides horizontally */}
          <div
            ref={navBandRef}
            className={styles['disc-nav-band']}
            data-disc-nav-band
          >
            <div className={styles['disc-nav-band__track']}>
              <div ref={navBandDotRef} className={styles['disc-nav-band__dot']} />
              <button
                ref={(el) => { navLabelRefs.current[0] = el; }}
                className={`${styles['disc-nav-band__btn']} ${mode === 'lyrics' ? styles['disc-nav-band__btn--active'] : ''}`}
                onClick={goLyrics}
                aria-pressed={mode === 'lyrics'}
                aria-label="Lyrics view"
              >
                Lyrics
              </button>
              <button
                ref={(el) => { navLabelRefs.current[1] = el; }}
                className={`${styles['disc-nav-band__btn']} ${mode === 'cover' ? styles['disc-nav-band__btn--active'] : ''}`}
                onClick={goHome}
                aria-pressed={mode === 'cover'}
                aria-label="Cover view"
              >
                Home
              </button>
              <button
                ref={(el) => { navLabelRefs.current[2] = el; }}
                className={`${styles['disc-nav-band__btn']} ${mode === 'credits' ? styles['disc-nav-band__btn--active'] : ''}`}
                onClick={goCredits}
                aria-pressed={mode === 'credits'}
                aria-label="Credits view"
              >
                Credits
              </button>
            </div>
          </div>
        </div>

        {/* ARTIST HEADER */}
        <div ref={artistFollowRef} className={styles['artist-slot']}>
          <div className={styles['artist-name']}>
            <ArtistHeader signatureRef={headerSignatureRef} />
          </div>
        </div>

        {/* COVERSTAGE — recedes left in lyrics view */}
        <div
          className={`${styles.coverstage} ${mode === 'lyrics' ? styles['coverstage--recede'] : ''}`}
        >
          {/* Floating cover card with bobbing animation */}
          <div className={styles['cover-float-wrap']}>
            <div ref={coverBobRef} className={styles['cover-bob']}>
              <div ref={coverRevealRef}>
                <CoverCard
                  coverSrc={MEDIA_ENDPOINTS.cover}
                  isFlipped={mode === 'credits'}
                />
              </div>
              <div className={styles['cover-halo']} aria-hidden="true" />
            </div>
          </div>

          {/* Track title + meta */}
          <div className={styles['track-meta-outer']}>
            <div ref={metaBobRef}>
              <div ref={trackRevealRef} className={styles['track-meta']}>
                <h2 className={styles['track-meta__title']}>Caramelo</h2>
                <div className={styles['track-meta__sub']}>
                  <i>Latest Release</i>
                  <span aria-hidden="true">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                  <span>Latin</span>
                  <span aria-hidden="true">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                  <span>SINGLE</span>
                  <span aria-hidden="true">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                  <span>2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LYRICS PANEL */}
        <div
          className={`${styles.lyrics} ${mode === 'lyrics' ? styles['lyrics--show'] : ''}`}
          aria-hidden={mode !== 'lyrics'}
        >
          <div className={styles['lyrics__header']}>
            <span className={styles['lyrics__eyebrow']}>Lyrics</span>
            <span className={styles['lyrics__song']}>Caramelo</span>
          </div>
          <div className={styles['lyrics__scroll']}>
            <div className={styles['lyrics__body']}>
              <p>
                En mi vista yo te veo<br />
                Eres igual a la luna en el cielo<br />
                Bonita como el mar cuando despierto<br />
                Esta Lista pa broncearte caramelo
              </p>
              <p>
                Te comparo a una isla tropical en cual la vibra me llama<br />
                Refrescante como una bebida en verano que a mí me calma<br />
                Cautivante como unos días grises que por fin se aclaran<br />
                Y si fuero yo pirata tú series el destino en mi mapa
              </p>
              <p>
                Vámonos par de noches<br />
                Para unas vacaciones<br />
                Bien lejos sin explicaciones<br />
                Te quiero so let me show it
              </p>
              <p>
                Ride with me<br />
                Pa cumplir to tus deseos spend some time with me<br />
                Pa que llene to el rollo de tu cámara<br />
                Con memoria que no olvide no e falsedad<br />
                Lo que siento yo por ti e más que un friend to me<br />
                voy donde quieras just keep me compony<br />
                Es como ver el sol nacer al madrugar<br />
                Como una luz que deja respirar
              </p>
              <p>
                En mi vista yo te veo<br />
                Eres igual a la luna en el cielo<br />
                Bonita como el mar cuando despierto<br />
                Esta Lista pa broncearte caramelo
              </p>
            </div>
          </div>
        </div>


        {/* PLAYER ROW */}
        <div ref={audioRef} className={styles['player-row']} data-player-row>
          {/* Spotify — icon only */}
          <a
            href={SPOTIFY_URL}
            className={styles['btn-icon']}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Stream Caramelo on Spotify"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#1DB954" />
              <g fill="none" stroke="#0d2716" strokeWidth="2" strokeLinecap="round">
                <path d="M6 9.7c4-1.1 8.4-0.7 12 1.4" />
                <path d="M6.8 13c3.2-0.9 6.7-0.5 9.6 1.2" />
                <path d="M7.5 16c2.4-0.6 4.9-0.3 7 0.9" />
              </g>
            </svg>
          </a>
          {/* Save/heart */}
          <a
            href={SPOTIFY_URL}
            className={`${styles['btn-icon']} ${styles['btn-icon--heart']}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Caramelo on Spotify"
            data-heart-control
          >
            <svg width="19" height="19" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M9 15.5S2.6 11.6 2.6 7.1A3.4 3.4 0 0 1 9 5.2a3.4 3.4 0 0 1 6.4 1.9C15.4 11.6 9 15.5 9 15.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          {/* Play/pause — AudioPreview compact (no waveform), styled as larger center button */}
          <AudioPreview
            audioSrc={MEDIA_ENDPOINTS.preview}
            onPlaybackChange={setIsPreviewPlaying}
            onQualifiedFinish={handleQualifiedFinish}
            showWaveform={false}
          />
          <div ref={followMenuRef} className={styles['follow-menu-wrap']}>
            <button
              ref={followMenuTriggerRef}
              type="button"
              className={styles['btn-icon']}
              aria-label="Follow Jona Ferreira"
              aria-haspopup="menu"
              aria-expanded={isFollowMenuOpen}
              onClick={() => setIsFollowMenuOpen((o) => !o)}
            >
              {/* Orbit icon — communicates "enter the artist's orbit" */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="2.5" fill="#212121" />
                <circle cx="12" cy="12" r="6.5" stroke="#212121" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="10.5" stroke="#212121" strokeWidth="1" strokeDasharray="2 2.8" />
              </svg>
            </button>

            {isFollowMenuOpen ? (
              <div
                className={styles['follow-menu']}
                role="menu"
                onKeyDown={handleFollowMenuKeyDown}
              >
                <span className={styles['follow-menu__name']}>Jona Ferreira</span>
                {SOCIAL_LINKS.map((link, index) => (
                  <a
                    key={link.label}
                    ref={(el) => {
                      followMenuItemRefs.current[index] = el;
                    }}
                    href={link.href}
                    className={styles['follow-menu__item']}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => setIsFollowMenuOpen(false)}
                  >
                    <SocialIcon name={link.icon} />
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div ref={streamMenuRef} className={styles['stream-menu-wrap']}>
            <button
              ref={streamMenuTriggerRef}
              type="button"
              className={styles['btn-icon']}
              aria-label="More streaming platforms"
              aria-haspopup="menu"
              aria-expanded={isStreamMenuOpen}
              onClick={() => setIsStreamMenuOpen((open) => !open)}
            >
              <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true">
                <circle cx="2.5" cy="3" r="1.6" fill="#212121" />
                <circle cx="9" cy="3" r="1.6" fill="#212121" />
                <circle cx="15.5" cy="3" r="1.6" fill="#212121" />
              </svg>
            </button>

            {isStreamMenuOpen ? (
              <div
                className={styles['stream-menu']}
                role="menu"
                onKeyDown={handleStreamMenuKeyDown}
              >
                {STREAMING_LINKS.map((link, index) => (
                  <a
                    key={link.label}
                    ref={(item) => {
                      streamMenuItemRefs.current[index] = item;
                    }}
                    href={link.href}
                    className={styles['stream-menu__item']}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => setIsStreamMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </div>

      {/* POST-PREVIEW MODAL */}
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
