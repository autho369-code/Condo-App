import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function NewWorkOrderPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: occs } = await db.from('occupancies').select('unit_id, association_id, id').eq('owner_id', me.owner_id).limit(1)
  const occ = occs?.[0]
  if (!occ) return <div className="p-8 text-gray-500">No unit found for your account.</div>

  async function submit(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const category = formData.get('category') as string
    const priority = formData.get('priority') as string
    const unitId = formData.get('unit_id') as string
    const assocId = formData.get('association_id') as string

    await (supabase2 as any).from('work_orders').insert({
      title, description, category, priority: priority || 'medium', status: 'open',
      unit_id: unitId, association_id: assocId, owner_id: me2.owner_id,
      requested_by: me2.owner_id,
    })
    revalidatePath('/portal/work-orders')
    redirect('/portal/work-orders')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">New Work Order</h1><p className="text-sm text-gray-500">Submit a maintenance or repair request</p></div>
      <form action={submit} className="space-y-5 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <input type="hidden" name="unit_id" value={occ.unit_id} />
        <input type="hidden" name="association_id" value={occ.association_id} />
        <label className="block"><span className="text-sm font-medium text-gray-700">Title</span><input name="title" required className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. Leaking faucet in kitchen" /></label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Description</span><textarea name="description" rows={4} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Describe the issue..." /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><span className="text-sm font-medium text-gray-700">Category</span>
            <select name="category" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
              <option value="general">General</option><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="hvac">HVAC</option><option value="structural">Structural</option><option value="appliance">Appliance</option><option value="other">Other</option>
            </select>
          </label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Priority</span>
            <select name="priority" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="emergency">Emergency</option>
            </select>
          </label>
        </div>
        <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">Submit Request</button>
      </form>
    </div>
  )
}
