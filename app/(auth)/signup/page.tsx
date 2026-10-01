import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Portier369 accounts are invitation-only: a company is set up by Portier369,
// and its staff, boards, owners and vendors are invited from inside it. A
// self-made account would belong to no company and could do nothing.
export default function SignupPage() {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Accounts are by invitation</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-3 text-sm leading-6 text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Homeowners, board members and vendors:</span> your management
            company sends you an invitation email. Open the link in it to set your password. If it expired, ask them to
            send a new one.
          </p>
          <p>
            <span className="font-medium text-gray-900">Management companies:</span> request a demo and we&apos;ll set up
            your company workspace.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/demo"><Button className="w-full">Request a demo</Button></Link>
          <Link href="/login"><Button variant="secondary" className="w-full">Sign in</Button></Link>
        </div>
      </CardBody>
    </Card>
  );
}
