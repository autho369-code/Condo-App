-- White-glove: each association's manager enters where owners send payments
-- (their own payee / lockbox / mailing address / bill-pay notes). The owner
-- portal "How to pay" page renders exactly what the manager entered.
ALTER TABLE public.associations ADD COLUMN IF NOT EXISTS remit_payee text;
ALTER TABLE public.associations ADD COLUMN IF NOT EXISTS remit_address text;
ALTER TABLE public.associations ADD COLUMN IF NOT EXISTS payment_instructions text;

COMMENT ON COLUMN public.associations.remit_payee IS 'Make checks payable to (manager-entered)';
COMMENT ON COLUMN public.associations.remit_address IS 'Mailing address for check/bill-pay payments (manager-entered, multi-line)';
COMMENT ON COLUMN public.associations.payment_instructions IS 'Free-text payment notes: bill-pay payee, account #, lockbox, online options (manager-entered)';
