import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import QRCode from 'qrcode';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CourseSetup } from '@/components/CourseSetup';
import { RuleBuilder } from '@/components/RuleBuilder';
import { useTournament, createTournamentDoc } from '@/lib/tournamentContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  type CourseHole, type TournamentConfig, type HoleRule, type RuleLibraryEntry,
  blankCourse, holeRulesFromCourse, blankTournamentSetup, tracksYardages,
  generateTournamentId, generateJoinCode, generateHostKey,
  buildWfc2026Config,
} from '@/lib/tournament';
import {
  ArrowLeft, Copy, Check, Share2, KeyRound, AlertTriangle, ArrowRight,
  Sparkles, MapPin, ClipboardList, ChevronDown,
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
  const [requireTeamCode, setRequireTeamCode] = useState(true);
  const [useTeamNames, setUseTeamNames] = useState(true);
  const [wfcPreset, setWfcPreset] = useState(false);

  const [holes, setHoles] = useState<CourseHole[]>(() => blankCourse());

  const [holeRules, setHoleRules] = useState<HoleRule[]>(() => holeRulesFromCourse(blankCourse()));
  const [customRules, setCustomRules] = useState<RuleLibraryEntry[]>([]);
  // Keep rules mirrored to the course until the host edits them in the builder.
  const [rulesDirty, setRulesDirty] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<TournamentConfig | null>(null);

  // Which setup section is expanded ('course' | 'rules' | null). Only one opens
  // at a time and both start closed to keep the mobile form short.
  const [openSection, setOpenSection] = useState<'course' | 'rules' | null>(null);

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
      setRequireTeamCode(c.requireTeamCode);
      setUseTeamNames(c.useTeamNames);
      setHoles(c.holes);
      setHoleRules(c.holeRules);
      // The preset only pre-fills plain rules derived from the course. The host
      // adds any wheel/Item Box holes themselves in the rule builder, so let the
      // holes→rules mirror stay live until they edit.
      setRulesDirty(false);
      setCustomRules(c.customRules ?? []);
      setAdminCode(c.adminCode);
    } else {
      // Clean slate: blank holes (par placeholder, no yardages, no rules) and
      // default settings — nothing pre-filled from Dundee.
      const blank = blankTournamentSetup();
      setName(blank.name);
      setCourseName(blank.courseName);
      setTeamSize(blank.teamSize);
      setStartType(blank.startType);
      setAutoTeeRule(blank.autoTeeRule);
      setRequireTeamCode(blank.requireTeamCode);
      setUseTeamNames(blank.useTeamNames);
      setHoles(blank.holes);
      setRulesDirty(false);
      setHoleRules(blank.holeRules);
      setCustomRules(blank.customRules);
      setAdminCode(blank.adminCode);
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
      // Derive yardage tracking from the data: a course with any distance
      // entered tracks yardages; pars-only stays par-only.
      const trackYardages = tracksYardages(holes);

      // Every tournament — including one started from the WFC preset — is a
      // fresh, independent event with its own generated id, host key, and join
      // code. The preset only pre-fills the form fields.
      const config: TournamentConfig = {
        id: generateTournamentId(),
        name: name.trim(),
        courseName: courseName.trim(),
        holes,
        trackYardages,
        teamSize,
        startType,
        autoTeeRule,
        requireTeamCode,
        useTeamNames,
        adminCode: adminCode.trim(),
        hostKey: generateHostKey(),
        joinCode: generateJoinCode(),
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
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => applyWfcPreset(true)}
              data-testid="button-load-preset"
              className="w-full flex items-center justify-center gap-2 h-14 bg-primary/15 border border-primary/50 rounded-xl text-primary font-condensed text-xl font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              <Sparkles className="w-5 h-5" /> Load WFC Preset
            </button>
            {wfcPreset ? (
              <button
                type="button"
                onClick={() => applyWfcPreset(false)}
                data-testid="button-clear-preset"
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear preset & start blank
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center px-4">
                Fills the course, rules, tees &amp; settings for the Whack Fuck Cup at Dundee CC instantly.
              </p>
            )}
          </div>

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

          <label className="flex items-center justify-between bg-card/50 border border-border/60 rounded-xl px-4 py-3 cursor-pointer">
            <div className="pr-4">
              <p className="text-sm font-bold text-foreground">Require team code to join</p>
              <p className="text-[11px] text-muted-foreground">
                {requireTeamCode
                  ? 'Players need the 4-character team code to rejoin an existing team.'
                  : 'Players can rejoin any team by tapping it — no code needed.'}
              </p>
            </div>
            <Switch checked={requireTeamCode} onCheckedChange={setRequireTeamCode} data-testid="switch-require-team-code" />
          </label>

          <label className="flex items-center justify-between bg-card/50 border border-border/60 rounded-xl px-4 py-3 cursor-pointer">
            <div className="pr-4">
              <p className="text-sm font-bold text-foreground">Use team names</p>
              <p className="text-[11px] text-muted-foreground">
                {useTeamNames
                  ? 'Each team enters its own name when registering.'
                  : "No team names — the players' names are used as the team name."}
              </p>
            </div>
            <Switch checked={useTeamNames} onCheckedChange={setUseTeamNames} data-testid="switch-use-team-names" />
          </label>

          <div className="space-y-3">
            <Section
              title="Course Setup"
              icon={<MapPin className="w-4 h-4 text-primary" />}
              open={openSection === 'course'}
              onToggle={() => setOpenSection(s => (s === 'course' ? null : 'course'))}
              testid="section-course"
            >
              <CourseSetup
                holes={holes}
                onHolesChange={setHoles}
                showYardages={autoTeeRule}
              />
            </Section>

            <Section
              title="Hole Rules (Optional Chaos Modifiers)"
              icon={<ClipboardList className="w-4 h-4 text-primary" />}
              open={openSection === 'rules'}
              onToggle={() => setOpenSection(s => (s === 'rules' ? null : 'rules'))}
              testid="section-rules"
            >
              <RuleBuilder
                holeRules={holeRules}
                onHoleRulesChange={r => { setHoleRules(r); setRulesDirty(true); }}
                customRules={customRules}
                onCustomRulesChange={setCustomRules}
                onHoleClose={() => setOpenSection('rules')}
              />
            </Section>
          </div>

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

function Section({
  title, icon, open, onToggle, testid, children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        data-testid={`${testid}-toggle`}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-condensed font-black uppercase tracking-widest text-sm text-foreground">
            {title}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Kept mounted (hidden, not unmounted) so any open per-hole editor dialog
          inside survives the section collapsing when a hole is opened. */}
      <div className={open ? 'px-4 pb-4' : 'hidden'} data-testid={`${testid}-content`}>
        {children}
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
