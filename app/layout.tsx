import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-inter' })

export const metadata = {
  title: 'Portier369 — The operating system for community management',
  description: 'Complete platform for property management companies. Work orders, violations, maintenance, board portal, owner portal, and vendor management — all in one place.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
