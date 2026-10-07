# white-label-checker memory

## Confirmed rules (Mirsad)
- Every client has its own domain; build for new clients, not the current sample data.
- Keep "Powered by Portier369" and "Generated securely by Portier369".

## Recurring mistakes
- `from_name: 'Portier369'` on company mail makes the worker send it as platform mail. Company mail uses the company name or `null`.
- SQL helpers once used `coalesce(company, 'Portier369')`; the fallback must be the company only (migration 20261007010000).
- Preview images/links built from `NEXT_PUBLIC_SITE_URL` instead of the tenant or custom-domain host.
