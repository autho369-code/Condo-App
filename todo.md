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

## Owner Portal Expansion
- [x] Add owner_accounts table (ownerId, propertyId, companyId, balanceCents, currency, notes)
- [x] Add payment_transactions table (ownerId, propertyId, companyId, amountCents, method, status, description, referenceNumber)
- [x] Add property_documents table (propertyId, companyId, uploadedById, title, description, category, fileKey, fileUrl, mimeType, fileSize, isSharedWithOwners)
- [x] Add owner_messages table (propertyId, companyId, ownerId, managerId, direction, channel, subject, body, threadKey, isReadByOwner, isReadByManager)
- [x] Run db:push for all 4 new tables
- [x] Add portal.getAccountBalance tRPC procedure (returns balance + transaction history)
- [x] Add portal.makePayment tRPC procedure (records payment intent, updates balance)
- [x] Add portal.listDocuments tRPC procedure (returns shared documents for a property)
- [x] Add portal.getMessages tRPC procedure (returns owner-manager message thread)
- [x] Add portal.sendMessage tRPC procedure (owner sends message to management)
- [x] Add documents.listByProperty tRPC procedure (manager: all docs for a property)
- [x] Add documents.toggleShare tRPC procedure (manager: toggle owner visibility)
- [x] Add documents.delete tRPC procedure (manager: delete document)
- [x] Add documents.ownerMessages tRPC procedure (manager inbox: all owner messages)
- [x] Add documents.replyToOwner tRPC procedure (manager: reply to owner message)
- [x] Add POST /api/properties/:propertyId/documents Express route (S3 upload, manager auth)
- [x] Update ResidentPortal.tsx with Account Balance view (balance card + transaction history)
- [x] Update ResidentPortal.tsx with Make Payment view (amount, method, description, reference)
- [x] Update ResidentPortal.tsx with Shared Documents view (category filter, download button)
- [x] Update ResidentPortal.tsx with Contact Management view (message thread + compose form)
- [x] Update portal home screen with new quick action tiles for owners
- [x] Update Properties.tsx with expandable document panel per property
- [x] Add document upload dialog (title, category, description, file, share toggle)
- [x] Add share/private toggle switch per document with Eye/EyeOff indicator
- [x] Add delete document button with confirmation
- [x] Write vitest tests for owner portal logic (balance, payments, documents, messages)
- [x] All 138 tests passing

## Automated Document Notification System
- [x] Add owner_notifications table (ownerId, propertyId, companyId, type, title, body, documentId, isRead, emailSent, createdAt)
- [x] Run db:push for new table
- [x] Add DB helpers: createOwnerNotification, getNotificationsByOwner, markNotificationRead, markNotificationsRead, getUnreadCount
- [x] Build notifyDocumentShared(documentId) server helper — creates in-app notifications for all owners of the property
- [x] Build sendDocumentEmail helper — sends branded HTML email via Forge API
- [x] Trigger notification on documents.toggleShare (when isShared flips true)
- [x] Trigger notification on POST /api/properties/:propertyId/documents (when isSharedWithOwners=true at upload time)
- [x] Add portal.getNotifications tRPC procedure (returns unread + recent notifications for logged-in owner)
- [x] Add portal.markNotificationRead tRPC procedure
- [x] Add portal.markAllNotificationsRead tRPC procedure
- [x] Add portal.getUnreadCount tRPC procedure (polls every 30s on frontend)
- [x] Add notification bell icon with unread badge to portal header
- [x] Build Notifications view in owner portal (list, unread dot, mark-read, mark-all-read)
- [x] Email sent indicator on each notification card
- [x] Write 12 vitest tests for notification trigger logic and DB helpers — all passing
- [x] Full test suite: 150 tests passing

## Owner Notification Preferences
- [x] Add owner_notification_prefs table (ownerId, docSharedInApp, docSharedEmail, paymentDueInApp, paymentDueEmail, msgReceivedInApp, msgReceivedEmail, ticketUpdateInApp, ticketUpdateEmail)
- [x] Run db:push for new table
- [x] Add DB helpers: upsertNotificationPrefs, getNotificationPrefs with DEFAULT_NOTIFICATION_PREFS fallback
- [x] Add portal.getNotificationPrefs tRPC procedure (portalProcedure, returns prefs or defaults)
- [x] Add portal.saveNotificationPrefs tRPC procedure (portalProcedure, partial update upsert)
- [x] Update notifyDocumentShared to call getNotificationPrefs per owner before creating in-app notification or sending email
- [x] Build Settings view in owner portal (4 notification type cards, each with In-App + Email toggles)
- [x] Add Settings quick action tile to portal home (owners only)
- [x] Add "settings" view type to PortalView union and goBack handler
- [x] Sticky unsaved-changes bar with Save and Discard buttons
- [x] Write 12 vitest tests for preference-aware notification logic — all passing
- [x] Full test suite: 163 tests passing

## Manager Owner Messages Inbox
- [x] Review owner_messages schema and existing DB helpers
- [x] Add isReadByManager column to owner_messages table + db:push migration
- [x] Add getOwnerMessageThreads DB helper (grouped by threadKey, with unread count per thread)
- [x] Add getThreadMessages DB helper (all messages in a thread, ordered by createdAt)
- [x] Add markThreadReadByManager DB helper (mark all messages in thread as read by manager)
- [x] Add getTotalUnreadManagerCount DB helper (total unread across all properties for a company)
- [x] Add documents.getMessageThreads tRPC procedure (manager: list all threads with metadata)
- [x] Add documents.getThreadMessages tRPC procedure (manager: messages in a specific thread)
- [x] Add documents.markThreadRead tRPC procedure (manager: mark thread as read)
- [x] Add documents.getTotalUnread tRPC procedure (manager: total unread badge count)
- [x] Update documents.replyToOwner to accept threadKey and auto-mark thread as read after reply
- [x] Build OwnerMessages.tsx page (thread list + reply panel, two-column layout on desktop)
- [x] Thread list: property badge, owner name, last message preview, timestamp, unread dot
- [x] Thread list sorted: unread first, then by most recent message
- [x] Thread detail: full message history with chat bubbles, manager reply compose box, Ctrl+Enter to send
- [x] Auto-mark thread as read when manager opens it
- [x] Auto-scroll to latest message when thread opens or new message arrives
- [x] Unread badge on sidebar nav item (polls every 60s)
- [x] Add "Owner Messages" nav entry to DashboardLayout sidebar
- [x] Register /dashboard/owner-messages route in App.tsx
- [x] Write 14 vitest tests for new DB helpers and tRPC procedures — all passing
- [x] Full test suite: 177 tests passing

## Manager Reply Notifications
- [x] Review notificationService.ts and owner_notification_prefs schema
- [x] Add getUserById DB helper for owner email/name lookup
- [x] Add notifyManagerReply(ownerId, propertyId, companyId, managerName, replyBody, propertyName) to notificationService.ts
- [x] Respect msgReceivedInApp and msgReceivedEmail preferences per owner
- [x] Create in-app notification (type: "message_received") with truncated body preview
- [x] Send branded HTML email with manager name, property name, and reply preview
- [x] Wire notifyManagerReply into documents.replyToOwner tRPC procedure (fire-and-forget, never blocks reply)
- [x] Clicking a "message_received" notification in the portal navigates to the Messages view
- [x] Clicking a "document_shared" notification navigates to the Documents view
- [x] Updated empty-state description to mention manager replies
- [x] Write 18 vitest tests for notifyManagerReply logic and preference gating — all passing
- [x] Full test suite: 195 tests passing

## Ticket Update Notifications
- [x] Review tickets schema (status enum, reportedById, propertyId) and updateTicketStatus procedure
- [x] Add notifyTicketUpdate(ticketId, newStatus, oldStatus) to notificationService.ts
- [x] Owner-role guard: only notify when reporter has portierRole === "owner"
- [x] No-op guard: skip when newStatus === oldStatus
- [x] Respect ticketUpdateInApp and ticketUpdateEmail preferences per owner
- [x] Create in-app notification (type: "ticket_update") with ticket title, new status label, and property name
- [x] Send branded HTML email with ticket title, old status → new status badge, and portal CTA
- [x] Wire notifyTicketUpdate into tickets.updateStatus tRPC procedure (fire-and-forget, fetches old status first)
- [x] Clicking ticket_update notification in portal navigates to my-tickets view
- [x] Updated empty-state description to mention ticket status changes
- [x] Write 24 vitest tests for notifyTicketUpdate logic and preference gating — all passing
- [x] Full test suite: 219 tests passing

## Tasks Panel Quick Actions (3-Panel Layout)
- [x] Read DashboardLayout.tsx and Tasks panel to understand current structure
- [x] Build right Tasks panel component with collapsible toggle (open/close button)
- [x] Add QUICK ACTIONS section: Open work orders, Schedule hearing, Send email blast, View meetings
- [x] Add OWNER COMMUNICATIONS section: View owner messages, Owner portal
- [x] Add PROPERTIES & DOCUMENTS section: Manage properties, Upload document, View all documents
- [x] Add WORK ORDERS section: All tickets, Urgent tickets, Manage vendors
- [x] Add ACCOUNTING section: Post charge, Record credit, Payment history
- [x] Add REPORTS & ANALYTICS section: View analytics
- [x] Add NOTIFICATIONS section: Notification history, Settings
- [x] Role-based section visibility (managers only see relevant sections)
- [x] Tasks panel toggle button on right edge when panel is closed
- [x] Mobile: Tasks panel as overlay with backdrop dismiss
- [x] Mobile header: Tasks toggle button in top-right corner
- [x] All 219 tests still passing after layout changes

## Context-Aware Tasks Panel
- [x] Read DashboardLayout.tsx to understand current Tasks panel structure
- [x] Define per-route PAGE_CONTEXT map (10 routes × 4-6 actions each)
- [x] Dashboard: Open work orders, View overdue, Pending approvals, Send email blast, Schedule hearing
- [x] Properties: Add property, Upload document, View documents, Message owners, Post charge, Record credit
- [x] Tickets: New work order, Filter urgent, Assign vendor, Export report, View all vendors
- [x] Owner Messages: Mark all read, Filter by property, View owner portal, Send email blast
- [x] Schedule: New event, View calendar, Send reminder, View meetings
- [x] Email Hub: New email blast, View templates, Scheduled emails, View analytics
- [x] Meetings: New meeting, View agenda, Send minutes, Invite owners
- [x] Vendors: Add vendor, View work orders, Rate vendor, Archive vendor
- [x] Analytics: Export report, Refresh data, Compare properties, View delinquency
- [x] Admin: Manage users, System settings, View audit log, Quick setup
- [x] Context section rendered at TOP with olive accent color and ▸ prefix
- [x] Context section separated from static sections by bottom border
- [x] Static sections (Owner Communications, Accounting, Reports) filtered to not duplicate context section
- [x] Role-based filtering on both context and static sections
- [x] All 219 tests still passing after changes
