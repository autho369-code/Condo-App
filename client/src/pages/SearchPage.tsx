import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Search, Building2, Users, DollarSign } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = trpc.search.global.useQuery({ q: query }, { enabled: query.length > 2 });

  return (
    <ThreePanelLayout title="Search" subtitle="Search across associations, people, and transactions">
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search everything..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {query.length > 2 && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Searching...</div>
          ) : results ? (
            <>
              {results.associations?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Associations</h3>
                  <div className="bg-card border border-border rounded-xl divide-y divide-border">
                    {results.associations.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">{a.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{a.city}, {a.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.people?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">People</h3>
                  <div className="bg-card border border-border rounded-xl divide-y divide-border">
                    {results.people.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{p.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.transactions?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transactions</h3>
                  <div className="bg-card border border-border rounded-xl divide-y divide-border">
                    {results.transactions.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-foreground">{t.description ?? t.reference}</span>
                        <span className="text-xs text-muted-foreground ml-auto">${Number(t.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!results.associations?.length && !results.people?.length && !results.transactions?.length && (
                <div className="text-center py-12 text-sm text-muted-foreground">No results for "{query}"</div>
              )}
            </>
          ) : null}
        </div>
      )}

      {query.length <= 2 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Type at least 3 characters to search
        </div>
      )}
    </ThreePanelLayout>
  );
}
