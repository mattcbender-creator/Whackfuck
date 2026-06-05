import { useWFC } from '@/lib/store';
import { useCourse } from '@/lib/tournamentContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Stats() {
  const { scores } = useWFC();
  const { holes: HOLES } = useCourse();

  // Calculate stats
  let eagleCount = 0;
  let birdieCount = 0;
  let parCount = 0;
  let bogeyCount = 0;
  let doubleCount = 0;

  scores.forEach((score, i) => {
    if (score === null) return;
    const diff = score - HOLES[i].par;
    if (diff <= -2) eagleCount++;
    else if (diff === -1) birdieCount++;
    else if (diff === 0) parCount++;
    else if (diff === 1) bogeyCount++;
    else doubleCount++;
  });

  const chartData = [
    { name: 'Eagle', count: eagleCount, color: '#facc15' },
    { name: 'Birdie', count: birdieCount, color: '#39FF14' },
    { name: 'Par', count: parCount, color: '#ffffff' },
    { name: 'Bogey', count: bogeyCount, color: '#f97316' },
    { name: 'Double+', count: doubleCount, color: '#ef4444' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
          <p className="font-condensed text-lg font-bold uppercase mb-1">{label}</p>
          <p className="text-sm font-bold text-muted-foreground">{payload[0].value} Holes</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto">
          <h2 className="font-condensed text-3xl font-black uppercase tracking-wider text-foreground">
            Tournament <span className="text-primary">Stats</span>
          </h2>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-8">
        
        {/* Score Distribution */}
        <section>
          <h3 className="font-condensed text-xl font-bold uppercase tracking-widest text-muted-foreground mb-4">Score Distribution</h3>
          <div className="bg-card border border-border rounded-xl p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#666" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Long Drive Trackers */}
        <section>
          <h3 className="font-condensed text-xl font-bold uppercase tracking-widest text-muted-foreground mb-4">Official Contests</h3>
          <div className="space-y-3">
            {[2, 8, 12].map(holeNum => {
              const hole = HOLES.find(h => h.hole === holeNum);
              return (
                <div key={holeNum} className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-primary font-bold text-sm uppercase tracking-widest block mb-1">Hole {holeNum}</span>
                    <span className="font-condensed font-bold text-xl uppercase">{hole?.ruleName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Current Leader</span>
                    <span className="font-bold">Pending...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}