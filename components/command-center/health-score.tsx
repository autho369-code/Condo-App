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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-[13px] font-semibold text-gray-900 mb-4">Association Health Score</h3>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <span className="text-[36px] font-bold text-gray-900 tabular-nums">{score}</span>
          <span className="text-[13px] text-gray-400">/ 100</span>
        </div>
        <div className="flex-1 grid grid-cols-4 gap-4">
          {data.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-gray-500">{item.label}</span>
                <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{item.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${item.value}%`, backgroundColor: getColor(item.value) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
