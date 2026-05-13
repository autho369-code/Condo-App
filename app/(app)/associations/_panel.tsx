'use client';

// Route-aware right panel for /associations/* pages.
// Reads the pathname client-side and renders the matching ContextPanel
// content (Tasks, Reports, Help Topics groups).
//
// Uses the user's existing ContextPanel/PanelSection/PanelLink primitives
// from components/workspace/context-panel.tsx — same look and feel as
// the rest of the app.
import { usePathname } from 'next/navigation';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export function AssociationsPanel() {
  const pathname = usePathname() || '';

  // ----- Association detail tabs (most specific first) -----
  if (/^\/associations\/[^/]+\/board/.test(pathname)) {
    const associationId = pathname.split('/')[2];
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href={`/associations/${associationId}/documents`}>Share Board Member Packets</PanelLink>
          <PanelLink href="/send-email">Email Board Members</PanelLink>
</PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/approvals/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/send-email">Email Board Members</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=approval-history">Approval History</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/committees/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/send-email">Email Committee Members</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/architectural-reviews/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/reports?slug=architectural-review-log">Architectural Review Log</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/budget/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
</PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=annual-budget-comparison">Annual Budget Comparison</PanelLink>
          <PanelLink href="/reports?slug=annual-budget-approved">Annual Budget — Approved</PanelLink>
          <PanelLink href="/reports?slug=budget-detail">Budget Detail</PanelLink>
          <PanelLink href="/reports?slug=budget-components">Budget — Components</PanelLink>
          <PanelLink href="/reports?slug=budget-association-comparison">Budget - Association Comparison</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/amenities/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/calendar">View Reservations</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/units/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
<PanelLink href="/units/new">New Unit</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=unit-directory">Unit Directory</PanelLink>
          <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
          <PanelLink href="/reports?slug=unit-directory">Unit Directory</PanelLink>
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
          <PanelLink href="/reports?slug=activities-summary">Activities Summary</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/profile/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
<PanelLink href="/units/new">New Unit</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=association-summary">Association Summary</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  // /associations/new
  if (/^\/associations\/new/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
      </ContextPanel>
    );
  }

  // /associations (the list) — matches AppFolio screenshot
  return (
    <ContextPanel title="Tasks">
      <PanelSection title="Calendar">
        <PanelLink href="/calendar">View Calendar</PanelLink>
      </PanelSection>
      <PanelSection title="Tasks">
        <PanelLink href="/associations/new">New Association</PanelLink>
        <PanelLink href="/violations/new">New Violation</PanelLink>
</PanelSection>
      <PanelSection title="Reports">
        <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
        <PanelLink href="/reports?slug=unit-directory">Unit Directory</PanelLink>
        <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
        <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
      </PanelSection>
      <PanelSection title="Statements">
        <PanelLink href="/bulk-statement-settings/new">Bulk Update Statement Settings</PanelLink>
      </PanelSection>
    </ContextPanel>
  );
}
