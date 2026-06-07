import './globals.css';

export const metadata = {
  title: 'Portier369 — The operating system for community management',
  description: 'Complete platform for property management companies. Work orders, violations, maintenance, board portal, owner portal, and vendor management — all in one place.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}