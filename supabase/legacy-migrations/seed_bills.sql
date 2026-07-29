INSERT INTO public.payable_bills (id, portfolio_id, association_id, vendor_id, gl_account_id, amount, status, bill_date, due_date, memo)
SELECT
  gen_random_uuid(),
  'a1000000-0000-0000-0000-000000000001',
  a.id,
  v.id,
  g.id,
  (random() * 8000 + 200)::numeric(12,2),
  (ARRAY['pending_approval','pending_approval','approved','approved','paid'])[floor(random()*5)+1]::payable_bill_status,
  (CURRENT_DATE - (floor(random()*45)+1)::int)::date,
  (CURRENT_DATE + (floor(random()*30)+5)::int)::date,
  v.name || ' — ' || (ARRAY['Monthly service','Repair','Emergency call','Quarterly maint.','Annual inspection'])[floor(random()*5)+1]
FROM public.associations a
CROSS JOIN LATERAL (
  SELECT id, name FROM public.vendors WHERE archived_at IS NULL ORDER BY random() LIMIT 1
) v
CROSS JOIN LATERAL (
  SELECT id FROM public.gl_accounts WHERE account_type = 'expense' AND active = true ORDER BY random() LIMIT 1
) g
WHERE a.archived_at IS NULL;
