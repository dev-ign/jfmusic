import type { RefObject } from 'react';

import SignatureLogo from '@/components/SignatureLogo/SignatureLogo';

import styles from './ArtistHeader.module.scss';

type ArtistHeaderProps = Readonly<{
  signatureRef?: RefObject<SVGSVGElement | null>;
}>;

export default function ArtistHeader({
  signatureRef,
}: ArtistHeaderProps = {}) {
  return (
    <header className={styles['artist-header']}>
      <h1 className={styles['artist-header__name']}>
        <SignatureLogo ref={signatureRef} variant="header" />
      </h1>
    </header>
  );
}
