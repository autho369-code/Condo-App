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
  status: string
  unit_count: number | null
}

export default function AssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('associations')
        .select('id, name, address, city, state, zip, status, unit_count')
        .is('archived_at', null)
        .order('name')
      setAssociations(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? associations : associations.filter(a => a.status === filter)

  return (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <nav className="flex gap-6 border-b border-gray-200 px-6">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`pb-3 pt-4 text-sm font-medium border-b-2 transition-colors ${
                filter === f ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h1 className="text-xl font-semibold text-gray-900">Associations</h1>
          <Link href="/associations/new" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            + New Association
          </Link>
        </div>

        <div className="px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-200">
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">City</th>
                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Units</th>
                <th className="py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">No associations found.</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <Link href={`/associations/${a.id}`} className="font-medium text-blue-600 hover:underline">{a.name}</Link>
                    <div className="text-xs text-gray-400">{a.address}</div>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{a.city}, {a.state} {a.zip}</td>
                  <td className="py-3 pr-4 text-right text-gray-700">{a.unit_count ?? '—'}</td>
                  <td className="py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="w-64 shrink-0 border-l border-gray-200 bg-white px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-3 mb-4">Tasks</h2>
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Property</p>
          <ul className="space-y-1.5">
            <li><Link href="/associations/new" className="text-sm text-blue-600 hover:underline">+ New Association</Link></li>
            <li><Link href="/units/new" className="text-sm text-blue-600 hover:underline">+ New Unit</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reports</p>
          <ul className="space-y-1.5">
            <li><Link href="/reports/delinquency" className="text-sm text-blue-600 hover:underline">Owner Delinquency</Link></li>
            <li><Link href="/reports/income_statement" className="text-sm text-blue-600 hover:underline">Income Statement</Link></li>
            <li><Link href="/reports/dues_roll" className="text-sm text-blue-600 hover:underline">Dues Roll</Link></li>
            <li><Link href="/reports/balance_sheet" className="text-sm text-blue-600 hover:underline">Balance Sheet</Link></li>
          </ul>
        </div>
      </aside>
    </div>
  )
}