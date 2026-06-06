export function StandardPlay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 5 — No Placeholder, Flex Breathes
      </p>

      <div className="flex gap-10 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ height: 340, width: 220, display: 'flex', flexDirection: 'column', gap: 8, border: '1px dashed #222', borderRadius: 16, padding: 12 }}>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>4</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 7</span>
            </div>
            {/* Standard Play filler */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Standard Play</span>
            </div>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontSize: 38, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>Filler card forces a fixed gap — looks crowded.</p>
        </div>

        {/* AFTER — plain hole */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (plain hole)</p>
          <div style={{ height: 340, width: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px dashed #222', borderRadius: 16, padding: 12 }}>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>4</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 7</span>
            </div>
            {/* Nothing — flex justify-between absorbs the space */}
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontSize: 38, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>No filler. Space breathes. Nothing looks broken.</p>
        </div>

        {/* AFTER — rule hole (unchanged) */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (rule hole)</p>
          <div style={{ height: 340, width: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px dashed #222', borderRadius: 16, padding: 12 }}>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>3</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 3</span>
            </div>
            <div style={{ background: '#141414', border: '1px solid rgba(57,255,20,0.3)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ color: '#39FF14', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>Hole Rule</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', textTransform: 'uppercase', marginBottom: 4 }}>Tee Flip</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Stand face-to-face and flip a tee to decide who plays the shot.</p>
            </div>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontSize: 38, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>Rule holes unchanged — card still appears.</p>
        </div>

      </div>
    </div>
  );
}
