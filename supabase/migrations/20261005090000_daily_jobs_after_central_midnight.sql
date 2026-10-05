-- Run the date-driven daily jobs after midnight Central (every association
-- is on America/Chicago). They compare against current_date, the UTC date.
-- The recurring bill, journal entry, work order and purchase order
-- generators ran at 02:20-02:35 UTC (9:20 PM Central the day before), so
-- every template came due and posted a day early.
--
-- pg_cron schedules are UTC. 11:00-11:35 UTC is 6 AM Central (CDT) / 5 AM
-- (CST), and every US zone from Eastern to Hawaii is then on the same
-- calendar date as UTC.
--
-- cron.schedule with an existing job name updates that job in place.
-- Order is kept: unit charges post before late fees are assessed, and both
-- before the 13:00 UTC payment reminders.
select cron.schedule('post-unit-recurring-charges-daily', '0 11 * * *',
  $$ select public.post_unit_recurring_charges(); $$);
select cron.schedule('assess-late-fees-daily', '10 11 * * *',
  $$ select public.cron_assess_late_fees(); $$);
select cron.schedule('generate-recurring-bills-daily', '20 11 * * *',
  $$ select public.generate_recurring_bills(); $$);
select cron.schedule('generate-recurring-journal-entries-daily', '25 11 * * *',
  $$ select public.generate_recurring_journal_entries(); $$);
select cron.schedule('generate-recurring-work-orders', '30 11 * * *',
  $$ select public.generate_recurring_work_orders(); $$);
select cron.schedule('generate-recurring-purchase-orders-daily', '35 11 * * *',
  $$ select public.generate_recurring_purchase_orders(); $$);
