import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AssociationsPage() {
  const supabase = createClient()
  const { data: associations } = await supabase
    .from('associations')
    .select('id, name, city, state, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Associations</h1>
        <Link href='/associations/new' className='px-4 py-2 bg-black text-white rounded'>
          New Association
        </Link>
      </div>
      {!associations?.length ? (
        <p>No associations yet. Create your first one.</p>
      ) : (
        <table className='w-full border-collapse'>
          <thead>
            <tr className='border-b text-left'>
              <th className='py-2'>Name</th>
              <th className='py-2'>City</th>
              <th className='py-2'>State</th>
            </tr>
          </thead>
          <tbody>
            {associations.map((a) => (
              <tr key={a.id} className='border-b'>
                <td className='py-2'>{a.name}</td>
                <td className='py-2'>{a.city}</td>
                <td className='py-2'>{a.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
