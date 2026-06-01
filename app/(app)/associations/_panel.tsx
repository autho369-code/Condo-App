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
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#email-board">Email Board Members</PanelLink>
          <PanelLink href="#share-packets">Share Board Member Packets</PanelLink>
          <PanelLink href="#bulk-update-reports">Bulk Update Board Reports</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/board-reports">Board Reports</PanelLink>
          <PanelLink href="/help/board-member-overview">Board Member Association Overview</PanelLink>
          <PanelLink href="/help/board-member-packets">Board Member Packets</PanelLink>
          <PanelLink href="/help/adding-board-members">Adding Board Members</PanelLink>
          <PanelLink href="/help/tracking-board-terms">Tracking Board Member Terms</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/approvals/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#new-approval">New Approval</PanelLink>
          <PanelLink href="#email-board">Email Board Members</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=approval-history">Approval History</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/creating-approvals">Creating Approvals</PanelLink>
          <PanelLink href="/help/voting-schemes">Voting Schemes</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/committees/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#new-committee">New Committee</PanelLink>
          <PanelLink href="#email-committee">Email Committee Members</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/committees">Managing Committees</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/architectural-reviews/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#edit-settings">Edit Settings</PanelLink>
          <PanelLink href="#view-submissions">View Submissions</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/architectural-reviews">Architectural Reviews</PanelLink>
          <PanelLink href="/help/configuring-review-forms">Configuring Review Forms</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/budget/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/assessments/update">Update Assessments</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=annual-budget-comparison">Annual Budget Comparison</PanelLink>
          <PanelLink href="/reports?slug=annual-budget-approved">Annual Budget — Approved</PanelLink>
          <PanelLink href="/reports?slug=budget-detail">Budget Detail</PanelLink>
          <PanelLink href="/reports?slug=budget-components">Budget — Components</PanelLink>
          <PanelLink href="/reports?slug=budget-property-comparison">Budget — Property Comparison</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/add-property-budget">Add a Property Budget</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/amenities/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#create-amenity">Create Amenity</PanelLink>
          <PanelLink href="#view-reservations">View Reservations</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/amenities">Setting Up Amenities</PanelLink>
          <PanelLink href="/help/amenity-reservations">Reservation Workflow</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/units/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="/assessments/update">Update Assessments</PanelLink>
          <PanelLink href="/units/new">New Unit</PanelLink>
          <PanelLink href="/unit-types/new">New Unit Type</PanelLink>
          <PanelLink href="/units/bulk-import-ownership">Bulk Import Ownership Percentages</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=unit-directory">Unit Directory</PanelLink>
          <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
          <PanelLink href="/reports?slug=renter-directory">Renter Directory</PanelLink>
          <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
          <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
          <PanelLink href="/reports?slug=activities-summary">Activities Summary</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/managing-hoas">Managing HOAs</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  if (/^\/associations\/[^/]+\/profile/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Tasks">
          <PanelLink href="#edit-association">Edit Association</PanelLink>
          <PanelLink href="/units/new">New Unit</PanelLink>
        </PanelSection>
        <PanelSection title="Reports">
          <PanelLink href="/reports?slug=association-summary">Association Summary</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="/help/managing-hoas">Managing HOAs</PanelLink>
        </PanelSection>
      </ContextPanel>
    );
  }

  // /associations/new
  if (/^\/associations\/new/.test(pathname)) {
    return (
      <ContextPanel title="Tasks">
        <PanelSection title="Help Topics">
          <PanelLink href="/help/adding-a-property">Adding a Property</PanelLink>
          <PanelLink href="/help/import-association">Importing a New Association</PanelLink>
          <PanelLink href="/help/managing-hoas">Managing HOAs</PanelLink>
          <PanelLink href="/help/property-groups">Property Groups</PanelLink>
          <PanelLink href="/help/lease-templates">Lease Templates</PanelLink>
          <PanelLink href="/help/late-fee-policies">Late Fee Policies</PanelLink>
        </PanelSection>
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
        <PanelLink href="/associations/new">New Property</PanelLink>
        <PanelLink href="/associations/new">New Association</PanelLink>
        <PanelLink href="#meeting-sign-in">Meeting Sign-In</PanelLink>
        <PanelLink href="#violations-field-entry">Violations Field Entry</PanelLink>
        <PanelLink href="#bulk-update-board-reports">Bulk Update Board Reports</PanelLink>
      </PanelSection>
      <PanelSection title="Reports">
        <PanelLink href="/reports?slug=owner-directory">Owner Directory</PanelLink>
        <PanelLink href="/reports?slug=unit-directory">Unit Directory</PanelLink>
        <PanelLink href="/reports?slug=renter-directory">Renter Directory</PanelLink>
        <PanelLink href="/reports?slug=dues-roll">Dues Roll</PanelLink>
        <PanelLink href="/reports?slug=general-ledger">General Ledger</PanelLink>
      </PanelSection>
      <PanelSection title="Statements">
        <PanelLink href="/bulk-statement-settings">Bulk Update Statement Settings</PanelLink>
      </PanelSection>
      <PanelSection title="Help Topics">
        <PanelLink href="/help/import-association">Import a New Association</PanelLink>
        <PanelLink href="/help/managing-hoas">Managing HOAs</PanelLink>
        <PanelLink href="/help/property-groups">Managing Property Groups</PanelLink>
        <PanelLink href="/help/owner-statements">Sending Homeowner Statements</PanelLink>
      </PanelSection>
    </ContextPanel>
  );
}
