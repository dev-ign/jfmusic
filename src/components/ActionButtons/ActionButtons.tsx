'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ActionButtons.module.scss';

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#1DB954" />
      <path
        d="M14.08 13.52a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.77-8.83-.97a.62.62 0 0 1-.28-1.21c3.83-.88 7.11-.5 9.77 1.12.3.18.4.56.2.86ZM15.22 11a.78.78 0 0 1-1.07.25c-2.7-1.66-6.81-2.14-10-1.17a.78.78 0 0 1-.44-1.49c3.64-1.1 8.17-.57 11.26 1.34.36.22.48.7.25 1.07ZM15.33 8.4c-3.24-1.92-8.59-2.1-11.68-1.16a.93.93 0 1 1-.54-1.78c3.55-1.08 9.45-.87 13.17 1.34a.93.93 0 1 1-.95 1.6Z"
        fill="white"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 16.5S2.5 12 2.5 6.5A4 4 0 0 1 10 4.06 4 4 0 0 1 17.5 6.5C17.5 12 10 16.5 10 16.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BullseyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="4.5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function InlineMenu({
  items,
  onClose,
}: {
  items: { label: string; href: string }[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className={styles['action-buttons__menu']} role="menu">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={styles['action-buttons__menu-item']}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          onClick={onClose}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

const FOLLOW_LINKS = [
  { label: 'Instagram', href: '#' },
  { label: 'TikTok', href: '#' },
  { label: 'Spotify', href: '#' },
  { label: 'YouTube', href: '#' },
];

const MORE_LINKS = [
  { label: 'Apple Music', href: '#' },
  { label: 'YouTube Music', href: '#' },
  { label: 'Tidal', href: '#' },
  { label: 'Amazon Music', href: '#' },
];

export default function ActionButtons() {
  const [followOpen, setFollowOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className={styles['action-buttons']}>
      <a
        href="#"
        className={`${styles['action-buttons__btn']} ${styles['action-buttons__btn--primary']}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Listen to Caramelo on Spotify"
      >
        <SpotifyIcon />
        <span>Listen Now</span>
      </a>

      <a
        href="#"
        className={`${styles['action-buttons__btn']} ${styles['action-buttons__btn--outline']}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Save Caramelo on Spotify"
      >
        <HeartIcon />
        <span>Save Song</span>
      </a>

      <div className={styles['action-buttons__group']}>
        <button
          className={`${styles['action-buttons__btn']} ${styles['action-buttons__btn--outline']}`}
          onClick={() => {
            setFollowOpen((v) => !v);
            setMoreOpen(false);
          }}
          aria-expanded={followOpen}
          aria-haspopup="menu"
        >
          <BullseyeIcon />
          <span>Follow</span>
        </button>
        {followOpen && (
          <InlineMenu items={FOLLOW_LINKS} onClose={() => setFollowOpen(false)} />
        )}
      </div>

      <div className={styles['action-buttons__group']}>
        <button
          className={`${styles['action-buttons__btn']} ${styles['action-buttons__btn--outline']} ${styles['action-buttons__btn--icon-only']}`}
          onClick={() => {
            setMoreOpen((v) => !v);
            setFollowOpen(false);
          }}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label="More platforms"
        >
          <EllipsisIcon />
        </button>
        {moreOpen && (
          <InlineMenu items={MORE_LINKS} onClose={() => setMoreOpen(false)} />
        )}
      </div>
    </div>
  );
}
