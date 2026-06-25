/**
 * Central config for all protected media asset URLs.
 * To switch to Cloudinary/S3 signed URLs, replace the values below with
 * async calls to your signing service, e.g.:
 *   cover: await getSignedUrl('caramelo-cover.png', { expiresIn: 300 })
 */
export const MEDIA_ENDPOINTS = {
  cover: '/api/media/cover',
  preview: '/api/media/preview',
} as const;
