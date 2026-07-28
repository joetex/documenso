import { isRvhoopAllowedPath, rvhoopFallbackPath } from '@documenso/lib/constants/rvhoop-lockdown';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

// eslint-disable-next-line @typescript-eslint/require-await
export const handleRedirects = async (c: Context): Promise<string | null> => {
  const { req } = c;
  const path = req.path;

  // Direct rewrites
  if (
    path === '/documents' ||
    path === '/documents/folders' ||
    path === '/templates' ||
    path === '/templates/folders'
  ) {
    return '/';
  }

  // RVHOOP FORK ADDITION. Page-load half of the templates-only lockdown; see
  // `rvhoop-lockdown.ts`. This runs for every page path (`appMiddleware` skips
  // `/api/`, `/assets/` and friends before calling us), which is what catches
  // both a typed URL and React Router's `<path>.data` fetch for a client-side
  // navigation. The tRPC guard is what actually protects the data — this exists
  // so a blocked route lands somewhere useful instead of rendering a shell full
  // of failing queries.
  if (!isRvhoopAllowedPath(path)) {
    return rvhoopFallbackPath(path, getCookie(c, 'preferred-team-url'));
  }

  return null;
};
