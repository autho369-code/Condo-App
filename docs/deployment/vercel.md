# Vercel Deployment

Use this path when the Vercel CLI install prompt is blocked or inconvenient. The project can deploy directly from GitHub.

## Dashboard Import

1. Open the Vercel dashboard and choose **Add New Project**.
2. Import `autho369-code/Condo-App` from GitHub.
3. Use the **Next.js** framework preset.
4. Leave the output directory on Vercel's default Next.js setting.
5. Confirm these build settings:

| Setting | Value |
| --- | --- |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Root Directory | repository root |

## Branch Strategy

- For the current live preview, deploy branch `codex/operations-redesign-impl`.
- For production, merge PR #1 into `main`, then let Vercel deploy from the production branch.
- Vercel creates preview deployments from non-production branches and production deployments from the production branch.

## Environment Variables

Add these in Vercel Project Settings -> Environment Variables for Preview and Production.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe Supabase anon or publishable key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only secret. Never expose this in client code. |
| `NEXT_PUBLIC_PORTAL_URL` | Yes | Use the Vercel app URL or custom domain, not localhost. |
| `STRIPE_SECRET_KEY` | Payment flow only | Server-only Stripe secret key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payment UI only | Browser-safe Stripe publishable key. |

Do not set `LOCAL_PREVIEW_MODE` on Vercel. That flag is only for local development so the app can be reviewed without a real staff login.

## Supabase Auth URLs

After Vercel gives you a preview or production URL, update Supabase Auth settings:

- Site URL: your Vercel production URL or custom domain.
- Redirect URLs: add the production URL and preview URL callback path, for example:
  - `https://your-domain.com/api/auth/callback`
  - `https://your-preview.vercel.app/api/auth/callback`

If login redirects fail on Vercel, the Supabase redirect URL list is the first place to check.

## No CLI Fallback

If the CLI installer fails, keep using the Vercel dashboard. GitHub pushes and PRs are enough for preview deployments once the project is imported.
