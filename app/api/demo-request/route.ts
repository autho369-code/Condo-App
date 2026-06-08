import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function getList(formData: FormData, key: string): string {
  return formData.getAll(key).filter(Boolean).join(', ')
}

export async function POST(request: Request) {
  const fd = await request.formData()

  const lines = [
    `=== MANAGEMENT COMPANY PROPOSAL REQUEST ===`,
    ``,
    `COMPANY`,
    `Name: ${fd.get('company_name') || '—'}`,
    `City: ${fd.get('city') || '—'}`,
    `State: ${fd.get('state') || '—'}`,
    `Website: ${fd.get('website') || '—'}`,
    ``,
    `PORTFOLIO`,
    `Associations: ${fd.get('num_associations') || '—'}`,
    `Total Doors: ${fd.get('total_doors') || '—'}`,
    `Managers: ${fd.get('num_managers') || '—'}`,
    `Community Types: ${getList(fd, 'community_types') || '—'}`,
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

  const company = fd.get('company_name') || 'New Lead'

  try {
    await resend.emails.send({
      from: 'Portier369 <hello@portier369.com>',
      to: 'hello@portier369.com',
      replyTo: (fd.get('email') as string) || undefined,
      subject: `Proposal request — ${company} (${fd.get('total_doors') || '?'} doors)`,
      text: lines.join('\n'),
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return NextResponse.redirect(new URL('/demo?submitted=1', request.url))
}
