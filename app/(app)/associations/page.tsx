'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, FolderTree, Search, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageShell, PageHeader, EmptyState } from '@/components/ui/shell'
import { DataTable } from '@/components/ui/table'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Association = {
  id: string
  slug: string | null
  name: string
  address: string
  city: string
  state: string
  zip: string
  unit_count: number | null
  property_group_id: string | null
}

const PAGE_SIZE = 12

export default function AssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [group, setGroup] = useState('')
  const supabase = useMemo(() => createClient(), [])

  // ?group=<id> deep link from the property groups page.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('group')
    if (fromUrl) setGroup(fromUrl)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data }, { data: groupRows }] = await Promise.all([
        (supabase as any)
          .from('associations')
          .select('id, slug, name, address, city, state, zip, unit_count, property_group_id')
          .is('archived_at', null)
          .order('name', { ascending: true }),
        (supabase as any).from('property_groups').select('id, name').order('name'),
      ])
      setAssociations(data ?? [])
      setGroups(groupRows ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inGroup = group === 'none'
      ? associations.filter((a) => !a.property_group_id)
      : group ? associations.filter((a) => a.property_group_id === group) : associations
    if (!q) return inGroup
    return inGroup.filter(
      (a) => a.name?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q) || a.address?.toLowerCase().includes(q),
    )
  }, [associations, query, group])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const totalUnits = associations.reduce((s, a) => s + (a.unit_count ?? 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Associations"
        description={`${associations.length} communities · ${totalUnits.toLocaleString()} units under management`}
        actions={
          <>
            <Link href="/associations/groups">
              <Button variant="secondary"><FolderTree className="h-4 w-4" /> Property groups</Button>
            </Link>
            <Link href="/associations/new">
              <Button><Plus className="h-4 w-4" /> New association</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search by name, city, or address"
            className="pl-9"
            aria-label="Search associations"
          />
        </div>
        {groups.length > 0 && (
          <Select
            value={group}
            onChange={(e) => { setGroup(e.target.value); setPage(1) }}
            aria-label="Filter by property group"
            className="sm:w-60"
          >
            <option value="">All property groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="none">Ungrouped</option>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
          Loading associations…
        </div>
      ) : (
        <DataTable
          rows={paged}
          rowKey={(a) => a.id}
          onRowHref={(a) => `/associations/${a.slug ?? a.id}`}
          columns={[
            {
              key: 'name',
              header: 'Association',
              render: (a) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{a.name}</div>
                    <div className="truncate text-[12px] text-gray-500">
                      {[a.address, a.city && `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'unit_count',
              header: 'Units',
              align: 'right',
              className: 'w-28 tabular-nums text-gray-900',
              render: (a) => a.unit_count ?? '—',
            },
          ]}
          empty={
            <EmptyState
              icon={Building2}
              title={query ? 'No matches' : 'No associations yet'}
              description={query ? 'Try a different name or city.' : 'Create your first community to start managing units, owners, and finances.'}
              action={!query && (
                <Link href="/associations/new"><Button><Plus className="h-4 w-4" /> New association</Button></Link>
              )}
            />
          }
        />
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-gray-500">
          <span>
            Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current === 1}>
              Previous
            </Button>
            <span className="px-2 tabular-nums">{current} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={current === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  )
}
