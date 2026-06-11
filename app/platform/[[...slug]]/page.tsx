import { redirect } from 'next/navigation';

// Legacy platform area consolidated into /platform-operator (2026-06-11).
// This catch-all preserves old bookmarks and deep links.
export default function LegacyPlatformRedirect() {
  redirect('/platform-operator');
}
