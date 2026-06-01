'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export async function submitContactForm(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const company = (formData.get('company') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const units = (formData.get('units') as string);
  const message = (formData.get('message') as string)?.trim();

  if (!name || !email || !message) {
    redirect('/contact?error=' + encodeURIComponent('Name, email, and message are required.'));
  }

  const body = [
    `From: ${name} <${email}>`,
    company ? `Company: ${company}` : '',
    units ? `Units: ${units}` : '',
    '',
    message,
  ].filter(Boolean).join('\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await supabase.from('email_queue').insert({
    to_email: 'autho369@gmail.com',
    to_name: 'Portier Sales',
    subject: `Portier inquiry from ${name}${company ? ` at ${company}` : ''}`,
    body: body.replace(/\n/g, '<br>'),
    status: 'pending',
  });

  redirect('/contact?ok=1');
}
