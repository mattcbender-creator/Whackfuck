export function LockedInputs() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 3 — Locked Inputs After Submit
      </p>

      <div className="flex gap-8 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before (submitted)</p>
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
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 2</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>Mike</span>
              </div>
            </div>
            <div style={{ height: 52, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 200 }}>Inputs look editable even though nothing can change. Confusing.</p>
        </div>

        {/* AFTER */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (submitted)</p>
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ opacity: 0.5 }}>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Team Name</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ color: '#aaa', fontSize: 15 }}>The Mulligans</span>
              </div>
            </div>
            <div style={{ opacity: 0.5 }}>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 1</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ color: '#aaa', fontSize: 15 }}>Dave</span>
              </div>
            </div>
            <div style={{ opacity: 0.5 }}>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 2</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ color: '#aaa', fontSize: 15 }}>Mike</span>
              </div>
            </div>
            <div style={{ height: 52, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 200 }}>All fields dim to 50% — clearly read-only. No confusion.</p>
        </div>

      </div>
    </div>
  );
}
