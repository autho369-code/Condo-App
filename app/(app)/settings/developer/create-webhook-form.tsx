'use client';

import { useActionState } from 'react';

import { WEBHOOK_EVENTS } from '@/lib/api/catalog';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';

import { createDeveloperWebhook, type SecretActionState } from './actions';

const initialState: SecretActionState = { error: null, secret: null, name: null };

export function CreateWebhookForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(createDeveloperWebhook, initialState);

  return (
    <div className="space-y-4">
      {state.error && <Alert title="Webhook endpoint was not created.">{state.error}</Alert>}
      {state.secret && (
        <Alert tone="success" title={`${state.name ?? 'Webhook'} created.`}>
          Copy the signing secret now and use it to verify the HMAC-SHA256 signature on every delivery.
          <code className="mt-2 block select-all overflow-x-auto rounded-lg bg-emerald-950 px-3 py-2 font-mono text-xs text-emerald-50">{state.secret}</code>
        </Alert>
      )}
      <form action={action} className="space-y-4">
        <div><Label htmlFor="webhook_name">Endpoint name</Label><Input id="webhook_name" name="name" required maxLength={200} placeholder="Accounting sync" disabled={!enabled || pending} /></div>
        <div><Label htmlFor="webhook_url">HTTPS endpoint URL</Label><Input id="webhook_url" name="url" type="url" required placeholder="https://integrations.example.com/portier" disabled={!enabled || pending} /></div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-gray-700">Business events</legend>
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs text-gray-700 hover:bg-gray-50">
                <input type="checkbox" name="events" value={event} className="h-4 w-4 rounded border-gray-300" disabled={!enabled || pending} />
                <span className="font-mono">{event}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={!enabled || pending}>{pending ? 'Creating…' : 'Create webhook'}</Button>
      </form>
    </div>
  );
}
