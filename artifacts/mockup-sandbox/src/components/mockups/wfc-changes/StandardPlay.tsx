export function StandardPlay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 py-10"
      style={{ background: '#0a0a0a' }}>

      <p style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        CHANGE 5 — Standard Play Placeholder
      </p>

      <div className="flex gap-8 items-start">

        {/* BEFORE */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Before</p>
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Par card */}
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: '#fff', lineHeight: 1 }}>4</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 7</span>
            </div>
            {/* Empty gap — nothing here */}
            <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#222', fontSize: 10 }}>(empty gap)</span>
            </div>
            {/* Score entry */}
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#444', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>Blank gap between par and scoring. Looks broken.</p>
        </div>

        {/* AFTER */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After</p>
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Par card */}
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: '#fff', lineHeight: 1 }}>4</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 7</span>
            </div>
            {/* Standard Play pill */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Standard Play</span>
            </div>
            {/* Score entry */}
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>Dim label fills the gap. Intentional, not broken.</p>
        </div>

        {/* AFTER — with a rule */}
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#39FF14', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>After (rule hole)</p>
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: '#fff', lineHeight: 1 }}>3</span>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: 8 }}>Par · Hdcp 3</span>
            </div>
            <div style={{ background: '#141414', border: '1px solid rgba(57,255,20,0.3)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ color: '#39FF14', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>Hole Rule</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: '#fff', textTransform: 'uppercase', marginBottom: 4 }}>Tee Flip</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Stand face-to-face and flip a tee to decide who plays the shot.</p>
            </div>
            <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Enter Score</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>−</span></div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: 'rgba(255,255,255,0.2)' }}>—</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff' }}>+</span></div>
              </div>
            </div>
          </div>
          <p style={{ color: '#888', fontSize: 10, textAlign: 'center', maxWidth: 180 }}>Rule holes still show the full rule card as before.</p>
        </div>

      </div>
    </div>
  );
}
