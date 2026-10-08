import { describe, expect, it } from 'vitest';
import {
  mapAppfolioPriority,
  mapAppfolioStatus,
  parseAppfolioAmount,
  parseAppfolioDate,
  parseAppfolioDateTime,
  parseAppfolioWorkOrders,
} from './appfolio-work-orders';

const HEADER = 'Property,Priority,Work Order Type,Home Warranty Expiration,Work Order Number,Job Description,Instructions,Status,Vendor,Unit,Primary Resident,Created At,Estimate Req On,Estimated On,Estimate Amount,Estimate Approval Status,Estimate Approved On,Estimate Approval Last Requested,Scheduled Start,Scheduled End,Work Done On,Completed On,Amount,Invoice,Unit Turn ID,Recurring,Work Order Issue';

// Shaped like AppFolio's export: header, blank line, "-> Property" headings,
// detail rows, subtotal rows (blank first cell) and a final Total row.
const GROUPED = [
  HEADER,
  '',
  '"-> Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630",,,,,,,,,,,,,,,,,,,,,,,,,,',
  '"Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630",Urgent,Resident,,1201-1,"Kitchen sink leaking under cabinet","Call resident before arriving",Completed,Acme Plumbing,101,Jane Doe,10/01/2025 9:15 AM,,,,,,,10/02/2025 1:30 PM,10/02/2025 3:00 PM,10/02/2025,10/03/2025,"$1,250.00",INV-77,,No,Plumbing: Leak',
  '"Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630",Normal,Internal,,1202-1,"Replace hallway light",,Estimate Requested,Bright Electric,,,"10/05/2025",10/05/2025,,,,,,,,,,,,,No,',
  '"Pine Tree Court Condominium Association - 5460 W Higgins Ave Chicago, IL 60630",Whenever,Internal,,1203-1,"Paint lobby",,On Hold Forever,,,,10/06/2025,,,,,,,,,,,,,,No,',
  ',,,,,,,,,,,,,,,,,,,,,,1250.00,,,,',
  '',
  '"-> Granville Courts - 1200 W Granville Ave Chicago, IL 60660",,,,,,,,,,,,,,,,,,,,,,,,,,',
  '"Granville Courts - 1200 W Granville Ave Chicago, IL 60660",Emergency,Unit Turn,12/31/2026,88-2,"Water in basement",,Canceled,,2B,,2025-09-30T22:05:00,,,,,,,,,,,,,T-9,Yes,',
  '"Granville Courts - 1200 W Granville Ave Chicago, IL 60660",Low,Internal,,,"No number row",,New,,,,10/07/2025,,,,,,,,,,,,,,No,',
  ',,,,,,,,,,,,,,,,,,,,,,0.00,,,,',
  '',
  'Total,,,,,,,,,,,,,,,,,,,,,,1250.00,,,,',
].join('\n');

describe('AppFolio Work Order report', () => {
  it('reads the grouped export into work orders per property, skipping subtotal and total rows', () => {
    const { groups, error } = parseAppfolioWorkOrders(GROUPED);
    expect(error).toBeUndefined();
    expect(groups).toHaveLength(2);
    const [pine, granville] = groups!;
    expect(pine.name).toBe('Pine Tree Court Condominium Association');
    expect(pine.address).toBe('5460 W Higgins Ave Chicago, IL 60630');
    expect(pine.workOrders.map((w) => w.number)).toEqual(['1201-1', '1202-1', '1203-1']);
    expect(granville.workOrders.map((w) => w.number)).toEqual(['88-2']);
  });

  it('normalizes dates, times and amounts and maps status and priority', () => {
    const wo = parseAppfolioWorkOrders(GROUPED).groups![0].workOrders[0];
    expect(wo).toMatchObject({
      row: '4',
      unit: '101',
      vendor: 'Acme Plumbing',
      status: 'completed',
      appfolio_status: 'Completed',
      priority: 'high',
      appfolio_priority: 'Urgent',
      type: 'Resident',
      issue: 'Plumbing: Leak',
      job_description: 'Kitchen sink leaking under cabinet',
      instructions: 'Call resident before arriving',
      primary_resident: 'Jane Doe',
      created_on: '2025-10-01',
      scheduled_date: '2025-10-02',
      scheduled_time: '13:30:00',
      scheduled_end: '2025-10-02',
      work_done_on: '2025-10-02',
      completed_on: '2025-10-03',
      amount: 1250,
      invoice: 'INV-77',
    });
    const granville = parseAppfolioWorkOrders(GROUPED).groups![1].workOrders[0];
    expect(granville).toMatchObject({ status: 'cancelled', priority: 'emergency', unit: '2B', created_on: '2025-09-30', home_warranty_expiration: '2026-12-31', unit_turn_id: 'T-9' });
  });

  it('treats an estimate request with a vendor as assigned', () => {
    const wo = parseAppfolioWorkOrders(GROUPED).groups![0].workOrders[1];
    expect(wo).toMatchObject({ status: 'assigned', vendor: 'Bright Electric', unit: null });
  });

  it('defaults unknown status and priority and lists them, and warns about rows without a number', () => {
    const [pine, granville] = parseAppfolioWorkOrders(GROUPED).groups!;
    expect(pine.workOrders[2]).toMatchObject({ status: 'new', priority: 'normal' });
    expect(pine.warnings).toHaveLength(2);
    expect(pine.warnings[0]).toContain('"On Hold Forever"');
    expect(pine.warnings[1]).toContain('"Whenever"');
    expect(granville.warnings).toEqual(['Line 11: no work order number; skipped.']);
  });

  it('groups a flat export (no row groups) by the Property column', () => {
    const flat = [
      HEADER,
      '"Granville Courts - 1200 W Granville Ave Chicago, IL 60660",Normal,Internal,,5-1,Fix gate,,Assigned,Gate Co,,,10/01/2025,,,,,,,,,,,,,,No,',
      '"Pine Tree Court - 5460 W Higgins Ave Chicago, IL 60630",Normal,Internal,,6-1,Fix door,,Scheduled,,,,10/01/2025,,,,,,,10/09/2025,,,,,,,No,',
    ].join('\n');
    const { groups } = parseAppfolioWorkOrders(flat);
    expect(groups?.map((g) => [g.name, g.workOrders.length])).toEqual([['Granville Courts', 1], ['Pine Tree Court', 1]]);
    expect(groups?.[1].workOrders[0]).toMatchObject({ status: 'scheduled', scheduled_date: '2025-10-09', scheduled_time: null });
  });

  it('rejects a file that is not the Work Order report', () => {
    expect(parseAppfolioWorkOrders('Unit Name,Sqft\n101,800\n').error).toMatch(/Work Order report/);
    expect(parseAppfolioWorkOrders('').error).toBeTruthy();
  });

  it('maps every AppFolio status it knows', () => {
    const cases: Array<[string, string]> = [
      ['New', 'new'], ['Estimate Requested', 'new'], ['Estimated', 'new'], ['Assigned', 'assigned'],
      ['Assigned by AppFolio', 'assigned'], ['Scheduled', 'scheduled'], ['Waiting', 'in_progress'],
      ['Work Done', 'done'], ['Completed', 'completed'], ['Completed No Need To Bill', 'completed'],
      ['Canceled', 'cancelled'], ['cancelled', 'cancelled'],
    ];
    for (const [af, portier] of cases) expect(mapAppfolioStatus(af)).toEqual({ status: portier, known: true });
    expect(mapAppfolioStatus('Estimated', true).status).toBe('assigned');
    expect(mapAppfolioStatus('')).toEqual({ status: 'new', known: false });
  });

  it('maps priorities, with blank as normal', () => {
    expect(mapAppfolioPriority('Urgent')).toEqual({ priority: 'high', known: true });
    expect(mapAppfolioPriority('emergency')).toEqual({ priority: 'emergency', known: true });
    expect(mapAppfolioPriority('')).toEqual({ priority: 'normal', known: true });
    expect(mapAppfolioPriority('ASAP')).toEqual({ priority: 'normal', known: false });
  });

  it('parses dates and times defensively', () => {
    expect(parseAppfolioDateTime('1/5/26 12:05 AM')).toEqual({ date: '2026-01-05', time: '00:05:00' });
    expect(parseAppfolioDateTime('01/05/2026 at 12:30 pm')).toEqual({ date: '2026-01-05', time: '12:30:00' });
    expect(parseAppfolioDateTime('2026-01-05')).toEqual({ date: '2026-01-05', time: null });
    expect(parseAppfolioDate('02/30/2026')).toBeNull();
    expect(parseAppfolioDate('soon')).toBeNull();
    expect(parseAppfolioDate('')).toBeNull();
  });

  it('parses amounts', () => {
    expect(parseAppfolioAmount('$1,234.567')).toBe(1234.57);
    expect(parseAppfolioAmount('(12.00)')).toBe(-12);
    expect(parseAppfolioAmount('')).toBeNull();
    expect(parseAppfolioAmount('n/a')).toBeNull();
  });
});
