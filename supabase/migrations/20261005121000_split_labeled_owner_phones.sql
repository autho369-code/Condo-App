-- Owners imported from an AppFolio export carried the whole phone cell in
-- owners.phone ("Mobile: (773) 829-7314, Home: (773) 599-6882"), which SMS and
-- dialing cannot use. Split it into phone_numbers ({ number, type }) and set
-- phone to the first mobile number, else the first number. Only rows whose
-- phone has a label and no phone_numbers yet are touched.
with parsed as (
  select o.id,
         m.ord,
         nullif(lower(btrim(m.parts[1])), '') as type,
         btrim(m.parts[2]) as number
    from public.owners o
    cross join lateral regexp_matches(
      o.phone,
      '(?:([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*)?(\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})',
      'g') with ordinality as m(parts, ord)
   where o.phone ~ '[A-Za-z]+\s*:'
     and coalesce(jsonb_array_length(case when jsonb_typeof(o.phone_numbers) = 'array' then o.phone_numbers end), 0) = 0
),
agg as (
  select id,
         jsonb_agg(jsonb_build_object('number', number, 'type', type) order by ord) as entries,
         coalesce(
           (array_agg(number order by ord) filter (where type in ('mobile', 'cell')))[1],
           (array_agg(number order by ord))[1]
         ) as primary_number
    from parsed
   group by id
)
update public.owners o
   set phone_numbers = agg.entries,
       phone = agg.primary_number
  from agg
 where o.id = agg.id;
