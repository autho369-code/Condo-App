// Plaid client initialization
// Uses PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV from environment

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
const PLAID_SECRET = process.env.PLAID_SECRET || '';
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as string;

function getPlaidBasePath(): string {
  switch (PLAID_ENV) {
    case 'production': return PlaidEnvironments.production;
    case 'development': return PlaidEnvironments.development;
    default: return PlaidEnvironments.sandbox;
  }
}

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (!plaidClient) {
    const configuration = new Configuration({
      basePath: getPlaidBasePath(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });
    plaidClient = new PlaidApi(configuration);
  }
  return plaidClient;
}

export function isPlaidConfigured(): boolean {
  return !!(PLAID_CLIENT_ID && PLAID_SECRET);
}

export function getPlaidEnv(): string {
  return PLAID_ENV;
}
