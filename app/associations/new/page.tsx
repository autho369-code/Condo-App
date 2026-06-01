import { createAssociation } from '../actions'

export default function NewAssociationPage() {
  return (
    <div className='p-8 max-w-xl'>
      <h1 className='text-2xl font-bold mb-6'>New Association</h1>
      <form action={createAssociation} className='space-y-4'>
        <div>
          <label className='block mb-1'>Name</label>
          <input name='name' required className='w-full border rounded px-3 py-2' />
        </div>
        <div>
          <label className='block mb-1'>Address</label>
          <input name='address' required className='w-full border rounded px-3 py-2' />
        </div>
        <div className='grid grid-cols-3 gap-3'>
          <div>
            <label className='block mb-1'>City</label>
            <input name='city' required className='w-full border rounded px-3 py-2' />
          </div>
          <div>
            <label className='block mb-1'>State</label>
            <input name='state' maxLength={2} required className='w-full border rounded px-3 py-2' />
          </div>
          <div>
            <label className='block mb-1'>ZIP</label>
            <input name='zip' required className='w-full border rounded px-3 py-2' />
          </div>
        </div>
        <div>
          <label className='block mb-1'>Fiscal Year Start Month (1-12)</label>
          <input name='fiscal_year_start' type='number' min='1' max='12' defaultValue='1' className='w-full border rounded px-3 py-2' />
        </div>
        <button type='submit' className='px-4 py-2 bg-black text-white rounded'>Create</button>
      </form>
    </div>
  )
}
