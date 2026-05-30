import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-white text-gray-900`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="text-xl font-bold tracking-tight" style={{ color: siteConfig.branding.primaryColor }}>
          {siteConfig.name}
        </a>
        <div className="hidden md:flex items-center gap-8">
          {siteConfig.navigation.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              {link.label}
            </a>
          ))}
          <a
            href="/contact"
            className="text-sm px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: siteConfig.branding.primaryColor }}
          >
            Get Started
          </a>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-bold text-lg mb-2">{siteConfig.name}</h3>
          <p className="text-sm text-gray-500">{siteConfig.tagline}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Links</h4>
          <div className="space-y-2">
            {siteConfig.navigation.map((link) => (
              <a key={link.href} href={link.href} className="block text-sm text-gray-500 hover:text-gray-900">
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Contact</h4>
          <div className="space-y-1 text-sm text-gray-500">
            <p>{siteConfig.email}</p>
            <p>{siteConfig.phone}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        {siteConfig.footer.copyright}
      </div>
    </footer>
  );
}
