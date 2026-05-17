# Portier369 — Project TODO

## Database Schema
- [ ] Extend users table with portier-specific role enum (super_admin, company_admin, portfolio_manager, property_manager, accountant, assistant_manager, owner, vendor, resident)
- [ ] Create companies table (property management companies)
- [ ] Create properties table (individual condo communities)
- [ ] Create property_assignments table (manager ↔ property)
- [ ] Create work_tickets table
- [ ] Create ticket_comments table
- [ ] Create schedule_events table
- [ ] Create meetings table
- [ ] Create meeting_action_items table
- [ ] Create vendors table
- [ ] Create email_threads table
- [ ] Run db:push to apply migrations

## Landing Page
- [ ] Match portier369.com brand: warm cream bg, editorial serif, charcoal text, olive/gold accents
- [ ] Hero section with headline, subheadline, dual CTAs (Start Free Trial / Book Demo)
- [ ] Features grid (6 key modules)
- [ ] Role hierarchy explainer section
- [ ] Pricing tiers (Starter, Growth, Professional, Enterprise)
- [ ] FAQ accordion
- [ ] Footer with nav links

## Authentication & Role System
- [ ] Multi-tier role enum in schema
- [ ] SuperAdmin: invisible login / impersonation (can log in as any company)
- [ ] Company Admin login → company dashboard
- [ ] Portfolio Manager login → portfolio view
- [ ] Property Manager login → single property workspace
- [ ] Sub-role creation by Property Manager (accountant, assistant, owner, vendor, resident)
- [ ] Role-based route guards in App.tsx
- [ ] Login page with role-aware redirect

## SuperAdmin Dashboard
- [ ] Customer list (all companies)
- [ ] Company detail view
- [ ] Impersonate / invisible login into any company
- [ ] Platform-wide stats (total properties, tickets, users)

## Company Admin Dashboard
- [ ] Portfolio overview (all properties under company)
- [ ] Manager management (add/remove/assign managers)
- [ ] Company settings and branding
- [ ] Billing and subscription view

## Portfolio Manager Dashboard
- [ ] Cross-property summary view
- [ ] Aggregate ticket and schedule overview
- [ ] Manager performance metrics

## Property Manager Workspace
- [ ] Property overview card
- [ ] Open tickets summary
- [ ] Today's schedule
- [ ] Recent emails
- [ ] Upcoming meetings
- [ ] Quick-add sub-users (accountant, assistant, owner, vendor, resident)

## Work Tickets Module
- [ ] Ticket inbox list view with filters (status, priority, category)
- [ ] Create ticket form (title, description, category, priority, assignee)
- [ ] Ticket detail view with comments and status workflow
- [ ] Ticket categories: common-area, unit-related, emergency, vendor, board matter

## Scheduling Hub
- [ ] Calendar view (month/week/day)
- [ ] Create event form (type, date, time, assignee, property)
- [ ] Event types: inspection, vendor visit, maintenance, board meeting, deadline
- [ ] Recurring event support

## Email Hub
- [ ] Email thread list view
- [ ] Link email to ticket/property/unit
- [ ] AI-draft reply button (using LLM integration)
- [ ] Gmail / Outlook connect placeholders

## Meeting Hub
- [ ] Meeting list view
- [ ] Create meeting form (agenda, attendees, date)
- [ ] Agenda builder
- [ ] Action items tracker
- [ ] AI meeting summary (using LLM integration)

## Vendor Management
- [ ] Vendor directory list
- [ ] Vendor profile (contact, insurance, contracts)
- [ ] Insurance expiry alerts
- [ ] Work history log

## Global UX
- [ ] Sidebar navigation (role-aware items)
- [ ] Responsive mobile layout
- [ ] Toast notifications
- [ ] Loading skeletons
- [ ] Empty state illustrations

## Email OAuth Integration
- [x] Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET to secrets
- [x] Add email_connections table to schema (userId, provider, accessToken, refreshToken, expiresAt, email, syncedAt)
- [x] Run db:push for new schema
- [x] Build Gmail OAuth authorize endpoint (/api/email/gmail/connect)
- [x] Build Gmail OAuth callback handler (/api/email/gmail/callback)
- [x] Build Gmail token refresh helper
- [x] Build Gmail message sync function (fetch last 50 messages via Gmail API)
- [x] Build Outlook OAuth authorize endpoint (/api/email/outlook/connect)
- [x] Build Outlook OAuth callback handler (/api/email/outlook/callback)
- [x] Build Outlook token refresh helper
- [x] Build Outlook message sync function (fetch last 50 messages via Graph API)
- [x] Add tRPC procedures: listConnections, disconnectAccount, syncEmails
- [x] Update Email Hub UI with connected accounts panel
- [x] Add sync button with loading state and last-synced timestamp
- [x] Add Gmail/Outlook source badges on email thread cards
- [x] Write vitest tests for token refresh and sync procedures

## AI Email Categorization
- [x] Add aiUrgency, aiCategory, aiPropertyId, aiConfidence, aiCategorizedAt fields to email_threads schema
- [x] Run db:push for new fields
- [x] Build categorizeEmail(email, properties[]) LLM function using structured JSON output
- [x] Call categorizeEmail automatically on every email during sync (Gmail + Outlook)
- [x] Add tRPC procedure: email.recategorize (re-run AI on a single email)
- [x] Add tRPC procedure: email.bulkRecategorize (re-run AI on all uncategorized emails for a company)
- [x] Update Email Hub UI with urgency badges (critical/high/medium/low)
- [x] Add property tag chips on email cards
- [x] Add filter tabs: All / Critical / High / Unassigned
- [x] Add per-card "Re-categorize" button
- [x] Write vitest tests for categorizeEmail structured output parsing
