import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'condo-app — HOA management',
  description: 'Property management for condos, HOAs, and community associations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
