export function DuplicateWarning() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 2 — Hard Block on Duplicate Name
      </p>

      <div className="flex gap-10 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before (soft warning)</p>
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Team Name</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>The Mulligans</span>
              </div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                ⚠ A team with this name already exists. Are you sure?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, height: 34, borderRadius: 999, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Cancel</span>
                </div>
                <div style={{ flex: 1, height: 34, borderRadius: 999, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Create Anyway</span>
                </div>
              </div>
            </div>
            <div style={{ height: 50, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <span style={{ fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 200 }}>
            Fires after submit. Player can still bypass with "Create Anyway".
          </p>
        </div>

        {/* AFTER */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (as-you-type block)</p>
          <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Team Name</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #ef4444', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>The Mulligans</span>
              </div>
              {/* Inline error — no dialog */}
              <p style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>
                Name taken. Tap JOIN on the existing team above.
              </p>
            </div>
            <div>
              <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Player 1</p>
              <div style={{ height: 44, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 15 }}>Dave</span>
              </div>
            </div>
            {/* Button hard-disabled */}
            <div style={{ height: 50, background: '#39FF14', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed' }}>
              <span style={{ fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000' }}>Start Tournament</span>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 220 }}>
            Fires 400ms after typing stops. Button locked. No dialog. No bypass.
          </p>
        </div>

      </div>
    </div>
  );
}
