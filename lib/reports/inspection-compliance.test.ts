import { describe, expect, it } from 'vitest';
import { complianceExportRows, complianceMetrics, findingsBySeverity, type ComplianceFinding, type ComplianceInspection } from '@/lib/reports/inspection-compliance';

const NOW = new Date('2026-10-04T03:00:00Z'); // still Oct 3 in Chicago
const insp = (p: Partial<ComplianceInspection>): ComplianceInspection => ({
  id: 'i1', association_id: 'a', inspection_type: 'annual', status: 'scheduled',
  scheduled_date: '2026-10-01', completed_date: null, ...p,
});
const find = (p: Partial<ComplianceFinding>): ComplianceFinding => ({
  inspection_id: 'i1', severity: 'minor', resolved: false, resolved_at: null, work_order_id: null,
  created_at: '2026-10-01T12:00:00Z', ...p,
});

describe('inspection compliance metrics', () => {
  it('splits inspections into on time, late and overdue', () => {
    const m = complianceMetrics([
      insp({ id: '1', status: 'completed', completed_date: '2026-10-01' }),
      insp({ id: '2', status: 'completed', completed_date: '2026-10-04' }),
      insp({ id: '3' }),
      insp({ id: '4', scheduled_date: '2026-10-09' }),
      insp({ id: '5', status: 'completed' }),
    ], [], NOW);
    expect(m).toMatchObject({ inspections: 5, completed: 3, onTime: 1, late: 1, overdueNow: 1, medianDaysLate: 3 });
    expect(m.onTimeRate).toBeCloseTo(1 / 3); // 1 on time ÷ (on time + late + overdue); no-date completion excluded
  });

  it('judges overdue by the association-local date', () => {
    const due = [insp({ scheduled_date: '2026-10-03', time_zone: 'America/Chicago' })];
    expect(complianceMetrics(due, [], NOW).overdueNow).toBe(0);
    expect(complianceMetrics([{ ...due[0], time_zone: 'UTC' }], [], NOW).overdueNow).toBe(1);
  });

  it('counts findings of the selected inspections only', () => {
    const m = complianceMetrics([insp({ id: 'i1' })], [
      find({ severity: 'critical' }),
      find({ severity: 'minor', resolved: true, resolved_at: '2026-10-03T12:00:00Z', work_order_id: 'w1' }),
      find({ inspection_id: 'other', severity: 'critical' }),
    ], NOW);
    expect(m).toMatchObject({ findings: 2, openFindings: 1, openSerious: 1, sentToWorkOrder: 1, medianDaysToResolve: 2 });
  });

  it('groups findings by severity', () => {
    expect(findingsBySeverity([find({ severity: 'major' }), find({ severity: 'major', resolved: true }), find({ severity: 'info' })]))
      .toEqual([{ severity: 'major', total: 2, open: 1 }, { severity: 'info', total: 1, open: 1 }]);
  });

  it('exports association, type and severity sections with the same columns', () => {
    const rows = complianceExportRows(
      [insp({ id: 'i1', association_id: 'b' }), insp({ id: 'i2', association_id: 'a', inspection_type: 'move_out' })],
      [find({ severity: 'major' })],
      new Map([['a', 'Alder'], ['b', 'Birch']]),
      NOW,
    );
    expect(rows.map((r) => `${r.section}: ${r.group}`)).toEqual([
      'By association: Alder',
      'By association: Birch',
      'By association: All associations',
      'By inspection type: Annual',
      'By inspection type: Move out',
      'Findings by severity: Major',
    ]);
    expect(rows[5]).toMatchObject({ findings_total: 1, open_findings: 1, inspections: null });
    expect(new Set(rows.map((r) => Object.keys(r).join()))).toHaveProperty('size', 1);
  });
});
