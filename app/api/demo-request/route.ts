import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function getList(formData: FormData, key: string): string {
  return formData.getAll(key).filter(Boolean).join(', ')
}

export async function POST(request: Request) {
  const fd = await request.formData()

  const lines = [
    `=== PROPOSAL REQUEST ===`,
    ``,
    `COMMUNITY INFORMATION`,
    `Association: ${fd.get('association_name') || '—'}`,
    `City: ${fd.get('city') || '—'}`,
    `State: ${fd.get('state') || '—'}`,
    ``,
    `COMMUNITY PROFILE`,
    `Type: ${fd.get('association_type') || '—'}`,
    `Units: ${fd.get('units') || '—'}`,
    `Buildings: ${fd.get('buildings') || '—'}`,
    `Elevators: ${fd.get('elevators') || '—'}`,
    `Onsite Staff: ${fd.get('onsite_staff') || '—'}`,
    `Has Management Company: ${fd.get('has_mgmt_company') || '—'}`,
    `Management Company: ${fd.get('mgmt_company') || '—'}`,
    ``,
    `CURRENT SOFTWARE`,
    getList(fd, 'current_software') || '—',
    ``,
    `INTERESTED FEATURES`,
    getList(fd, 'interested_features') || '—',
    ``,
    `CONTACT`,
    `Name: ${fd.get('first_name') || ''} ${fd.get('last_name') || ''}`,
    `Position: ${fd.get('position') || '—'}`,
    `Email: ${fd.get('email') || '—'}`,
    `Phone: ${fd.get('phone') || '—'}`,
    `Best Time: ${fd.get('contact_time') || '—'}`,
    ``,
    `MESSAGE`,
    fd.get('message') || '—',
    ``,
    `Submitted: ${new Date().toISOString()}`,
  ]

  try {
    await resend.emails.send({
      from: 'Portier369 <hello@portier369.com>',
      to: 'hello@portier369.com',
      replyTo: (fd.get('email') as string) || undefined,
      subject: `Proposal request from ${fd.get('first_name') || ''} ${fd.get('last_name') || ''} — ${fd.get('association_name') || 'New Lead'}`,
      text: lines.join('\n'),
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return NextResponse.redirect(new URL('/demo?submitted=1', request.url))
}
