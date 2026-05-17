# Portier369 — Project TODO

## Database Schema
- [x] Extend users table with portier-specific role enum (super_admin, company_admin, portfolio_manager, property_manager, accountant, assistant_manager, owner, vendor, resident)
- [x] Create companies table (property management companies)
- [x] Create properties table (individual condo communities)
- [x] Create property_assignments table (manager ↔ property)
- [x] Create work_tickets table
- [x] Create ticket_comments table
- [x] Create schedule_events table
- [x] Create meetings table
- [x] Create meeting_action_items table
- [x] Create vendors table
- [x] Create email_threads table
- [x] Run db:push to apply migrations

## Landing Page
- [x] Match portier369.com brand: warm cream bg, editorial serif, charcoal text, olive/gold accents
- [x] Hero section with headline, subheadline, dual CTAs (Start Free Trial / Book Demo)
- [x] Features grid (6 key modules)
- [x] Role hierarchy explainer section
- [x] Pricing tiers (Starter, Growth, Professional, Enterprise)
- [x] FAQ accordion
- [x] Footer with nav links

## Authentication & Role System
- [x] Multi-tier role enum in schema
- [x] SuperAdmin: invisible login / impersonation (can log in as any company)
- [x] Company Admin login → company dashboard
- [x] Portfolio Manager login → portfolio view
- [x] Property Manager login → single property workspace
- [x] Sub-role creation by Property Manager (accountant, assistant, owner, vendor, resident)
- [x] Role-based route guards in App.tsx
- [x] Login page with role-aware redirect

## SuperAdmin Dashboard
- [x] Customer list (all companies)
- [x] Company detail view
- [x] Impersonate / invisible login into any company
- [x] Platform-wide stats (total properties, tickets, users)

## Company Admin Dashboard
- [x] Portfolio overview (all properties under company)
- [x] Manager management (add/remove/assign managers)
- [x] Company settings and branding
- [x] Billing and subscription view

## Portfolio Manager Dashboard
- [x] Cross-property summary view
- [x] Aggregate ticket and schedule overview
- [x] Manager performance metrics

## Property Manager Workspace
- [x] Property overview card
- [x] Open tickets summary
- [x] Today's schedule
- [x] Recent emails
- [x] Upcoming meetings
- [x] Quick-add sub-users (accountant, assistant, owner, vendor, resident)

## Work Tickets Module
- [x] Ticket inbox list view with filters (status, priority, category)
- [x] Create ticket form (title, description, category, priority, assignee)
- [x] Ticket detail view with comments and status workflow
- [x] Ticket categories: common-area, unit-related, emergency, vendor, board matter

## Scheduling Hub
- [x] Calendar view (month/week/day)
- [x] Create event form (type, date, time, assignee, property)
- [x] Event types: inspection, vendor visit, maintenance, board meeting, deadline
- [x] Recurring event support

## Email Hub
- [x] Email thread list view
- [x] Link email to ticket/property/unit
- [x] AI-draft reply button (using LLM integration)
- [x] Gmail / Outlook connect placeholders

## Meeting Hub
- [x] Meeting list view
- [x] Create meeting form (agenda, attendees, date)
- [x] Agenda builder
- [x] Action items tracker
- [x] AI meeting summary (using LLM integration)

## Vendor Management
- [x] Vendor directory list
- [x] Vendor profile (contact, insurance, contracts)
- [x] Insurance expiry alerts
- [x] Work history log

## Global UX
- [x] Sidebar navigation (role-aware items)
- [x] Responsive mobile layout
- [x] Toast notifications
- [x] Loading skeletons
- [x] Empty state illustrations

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

## Email → Work Ticket Conversion
- [x] Add sourceEmailId foreign key column to tickets table in schema and run db:push
- [x] Add email.convertToTicket tRPC procedure that maps AI fields to ticket fields and saves both
- [x] Map aiUrgency → ticket priority, aiCategory → ticket category, aiMatchedPropertyId → ticket propertyId
- [x] Mark email as converted (set sourceEmailId on ticket, add convertedToTicketId on email thread)
- [x] Add Convert to Ticket button on each email card (only show when email has AI categorization)
- [x] Build pre-filled confirmation dialog showing all auto-populated ticket fields with edit capability
- [x] Show linked ticket badge on email card after conversion (with ticket ID link)
- [x] Prevent duplicate conversion (disable button if email already converted)
- [x] Write vitest tests for emailToTicket field mapping logic

## Ticket File Attachments
- [x] Add ticket_attachments table to schema (id, ticketId, uploadedBy, fileName, fileKey, fileUrl, mimeType, fileSize, createdAt)
- [x] Run db:push for new table
- [x] Add POST /api/tickets/upload Express route (multipart, calls storagePut, returns key+url)
- [x] Add tRPC procedures: tickets.listAttachments, tickets.deleteAttachment
- [x] Add file upload dropzone to ticket creation form (photos + documents, max 10MB each, max 5 files)
- [x] Add attachment panel to ticket detail/expand view with image previews and document icons
- [x] Show upload progress bar during upload
- [x] Allow delete of own attachments (with confirmation)
- [x] Support image preview lightbox on click
- [x] Write vitest tests for attachment upload validation logic

## Kanban Board View for Work Tickets
- [x] Install @dnd-kit/core and @dnd-kit/sortable for drag-and-drop
- [x] Build KanbanBoard component with 5 status columns (Open, In Progress, Pending Vendor, Resolved, Closed)
- [x] Build draggable KanbanCard component with ticket info, priority badge, category chip, attachment count
- [x] Wire drag-end event to trpc.tickets.updateStatus mutation with optimistic update
- [x] Add view toggle (List / Kanban) in the Tickets page header
- [x] Persist view preference in localStorage
- [x] Show column ticket count badge
- [x] Highlight drop target column on drag-over
- [x] Show empty column placeholder when no tickets
- [x] Write vitest tests for Kanban status column mapping logic

## Resident & Owner Portal
- [x] Add portalUserId and unitNumber fields to tickets table (for resident-submitted tickets)
- [x] Add tRPC procedures: portal.submitRequest, portal.myTickets, portal.getTicket, portal.addComment
- [x] Restrict portal procedures to resident/owner roles only
- [x] Build PortalLayout component (clean minimal nav, no manager sidebar)
- [x] Build portal landing/welcome page with property info and quick actions
- [x] Build Submit Request form (title, category, description, unit, photo upload)
- [x] Build My Tickets list with status timeline and last-updated indicator
- [x] Build Ticket Detail view with status history, manager comments, and resident reply
- [x] Add role-based redirect: resident/owner → /portal, manager+ → /dashboard
- [x] Add /portal route and PortalLayout to App.tsx
- [x] Write vitest tests for portal.submitRequest and portal.myTickets procedures
