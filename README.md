# Condo-App — AI-Powered Property Management Platform

Monorepo for the Portier property management platform and its supporting agency modules.

```
condo-app-ui/
├── app/                          # Next.js 15 App Router — Portier dashboard
├── components/                   # Shared UI components
├── lib/                          # Auth guards, Supabase clients, utilities
├── supabase/                     # Migrations, Edge Functions, schema
├── tests/                        # Vitest + Playwright tests
├── packages/                     # Agency modules (complement Portier)
│   ├── agency-website-template/  # Next.js template + Vercel deploy + onboarding
│   ├── agency-chat-widget/       # Embeddable AI chat (5.4KB), Supabase backend
│   ├── agency-voice-agent/       # Twilio + Vapi AI receptionist pipeline
│   ├── agency-review-engine/     # GMB API + AI auto-respond + alerts
│   ├── agency-content-machine/   # Video scripts + 30-day content calendar
│   ├── agency-search-dominance/  # Schema.org JSON-LD + LLMs.txt generator
│   ├── agency-monitoring/        # Uptime checker (30m cron) + SSL expiry
│   └── agency-platform/          # Architecture docs + TODO + env example
└── docs/                         # Project documentation
```

## Portier (Main App)

- **Live:** https://portier369.com (Vercel)
- **Stack:** Next.js 15, Supabase, Stripe, Tailwind CSS
- **Auth:** 7-level RBAC (Platform Operator → Vendor)
- **Modules:** Dashboard, Associations, Units, Owners, Charges, Bills, Work Orders, Reports, Settings
- **DO NOT MODIFY:** Accounting, reports, units, charges — production-perfect

## Agency Modules

Each module is a standalone service that complements Portier. Client onboarding flow:

```
New client signs up
  → Website Rebuild: spins up custom Next.js site on Vercel
  → Chat Widget: embedded on the site, captures leads
  → Voice Agent: Twilio number + Vapi AI receptionist goes live
  → Review Engine: GMB connected, auto-responds to reviews
  → Content Machine: 30-day content calendar generated
  → Search Dominance: structured data + LLMs.txt deployed
  → Monitoring: cron jobs auto-discover the new site
```

## Quick Start

```bash
# Main app
npm install && npm run dev          # http://localhost:3000

# Website rebuild — onboard a client
cd packages/agency-website-template
node scripts/onboard.mjs --name "Client" --domain client.com --email hello@client.com

# Chat widget — build and embed
cd packages/agency-chat-widget
node build.mjs
# <script src="dist/widget.js" data-api="/api/chat" data-color="#2563eb"></script>
```

## Cron Jobs (Hermes)

| Job | Schedule | ID |
|-----|----------|-----|
| Site Uptime Monitor | every 30 min | `87fbce8c1e2f` |
| SSL Certificate Monitor | every Monday 9am | `f3e0139cb946` |
| Review Engine Pipeline | every 30 min | `8ac50ef52ffa` |
