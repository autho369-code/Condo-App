'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Association = {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  unit_count: number | null
}

const PAGE_SIZE = 10

export default function AssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([])
  const [loading, setLoading] = useState(true)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await (supabase as any)
        .from('associations')
        .select('id, name, address, city, state, zip, unit_count')
        .is('archived_at', null)
        .order('name', { ascending: sortAsc })
      setAssociations(data ?? [])
      setLoading(false)
    }
    load()
  }, [sortAsc])

  const totalPages = Math.ceil(associations.length / PAGE_SIZE)
  const paged = associations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="px-8 py-6">
      <div className="mb-1 text-sm">
        <Link href="/associations" className="text-blue-600 hover:underline">Associations</Link>
      </div>
      <h1 className="text-2xl font-normal text-gray-800 mb-1">Associations</h1>
      <p className="text-sm text-gray-500 mb-4">Click on any row to view association information.</p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            <th className="py-2 px-3 text-left font-medium text-gray-700">
              <button onClick={() => { setSortAsc(!sortAsc); setPage(1) }} className="flex items-center gap-1 hover:text-blue-600">
                Name <span className="text-xs">{sortAsc ? '▲' : '▼'}</span>
              </button>
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-700">Units</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={2} className="py-8 text-center text-gray-400">Loading…</td></tr>
          ) : paged.length === 0 ? (
            <tr><td colSpan={2} className="py-8 text-center text-gray-400">No associations found.</td></tr>
          ) : paged.map((a, i) => (
            <tr key={a.id} className={`border-b border-gray-200 hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
              <td className="py-2 px-3">
                <Link href={`/associations/${a.id}`} className="text-blue-600 hover:underline font-medium">{a.name}</Link>
                <div className="text-xs text-gray-500">{a.address}</div>
                <div className="text-xs text-gray-500">{a.city}, {a.state} {a.zip}</div>
              </td>
              <td className="py-2 px-3 text-gray-700 align-top pt-3">{a.unit_count ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && associations.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Displaying: {(page-1)*PAGE_SIZE+1}-{Math.min(page*PAGE_SIZE, associations.length)} of {associations.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page===1} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">«</button>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
              <button key={p} onClick={()=>setPage(p)} className={`px-2.5 py-1 border rounded ${p===page?'bg-blue-600 text-white':'hover:bg-gray-100'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">»</button>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm">
        <Link href="#" className="text-blue-600 hover:underline">Show Hidden Associations</Link>
      </div>
    </div>
  )
}