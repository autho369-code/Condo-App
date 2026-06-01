'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Building2, Users, Home, Briefcase, FileText, Mail, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type SearchResult = {
  id: string;
  type: 'portfolio' | 'association' | 'owner' | 'manager' | 'vendor' | 'ticket' | 'invoice' | 'invitation';
  label: string;
  subtitle: string;
  href: string;
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  portfolio: Building2,
  association: Home,
  owner: Users,
  manager: Briefcase,
  vendor: Wrench,
  ticket: FileText,
  invoice: FileText,
  invitation: Mail,
};

const typeColors: Record<string, string> = {
  portfolio: 'text-blue-400 bg-blue-400/10',
  association: 'text-emerald-400 bg-emerald-400/10',
  owner: 'text-amber-400 bg-amber-400/10',
  manager: 'text-purple-400 bg-purple-400/10',
  vendor: 'text-slate-400 bg-slate-400/10',
  ticket: 'text-red-400 bg-red-400/10',
  invoice: 'text-orange-400 bg-orange-400/10',
  invitation: 'text-cyan-400 bg-cyan-400/10',
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    setLoading(true);
    const supabase = createClient();
    const results: SearchResult[] = [];
    const like = `%${q}%`;

    try {
      const [
        { data: portfolios },
        { data: associations },
        { data: owners },
        { data: vendors },
        { data: tickets },
        { data: invitations },
      ] = await Promise.all([
        (supabase as any).from('portfolios').select('id, company_name').ilike('company_name', like).is('archived_at', null).limit(3),
        (supabase as any).from('associations').select('id, name').ilike('name', like).is('archived_at', null).limit(3),
        (supabase as any).from('owners').select('id, full_name, email').or(`full_name.ilike.${like},email.ilike.${like}`).limit(3),
        (supabase as any).from('vendors').select('id, name').ilike('name', like).limit(3),
        (supabase as any).from('tickets').select('id, title').ilike('title', like).neq('status', 'resolved').limit(3),
        (supabase as any).from('user_invitations').select('id, email, full_name, hoa_role').or(`email.ilike.${like},full_name.ilike.${like}`).eq('status', 'pending').limit(3),
      ]);

      (portfolios ?? []).forEach((p: any) => results.push({ id: p.id, type: 'portfolio', label: p.company_name, subtitle: 'Management Company', href: `/platform/portfolios/${p.id}` }));
      (associations ?? []).forEach((a: any) => results.push({ id: a.id, type: 'association', label: a.name, subtitle: 'Association', href: `/associations/${a.id}` }));
      (owners ?? []).forEach((o: any) => results.push({ id: o.id, type: 'owner', label: o.full_name, subtitle: o.email ?? 'Owner', href: `/owners/${o.id}` }));
      (vendors ?? []).forEach((v: any) => results.push({ id: v.id, type: 'vendor', label: v.name, subtitle: 'Vendor', href: `/vendors/${v.id}` }));
      (tickets ?? []).forEach((t: any) => results.push({ id: t.id, type: 'ticket', label: t.title, subtitle: 'Support Ticket', href: `/platform/support` }));
      (invitations ?? []).forEach((i: any) => results.push({ id: i.id, type: 'invitation', label: i.full_name ?? i.email, subtitle: `${i.hoa_role ?? 'Invitation'} · Pending`, href: `/platform/invitations` }));
    } catch {}

    setResults(results);
    setLoading(false);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search companies, associations, owners... (⌘K)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-10 pr-10 text-sm text-white placeholder:text-slate-400 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B1121] shadow-2xl shadow-black/50">
          {loading && <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No results found for "{query}"</div>
          )}
          {!loading && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((r) => {
                const Icon = typeIcons[r.type] ?? FileText;
                return (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.04] transition"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeColors[r.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{r.label}</p>
                      <p className="text-xs text-slate-400">{r.subtitle}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${typeColors[r.type]}`}>
                      {r.type}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
