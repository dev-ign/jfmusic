export type SocialIconName = 'instagram' | 'youtube' | 'tiktok';

export type SocialLink = Readonly<{
  label: string;
  href: string;
  icon: SocialIconName;
}>;

export type StreamingLink = Readonly<{
  label: string;
  href: string;
}>;

export const SPOTIFY_URL =
  'https://open.spotify.com/track/2sDSnFmxyLvWgXQZm5Mdt2?si=6c58b7c468d24c4d';

export const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/jonaferreira',
    icon: 'instagram',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCWa1kPIczNX6qKZ8hMbNdsg',
    icon: 'youtube',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@jonafmusic',
    icon: 'tiktok',
  },
] as const satisfies readonly SocialLink[];

export const STREAMING_LINKS = [
  {
    label: 'Apple Music',
    href: 'https://music.apple.com/us/album/caramelo/6773485931?i=6773485933',
  },
  { label: 'Spotify', href: SPOTIFY_URL },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/watch?v=sb6EryPbY_A&list=OLAK5uy_lsz4B2564DZiRfBbBdES-dz5YEkTmlTn0',
  },
  {
    label: 'Amazon Music',
    href: 'https://amazon.com/music/player/albums/B0H31RQSRH?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_fE6GMFJbRU5FpVcsEpHhibWDN',
  },
  { label: 'Tidal', href: 'https://tidal.com/track/528205807/u' },
] as const satisfies readonly StreamingLink[];
