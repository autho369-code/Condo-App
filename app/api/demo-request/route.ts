import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const formData = await request.formData()
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const email = formData.get('email') as string
  const company = formData.get('company') as string
  const phone = formData.get('phone') as string
  const doors = formData.get('doors') as string
  const message = formData.get('message') as string

  const body = [
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Company: ${company || '—'}`,
    `Phone: ${phone || '—'}`,
    `Doors/Units: ${doors || '—'}`,
    `Message: ${message || '—'}`,
    `Submitted: ${new Date().toISOString()}`,
  ].join('\n')

  try {
    await resend.emails.send({
      from: 'Portier369 <hello@portier369.com>',
      to: 'hello@portier369.com',
      replyTo: email,
      subject: `Demo request from ${firstName} ${lastName}${company ? ` — ${company}` : ''}`,
      text: body,
    })
  } catch (err) {
    console.error('Resend send failed:', err)
  }

  return NextResponse.redirect(new URL('/demo?submitted=1', request.url))
}
