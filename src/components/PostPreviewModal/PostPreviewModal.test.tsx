import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PostPreviewModal from './PostPreviewModal';

function dispatchTransitionEnd(element: Element, propertyName: string) {
  const event = new Event('transitionend', {
    bubbles: true,
    cancelable: false,
  });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  fireEvent(element, event);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PostPreviewModal', () => {
  it('does not render portal content during server rendering', () => {
    expect(
      renderToString(
        <PostPreviewModal isOpen onRequestClose={vi.fn()} />,
      ),
    ).toBe('');
  });

  it('portals an accessible dialog with the requested content and actions', () => {
    const { container } = render(
      <PostPreviewModal isOpen onRequestClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Thanks for listening.',
    });

    expect(container).toBeEmptyDOMElement();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      "If you enjoyed Caramelo, here's how you can support the release.",
    );
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Thanks for listening.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "If you enjoyed Caramelo, here's how you can support the release.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Listen Full Song' }),
    ).toHaveAttribute('href', '#');
    expect(screen.getByRole('link', { name: 'Save Song' })).toHaveAttribute(
      'href',
      '#',
    );
    expect(screen.getByRole('link', { name: 'Follow Artist' })).toHaveAttribute(
      'href',
      '#',
    );
    expect(screen.getByRole('link', { name: 'Share Track' })).toHaveAttribute(
      'href',
      '#',
    );
  });

  it('moves initial focus to the primary action', () => {
    render(<PostPreviewModal isOpen onRequestClose={vi.fn()} />);

    expect(
      screen.getByRole('link', { name: 'Listen Full Song' }),
    ).toHaveFocus();
  });

  it('requests close on Escape', () => {
    const onRequestClose = vi.fn();
    render(
      <PostPreviewModal isOpen onRequestClose={onRequestClose} />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop but not from the dialog surface', () => {
    const onRequestClose = vi.fn();
    render(
      <PostPreviewModal isOpen onRequestClose={onRequestClose} />,
    );

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error('Expected modal backdrop');

    fireEvent.click(dialog);
    expect(onRequestClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab and Shift+Tab across modal actions', () => {
    render(<PostPreviewModal isOpen onRequestClose={vi.fn()} />);

    const first = screen.getByRole('link', { name: 'Listen Full Song' });
    const last = screen.getByRole('link', { name: 'Share Track' });

    last.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(last).toHaveFocus();
  });

  it.each([
    'Listen Full Song',
    'Save Song',
    'Follow Artist',
    'Share Track',
  ])(
    'keeps the %s placeholder action inert without dismissing',
    (actionName) => {
      const onRequestClose = vi.fn();
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      render(
        <PostPreviewModal isOpen onRequestClose={onRequestClose} />,
      );

      const action = screen.getByRole('link', { name: actionName });
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      action.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
      expect(onRequestClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      if (process.env.NODE_ENV !== 'production') {
        expect(infoSpy).toHaveBeenCalledWith(
          '[post-preview-action]',
          actionName,
        );
      }
    },
  );

  it('exits only from the surface transform transition and completes once', () => {
    const onExited = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open modal';
    document.body.append(trigger);
    trigger.focus();

    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
    expect(onExited).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error('Expected modal backdrop');

    dispatchTransitionEnd(backdrop, 'opacity');
    dispatchTransitionEnd(dialog, 'opacity');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
    expect(onExited).not.toHaveBeenCalled();

    dispatchTransitionEnd(dialog, 'transform');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onExited).toHaveBeenCalledTimes(1);

    dispatchTransitionEnd(dialog, 'transform');
    expect(onExited).toHaveBeenCalledTimes(1);

    trigger.remove();
  });

  it('waits beyond the 560ms surface transition before fallback exit', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    act(() => vi.advanceTimersByTime(619));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onExited).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onExited).toHaveBeenCalledTimes(1);

    act(() => vi.runAllTimers());
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('completes reduced-motion exit promptly and exactly once', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const onExited = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open modal';
    document.body.append(trigger);
    trigger.focus();

    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    act(() => vi.advanceTimersByTime(119));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
    expect(onExited).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onExited).toHaveBeenCalledTimes(1);

    act(() => vi.runAllTimers());
    expect(onExited).toHaveBeenCalledTimes(1);

    trigger.remove();
  });

  it('keeps one surface and ignores a stale listener from an earlier close cycle', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    const stableSurface = screen.getByRole('dialog');
    const stableAction = screen.getByRole('link', {
      name: 'Listen Full Song',
    });
    stableAction.focus();
    const addListenerSpy = vi.spyOn(stableSurface, 'addEventListener');
    const nativeRemoveEventListener =
      stableSurface.removeEventListener.bind(stableSurface);
    let preserveFirstListener = true;
    let firstTransitionListener: EventListener | null = null;
    vi.spyOn(stableSurface, 'removeEventListener').mockImplementation(
      (eventName, listener, options) => {
        if (
          preserveFirstListener &&
          eventName === 'transitionend' &&
          listener === firstTransitionListener
        ) {
          return;
        }
        nativeRemoveEventListener(eventName, listener, options);
      },
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    expect(screen.getByRole('dialog')).toBe(stableSurface);
    expect(
      screen.getByRole('link', { name: 'Listen Full Song' }),
    ).toBe(stableAction);
    expect(stableAction).toHaveFocus();

    firstTransitionListener = addListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'transitionend',
    )?.[1] as EventListener | null;
    if (typeof firstTransitionListener !== 'function') {
      throw new Error('Expected first close transition listener');
    }

    let blockNewerListener = true;
    const staleEventBoundary = (event: Event) => {
      if (blockNewerListener) {
        event.stopImmediatePropagation();
      }
    };
    stableSurface.addEventListener('transitionend', staleEventBoundary);

    rerender(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );
    expect(screen.getByRole('dialog')).toBe(stableSurface);
    preserveFirstListener = false;

    addListenerSpy.mockClear();
    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    expect(screen.getByRole('dialog')).toBe(stableSurface);
    const secondTransitionListener = addListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'transitionend',
    )?.[1];
    if (typeof secondTransitionListener !== 'function') {
      throw new Error('Expected second close transition listener');
    }
    expect(secondTransitionListener).not.toBe(firstTransitionListener);

    dispatchTransitionEnd(stableSurface, 'transform');

    expect(screen.getByRole('dialog')).toBe(stableSurface);
    expect(onExited).not.toHaveBeenCalled();

    blockNewerListener = false;
    stableSurface.removeEventListener('transitionend', staleEventBoundary);
    dispatchTransitionEnd(stableSurface, 'transform');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('keeps the original reduced-motion deadline across onExited identity churn', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const firstOnExited = vi.fn();
    const secondOnExited = vi.fn();
    const latestOnExited = vi.fn();
    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={firstOnExited}
      />,
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={firstOnExited}
      />,
    );

    act(() => vi.advanceTimersByTime(40));
    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={secondOnExited}
      />,
    );

    act(() => vi.advanceTimersByTime(40));
    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={latestOnExited}
      />,
    );

    act(() => vi.advanceTimersByTime(39));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(firstOnExited).not.toHaveBeenCalled();
    expect(secondOnExited).not.toHaveBeenCalled();
    expect(latestOnExited).toHaveBeenCalledTimes(1);

    act(() => vi.runAllTimers());
    expect(latestOnExited).toHaveBeenCalledTimes(1);
  });

  it('restores prior focus on forced unmount without calling onExited', () => {
    const onExited = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open modal';
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    expect(trigger).not.toHaveFocus();
    unmount();

    expect(trigger).toHaveFocus();
    expect(onExited).not.toHaveBeenCalled();

    trigger.remove();
  });

  it('cancels a pending exit when rapidly reopened', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const { rerender } = render(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    rerender(
      <PostPreviewModal
        isOpen={false}
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );
    rerender(
      <PostPreviewModal
        isOpen
        onRequestClose={vi.fn()}
        onExited={onExited}
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onExited).not.toHaveBeenCalled();
  });

  it('defines the warm palette, glass treatment, touch targets, and reduced motion', () => {
    const css = readFileSync(
      'src/components/PostPreviewModal/PostPreviewModal.module.scss',
      'utf8',
    );

    expect(css).toContain('--modal-cream: 249 236 211');
    expect(css).toContain('--modal-caramel: 132 58 9');
    expect(css).toContain('--modal-amber: 201 120 50');
    expect(css).toContain('--modal-gold: 228 164 94');
    expect(css).toMatch(/backdrop-filter:\s*blur\(18px\) saturate\(\.9\)/);
    expect(css).toMatch(/overscroll-behavior:\s*contain/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/translateY\(16px\)\s+scale\(\.965\)/);

    const primaryRule = css.match(/\.primaryAction\s*\{([^}]*)\}/)?.[1];
    expect(primaryRule).toMatch(/color:\s*rgb\(var\(--modal-cream\)\)/);
    expect(primaryRule).toMatch(/background:\s*rgb\([0-5]?\d\s/);
    expect(primaryRule).not.toMatch(/linear-gradient/);
  });
});
