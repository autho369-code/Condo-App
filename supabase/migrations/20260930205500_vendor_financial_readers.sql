-- Follow-up to vendor_financial_details: the three database functions that
-- still read the old vendors tax columns now read the finance-only table or
-- the has_taxpayer_id flag, so Phase 2 (clearing the vendors columns) cannot
-- silently break 1099 assembly, year-end readiness or data diagnostics.
-- Each function body is rewritten in place; the block fails if a pattern is
-- no longer present, so a drifted definition is never half-patched.

do $$
declare
  f record;
  def text;
  patched text;
begin
  for f in
    select * from (values
      ('public.assemble_vendor_1099_data(uuid, integer)',
       array['        v.taxpayer_id,', '      from public.vendors v', 'group by v.id, v.name, v.taxpayer_name, v.taxpayer_id,'],
       array['        vfd.taxpayer_id,', '      from public.vendors v' || chr(10) || '      left join public.vendor_financial_details vfd on vfd.vendor_id = v.id', 'group by v.id, v.name, v.taxpayer_name, vfd.taxpayer_id,']),
      ('public.year_end_readiness(uuid, integer)',
       array['nullif(btrim(coalesce(v.taxpayer_id, '''')), '''') is null'],
       array['not v.has_taxpayer_id']),
      ('public.scan_data_diagnostics(uuid)',
       array['(v.taxpayer_id is null or v.taxpayer_id = '''')'],
       array['not v.has_taxpayer_id'])
    ) t(sig, old_parts, new_parts)
  loop
    def := pg_get_functiondef(f.sig::regprocedure);
    patched := def;
    for i in 1 .. array_length(f.old_parts, 1) loop
      if position(f.old_parts[i] in patched) = 0 then
        raise exception 'vendor_financial_readers: % no longer contains %', f.sig, f.old_parts[i];
      end if;
      patched := replace(patched, f.old_parts[i], f.new_parts[i]);
    end loop;
    execute patched;
  end loop;
end $$;
