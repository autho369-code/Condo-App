import { signedInStepMetadata } from '@/lib/tenant/metadata';

// Two-factor sign-in is reached only by a signed-in person, so it carries
// their company's name even on the platform address.
export const generateMetadata = signedInStepMetadata;

export default function MfaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
