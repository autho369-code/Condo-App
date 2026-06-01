import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip } from '@/components/operations/status-chip';
import { MetricStrip } from '@/components/operations/metric-strip';

describe('operations primitives', () => {
  it('renders a status chip with the provided label', () => {
    render(<StatusChip tone="success">Enabled</StatusChip>);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('renders metrics with labels and values', () => {
    render(<MetricStrip metrics={[{ label: 'Open violations', value: 12 }, { label: 'Unreconciled', value: '$4,500' }]} />);
    expect(screen.getByText('Open violations')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Unreconciled')).toBeInTheDocument();
    expect(screen.getByText('$4,500')).toBeInTheDocument();
  });
});
