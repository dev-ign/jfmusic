import { ImageResponse } from 'next/og';

import { SIGNATURE_PATHS } from '@/components/SignatureLogo/signaturePaths';

export const size = {
  width: 128,
  height: 128,
};

export const contentType = 'image/png';

export default function Icon() {
  const jGlyph = SIGNATURE_PATHS[0];
  const fGlyph = SIGNATURE_PATHS[4];

  return new ImageResponse(
    (
      <div
        aria-label="JF favicon"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 28,
          background:
            'radial-gradient(circle at 35% 25%, #fff4d9 0%, #edc37f 54%, #cf873c 100%)',
        }}
      >
        <svg
          width="112"
          height="72"
          viewBox="0 0 150 80"
          aria-hidden="true"
        >
          <path d={jGlyph.d} fill="#843a09" />
          <path d={fGlyph.d} fill="#843a09" transform="translate(-170 0)" />
        </svg>
      </div>
    ),
    size,
  );
}
