export function DuplicateWarning() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 2 — Duplicate Team Warning
      </p>

      <div className="flex gap-8 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Team Name</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>The Mulligans</span>
              </div>
            </div>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 1</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>Dave</span>
              </div>
            </div>
            <div style={{ height: 52, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 200 }}>Submits silently — two "The Mulligans" on the leaderboard.</p>
        </div>

        {/* AFTER */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (duplicate detected)</p>
          <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Team Name</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>The Mulligans</span>
              </div>
            </div>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 1</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>Dave</span>
              </div>
            </div>
            {/* Warning banner */}
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <span style={{ color: '#ef4444', fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
                <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
                  A team with this name already exists. Are you sure you want to create a duplicate?
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, height: 36, borderRadius: 999, border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cancel</span>
                </div>
                <div style={{ flex: 1, height: 36, borderRadius: 999, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Create Anyway</span>
                </div>
              </div>
            </div>
            <div style={{ height: 52, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 220 }}>Submit pauses, shows warning. Cancel to rename, or Create Anyway to proceed.</p>
        </div>

      </div>
    </div>
  );
}
