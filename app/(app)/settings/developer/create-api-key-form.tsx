'use client';

import { useActionState } from 'react';

import { DEVELOPER_API_SCOPES } from '@/lib/api/catalog';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';

import { createDeveloperApiKey, type SecretActionState } from './actions';

const initialState: SecretActionState = { error: null, secret: null, name: null, prefix: null };

export function CreateApiKeyForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(createDeveloperApiKey, initialState);

  return (
    <div className="space-y-4">
      {state.error && <Alert title="API key was not created.">{state.error}</Alert>}
      {state.secret && (
        <Alert tone="success" title={`${state.name ?? 'API key'} created.`}>
          Copy this key now. It is stored only as a hash and cannot be shown again.
          <code className="mt-2 block select-all overflow-x-auto rounded-lg bg-emerald-950 px-3 py-2 font-mono text-xs text-emerald-50">{state.secret}</code>
        </Alert>
      )}
      <form action={action} className="space-y-4">
        <div><Label htmlFor="api_key_name">Key name</Label><Input id="api_key_name" name="name" required maxLength={200} placeholder="Operations data warehouse" disabled={!enabled || pending} /></div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-gray-700">Read scopes</legend>
          <div className="space-y-2">
            {DEVELOPER_API_SCOPES.map((scope) => (
              <label key={scope.value} className="flex min-h-10 items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                <input type="checkbox" name="scopes" value={scope.value} className="mt-0.5 h-4 w-4 rounded border-gray-300" disabled={!enabled || pending} />
                <span><span className="block text-sm font-medium text-gray-900">{scope.label}</span><span className="block text-xs leading-5 text-gray-500">{scope.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="expires_days">Expiration</Label><Select id="expires_days" name="expires_days" defaultValue="90" disabled={!enabled || pending}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="">No expiration</option></Select></div>
        <Button type="submit" disabled={!enabled || pending}>{pending ? 'Creating…' : 'Create API key'}</Button>
      </form>
    </div>
  );
}
