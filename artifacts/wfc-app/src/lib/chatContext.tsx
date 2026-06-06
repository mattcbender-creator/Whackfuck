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
  const lastOpenedRef = useRef<number>(
    parseInt(localStorage.getItem(LAST_OPENED_KEY) ?? '0', 10),
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !teamId) return;
    const q = query(chatCol(db), orderBy('ts', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const incoming = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<ChatMsg, 'id'>) }))
        .find(
          m =>
            m.toTeamId === teamId &&
            m.fromTeamId !== teamId &&
            (m.ts?.toMillis?.() ?? 0) > lastOpenedRef.current,
        );
      setLatestDm(incoming ?? null);
    });
    return unsub;
  }, [teamId]);

  const markOpened = () => {
    const now = Date.now();
    localStorage.setItem(LAST_OPENED_KEY, String(now));
    lastOpenedRef.current = now;
    setLatestDm(null);
  };

  return (
    <ChatNotifContext.Provider
      value={{ hasUnread: !!latestDm, latestDm, markOpened }}
    >
      {children}
    </ChatNotifContext.Provider>
  );
}
