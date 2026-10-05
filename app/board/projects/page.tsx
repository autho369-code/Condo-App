import { redirect } from 'next/navigation';

// The board portal is a read-only view of basic financials, meeting minutes
// and governing documents only; this section is not part of it.
export default function RemovedBoardSection(): never {
  redirect('/board');
}
