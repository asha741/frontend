/**
 * App-wide static configuration constants (not environment-specific).
 * Used across upload validation, file-type checks, and i18n defaults.
 */
export const APP_CONFIG = {
  /** Maximum allowed file size for uploads, in megabytes. */
  maxUploadSizeMB: 10,
  /** MIME types accepted for image uploads (e.g. profile pictures). */
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  /** MIME types accepted for document uploads (e.g. claim batch/import files). */
  supportedDocTypes: ['application/pdf', 'text/csv'],
  /** Fallback locale used when no user/browser language preference is set. */
  defaultLanguage: 'en-US',
} as const;
