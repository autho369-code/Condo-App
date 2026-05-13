import { describe, expect, it } from 'vitest';
import { joinRenterName, occupancyLabel, splitRenterName } from '@/lib/units/renter';

describe('unit renter helpers', () => {
  it('splits renter names into first and last fields for the unit form', () => {
    expect(splitRenterName('Alex Rivera')).toEqual({ firstName: 'Alex', lastName: 'Rivera' });
    expect(splitRenterName('Maria Del Carmen Soto')).toEqual({ firstName: 'Maria', lastName: 'Del Carmen Soto' });
    expect(splitRenterName(null)).toEqual({ firstName: '', lastName: '' });
  });

  it('stores first and last renter names as the existing Supabase renter contact name', () => {
    expect(joinRenterName(' Alex ', ' Rivera ')).toBe('Alex Rivera');
    expect(joinRenterName('Alex', null)).toBe('Alex');
  });

  it('labels unit occupancy from active renter state', () => {
    expect(occupancyLabel(true)).toBe('Renter occupied');
    expect(occupancyLabel(false)).toBe('Owner occupied');
  });
});
