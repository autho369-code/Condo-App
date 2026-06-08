import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function getList(formData: FormData, key: string): string {
  return formData.getAll(key).filter(Boolean).join(', ')
}

export async function POST(request: Request) {
  const fd = await request.formData()

  const lines = [
    `=== PORTFOLIO ASSESSMENT REQUEST ===`,
    ``,
    `COMPANY`,
    `Company: ${fd.get('company_name') || '—'}`,
    `Contact: ${fd.get('contact_name') || '—'}`,
    `Title: ${fd.get('title') || '—'}`,
    `Email: ${fd.get('email') || '—'}`,
    `Phone: ${fd.get('phone') || '—'}`,
    `Website: ${fd.get('website') || '—'}`,
    ``,
    `PORTFOLIO`,
    `Associations: ${fd.get('num_associations') || '—'}`,
    `Total Doors: ${fd.get('total_doors') || '—'}`,
    `Market: ${getList(fd, 'market') || '—'}`,
    ``,
    `SELECTED PLAN: ${fd.get('selected_plan') || 'Not selected'}`,
    ``,
    `ADD-ON SERVICES`,
    getList(fd, 'addon_services') || 'None selected',
    ``,
    `CURRENT OPERATIONS`,
    `Software: ${getList(fd, 'current_software') || '—'}`,
    `Challenges: ${getList(fd, 'challenges') || '—'}`,
    ``,
    `IMPLEMENTATION`,
    `Timeline: ${fd.get('timeline') || '—'}`,
    `Looking For: ${getList(fd, 'looking_for') || '—'}`,
    ``,
    `CONTACT TIME: ${fd.get('contact_time') || '—'}`,
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
      subject: `Portfolio Assessment — ${company} (${fd.get('total_doors') || '?'} doors)`,
      text: lines.join('\n'),
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return NextResponse.redirect(new URL('/demo?submitted=1', request.url))
}
