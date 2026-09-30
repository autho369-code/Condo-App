import { describe, expect, it } from 'vitest';
import { activeWorkOrder, currentWorkOrder, requestKindLabel, responseState } from './intake';

describe('work order selection', () => {
  const closed = { id: 'a', status: 'completed', created_at: '2026-09-01T00:00:00Z' };
  const open = { id: 'b', status: 'assigned', created_at: '2026-09-10T00:00:00Z' };
  const cancelled = { id: 'c', status: 'cancelled', created_at: '2026-09-20T00:00:00Z' };

  it('ignores finished or cancelled orders when deciding triage', () => {
    expect(activeWorkOrder({ work_orders: [closed, cancelled] })).toBeNull();
    expect(activeWorkOrder({ work_orders: [closed, open] })?.id).toBe('b');
    expect(activeWorkOrder({ work_orders: null })).toBeNull();
  });

  it('shows residents the open order, else the latest one', () => {
    expect(currentWorkOrder({ work_orders: [open, cancelled] })?.id).toBe('b');
    expect(currentWorkOrder({ work_orders: [closed, cancelled] })?.id).toBe('c');
    expect(currentWorkOrder({ work_orders: open })?.id).toBe('b');
  });
});

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('responseState', () => {
  it('reports a responded request as done regardless of the due time', () => {
    expect(responseState({ status: 'open', acknowledged_at: '2026-09-30T11:00:00Z', first_response_due_at: '2026-09-30T10:00:00Z' }, NOW))
      .toMatchObject({ tone: 'success', overdue: false });
  });

  it('flags an unanswered request past its due time as overdue', () => {
    expect(responseState({ status: 'open', first_response_due_at: '2026-09-30T09:00:00Z' }, NOW))
      .toEqual({ tone: 'danger', label: 'Overdue 3h', overdue: true });
  });

  it('warns when the reply is due within four hours and counts days beyond 48h', () => {
    expect(responseState({ status: 'waiting', first_response_due_at: '2026-09-30T13:30:00Z' }, NOW)?.tone).toBe('warning');
    expect(responseState({ status: 'open', first_response_due_at: '2026-10-03T12:00:00Z' }, NOW)?.label).toBe('Reply in 3d');
  });

  it('has no state for closed requests nobody acknowledged', () => {
    expect(responseState({ status: 'cancelled', first_response_due_at: '2026-09-30T09:00:00Z' }, NOW)).toBeNull();
  });
});

describe('requestKindLabel', () => {
  it('labels questions by topic and repairs by category', () => {
    expect(requestKindLabel('admin', 'account', 'other')).toBe('Billing / account');
    expect(requestKindLabel('maintenance', null, 'pest_control')).toBe('Pest control');
    expect(requestKindLabel('maintenance', null, null)).toBe('Repair');
  });
});
