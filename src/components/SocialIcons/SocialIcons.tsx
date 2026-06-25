import type { SocialIconName } from '@/lib/releaseLinks';

type SocialIconProps = Readonly<{
  name: SocialIconName;
}>;

export default function SocialIcon({ name }: SocialIconProps) {
  if (name === 'instagram') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === 'youtube') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="3"
          y="6.6"
          width="18"
          height="10.8"
          rx="3.2"
          fill="currentColor"
        />
        <path d="M10.5 9.4v5.2L15 12z" fill="#1f1f1f" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 4c.4 2.4 1.9 3.9 4.2 4.1v2.4c-1.5 0-2.9-.5-4.1-1.3v5.6c0 3-2.4 5.2-5.3 5.2A5 5 0 0 1 6 10.7c.5 0 1 .1 1.5.2v2.5a2.4 2.4 0 0 0-1.5-.4 2.5 2.5 0 1 0 2.7 2.5V4H14z" />
    </svg>
  );
}
