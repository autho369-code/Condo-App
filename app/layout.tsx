import './globals.css'
import localFont from 'next/font/local'
import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'

// Inter (OFL) bundled from npm: builds never depend on reaching Google Fonts.
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
})

// Schibsted Grotesk (OFL) for titles and key figures, bundled the same way.
const display = localFont({
  src: '../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2',
  weight: '400 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-display',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://portier369.com'),
  title: {
    default: 'Portier369 — Property Management Software for HOAs & Condos',
    template: '%s · Portier369',
  },
  description:
    'All-in-one property management software for condominium and HOA management companies. Work orders, violations, maintenance, accounting, board and owner portals, and vendor management in one platform.',
  keywords: [
    'property management software',
    'HOA management software',
    'condo management software',
    'community association management',
    'HOA accounting software',
    'violation tracking software',
    'board portal',
    'owner portal',
    'CAM software',
  ],
  authors: [{ name: 'Portier369' }],
  creator: 'Portier369',
  applicationName: 'Portier369',
  appleWebApp: {
    capable: true,
    title: 'Portier369',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://portier369.com',
    siteName: 'Portier369',
    title: 'Portier369 — Property Management Software for HOAs & Condos',
    description:
      'Run your entire property management company from one platform. Built from 29 years of real condominium and HOA operations.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Portier369 — property management platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portier369 — Property Management Software for HOAs & Condos',
    description: 'Run your entire property management company from one platform.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  verification: {
    google: 'GYWV2Af_pJQV8p4Wwm3Y8lRSd6-uoVQSWN76w_3rR3M',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1E3A5F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
