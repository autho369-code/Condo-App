export function HealthScoreGauge({ score, breakdown }: {
  score: number;
  breakdown?: { label: string; value: number }[];
}) {
  const data = breakdown ?? [
    { label: 'Financial Health', value: 96 },
    { label: 'Maintenance Health', value: 88 },
    { label: 'Compliance Health', value: 94 },
    { label: 'Communication Health', value: 90 },
  ];

  const getColor = (v: number) => {
    if (v >= 90) return '#10b981';
    if (v >= 75) return '#f59e0b';
    return '#ef4444';
  };

  const circumference = 2 * Math.PI * 108;
  const progress = circumference * (1 - score / 100);

  return (
    <div className="rounded-2xl bg-[#0a0b0d] border border-[#1a1b1e] p-6">
      <div className="flex items-start gap-8">
        {/* Gauge */}
        <div className="relative flex-shrink-0">
          <svg width="240" height="140" viewBox="0 0 240 140">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d="M 12 128 A 108 108 0 0 1 228 128"
              fill="none"
              stroke="#1a1b1e"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d="M 12 128 A 108 108 0 0 1 228 128"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progress}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            {/* Score */}
            <text x="120" y="110" textAnchor="middle" className="text-[44px] font-bold" fill="#e4e4e7" style={{ fontFamily: 'Inter, sans-serif' }}>
              {score}
            </text>
            <text x="120" y="130" textAnchor="middle" className="text-[11px] font-medium" fill="#52525b" style={{ fontFamily: 'Inter, sans-serif' }}>
              / 100
            </text>
          </svg>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-3">
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Association Health Score</h3>
          {data.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-[#a1a1aa]">{item.label}</span>
                <span className="text-[#d4d4d8] font-medium tabular-nums">{item.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.value}%`,
                    backgroundColor: getColor(item.value),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
