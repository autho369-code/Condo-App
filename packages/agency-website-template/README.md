# Agency Website Template

Reusable Next.js website template for the digital agency platform. Edit `src/lib/site-config.ts` to customize per client.

## Quick Start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Customization

1. Edit `src/lib/site-config.ts` — change name, tagline, services, branding colors, navigation
2. Replace `public/logo.svg` and `public/favicon.ico`
3. Add client-specific pages under `src/app/`

## Deploy

Push to GitHub and connect to Vercel. The `vercel.json` config handles the framework settings automatically.

## Structure

```
src/
  app/
    layout.tsx       # Root layout with header + footer
    page.tsx         # Homepage (hero, services, CTA)
    about/page.tsx   # About page
    services/page.tsx # Services page
    contact/page.tsx  # Contact page with form
  lib/
    site-config.ts   # All customizable site settings
components/          # Add shared components here
public/              # Static assets (logo, favicon)
```
