const developmentSiteUrl = 'http://localhost:3000';

function readUrl(name: string, fallback?: string): URL | undefined {
  const value = process.env[name]?.trim() || fallback;
  if (!value) return undefined;

  try {
    return new URL(value);
  } catch {
    return fallback ? new URL(fallback) : undefined;
  }
}

export function getSiteUrl(): URL {
  return readUrl('NEXT_PUBLIC_SITE_URL', developmentSiteUrl) ?? new URL(developmentSiteUrl);
}

export function getConsoleUrl(): URL | undefined {
  return readUrl('NEXT_PUBLIC_CONSOLE_URL');
}
