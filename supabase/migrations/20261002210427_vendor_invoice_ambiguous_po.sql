-- submit_vendor_invoice linked the job's purchase order only when there was
-- exactly one approved PO for the vendor; with several it left the bill
-- unlinked, which skipped the PO over-billing guard. An invoice for a job with
-- more than one open approved PO is now refused until management settles
-- which PO applies (cancel or close the others).
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.submit_vendor_invoice(uuid,text,date,date,numeric,text,text,text)'::regprocedure) into v_def;
  v_new := replace(v_def,
    '  if v_po_count <> 1 then v_po_id := null; end if;',
    '  if v_po_count > 1 then
    raise exception ''This job has more than one approved purchase order. Ask management which one applies before sending the invoice'';
  elsif v_po_count = 0 then
    v_po_id := null;
  end if;');
  if v_new = v_def or position('v_po_count > 1' in v_new) = 0 then
    raise exception 'submit_vendor_invoice did not match the expected PO check';
  end if;
  execute v_new;
end $$;
