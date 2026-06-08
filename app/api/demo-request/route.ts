import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const data = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    company: formData.get('company'),
    phone: formData.get('phone'),
    doors: formData.get('doors'),
    message: formData.get('message'),
    submitted_at: new Date().toISOString(),
  }

  // Resend integration ready — add API key to wire email to hello@portier369.com
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: 'Portier369 <hello@portier369.com>', to: 'hello@portier369.com', subject: `Demo request from ${data.first_name} ${data.last_name}`, text: JSON.stringify(data, null, 2) })

  console.log('Demo request:', JSON.stringify(data, null, 2))

  return NextResponse.redirect(new URL('/demo?submitted=1', request.url))
}
