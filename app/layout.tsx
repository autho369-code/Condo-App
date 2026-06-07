import './globals.css';

export const metadata = {
  title: 'Portier',
  description: 'Property management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}