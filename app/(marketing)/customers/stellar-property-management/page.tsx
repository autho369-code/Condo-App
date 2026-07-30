import { permanentRedirect } from 'next/navigation'

/**
 * The previous content did not have approved source evidence. Keep the
 * historical URL working without publishing customer proof until the owner
 * supplies reviewed evidence for a future story.
 */
export default function RetiredCustomerStoryPage(): never {
  permanentRedirect('/company')
}
