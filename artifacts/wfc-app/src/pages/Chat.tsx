import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  addDoc, onSnapshot, orderBy, query,
  limitToLast, serverTimestamp,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Send, Users } from 'lucide-react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { chatCol, dmChannelId } from '@/lib/tournament';
import { useWFC } from '@/lib/store';
import type { TeamSnapshot } from '@/lib/store';
import { useChatNotif } from '@/lib/chatContext';
import type { ChatMsg } from '@/lib/chatContext';
import { pickRoast } from '@/lib/roasts';

const FACE_IMAGES: Record<string, string> = {
  angry:   '/whacky-angry.jpg',
  laugh:   '/whacky-laugh.jpg',
  shocked: '/whacky-shocked.jpg',
  fire:    '/whacky-fire.jpg',
  sad:     '/whacky-sad.jpg',
  smug:    '/whacky-smug.jpg',
};

// Whacky is a DM contact, not a lobby poster — he slides into your DMs.
const WHACKY_ID = '__whacky__';
const WHACKY_CONTACT: TeamSnapshot = {
  id: WHACKY_ID,
  teamName: 'Whacky',
  players: ['Your personal tormentor'],
  netScore: 0,
  holesPlayed: 0,
};

function tsMillis(m: ChatMsg): number {
  return m.ts?.toMillis?.() ?? 0;
}

function timeLabel(m: ChatMsg): string {
  const d = m.ts?.toDate?.() ?? new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, isMine }: { msg: ChatMsg; isMine: boolean }) {
  const face = msg.isWhacky ? (msg as ChatMsg & { face?: string }).face : undefined;
  const avatar = face ? FACE_IMAGES[face] ?? '/whacky-angry.jpg' : null;

  if (msg.isWhacky) {
    return (
      <div className="flex items-end gap-2 max-w-[88%]">
        <img
          src={avatar ?? '/whacky-angry.jpg'}
          alt="Whacky"
          className="w-8 h-8 rounded-full object-cover shrink-0 border border-primary/30"
        />
        <div>
          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1 ml-1">
            Whacky
          </p>
          <div className="bg-zinc-800 border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2 shadow">
            <p className="text-[13px] text-foreground/85 leading-snug break-words whitespace-pre-wrap">{msg.text}</p>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5 ml-1">{timeLabel(msg)}</p>
        </div>
      </div>
    );
  }

  if (isMine) {
    return (
      <div className="flex justify-end max-w-[88%] self-end">
        <div>
          <div className="bg-primary/20 border border-primary/25 rounded-2xl rounded-br-sm px-3 py-2 shadow">
            <p className="text-[13px] text-foreground leading-snug break-words whitespace-pre-wrap">{msg.text}</p>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5 text-right">{timeLabel(msg)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 max-w-[88%]">
      <div className="w-8 h-8 rounded-full bg-zinc-700 shrink-0 flex items-center justify-center">
        <span className="text-[10px] font-black text-primary">
          {msg.fromTeamName.charAt(0).toUpperCase()}
        </span>
      </div>
      <div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1 ml-1">
          {msg.fromTeamName}
        </p>
        <div className="bg-zinc-900 border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2 shadow">
          <p className="text-[13px] text-foreground/85 leading-snug break-words whitespace-pre-wrap">{msg.text}</p>
        </div>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5 ml-1">{timeLabel(msg)}</p>
      </div>
    </div>
  );
}

// ── Message list ─────────────────────────────────────────────────────────────
function MessageList({ msgs, teamId }: { msgs: ChatMsg[]; teamId: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  if (msgs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No messages yet. Say something.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {msgs.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={`flex ${m.fromTeamId === teamId ? 'justify-end' : 'justify-start'}`}
          >
            <Bubble msg={m} isMine={m.fromTeamId === teamId} />
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}

// ── Send input ───────────────────────────────────────────────────────────────
function SendBar({
  onSend, disabled,
}: { onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    await onSend(trimmed);
    setText('');
    setSending(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-background">
      <input
        className="flex-1 bg-zinc-900 border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        placeholder="Message…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        maxLength={300}
        disabled={disabled}
      />
      <button
        onClick={submit}
        disabled={!text.trim() || sending || disabled}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-black disabled:opacity-30 active:scale-90 transition-transform"
        aria-label="Send"
      >
        <Send className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// Input bar pinned just above the bottom nav so it's always reachable — no
// scrolling — and it rides above the keyboard (viewport resizes on focus).
function ChatInputBar({
  onSend, disabled,
}: { onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-background">
      <div className="max-w-md mx-auto">
        <SendBar onSend={onSend} disabled={disabled} />
      </div>
    </div>
  );
}

// ── Main Chat page ───────────────────────────────────────────────────────────
type Tab = 'lobby' | 'teams';

export default function Chat() {
  const { teamId, teamInfo, listTeamsOnce } = useWFC();
  const { markOpened } = useChatNotif();
  const [tab, setTab] = useState<Tab>('lobby');
  const [selectedTeam, setSelectedTeam] = useState<TeamSnapshot | null>(null);
  const [allMsgs, setAllMsgs] = useState<ChatMsg[]>([]);
  const [teams, setTeams] = useState<TeamSnapshot[]>([]);
  const allMsgsRef = useRef<ChatMsg[]>([]);
  const whackyMsgIdx = useRef(Math.floor(Math.random() * 100));

  // Mark chat as opened — clears the unread badge for THIS device. Re-run
  // whenever a new message arrives while the chat is open so the badge stays
  // cleared as the user reads, instead of popping back on every incoming message.
  const latestMsg = allMsgs[allMsgs.length - 1];
  useEffect(() => { markOpened(); }, [latestMsg?.id, latestMsg?.ts?.toMillis?.()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Firestore subscription — one listener, filter client-side
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const q = query(chatCol(db), orderBy('ts', 'asc'), limitToLast(80));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<ChatMsg, 'id'>),
      }));
      allMsgsRef.current = msgs;
      setAllMsgs([...msgs]);
    });
    return unsub;
  }, []);

  // Load team list for DM tab
  useEffect(() => {
    if (tab !== 'teams') return;
    listTeamsOnce().then(list =>
      setTeams(list.filter(t => t.id !== teamId)),
    );
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived message lists
  const lobbyMsgs = allMsgs.filter(m => m.channel === 'general');
  const dmMsgs = selectedTeam
    ? allMsgs.filter(m => m.channel === dmChannelId(teamId, selectedTeam.id))
    : [];

  // ── Whacky slides into your DMs (never the lobby) ───────────────────────────
  const postWhacky = useCallback(async () => {
    if (!db || !teamInfo || !isFirebaseConfigured) return;
    const ch = dmChannelId(WHACKY_ID, teamId);
    // Skip if Whacky DM'd this team within the last 2 minutes (another device)
    const now = Date.now();
    const recentWhacky = allMsgsRef.current.find(
      m => m.channel === ch && m.isWhacky && (m.ts?.toMillis?.() ?? 0) > now - 120_000,
    );
    if (recentWhacky) return;
    const roast = pickRoast({
      teamName: teamInfo.teamName,
      players: teamInfo.players,
      netScore: 0,
      holesPlayed: 0,
      holeNum: 1,
      score: null,
      par: 4,
      msgIndex: whackyMsgIdx.current++,
    });
    await addDoc(chatCol(db), {
      fromTeamId: WHACKY_ID,
      fromTeamName: 'Whacky',
      toTeamId: teamId,
      text: roast.text,
      face: roast.face,
      ts: serverTimestamp(),
      isWhacky: true,
      channel: ch,
    });
  }, [teamInfo, teamId]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // Initial post: wait 15-45 s after first open
    const t1 = window.setTimeout(postWhacky, 15_000 + Math.random() * 30_000);
    // Recurring every 5-8 minutes
    const t2 = window.setInterval(postWhacky, 300_000 + Math.random() * 180_000);
    return () => { window.clearTimeout(t1); window.clearInterval(t2); };
  }, [postWhacky]);

  // ── Send helpers ─────────────────────────────────────────────────────────
  const sendToLobby = async (text: string) => {
    if (!db || !teamInfo) return;
    await addDoc(chatCol(db), {
      fromTeamId: teamId,
      fromTeamName: teamInfo.teamName,
      toTeamId: null,
      text,
      ts: serverTimestamp(),
      isWhacky: false,
      channel: 'general',
    });
  };

  const sendDm = async (text: string) => {
    if (!db || !teamInfo || !selectedTeam) return;
    const ch = dmChannelId(teamId, selectedTeam.id);
    await addDoc(chatCol(db), {
      fromTeamId: teamId,
      fromTeamName: teamInfo.teamName,
      toTeamId: selectedTeam.id,
      text,
      ts: serverTimestamp(),
      isWhacky: false,
      channel: ch,
    });
    // DM Whacky and he fires back a roast shortly after.
    if (selectedTeam.id === WHACKY_ID) {
      window.setTimeout(postWhacky, 2_000 + Math.random() * 2_500);
    }
  };

  // ── No Firebase ───────────────────────────────────────────────────────────
  if (!isFirebaseConfigured) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center px-6 text-center pb-16">
        <MessageCircle className="w-12 h-12 text-primary/40 mb-4" />
        <h2 className="text-xl font-black font-condensed text-foreground mb-2">
          Chat needs Firebase
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Real-time chat requires a Firebase connection.
          Set your <code className="text-primary">VITE_FIREBASE_*</code> env vars and restart.
        </p>
      </div>
    );
  }

  // ── DM conversation view ──────────────────────────────────────────────────
  if (selectedTeam) {
    return (
      <div className="h-[100dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setSelectedTeam(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 active:bg-zinc-800"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Direct</p>
            <p className="text-[15px] font-black font-condensed text-foreground truncate">
              {selectedTeam.teamName}
            </p>
          </div>
        </div>

        <MessageList msgs={dmMsgs} teamId={teamId} />
        <ChatInputBar onSend={sendDm} />
      </div>
    );
  }

  // ── Main chat (tabs) ──────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header + tab switcher */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-4 pt-4 pb-0">
          <p className="text-2xl font-black font-condensed text-primary tracking-wide">Chat</p>
        </div>
        <div className="flex px-4 gap-1 mt-2">
          {(['lobby', 'teams'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-t-lg transition-colors ${
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              {t === 'lobby' ? 'Lobby' : 'Teams'}
            </button>
          ))}
        </div>
      </div>

      {/* Lobby */}
      {tab === 'lobby' && (
        <>
          <MessageList msgs={lobbyMsgs} teamId={teamId} />
          <ChatInputBar onSend={sendToLobby} />
        </>
      )}

      {/* Teams (DM list) — Whacky is always pinned at the top */}
      {tab === 'teams' && (
        <div className="flex-1 overflow-y-auto pb-[68px]">
          <div className="divide-y divide-border">
            {[WHACKY_CONTACT, ...teams].map(team => {
              const isWhackyContact = team.id === WHACKY_ID;
              const dmChannel = dmChannelId(teamId, team.id);
              const unread = allMsgs.filter(
                m => m.channel === dmChannel && m.toTeamId === teamId && m.fromTeamId !== teamId,
              ).length;
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900 transition-colors"
                >
                  {isWhackyContact ? (
                    <img
                      src="/whacky-smug.jpg"
                      alt="Whacky"
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-primary/40"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-black text-primary">
                        {team.teamName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold truncate ${isWhackyContact ? 'text-primary' : 'text-foreground'}`}>
                      {team.teamName}
                    </p>
                    {team.players.filter(Boolean).length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {team.players.filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 rounded-full bg-primary text-black text-[10px] font-black flex items-center justify-center px-1.5">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {teams.length === 0 && (
            <div className="flex flex-col items-center gap-2 text-center px-8 py-8">
              <Users className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-[13px]">
                No other teams yet. Once more teams join you can DM them too.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
