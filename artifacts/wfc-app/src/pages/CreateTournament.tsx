import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import QRCode from 'qrcode';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CourseSetup } from '@/components/CourseSetup';
import { RuleBuilder } from '@/components/RuleBuilder';
import { useTournament, createTournamentDoc, fetchTournament } from '@/lib/tournamentContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  type CourseHole, type TournamentConfig, type HoleRule, type RuleLibraryEntry,
  blankCourse, holeRulesFromCourse,
  generateTournamentId, generateJoinCode, generateHostKey,
  buildWfc2026Config, WFC_2026_ID, WFC_2026_JOIN_CODE, WFC_2026_HOST_KEY,
  hostKeyKey,
} from '@/lib/tournament';
import {
  ArrowLeft, Copy, Check, Share2, KeyRound, AlertTriangle, ArrowRight,
} from 'lucide-react';

function joinLinkFor(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`;
}

export default function CreateTournament() {
  const [, setLocation] = useLocation();
  const { setActiveTournament } = useTournament();

  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [teamSize, setTeamSize] = useState(2);
  const [startType, setStartType] = useState<'normal' | 'shotgun'>('normal');
  const [adminCode, setAdminCode] = useState('');
  const [autoTeeRule, setAutoTeeRule] = useState(false);
  const [wfcPreset, setWfcPreset] = useState(false);

  const [holes, setHoles] = useState<CourseHole[]>(() => blankCourse());

  const [holeRules, setHoleRules] = useState<HoleRule[]>(() => holeRulesFromCourse(blankCourse()));
  const [customRules, setCustomRules] = useState<RuleLibraryEntry[]>([]);
  // Keep rules mirrored to the course until the host edits them in the builder.
  const [rulesDirty, setRulesDirty] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<TournamentConfig | null>(null);

  // Mirror the course's own rule fields into the rule builder until the host
  // edits rules themselves — then the builder becomes the source of truth.
  useEffect(() => {
    if (!rulesDirty) setHoleRules(holeRulesFromCourse(holes));
  }, [holes, rulesDirty]);

  // Autofill (or clear) the form with the canonical WFC 2026 / Dundee CC setup.
  const applyWfcPreset = (on: boolean) => {
    setWfcPreset(on);
    setError('');
    if (on) {
      const c = buildWfc2026Config();
      setName(c.name);
      setCourseName(c.courseName);
      setTeamSize(c.teamSize);
      setStartType(c.startType);
      setAutoTeeRule(c.autoTeeRule);
      setHoles(c.holes);
      setHoleRules(c.holeRules);
      // The preset's hole rules (e.g. the wheel) aren't derivable from the
      // course, so mark rules dirty to stop the holes→rules mirror clobbering them.
      setRulesDirty(true);
      setCustomRules(c.customRules ?? []);
      setAdminCode(c.adminCode);
    } else {
      // Clean slate: blank holes (par placeholder, no yardages, no rules) and
      // default settings — nothing pre-filled from Dundee.
      const blank = blankCourse();
      setName('');
      setCourseName('');
      setTeamSize(2);
      setStartType('normal');
      setAutoTeeRule(false);
      setHoles(blank);
      setRulesDirty(false);
      setHoleRules(holeRulesFromCourse(blank));
      setCustomRules([]);
      setAdminCode('');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Tournament name is required.'); return; }
    if (!courseName.trim()) { setError('Course name is required.'); return; }
    if (!adminCode.trim()) { setError('Set an admin code so you can manage the tournament.'); return; }
    if (holes.some(h => !h.par || h.par < 3)) { setError('Every hole needs a par (3 or more).'); return; }
    if (!isFirebaseConfigured) { setError('A live connection is required to create a tournament.'); return; }

    setSubmitting(true);
    try {
      // WFC 2026 preset → initialize (or re-enter) the canonical Dundee CC event
      // so its fixed join code stays stable. If it already exists, don't clobber
      // a possibly-live event — just open it.
      if (wfcPreset) {
        const existing = await fetchTournament(WFC_2026_ID);
        if (existing) {
          // Already initialized — re-enter read-only, don't overwrite a live
          // event. Just persist the canonical host key locally for admin access.
          try { localStorage.setItem(hostKeyKey(existing.id), existing.hostKey); } catch { /* ignore */ }
          setCreated(existing);
          return;
        }
      }

      // Derive yardage tracking from the data: a course with any distance
      // entered tracks yardages; pars-only stays par-only.
      const trackYardages = holes.some(h => (h.tips ?? 0) > 0 || (h.mid ?? 0) > 0 || (h.womens ?? 0) > 0);

      const config: TournamentConfig = {
        id: wfcPreset ? WFC_2026_ID : generateTournamentId(),
        name: name.trim(),
        courseName: courseName.trim(),
        holes,
        trackYardages,
        teamSize,
        startType,
        autoTeeRule,
        adminCode: adminCode.trim(),
        hostKey: wfcPreset ? WFC_2026_HOST_KEY : generateHostKey(),
        joinCode: wfcPreset ? WFC_2026_JOIN_CODE : generateJoinCode(),
        holeRules,
        customRules,
        status: 'live',
        createdAt: Date.now(),
      };
      await createTournamentDoc(config);
      // Show the success screen first. We deliberately do NOT switch the active
      // tournament here: activeId is the key on <StoreProvider> in App, so
      // changing it now would remount this whole subtree and discard the
      // success screen (the create would look like it "reset" the form). The
      // tournament becomes active only when the host taps "Enter Tournament".
      setCreated(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <SuccessScreen
        config={created}
        onEnter={() => {
          setActiveTournament(created.id);
          setLocation('/home');
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background px-6 py-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="font-condensed text-4xl font-black uppercase tracking-tight text-foreground mb-6">
          New <span className="text-primary">Tournament</span>
        </h1>

        <div className="space-y-5">
          <label className="flex items-center justify-between bg-primary/10 border border-primary/40 rounded-xl px-4 py-3 cursor-pointer">
            <div className="pr-3">
              <p className="text-sm font-bold text-foreground">WFC 2026 preset</p>
              <p className="text-[11px] text-muted-foreground">Autofill the Whack Fuck Cup at Dundee CC — course, rules, tees, and settings.</p>
            </div>
            <Switch checked={wfcPreset} onCheckedChange={applyWfcPreset} data-testid="switch-wfc-preset" />
          </label>

          <Field label="Tournament name">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring Scramble"
              className="h-12 bg-input/60 border-border/80 focus:border-primary text-base" data-testid="input-name" />
          </Field>

          <Field label="Course name">
            <Input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. Dundee Country Club"
              className="h-12 bg-input/60 border-border/80 focus:border-primary text-base" data-testid="input-course-name" />
          </Field>

          <Field label="Team size">
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setTeamSize(n)}
                  data-testid={`button-teamsize-${n}`}
                  className={`h-12 rounded-xl font-condensed font-black text-lg transition-all ${
                    teamSize === n ? 'bg-primary text-primary-foreground neon-border' : 'bg-card border border-border/70 text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Start format">
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'shotgun'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setStartType(t)}
                  data-testid={`button-start-${t}`}
                  className={`h-12 rounded-xl font-condensed font-bold uppercase tracking-widest text-sm transition-all ${
                    startType === t ? 'bg-primary text-primary-foreground neon-border' : 'bg-card border border-border/70 text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Admin code">
            <Input value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Code to manage the tournament"
              className="h-12 bg-input/60 border-border/80 focus:border-primary text-base" data-testid="input-admin-code" />
          </Field>

          <label className="flex items-center justify-between bg-card/50 border border-border/60 rounded-xl px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-bold text-foreground">Auto-tee rule</p>
              <p className="text-[11px] text-muted-foreground">WFC mechanic: under par switches you to the Tips tees. Yardages optional.</p>
            </div>
            <Switch checked={autoTeeRule} onCheckedChange={setAutoTeeRule} data-testid="switch-auto-tee" />
          </label>

          <CourseSetup
            holes={holes}
            onHolesChange={setHoles}
          />

          <RuleBuilder
            holeRules={holeRules}
            onHoleRulesChange={r => { setHoleRules(r); setRulesDirty(true); }}
            customRules={customRules}
            onCustomRulesChange={setCustomRules}
          />

          {error && (
            <div className="flex items-start gap-2 bg-destructive/15 border border-destructive/40 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-create-submit"
            className="w-full h-14 bg-primary text-primary-foreground font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function SuccessScreen({ config, onEnter }: { config: TournamentConfig; onEnter: () => void }) {
  const link = joinLinkFor(config.joinCode);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState<'link' | 'key' | null>(null);

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#39FF14', light: '#0a0a0a' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [link]);

  const copy = async (text: string, which: 'link' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: config.name, text: `Join ${config.name}`, url: link }); } catch { /* ignore */ }
    } else {
      copy(link, 'link');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background px-6 py-8">
      <div className="max-w-md mx-auto flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
          <Check className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-condensed text-3xl font-black uppercase tracking-tight text-foreground">
          {config.name} is live
        </h1>

        {qr && (
          <div className="bg-[#0a0a0a] border border-primary/30 rounded-2xl p-4">
            <img src={qr} alt="Join QR code" className="w-48 h-48" />
          </div>
        )}

        <div className="w-full bg-card border border-border/60 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Join code</p>
          <p className="font-condensed text-4xl font-black tracking-[0.3em] text-foreground" data-testid="text-join-code">{config.joinCode}</p>
          <button
            onClick={() => copy(link, 'link')}
            data-testid="button-copy-link"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-xs"
          >
            {copied === 'link' ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy join link</>}
          </button>
          <button
            onClick={share}
            data-testid="button-share"
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-primary text-primary-foreground font-condensed font-bold uppercase tracking-widest text-xs"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>

        {/* Host recovery key */}
        <div className="w-full bg-card border border-yellow-500/40 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Host recovery key</span>
          </div>
          <p className="font-mono text-lg font-bold text-foreground tracking-wider break-all" data-testid="text-host-key">{config.hostKey}</p>
          <div className="flex items-start gap-2 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Screenshot this now. It's the only way to regain admin access on a new device. We can't recover it for you.
            </p>
          </div>
          <button
            onClick={() => copy(config.hostKey, 'key')}
            data-testid="button-copy-key"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-xs"
          >
            {copied === 'key' ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy key</>}
          </button>
        </div>

        <button
          onClick={onEnter}
          data-testid="button-enter-tournament"
          className="w-full h-14 bg-primary text-primary-foreground font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          Enter Tournament <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
