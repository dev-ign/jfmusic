'use client';

import styles from './CoverCard.module.scss';

interface CoverCardProps {
  coverSrc: string;
  isFlipped?: boolean;
}

export default function CoverCard({ coverSrc, isFlipped = false }: CoverCardProps) {
  return (
    <div className={`${styles['cover-card']} ${isFlipped ? styles['cover-card--flipped'] : ''}`}>
      <div className={styles['cover-card__inner']}>
        <div className={`${styles['cover-card__face']} ${styles['cover-card__face--front']}`}>
          {/* Context menu suppressed as a UI-layer gesture only */}
          <img
            src={coverSrc}
            alt="Caramelo single cover art by Jona Ferreira"
            className={styles['cover-card__image']}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className={styles['cover-card__gloss']} aria-hidden="true" />
        </div>

        <div
          className={`${styles['cover-card__face']} ${styles['cover-card__face--back']}`}
          aria-hidden={!isFlipped}
        >
          <div className={styles['cover-card__credits-eyebrow']}>Credits</div>
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
  );
}
