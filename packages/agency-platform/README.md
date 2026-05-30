# Agency Platform — AI-Powered Digital Agency Operating System

Built by Hermes Agent for Mirsad. 7 modules, 7 repos, 3 live cron jobs.

## Architecture

```
                    ┌──────────────────────────────────┐
                    │     AIOS Dashboard (:3001)        │
                    │  14 agents · Hermes LLM backend   │
                    └──────────────┬───────────────────┘
                                   │
        ┌──────────────┬───────────┼───────────┬──────────────┐
        ▼              ▼           ▼           ▼              ▼
   ┌─────────┐  ┌──────────┐ ┌──────────┐ ┌────────┐  ┌──────────────┐
   │Website   │  │Voice     │ │Review    │ │Content │  │Search        │
   │Rebuild   │  │Agent     │ │Engine    │ │Machine │  │Dominance     │
   └────┬─────┘  └────┬─────┘ └────┬─────┘ └───┬────┘  └──────┬───────┘
        │              │            │           │              │
   ┌────┴─────┐  ┌────┴─────┐ ┌────┴─────┐ ┌───┴────┐  ┌──────┴───────┐
   │Template  │  │Twilio    │ │GMB API   │ │OpenAI  │  │Schema.org    │
   │Next.js   │  │Vapi      │ │Auto-GPT  │ │Scripts │  │LLMs.txt      │
   │Vercel    │  │Calendar  │ │Discord   │ │Calendar│  │Rank Reports  │
   └──────────┘  └──────────┘ └──────────┘ └────────┘  └──────────────┘

   ┌──────────────────────────────────────────────────────┐
   │              Operations Layer                         │
   │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
   │  │Uptime    │  │SSL       │  │Chat Widget       │   │
   │  │30m cron  │  │Weekly    │  │Supabase Backend  │   │
   │  └──────────┘  └──────────┘  └──────────────────┘   │
   └──────────────────────────────────────────────────────┘
```

## Modules

| # | Module | Repo | What it does |
|---|--------|------|-------------|
| 1 | Website Rebuild | `agency-website-template` | Next.js template, Vercel CI/CD, client onboarding CLI |
| 2 | AI Booking Agent | `agency-chat-widget` | Embeddable chat widget, Supabase schema, cal.diy integration |
| 3 | AI Voice Receptionist | `agency-voice-agent` | Twilio provisioning, Vapi agent, call routing pipeline |
| 4 | AI Review Engine | `agency-review-engine` | GMB API fetch, AI auto-respond, negative review alerts |
| 5 | AI Content Machine | `agency-content-machine` | Video script generation, 30-day content calendar |
| 6 | AI Search Dominance | `agency-search-dominance` | Schema.org JSON-LD, LLMs.txt generation, ranking reports |
| 7 | Operations | `agency-monitoring` | Uptime checks (30m), SSL expiry (weekly), Discord alerts |

## Live Cron Jobs

| Job | Schedule | ID |
|-----|----------|-----|
| Site Uptime Monitor | every 30 min | `87fbce8c1e2f` |
| SSL Certificate Monitor | every Monday 9am | `f3e0139cb946` |
| Review Engine Pipeline | every 30 min | `8ac50ef52ffa` |

## Client Onboarding Flow

```
New client signs up
  → Website Rebuild: onboard.mjs spins up custom site on Vercel
  → AI Booking Agent: chat widget embedded on site
  → AI Voice Receptionist: Twilio number provisioned, Vapi agent live
  → AI Review Engine: GMB connected, auto-respond pipeline active
  → AI Content Machine: 30-day content calendar generated
  → AI Search Dominance: structured data + LLMs.txt deployed
  → Operations: monitoring cron jobs auto-discover new site
```

## Tech Stack (per module)

- **Website Rebuild:** Next.js 16, Tailwind CSS, Vercel, GitHub Actions
- **Chat Widget:** Vanilla JS (5.4KB), Supabase (leads + bookings + service catalog)
- **Voice Agent:** Twilio API, Vapi AI, Deepgram transcription, 11Labs TTS
- **Review Engine:** Google My Business API, OpenAI GPT-4o-mini, Discord webhooks
- **Content Machine:** OpenAI GPT-4o-mini, JSON calendar format
- **Search Dominance:** Schema.org JSON-LD, LLMs.txt spec
- **Monitoring:** Python scripts, Discord webhooks, Hermes cron scheduler

## Quick Start — Onboard a Client

```bash
# 1. Website
cd agency-website-template
node scripts/onboard.mjs --name "Acme PM" --domain acmepm.com --email hello@acmepm.com

# 2. Voice agent (requires Twilio + Vapi keys)
cd agency-voice-agent
TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... VAPI_API_KEY=... \
  node src/onboard-client.mjs --name "Acme PM" --area-code 415

# 3. Review engine (requires GMB + OpenAI keys)
cd agency-review-engine
GMB_CLIENT_ID=... GMB_CLIENT_SECRET=... GMB_REFRESH_TOKEN=... OPENAI_API_KEY=... \
  npm run pipeline

# 4. Content calendar
cd agency-content-machine
OPENAI_API_KEY=... node src/generate-scripts.mjs --brand brand.json
node src/build-calendar.mjs --scripts output/scripts-*.json

# 5. Search dominance
cd agency-search-dominance
node src/generate-structured-data.mjs --site https://acmepm.com
node src/generate-llms-txt.mjs --site https://acmepm.com
```

## Environment Variables Required

See `.env.example` in each repo. Core set:
- `GITHUB_TOKEN` — for repo creation in onboarding script
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — voice agent
- `VAPI_API_KEY` — voice agent AI
- `OPENAI_API_KEY` — review engine + content machine
- `GMB_CLIENT_ID`, `GMB_CLIENT_SECRET`, `GMB_REFRESH_TOKEN` — review engine
- `DISCORD_MONITORING_WEBHOOK`, `DISCORD_ALERTS_WEBHOOK` — monitoring + alerts
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — chat widget backend

## Integration with Portier

The agency modules are designed to complement Portier369.com:
- Chat widget embeds on Portier landing pages
- Voice agent handles Portier sales calls
- Review engine manages Portier's GMB presence
- Content machine generates Portier marketing content
- Search dominance optimizes Portier for AI search engines
