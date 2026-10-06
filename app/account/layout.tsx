import { workspaceMetadata } from '@/lib/tenant/metadata';

// Pages here carry the company's name in the browser tab (white label).
export const generateMetadata = workspaceMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
