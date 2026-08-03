import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/components/errors/application-error';

describe('ApplicationError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows branded recovery actions and retries the current route', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = vi.fn();

    render(<ApplicationError error={new Error('Invalid association state')} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'We could not load this workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try this page again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
