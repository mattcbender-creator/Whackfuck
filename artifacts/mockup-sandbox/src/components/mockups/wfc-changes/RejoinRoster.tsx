const teams = [
  { name: 'The Mulligans', players: 'Dave, Mike' },
  { name: 'Bogey Brothers', players: 'Chris, Jordan' },
  { name: 'Par-Tee Animals', players: 'Sam' },
  { name: 'Chip Shots', players: 'Alex, Taylor, Lee' },
];

export function RejoinRoster() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 1 — Rejoin Team Roster
      </p>

      <div className="flex gap-8 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>Pick your team:</p>
            {teams.map((t) => (
              <button key={t.name}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '10px 14px', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ color: '#39FF14', fontSize: 14, flexShrink: 0 }}>👤</span>
                <div>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 1 }}>{t.name}</p>
                  <p style={{ color: '#666', fontSize: 11 }}>{t.players}</p>
                </div>
              </button>
            ))}
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 200 }}>Whole row clickable. Static fetch — new teams don't appear live.</p>
        </div>

        {/* AFTER */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (live + Join button)</p>
          <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <p style={{ color: '#888', fontSize: 13, flex: 1 }}>Pick your team:</p>
              <span style={{ color: '#39FF14', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: 6, padding: '2px 6px' }}>LIVE</span>
            </div>
            {teams.map((t, i) => (
              <div key={t.name}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ color: '#39FF14', fontSize: 14, flexShrink: 0 }}>👤</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                    <p style={{ color: '#666', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.players}</p>
                  </div>
                </div>
                <button style={{ flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, background: i === 0 ? 'rgba(57,255,20,0.15)' : '#39FF14', border: i === 0 ? '1px solid rgba(57,255,20,0.4)' : 'none', color: i === 0 ? '#39FF14' : '#000', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
                  Join
                </button>
              </div>
            ))}
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 220 }}>Updates live as teams register. Explicit Join button per row.</p>
        </div>

      </div>
    </div>
  );
}
