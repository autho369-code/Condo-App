# TODO — Needs Your Review/Approval

_No blockers. Building continues. Review when you wake up._

## 🔴 Critical — Environment Variables Needed

These are referenced in the code but not yet set. Without them, the corresponding modules won't work in production:

- [ ] `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` — for AI Voice Receptionist phone provisioning
- [ ] `VAPI_API_KEY` — for Vapi voice agent creation
- [ ] `GMB_CLIENT_ID` + `GMB_CLIENT_SECRET` + `GMB_REFRESH_TOKEN` — for Google My Business review engine
- [ ] `OPENAI_API_KEY` — for review auto-respond + content script generation
- [ ] `DISCORD_MONITORING_WEBHOOK` — for uptime alerts
- [ ] `DISCORD_ALERTS_WEBHOOK` — for negative review alerts

## 🟡 Decisions

- [ ] **Pricing for agency services** — currently placeholder numbers in brand template. What do you charge per module?
- [ ] **Vercel account** — need `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` for auto-deploy GitHub Action
- [ ] **cal.diy account** — need `CALDIY_API_URL` + `CALDIY_API_KEY` for booking calendar in chat widget
- [ ] **Supabase project for agency** — chat widget uses its own Supabase. Create a new project or reuse Condo-App's?
- [ ] **Domain for agency landing page** — the agency-website-template needs a real domain

## 🟢 Nice to Have (Future)

- [ ] Video generation pipeline — currently script-only. Need actual video rendering (Remotion, Shotstack, or similar)
- [ ] Auto-posting to TikTok/Reels/Shorts — APIs require business accounts + approval
- [ ] AI search ranking reports — needs real-time SERP data (SEMRush API, DataForSEO, etc.)
- [ ] Analytics dashboard — aggregate metrics across all modules
- [ ] Client portal — self-serve onboarding instead of CLI scripts
