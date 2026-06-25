'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import SocialIcon from '@/components/SocialIcons/SocialIcons';
import { SOCIAL_LINKS, SPOTIFY_URL } from '@/lib/releaseLinks';

import styles from './PostPreviewModal.module.scss';

type PostPreviewModalProps = {
  isOpen: boolean;
  onRequestClose: () => void;
  onExited?: () => void;
};

const EXIT_FALLBACK_MS = 620;
const REDUCED_MOTION_EXIT_FALLBACK_MS = 120;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function PostPreviewModal({
  isOpen,
  onRequestClose,
  onExited,
}: PostPreviewModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTransitionCleanupRef = useRef<(() => void) | null>(null);
  const entranceFrameRef = useRef<number | null>(null);
  const activeExitCycleRef = useRef<number | null>(null);
  const onExitedRef = useRef(onExited);
  const cycleActiveRef = useRef(false);
  const renderedRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [previousIsOpen, setPreviousIsOpen] = useState(isOpen);
  const [lastExitCycle, setLastExitCycle] = useState(0);
  const [exitCycle, setExitCycle] = useState<number | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  if (isOpen !== previousIsOpen) {
    setPreviousIsOpen(isOpen);
    if (isOpen) {
      setIsRendered(true);
      setExitCycle(null);
    } else {
      const nextExitCycle = lastExitCycle + 1;
      setLastExitCycle(nextExitCycle);
      setExitCycle(nextExitCycle);
    }
    setIsVisible(false);
  }

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const clearExitTransitionListener = useCallback(() => {
    exitTransitionCleanupRef.current?.();
    exitTransitionCleanupRef.current = null;
  }, []);

  const restorePreviousFocus = useCallback(() => {
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previousFocus?.isConnected) {
      previousFocus.focus();
    }
  }, []);

  const finishExit = useCallback((cycle: number) => {
    if (
      cycle !== activeExitCycleRef.current ||
      !renderedRef.current
    ) {
      return;
    }

    clearExitTimer();
    clearExitTransitionListener();
    activeExitCycleRef.current = null;
    renderedRef.current = false;
    cycleActiveRef.current = false;
    setIsRendered(false);
    restorePreviousFocus();
    onExitedRef.current?.();
  }, [
    clearExitTimer,
    clearExitTransitionListener,
    restorePreviousFocus,
  ]);

  useEffect(() => {
    // Portals must not render until the component has committed on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    return () => {
      clearExitTimer();
      clearExitTransitionListener();
      if (entranceFrameRef.current !== null) {
        cancelAnimationFrame(entranceFrameRef.current);
      }
      if (cycleActiveRef.current) {
        cycleActiveRef.current = false;
        restorePreviousFocus();
      }
    };
  }, [
    clearExitTimer,
    clearExitTransitionListener,
    restorePreviousFocus,
  ]);

  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handlePreferenceChange);
    return () => {
      mediaQuery.removeEventListener('change', handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    if (entranceFrameRef.current !== null) {
      cancelAnimationFrame(entranceFrameRef.current);
      entranceFrameRef.current = null;
    }

    if (isOpen) {
      activeExitCycleRef.current = null;
      clearExitTimer();
      clearExitTransitionListener();

      if (!cycleActiveRef.current) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        cycleActiveRef.current = true;
      }

      renderedRef.current = true;
      entranceFrameRef.current = requestAnimationFrame(() => {
        entranceFrameRef.current = null;
        setIsVisible(true);
      });
      return;
    }

    if (!renderedRef.current || exitCycle === null) {
      return;
    }
    activeExitCycleRef.current = exitCycle;
    clearExitTimer();
    clearExitTransitionListener();

    const surface = dialogRef.current;
    if (surface) {
      let removeThisListener = () => {};
      const handleTransitionEnd = (event: TransitionEvent) => {
        if (
          event.target !== surface ||
          event.propertyName !== 'transform'
        ) {
          return;
        }

        removeThisListener();
        if (exitCycle !== activeExitCycleRef.current) {
          return;
        }

        if (exitTransitionCleanupRef.current === removeThisListener) {
          exitTransitionCleanupRef.current = null;
        }
        finishExit(exitCycle);
      };
      removeThisListener = () => {
        surface.removeEventListener('transitionend', handleTransitionEnd);
      };
      surface.addEventListener('transitionend', handleTransitionEnd);
      exitTransitionCleanupRef.current = removeThisListener;
    }

    exitTimerRef.current = setTimeout(
      () => finishExit(exitCycle),
      prefersReducedMotion
        ? REDUCED_MOTION_EXIT_FALLBACK_MS
        : EXIT_FALLBACK_MS,
    );
  }, [
    clearExitTimer,
    clearExitTransitionListener,
    exitCycle,
    finishExit,
    isOpen,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    if (isOpen && isRendered && isMounted) {
      primaryActionRef.current?.focus();
    }
  }, [isMounted, isOpen, isRendered]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onRequestClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    const first = focusableElements[0];
    const last = focusableElements.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }

    const activeElement = document.activeElement;
    if (
      event.shiftKey &&
      (activeElement === first || !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === last || !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onRequestClose();
    }
  };

  if (!isMounted || !isRendered) {
    return null;
  }

  return createPortal(
    <div
      className={styles.backdrop}
      data-state={isVisible ? 'open' : 'closed'}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className={styles.surface}
        data-exit-cycle={exitCycle ?? undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.content}>
          <p className={styles.eyebrow}>Caramelo</p>
          <h2 id={titleId} className={styles.heading}>
            Thanks for listening.
          </h2>
          <p id={descriptionId} className={styles.body}>
            If you enjoyed Caramelo, here&apos;s how you can support the release.
          </p>
        </div>

        <div className={styles.actions}>
          <a
            ref={primaryActionRef}
            href={SPOTIFY_URL}
            className={`${styles.action} ${styles.primaryAction}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Listen Full Song
          </a>
          <a
            href={SPOTIFY_URL}
            className={`${styles.action} ${styles.secondaryAction} ${styles.saveAction}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Save Song
          </a>
          <div className={styles.socialActions} aria-label="Follow Jona Ferreira">
            {SOCIAL_LINKS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              className={`${styles.action} ${styles.socialAction}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
            >
              <SocialIcon name={social.icon} />
            </a>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
