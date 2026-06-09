import Link from 'next/link';
import { date } from '@/lib/utils';

type Deadline = { label: string; date: string; daysLeft: number; urgent: boolean };
type AIRecommendation = { issue: string; impact: string; action: string; association?: string };

export function ManagerSidebar({ deadlines, recommendations }: {
  deadlines?: Deadline[];
  recommendations?: AIRecommendation[];
}) {
  const defaultDeadlines: Deadline[] = (deadlines ?? [
    { label: 'Elevator inspection due', date: '2026-06-14', daysLeft: 6, urgent: true },
    { label: 'Annual meeting', date: '2026-06-18', daysLeft: 10, urgent: true },
    { label: 'Insurance renewal', date: '2026-06-20', daysLeft: 12, urgent: false },
    { label: 'Fire alarm test', date: '2026-06-25', daysLeft: 17, urgent: false },
    { label: 'Vendor contract expires', date: '2026-06-30', daysLeft: 22, urgent: false },
  ]).slice(0, 5);

  const defaultRecommendations: AIRecommendation[] = recommendations ?? [
    { issue: '4 violations overdue', impact: 'Risk of escalation and fines', action: 'Send cure notices today', association: 'Lincoln Square' },
    { issue: 'Board packet not sent', impact: 'Meeting unprepared', action: 'Generate and email packet', association: 'Park Place' },
    { issue: 'Elevator inspection due', impact: 'Safety risk, possible violation', action: 'Schedule inspection in 6 days' },
    { issue: 'Vendor insurance expired', impact: 'Liability exposure', action: 'Request updated certificate' },
  ];

  return (
    <div className="w-[272px] h-full bg-[#0a0b0d] border-l border-[#111114] overflow-y-auto">
      {/* Tasks */}
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">Tasks</h2>
      </div>
      <div className="px-4 pb-5 space-y-1">
        {[
          { label: 'Enter bill', href: '/bills/new' },
          { label: 'New violation', href: '/violations/new' },
          { label: 'Schedule hearing', href: '/violations/new' },
          { label: 'New work order', href: '/work-orders/new' },
          { label: 'Send notice', href: '/letters/new' },
        ].map((t, i) => (
          <Link key={i} href={t.href} className="flex items-center gap-2 px-3 py-1.5 rounded text-[13px] text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#111114] transition-colors">
            <span className="w-1 h-1 rounded-full bg-[#3f3f46]" />
            <span>{t.label}</span>
          </Link>
        ))}
      </div>

      {/* Upcoming Deadlines */}
      <div className="px-4 pt-3 pb-2 border-t border-[#111114]">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">Upcoming Deadlines</h2>
      </div>
      <div className="px-4 pb-5">
        {defaultDeadlines.map((d, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded text-[13px] ${d.urgent ? 'bg-red-500/5' : ''}`}>
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.urgent ? 'bg-red-400' : 'bg-[#3f3f46]'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[#d4d4d8] truncate">{d.label}</div>
              <div className={`text-[11px] ${d.urgent ? 'text-red-400' : 'text-[#52525b]'}`}>
                {date(d.date)} · {d.daysLeft}d
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Recommendations */}
      <div className="px-4 pt-3 pb-2 border-t border-[#111114]">
        <h2 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-wider">AI Recommendations</h2>
      </div>
      <div className="px-4 pb-5 space-y-1.5">
        {defaultRecommendations.map((rec, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-[#0f1012] border border-[#1a1b1e] text-[12px] leading-relaxed">
            {rec.association && <div className="text-[11px] text-[#52525b] mb-0.5">{rec.association}</div>}
            <div className="text-[#d4d4d8] font-medium">{rec.issue}</div>
            <div className="text-[#6b6b72] mt-0.5">{rec.impact}</div>
            <div className="text-emerald-400/80 mt-0.5">→ {rec.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
