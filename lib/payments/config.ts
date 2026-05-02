export function isStripePaymentsConfigured(key: string | undefined = process.env.STRIPE_SECRET_KEY): key is string {
  const value = key?.trim();
  if (!value) return false;
  if (value === 'sk_test_...' || value === 'sk_live_...') return false;
  return value.startsWith('sk_test_') || value.startsWith('sk_live_');
}
