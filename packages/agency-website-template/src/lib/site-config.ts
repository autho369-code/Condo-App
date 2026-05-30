// Site configuration — edit this file per client. Everything else reads from here.
export const siteConfig = {
  name: "Agency Name",
  tagline: "We build digital products that grow your business",
  description: "Full-service digital agency specializing in web development, AI automation, and growth marketing.",
  domain: "agencyname.com",
  email: "hello@agencyname.com",
  phone: "(555) 000-0000",
  social: {
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
    github: "https://github.com",
  },
  branding: {
    primaryColor: "#2563eb",     // blue-600
    secondaryColor: "#7c3aed",   // violet-600
    logo: "/logo.svg",
    favicon: "/favicon.ico",
  },
  navigation: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  services: [
    { title: "Web Development", description: "Custom websites and web apps built with modern frameworks.", icon: "code" },
    { title: "AI Automation", description: "Intelligent workflows that save time and reduce costs.", icon: "cpu" },
    { title: "Growth Marketing", description: "Data-driven strategies to acquire and retain customers.", icon: "trending-up" },
  ],
  footer: {
    copyright: "© 2026 Agency Name. All rights reserved.",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
