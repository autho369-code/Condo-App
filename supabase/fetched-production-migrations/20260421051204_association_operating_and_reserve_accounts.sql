-- 1. Purpose enum for bank accounts so operating/reserve are queryable everywhere
DO $$ BEGIN
  CREATE TYPE bank_account_purpose AS ENUM ('operating','reserve','special_assessment','trust','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS purpose bank_account_purpose NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_bank_accounts_assoc_purpose
  ON public.bank_accounts (association_id, purpose);

-- 2. Quick-lookup FKs on associations
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS operating_bank_account_id uuid REFERENCES public.bank_accounts(id),
  ADD COLUMN IF NOT EXISTS reserve_bank_account_id   uuid REFERENCES public.bank_accounts(id);

-- 3. Trigger: every new association auto-gets an Operating + Reserve bank account
CREATE OR REPLACE FUNCTION public.ensure_operating_and_reserve_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  op_id uuid;
  rs_id uuid;
BEGIN
  INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
  VALUES (NEW.portfolio_id, NEW.id, 'Operating', 'checking', 'operating')
  RETURNING id INTO op_id;

  INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
  VALUES (NEW.portfolio_id, NEW.id, 'Reserve', 'savings', 'reserve')
  RETURNING id INTO rs_id;

  UPDATE public.associations
    SET operating_bank_account_id = op_id,
        reserve_bank_account_id   = rs_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_bank_accounts ON public.associations;
CREATE TRIGGER trg_ensure_bank_accounts
  AFTER INSERT ON public.associations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_operating_and_reserve_accounts();

-- 4. Backfill existing associations that are missing one or both accounts
DO $$
DECLARE
  a RECORD;
  op_id uuid;
  rs_id uuid;
BEGIN
  FOR a IN
    SELECT id, portfolio_id, operating_bank_account_id, reserve_bank_account_id
    FROM public.associations
    WHERE archived_at IS NULL
  LOOP
    IF a.operating_bank_account_id IS NULL THEN
      -- Prefer an existing operating-tagged account, otherwise create one
      SELECT id INTO op_id FROM public.bank_accounts
        WHERE association_id = a.id AND purpose = 'operating' AND archived_at IS NULL
        LIMIT 1;
      IF op_id IS NULL THEN
        INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
        VALUES (a.portfolio_id, a.id, 'Operating', 'checking', 'operating')
        RETURNING id INTO op_id;
      END IF;
      UPDATE public.associations SET operating_bank_account_id = op_id WHERE id = a.id;
    END IF;

    IF a.reserve_bank_account_id IS NULL THEN
      SELECT id INTO rs_id FROM public.bank_accounts
        WHERE association_id = a.id AND purpose = 'reserve' AND archived_at IS NULL
        LIMIT 1;
      IF rs_id IS NULL THEN
        INSERT INTO public.bank_accounts (portfolio_id, association_id, name, account_type, purpose)
        VALUES (a.portfolio_id, a.id, 'Reserve', 'savings', 'reserve')
        RETURNING id INTO rs_id;
      END IF;
      UPDATE public.associations SET reserve_bank_account_id = rs_id WHERE id = a.id;
    END IF;
  END LOOP;
END $$;

-- 5. Helper function: resolve operating bank account for an association.
-- Used by bill-pay / check-run flow so bills are always paid from Operating.
CREATE OR REPLACE FUNCTION public.association_operating_account(p_assoc_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT operating_bank_account_id FROM public.associations WHERE id = p_assoc_id;
$$;

CREATE OR REPLACE FUNCTION public.association_reserve_account(p_assoc_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT reserve_bank_account_id FROM public.associations WHERE id = p_assoc_id;
$$;;
