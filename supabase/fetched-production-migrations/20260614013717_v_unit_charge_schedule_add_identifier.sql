create or replace view public.v_unit_charge_schedule as
 select urc.id as recurring_charge_id,
    urc.unit_id,
    u.unit_number,
    b.association_id,
    a.name as association_name,
    a.portfolio_id,
    cc.id as charge_category_id,
    cc.name as category_name,
    cc.code as category_code,
    cc.charge_type,
    cc.is_assessment,
    cc.is_fee,
    urc.amount,
    urc.frequency,
    urc.start_date,
    urc.end_date,
    urc.next_post_date,
    urc.last_posted_at,
    urc.active,
    urc.memo,
    urc.identifier
   from unit_recurring_charges urc
     join charge_categories cc on cc.id = urc.charge_category_id
     join units u on u.id = urc.unit_id
     join buildings b on b.id = u.building_id
     join associations a on a.id = b.association_id;;
