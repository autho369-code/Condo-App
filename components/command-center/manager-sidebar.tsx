import Link from 'next/link';
import { date } from '@/lib/utils';

type Association = { id: string; name: string; score: number };
type Deadline = { label: string; date: string; daysLeft: number; urgent: boolean };
type AIRecommendation = { issue: string; impact: string; action: string; association?: string };

export function ManagerSidebar({ associations, deadlines, recommendations }: {
  associations?: Association[];
  deadlines?: Deadline[];
  recommendations?: AIRecommendation[];
}) {
  const defaultAssociations: Association[] = associations ?? [
    { id: '1', name: 'Lakeview Towers', score: 92 },
    { id: '2', name: 'Park Place', score: 85 },
    { id: '3', name: 'Lincoln Square', score: 78 },
  ];

  const defaultDeadlines: Deadline[] = (deadlines ?? [
    { label: 'Elevator inspection due', date: '2026-06-14', daysLeft: 6, urgent: true },
    { label: 'Annual meeting', date: '2026-06-18', daysLeft: 10, urgent: true },
    { label: 'Insurance renewal', date: '2026-06-20', daysLeft: 12, urgent: false },
    { label: 'Fire alarm test', date: '2026-06-25', daysLeft: 17, urgent: false },
    { label: 'Vendor contract expires', date: '2026-06-30', daysLeft: 22, urgent: false },
  ]).slice(0, 5);

  const defaultRecommendations: AIRecommendation[] = recommendations ?? [
    { issue: '4 violations overdue', impact: 'Risk of escalation and fines', action: 'Send cure notices today', association: 'Lincoln Square' },
    { issue: 'Board packet not sent', impact: 'Meeting unprepared, board frustrated', action: 'Generate and email packet', association: 'Park Place' },
    { issue: 'Elevator inspection due', impact: 'Safety risk, possible violation', action: 'Schedule inspection in 6 days', association: 'Lakeview Towers' },
    { issue: 'Vendor insurance expired', impact: 'Liability exposure for association', action: 'Request updated certificate', association: 'Lincoln Square' },
    { issue: 'Accounts receivable +12%', impact: 'Cash flow improving', action: 'No action needed — positive trend' },
  ];

  return (
    <div className="w-[280px] h-full bg-[#0a0b0d] border-l border-[#1a1b1e] overflow-y-auto">
      {/* SECTION 1: My Associations */}
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">My Associations</h2>
      </div>
      <div className="px-4 mb-5">
        {defaultAssociations.map((a, i) => (
          <Link
            key={a.id}
            href={`/dashboard?assoc=${a.id}`}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#0f1012] transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[#d4d4d8] truncate group-hover:text-white">{a.name}</div>
            </div>
            <div className={`text-sm font-semibold tabular-nums ${
              a.score >= 90 ? 'text-emerald-400' : a.score >= 80 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {a.score}
            </div>
          </Link>
        ))}
      </div>

      {/* SECTION 2: Upcoming Deadlines */}
      <div className="px-4 pt-3 pb-2 border-t border-[#1a1b1e]">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">Upcoming Deadlines</h2>
      </div>
      <div className="px-4 mb-5">
        {defaultDeadlines.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] ${
              d.urgent ? 'bg-red-500/5 border border-red-500/10' : ''
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.urgent ? 'bg-red-400' : 'bg-[#52525b]'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[#d4d4d8] truncate">{d.label}</div>
              <div className={`text-[11px] ${d.urgent ? 'text-red-400' : 'text-[#71717a]'}`}>
                {date(d.date)} · {d.daysLeft}d
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 3: AI Operations Assistant */}
      <div className="px-4 pt-3 pb-2 border-t border-[#1a1b1e]">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">AI Assistant</h2>
      </div>
      <div className="px-4 pb-5 space-y-2">
        {defaultRecommendations.map((rec, i) => (
          <div key={i} className="px-3 py-2.5 rounded-lg bg-[#0f1012] border border-[#1a1b1e] text-[13px] leading-relaxed">
            {rec.association && (
              <div className="text-[11px] text-[#52525b] mb-0.5">{rec.association}</div>
            )}
            <div className="text-[#e4e4e7] font-medium">{rec.issue}</div>
            <div className="text-[#71717a] mt-0.5">{rec.impact}</div>
            <div className="text-emerald-400/80 mt-0.5 text-[12px]">→ {rec.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
