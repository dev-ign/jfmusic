import { forwardRef, useId } from 'react';

import styles from './SignatureLogo.module.scss';
import { SIGNATURE_PATHS, SIGNATURE_VIEW_BOX } from './signaturePaths';

export type SignatureLogoProps = Readonly<{
  variant: 'intro' | 'header';
  className?: string;
}>;

const SignatureLogo = forwardRef<SVGSVGElement, SignatureLogoProps>(
  function SignatureLogo({ variant, className }, ref) {
    const reactId = useId();
    const revealMaskId = `signature-reveal-${reactId.replace(/:/g, '')}`;
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] =
      SIGNATURE_VIEW_BOX.split(' ').map(Number);
    const maskPadding = 40;
    const classNames = [styles.logo, styles[variant], className]
      .filter(Boolean)
      .join(' ');
    const isHeader = variant === 'header';

    return (
      <svg
        ref={ref}
        className={classNames}
        viewBox={SIGNATURE_VIEW_BOX}
        role={isHeader ? 'img' : undefined}
        aria-label={isHeader ? 'Jona Ferreira' : undefined}
        aria-hidden={isHeader ? undefined : true}
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        {!isHeader ? (
          <defs>
            <mask
              id={revealMaskId}
              maskUnits="userSpaceOnUse"
              x={viewBoxX - maskPadding}
              y={viewBoxY - maskPadding}
              width={viewBoxWidth + maskPadding * 2}
              height={viewBoxHeight + maskPadding * 2}
            >
              {SIGNATURE_PATHS.map(({ id, d, transform }) => (
                <path
                  key={`reveal-${id}`}
                  className="signature-reveal-mask-path"
                  data-signature-path={id}
                  d={d}
                  transform={transform}
                />
              ))}
            </mask>
          </defs>
        ) : null}

        {!isHeader ? (
          <g className="signature-draw-layer">
            {SIGNATURE_PATHS.map(({ id, d, transform }) => (
              <path
                key={`draw-${id}`}
                className="signature-draw-path"
                data-signature-path={id}
                d={d}
                transform={transform}
              />
            ))}
          </g>
        ) : null}

        <g
          className="signature-fill-layer"
          mask={isHeader ? undefined : `url(#${revealMaskId})`}
        >
          {SIGNATURE_PATHS.map(({ id, d, transform }) => (
            <path
              key={`fill-${id}`}
              className="signature-fill-path"
              data-signature-path={id}
              d={d}
              transform={transform}
            />
          ))}
        </g>
      </svg>
    );
  },
);

export default SignatureLogo;
