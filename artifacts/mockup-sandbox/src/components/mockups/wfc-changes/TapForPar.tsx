export function TapForPar() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 4 — Invisible Tap Target
      </p>

      <div className="flex gap-10 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px 20px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60, minHeight: 60, justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                  Tap<br/>for par
                </span>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 170 }}>Labelled hit target — tells player what to do</p>
        </div>

        {/* AFTER — unscored */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (unscored)</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px 20px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              {/* Invisible 60×60 hit box — just a dash */}
              <div style={{ minWidth: 60, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.15)' }}>—</span>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 170 }}>Silent dash. Tap it → par set. No labels.</p>
        </div>

        {/* AFTER — scored */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (tapped → par)</p>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px 20px', width: 200 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Enter Score</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>−</span>
              </div>
              <div style={{ minWidth: 60, minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.85)' }}>4</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>PAR</span>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 22 }}>+</span>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 170 }}>Score set instantly. Adjust with − / +.</p>
        </div>

      </div>
    </div>
  );
}
