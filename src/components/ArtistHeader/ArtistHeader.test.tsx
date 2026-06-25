import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ArtistHeader from './ArtistHeader';

afterEach(cleanup);

describe('ArtistHeader', () => {
  it('renders a path-only signature as the accessible level-one heading', () => {
    render(<ArtistHeader />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Jona Ferreira',
    });
    const signature = screen.getByRole('img', { name: 'Jona Ferreira' });

    expect(heading).toContainElement(signature);
    expect(signature.tagName).toBe('svg');
    expect(signature.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(heading).not.toHaveTextContent('Jona Ferreira');
  });

  it('preserves the visual metadata and exposes its separator accessibly', () => {
    render(<ArtistHeader />);

    const metadata = screen.getByText('Latest Release', {
      selector: 'span',
    }).parentElement;
    const normalizedMetadata = metadata?.textContent
      ?.replace(/\s+/g, ' ')
      .trim();

    expect(metadata).not.toHaveAttribute('aria-label');
    expect(normalizedMetadata).toBe('Latest Release • Latin');
    expect(metadata?.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('attaches the signature and metadata refs', () => {
    const signatureRef = createRef<SVGSVGElement>();
    const metadataRef = createRef<HTMLParagraphElement>();

    render(
      <ArtistHeader
        signatureRef={signatureRef}
        metadataRef={metadataRef}
      />,
    );

    expect(signatureRef.current).toBe(
      screen.getByRole('img', { name: 'Jona Ferreira' }),
    );
    expect(metadataRef.current).toBe(
      screen.getByText('Latest Release', { selector: 'span' }).parentElement,
    );
  });
});
