import { date } from '@/lib/utils';

type Insight = {
  type: 'warning' | 'info' | 'success';
  text: string;
  association?: string;
};

export function InsightsPanel({ insights, upcomingDeadlines, healthScores }: {
  insights?: Insight[];
  upcomingDeadlines?: { label: string; date: string; daysLeft: number; urgent: boolean }[];
  healthScores?: { association: string; score: number }[];
}) {
  const defaultInsights: Insight[] = insights ?? [
    { type: 'warning', text: 'Recurring plumbing issue — 3 work orders in 60 days', association: 'Lakeview Towers' },
    { type: 'warning', text: '4 unresolved violations past due date', association: 'Lincoln Square' },
    { type: 'success', text: 'Accounts receivable improved 12% this month' },
    { type: 'info', text: '2 vendor insurance certificates expiring within 30 days' },
    { type: 'info', text: 'Board meeting quorum at risk — only 3 RSVPs' },
  ];

  const defaultDeadlines = upcomingDeadlines ?? [
    { label: 'Elevator inspection due', date: '2026-06-14', daysLeft: 6, urgent: true },
    { label: 'Hearing: Unit 4B noise complaint', date: '2026-06-12', daysLeft: 4, urgent: true },
    { label: 'Board packet delivery', date: '2026-06-15', daysLeft: 7, urgent: false },
    { label: 'Insurance renewal', date: '2026-06-20', daysLeft: 12, urgent: false },
  ];

  const defaultScores = healthScores ?? [
    { association: 'Lakeview Towers', score: 92 },
    { association: 'Lincoln Square', score: 78 },
    { association: 'Park Place', score: 85 },
  ];

  return (
    <div className="w-[280px] h-full bg-[#0a0b0d] border-l border-[#1a1b1e] overflow-y-auto">
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-xs font-semibold text-[#52525b] uppercase tracking-wider">Insights</h2>
      </div>

      {/* Portfolio Health */}
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-medium text-[#71717a] mb-3 uppercase tracking-wide">Association Health</h3>
        <div className="space-y-2">
          {defaultScores.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0f1012] border border-[#1a1b1e]">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[#d4d4d8] truncate">{s.association}</div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${
                s.score >= 90 ? 'text-emerald-400' : s.score >= 80 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {s.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-medium text-[#71717a] mb-3 uppercase tracking-wide">Upcoming Deadlines</h3>
        <div className="space-y-1.5">
          {defaultDeadlines.map((d, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] ${
                d.urgent ? 'bg-red-500/5 border border-red-500/10' : 'bg-[#0f1012] border border-[#1a1b1e]'
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
      </div>

      {/* AI Recommendations */}
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-medium text-[#71717a] mb-3 uppercase tracking-wide">AI Recommendations</h3>
        <div className="space-y-2">
          {defaultInsights.map((insight, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 rounded-lg text-[13px] leading-relaxed border ${
                insight.type === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/10 text-amber-100/80'
                  : insight.type === 'success'
                  ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-100/80'
                  : 'bg-[#0f1012] border-[#1a1b1e] text-[#a1a1aa]'
              }`}
            >
              {insight.association && (
                <div className="text-[11px] text-[#52525b] mb-0.5">{insight.association}</div>
              )}
              {insight.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
