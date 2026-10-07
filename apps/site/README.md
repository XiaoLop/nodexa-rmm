# Nodexa RMM Product Site

The public, bilingual product site for Nodexa RMM. It is a Next.js application with localized Chinese and English routes, product screenshots, contact entry points, and generated SEO metadata.

## Development

From the repository root:

```bash
pnpm install
pnpm dev:site
```

Or run the package directly:

```bash
pnpm --filter @meshcentral/site dev
```

The default development URL is `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` and configure the public deployment values:

```dotenv
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_CONSOLE_URL=https://console.example.com
NEXT_PUBLIC_CONTACT_EMAIL=hello@example.com
NEXT_PUBLIC_CONTACT_TELEGRAM=@your-telegram-id
NEXT_PUBLIC_CONTACT_WECHAT=your-wechat-id
```

- `NEXT_PUBLIC_SITE_URL` is used for canonical links, Open Graph metadata, `robots.txt`, and `sitemap.xml`. It defaults to `http://localhost:3000` for local development.
- `NEXT_PUBLIC_CONSOLE_URL` is optional. When no contact details are configured, the primary CTA opens this URL.
- Contact values are optional and intentionally public. When at least one is configured, the primary CTA scrolls to the contact section.

## Validation

Run the package checks before deployment:

```bash
pnpm --filter @meshcentral/site typecheck
pnpm --filter @meshcentral/site lint
pnpm --filter @meshcentral/site build
```

## Routes

- `/zh-CN` - Simplified Chinese product site
- `/en` - English product site
- `/robots.txt` - generated crawler policy
- `/sitemap.xml` - generated localized sitemap
- `/[locale]/opengraph-image` - generated social sharing image

The root route redirects to `/zh-CN`.
