import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import SignatureLogo from './SignatureLogo';
import { SIGNATURE_PATHS, SIGNATURE_VIEW_BOX } from './signaturePaths';

describe('SignatureLogo', () => {
  it('renders the header variant as an accessible, path-only image', () => {
    const { container } = render(
      <SignatureLogo variant="header" className="header-logo" />,
    );

    const logo = screen.getByRole('img', { name: 'Jona Ferreira' });
    const fillPaths = logo.querySelectorAll('.signature-fill-path');

    expect(logo).toHaveAttribute('viewBox', SIGNATURE_VIEW_BOX);
    expect(logo).toHaveClass('header-logo');
    expect(fillPaths).toHaveLength(SIGNATURE_PATHS.length);
    expect(logo.querySelector('.signature-fill-layer')).toBeInTheDocument();
    expect(logo.querySelector('.signature-draw-layer')).not.toBeInTheDocument();
    expect(logo.querySelectorAll('path')).toHaveLength(SIGNATURE_PATHS.length);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('text')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('Jona Ferreira');
  });

  it('renders the intro variant by stroke-drawing the shared SVG source paths', () => {
    const { container } = render(<SignatureLogo variant="intro" />);
    const logo = container.querySelector('svg');

    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).not.toHaveAttribute('role');

    const drawLayer = logo?.querySelector('.signature-draw-layer');
    const fillLayer = logo?.querySelector('.signature-fill-layer');
    const drawPaths = Array.from(
      drawLayer?.querySelectorAll('.signature-draw-path') ?? [],
    );
    const fillPaths = Array.from(
      fillLayer?.querySelectorAll('.signature-fill-path') ?? [],
    );

    expect(drawPaths).toHaveLength(SIGNATURE_PATHS.length);
    expect(fillPaths).toHaveLength(SIGNATURE_PATHS.length);
    expect(logo?.querySelectorAll('path')).toHaveLength(
      SIGNATURE_PATHS.length * 3,
    );
    expect(
      drawPaths.map((path) => path.getAttribute('d')),
    ).toEqual(
      SIGNATURE_PATHS.map((path) => path.d),
    );
    expect(
      drawPaths.map((path) => path.getAttribute('data-signature-path')),
    ).toEqual(
      fillPaths.map((path) => path.getAttribute('data-signature-path')),
    );
    expect(
      drawPaths.map((path) => path.getAttribute('transform')),
    ).toEqual(
      fillPaths.map((path) => path.getAttribute('transform')),
    );
    expect(new Set(SIGNATURE_PATHS.map(({ id }) => id)).size).toBe(
      SIGNATURE_PATHS.length,
    );
    expect(
      SIGNATURE_PATHS.every(({ d }) =>
        (d.match(/-?\d+(?:\.\d+)?/g) ?? []).every((coordinate) =>
          Number.isFinite(Number(coordinate)),
        ),
      ),
    ).toBe(true);
  });

  it('exposes transform as an optional property on every shared path', () => {
    expect(
      SIGNATURE_PATHS.map(({ transform }) => transform),
    ).toEqual(
      SIGNATURE_PATHS.map((path) => path.transform),
    );
  });

  it('masks the intro fill with the same shared paths for progressive reveal', () => {
    const { container } = render(<SignatureLogo variant="intro" />);
    const logo = container.querySelector('svg');
    const fillLayer = logo?.querySelector('.signature-fill-layer');
    const mask = logo?.querySelector('mask');
    const revealPaths = Array.from(
      mask?.querySelectorAll('.signature-reveal-mask-path') ?? [],
    );

    expect(fillLayer?.getAttribute('mask') ?? '').toMatch(
      /^url\(#signature-reveal-/,
    );
    expect(mask).toBeInTheDocument();
    expect(revealPaths).toHaveLength(SIGNATURE_PATHS.length);
    expect(
      revealPaths.map((path) => path.getAttribute('d')),
    ).toEqual(
      SIGNATURE_PATHS.map((path) => path.d),
    );
    expect(
      revealPaths.map((path) => path.getAttribute('data-signature-path')),
    ).toEqual(SIGNATURE_PATHS.map((path) => path.id));
  });

  it('keeps intro fill and reveal mask paths hidden before animation code runs', () => {
    const css = readFileSync(
      'src/components/SignatureLogo/SignatureLogo.module.scss',
      'utf8',
    );

    expect(css).toMatch(
      /:global\(\.signature-fill-layer\)\s*\{[^}]*opacity:\s*0/,
    );
    expect(css).toMatch(
      /:global\(\.signature-reveal-mask-path\)\s*\{[^}]*stroke-opacity:\s*0/,
    );
    expect(css).toMatch(
      /:global\(\.signature-reveal-mask-path\)\s*\{[^}]*stroke-linecap:\s*butt/,
    );
    expect(css).toMatch(
      /:global\(\.signature-reveal-mask-path\)\s*\{[^}]*stroke-dashoffset:\s*var\(--signature-initial-dash\)/,
    );
  });

  it('forwards its ref to the svg element', () => {
    const ref = createRef<SVGSVGElement>();

    const { container } = render(<SignatureLogo ref={ref} variant="header" />);

    expect(ref.current).toBe(container.querySelector('svg'));
  });
});
