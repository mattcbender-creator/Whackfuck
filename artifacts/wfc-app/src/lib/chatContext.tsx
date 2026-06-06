import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { chatCol } from './tournament';
import { useWFC } from './store';
import type { Timestamp } from 'firebase/firestore';

export interface ChatMsg {
  id: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string | null;
  text: string;
  ts: Timestamp | null;
  isWhacky: boolean;
  channel: string;
}

interface ChatNotifCtx {
  hasUnread: boolean;
  latestDm: ChatMsg | null;
  markOpened: () => void;
}

const ChatNotifContext = createContext<ChatNotifCtx>({
  hasUnread: false,
  latestDm: null,
  markOpened: () => {},
});

export function useChatNotif() {
  return useContext(ChatNotifContext);
}

const LAST_OPENED_KEY = 'wfc-chat-opened';

export function ChatNotifProvider({ children }: { children: ReactNode }) {
  const { teamId } = useWFC();
  const [latestDm, setLatestDm] = useState<ChatMsg | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const lastOpenedRef = useRef<number>(
    parseInt(localStorage.getItem(LAST_OPENED_KEY) ?? '0', 10),
  );
  // Newest message timestamp this device has observed. markOpened() marks read
  // up to this point (not just Date.now()), so a freshly-arrived message whose
  // server ts is ahead of the device clock still clears the badge.
  const latestMsgTsRef = useRef<number>(0);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !teamId) return;
    const q = query(chatCol(db), orderBy('ts', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<ChatMsg, 'id'>),
      }));

      for (const m of msgs) {
        const t = m.ts?.toMillis?.() ?? 0;
        if (t > latestMsgTsRef.current) latestMsgTsRef.current = t;
      }

      // Badge: ANY new message from someone else — lobby (toTeamId null) OR a DM to me.
      const unread = msgs.some(
        m =>
          m.fromTeamId !== teamId &&
          (m.toTeamId === null || m.toTeamId === teamId) &&
          (m.ts?.toMillis?.() ?? 0) > lastOpenedRef.current,
      );
      setHasUnread(unread);

      // Pop-up banner: DMs only, to avoid spamming the screen with group chatter.
      const dm = msgs.find(
        m =>
          m.toTeamId === teamId &&
          m.fromTeamId !== teamId &&
          (m.ts?.toMillis?.() ?? 0) > lastOpenedRef.current,
      );
      setLatestDm(dm ?? null);
    });
    return unsub;
  }, [teamId]);

  const markOpened = () => {
    const upTo = Math.max(Date.now(), latestMsgTsRef.current);
    localStorage.setItem(LAST_OPENED_KEY, String(upTo));
    lastOpenedRef.current = upTo;
    setLatestDm(null);
    setHasUnread(false);
  };

  return (
    <ChatNotifContext.Provider value={{ hasUnread, latestDm, markOpened }}>
      {children}
    </ChatNotifContext.Provider>
  );
}
