export function TapForPar() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 py-10"
      style={{ background: '#0a0a0a', fontFamily: 'system-ui' }}>

      <p style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 4 — Tap for Par
      </p>

      <div className="flex gap-8 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div className="flex items-center justify-between gap-3">
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              <div className="flex flex-col items-center" style={{ width: 80 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 56, lineHeight: 1, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>—</span>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 160 }}>Dash shown. Must tap + to start scoring.</p>
        </div>

        {/* AFTER — unscored */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (unscored)</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div className="flex items-center justify-between gap-3">
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, lineHeight: 1.2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                  TAP<br/>FOR PAR
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>—</span>
              </button>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 160 }}>Tap the centre to instantly set par.</p>
        </div>

        {/* AFTER — scored at par */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (par scored)</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div className="flex items-center justify-between gap-3">
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 44, lineHeight: 1, color: 'rgba(255,255,255,0.85)' }}>4</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>PAR</span>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 160 }}>One tap → score set. Adjust with − / + as normal.</p>
        </div>

      </div>
    </div>
  );
}
