import { describe, expect, it } from 'vitest';
import { buildTeamScoreboard } from './team-performance';

const staff = [{ id: 'u1', name: 'Meho' }, { id: 'u2', name: 'Ana' }];

describe('buildTeamScoreboard', () => {
  it('counts open, overdue and window completions per assignee', () => {
    const board = buildTeamScoreboard({
      staff,
      since: '2026-09-01',
      today: '2026-09-30',
      labor: [],
      workOrders: [
        { id: 'a', assignee_id: 'u1', status: 'assigned', priority: 'normal', created_at: '2026-09-20T10:00:00Z', scheduled_date: '2026-09-25', completed_date: null },
        { id: 'b', assignee_id: 'u1', status: 'completed', priority: 'emergency', created_at: '2026-09-10T10:00:00Z', scheduled_date: null, completed_date: '2026-09-12' },
        { id: 'c', assignee_id: 'u1', status: 'completed', priority: 'normal', created_at: '2026-09-01T10:00:00Z', scheduled_date: null, completed_date: '2026-09-05' },
        { id: 'd', assignee_id: 'u1', status: 'completed', priority: 'normal', created_at: '2026-07-01T10:00:00Z', scheduled_date: null, completed_date: '2026-07-02' },
        { id: 'v', assignee_id: null, vendor_id: 'ven', status: 'assigned', priority: 'normal', created_at: '2026-09-29T10:00:00Z', scheduled_date: null, completed_date: null },
        { id: 'e', assignee_id: null, status: 'new', priority: 'normal', created_at: '2026-09-29T10:00:00Z', scheduled_date: null, completed_date: null },
        { id: 'f', assignee_id: 'u2', status: 'cancelled', priority: 'normal', created_at: '2026-09-29T10:00:00Z', scheduled_date: null, completed_date: null },
      ],
    });
    const meho = board.members.find((m) => m.id === 'u1')!;
    expect(meho).toMatchObject({ open: 1, overdue: 1, completed: 2, emergenciesCompleted: 1, averageDaysToComplete: 3 });
    expect(board.members.find((m) => m.id === 'u2')).toMatchObject({ open: 0, completed: 0 });
    expect(board.unassignedOpen).toBe(1);
    expect(board.members[0].id).toBe('u1');
  });

  it('adds labor in the window to staff, and keeps typed-in names separate', () => {
    const board = buildTeamScoreboard({
      staff,
      since: '2026-09-01',
      today: '2026-09-30',
      workOrders: [],
      labor: [
        { tech_id: 'u2', tech_name: 'Ana', date_worked: '2026-09-03', hours: '2.5', labor_cost: '100' },
        { tech_id: 'u2', tech_name: 'Ana', date_worked: '2026-09-09', hours: 1, labor_cost: 40 },
        { tech_id: 'u2', tech_name: 'Ana', date_worked: '2026-08-30', hours: 9, labor_cost: 900 },
        { tech_id: null, tech_name: 'Day helper', date_worked: '2026-09-04', hours: 4, labor_cost: null },
        { tech_id: null, tech_name: 'day helper ', date_worked: '2026-09-05', hours: 1, labor_cost: 20 },
      ],
    });
    expect(board.members.find((m) => m.id === 'u2')).toMatchObject({ hours: 3.5, laborCost: 140, lastWorked: '2026-09-09' });
    expect(board.otherLabor).toEqual([{ name: 'Day helper', hours: 5, laborCost: 20 }]);
  });

  it('credits a finished job to whoever finished it and ignores future labor', () => {
    const board = buildTeamScoreboard({
      staff,
      since: '2026-09-01',
      today: '2026-09-30',
      workOrders: [
        { id: 'r', assignee_id: 'u2', completed_by_assignee_id: 'u1', status: 'closed', priority: 'normal', created_at: '2026-09-05T00:00:00Z', scheduled_date: null, completed_date: '2026-09-06' },
        { id: 's', assignee_id: null, completed_by_assignee_id: 'u1', status: 'done', priority: 'normal', created_at: '2026-09-05T00:00:00Z', scheduled_date: null, completed_date: '2026-09-07' },
        { id: 't', assignee_id: 'u2', completed_by_assignee_id: null, status: 'closed', priority: 'normal', created_at: '2026-09-05T00:00:00Z', scheduled_date: null, completed_date: '2026-09-08' },
      ],
      labor: [{ tech_id: 'u1', tech_name: 'Meho', date_worked: '2026-10-05', hours: 8, labor_cost: 400 }],
    });
    expect(board.members.find((m) => m.id === 'u1')).toMatchObject({ completed: 2, hours: 0, lastWorked: null });
    expect(board.members.find((m) => m.id === 'u2')).toMatchObject({ completed: 0 });
    expect(board.unassignedOpen).toBe(0);
  });

  it('keeps work assigned to someone no longer on staff', () => {
    const board = buildTeamScoreboard({
      staff,
      since: '2026-09-01',
      today: '2026-09-30',
      labor: [],
      workOrders: [{ id: 'x', assignee_id: 'gone', status: 'in_progress', priority: 'high', created_at: '2026-09-02T00:00:00Z', scheduled_date: null, completed_date: null }],
    });
    expect(board.members.find((m) => m.id === 'gone')).toMatchObject({ name: 'Former staff', open: 1 });
  });
});
