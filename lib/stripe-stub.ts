/**
 * Stripe stub — When the `stripe` npm package is not installed this file
 * provides a no-op constructor so the rest of the codebase can import
 * `@/lib/stripe-stub` without a build-time "Module not found" error.
 *
 * Once you `npm install stripe`, switch imports back to `stripe`.
 */
class StripeStub {
  constructor(_key: any, _opts?: any) {}
  checkout = {
    sessions: {
      create: async (_params: any): Promise<any> => {
        throw new Error('Stripe is not installed. Run: npm install stripe');
      },
      retrieve: async (_id: string): Promise<any> => {
        throw new Error('Stripe is not installed. Run: npm install stripe');
      },
    },
  };
}

export default StripeStub;
