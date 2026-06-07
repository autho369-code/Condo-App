import Link from 'next/link';

export default function ConfirmationPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-16 text-center">
      <div className="text-5xl">📋</div>
      <h1 className="text-2xl font-semibold text-gray-900">Report submitted</h1>
      <p className="text-sm text-gray-500">
        Your violation report has been received. Management will review it within 10 days and send a formal notice to the alleged violator.
      </p>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <strong>What happens next:</strong>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Management reviews the report (within 10 days)</li>
          <li>Formal violation notice sent to alleged violator</li>
          <li>Violator has 10 days to respond or request a hearing</li>
          <li>If hearing is requested, Board schedules within 10 days</li>
          <li>Final determination issued after hearing or response period</li>
        </ol>
      </div>
      <Link href="/portal" className="inline-block text-sm font-medium text-blue-700 hover:underline">Return to portal</Link>
    </div>
  );
}
