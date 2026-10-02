'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['active', 'disposed', 'sold', 'fully_depreciated'];
const METHODS = ['straight_line', 'declining_balance', 'sum_of_years_digits', 'units_of_production', 'none'];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function ymd(formData: FormData, key: string, label: string, back: string): string | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!d || d.toISOString().slice(0, 10) !== raw) fail(back, `${label} is not a valid date.`);
  return raw;
}

function amount(formData: FormData, key: string, label: string, back: string): number | null {
  const raw = text(formData, key).replace(/[$,]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(back, `${label} must be a number of 0 or more.`);
  return Math.round(n * 100) / 100;
}

/**
 * Reads the asset form. The association and unit must be visible to the
 * caller (RLS), and the unit must belong to the chosen association.
 */
async function readAsset(formData: FormData, back: string, db: any, fallbackPortfolioId: string | null) {
  const name = text(formData, 'name');
  if (!name) fail(back, 'Enter an asset name.');

  let associationId = text(formData, 'association_id');
  const unitId = text(formData, 'unit_id');
  if (associationId && !UUID.test(associationId)) fail(back, 'Choose a valid association.');
  if (unitId && !UUID.test(unitId)) fail(back, 'Choose a valid unit.');

  if (unitId) {
    const { data: unit } = await db.from('units').select('id, buildings!inner(association_id)').eq('id', unitId).maybeSingle();
    if (!unit) fail(back, 'That unit was not found.');
    const unitAssociation = unit.buildings?.association_id;
    if (associationId && unitAssociation !== associationId) fail(back, 'The unit is not in the chosen association.');
    associationId = unitAssociation;
  }

  let portfolioId = fallbackPortfolioId;
  if (associationId) {
    const { data: assoc } = await db.from('associations').select('id, portfolio_id').eq('id', associationId).maybeSingle();
    if (!assoc) fail(back, 'That association was not found.');
    portfolioId = assoc.portfolio_id;
  }
  if (!portfolioId) fail(back, 'Choose an association for this asset.');

  const status = text(formData, 'status') || 'active';
  if (!STATUSES.includes(status)) fail(back, 'Choose a valid status.');
  const method = text(formData, 'depreciation_method') || 'straight_line';
  if (!METHODS.includes(method)) fail(back, 'Choose a valid depreciation method.');

  const lifeRaw = text(formData, 'useful_life_years');
  const life = lifeRaw ? Number(lifeRaw) : null;
  if (life != null && (!Number.isInteger(life) || life < 0)) fail(back, 'Useful life must be a whole number of years.');

  const purchasePrice = amount(formData, 'purchase_price', 'Cost', back);
  const salvage = amount(formData, 'salvage_value', 'Salvage value', back) ?? 0;
  if (purchasePrice != null && salvage > purchasePrice) fail(back, 'Salvage value cannot be more than the cost.');

  const placed = ymd(formData, 'placed_in_service_date', 'Placed in service', back);
  const purchased = ymd(formData, 'purchase_date', 'Purchase date', back);
  const warranty = ymd(formData, 'warranty_expiration_date', 'Warranty expiration', back);

  return {
    portfolio_id: portfolioId,
    association_id: associationId || null,
    unit_id: unitId || null,
    name,
    asset_type: text(formData, 'asset_type') || null,
    description: text(formData, 'description') || null,
    status,
    placed_in_service_date: placed,
    warranty_expiration_date: warranty,
    make: text(formData, 'make') || null,
    model: text(formData, 'model') || null,
    serial_number: text(formData, 'serial_number') || null,
    purchase_date: purchased,
    purchase_price: purchasePrice,
    salvage_value: salvage,
    useful_life_years: life,
    depreciation_method: method,
  };
}

/** Add Fixed Asset. Writes are limited by RLS to staff who manage the company's finances. */
export async function createFixedAsset(formData: FormData) {
  const me = await requireStaff();
  const back = '/fixed-assets/new';
  const db = (await createClient()) as any;
  const asset = await readAsset(formData, back, db, me.portfolio?.id ?? null);
  const disposal = disposalFields(formData, asset.status, back);
  const { data, error } = await db.from('fixed_assets')
    .insert({ ...asset, ...disposal, created_by: me.auth_user_id })
    .select('id')
    .maybeSingle();
  if (error) fail(back, error.message);
  if (!data) fail(back, 'You do not have permission to add fixed assets.');
  revalidatePath('/fixed-assets');
  redirect(`/fixed-assets/${data.id}?saved=created`);
}

function disposalFields(formData: FormData, status: string, back: string) {
  if (status !== 'disposed' && status !== 'sold') return { disposed_at: null, disposed_amount: null };
  const day = ymd(formData, 'disposed_date', 'Disposal date', back);
  return {
    // Stored at noon UTC so the calendar day reads the same in every US zone.
    disposed_at: day ? `${day}T12:00:00Z` : null,
    disposed_amount: amount(formData, 'disposed_amount', status === 'sold' ? 'Sale amount' : 'Disposal amount', back),
  };
}

export async function updateFixedAsset(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'asset_id');
  if (!UUID.test(id)) redirect('/fixed-assets');
  const back = `/fixed-assets/${id}`;
  const db = (await createClient()) as any;
  const { data: current } = await db.from('fixed_assets').select('id, portfolio_id').eq('id', id).is('archived_at', null).maybeSingle();
  if (!current) fail(back, 'This asset was not found.');
  const asset = await readAsset(formData, back, db, current.portfolio_id);
  if (asset.portfolio_id !== current.portfolio_id) fail(back, 'An asset cannot move to another company.');
  const disposal = disposalFields(formData, asset.status, back);
  const { data, error } = await db.from('fixed_assets')
    .update({ ...asset, ...disposal })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) fail(back, error.message);
  if (!data) fail(back, 'You do not have permission to edit this asset.');
  revalidatePath(back);
  revalidatePath('/fixed-assets');
  redirect(`${back}?saved=1`);
}

/** Removes an asset from the register (soft delete; the row is kept). */
export async function archiveFixedAsset(formData: FormData) {
  await requireStaff();
  const id = text(formData, 'asset_id');
  if (!UUID.test(id)) redirect('/fixed-assets');
  const back = `/fixed-assets/${id}`;
  const db = (await createClient()) as any;
  const { data, error } = await db.from('fixed_assets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error) fail(back, error.message);
  if (!data) fail(back, 'You do not have permission to remove this asset.');
  revalidatePath('/fixed-assets');
  redirect('/fixed-assets?removed=1');
}
