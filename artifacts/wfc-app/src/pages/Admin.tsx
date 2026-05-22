import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, setDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(false);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'dundee2025') {
      setAuth(true);
    } else {
      toast({ title: 'Access Denied', variant: 'destructive' });
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !message.trim()) return;
    try {
      await addDoc(collection(db, 'events'), {
        type: 'broadcast',
        message,
        timestamp: new Date().toISOString()
      });
      toast({ title: 'Broadcast Sent' });
      setMessage('');
    } catch (e) {
      toast({ title: 'Failed to send', variant: 'destructive' });
    }
  };

  if (!auth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-card p-8 rounded-xl border border-border space-y-6">
          <h2 className="font-condensed text-3xl font-black uppercase text-center">Admin <span className="text-primary">Access</span></h2>
          <Input 
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 bg-input"
          />
          <Button type="submit" className="w-full h-12 font-condensed text-xl tracking-widest font-bold">LOGIN</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 pb-24">
      <div className="max-w-md mx-auto space-y-8">
        <h2 className="font-condensed text-3xl font-black uppercase mt-8">Tournament <span className="text-primary">Control</span></h2>
        
        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Global Broadcast</h3>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Message to all players..."
              className="h-12 bg-input"
            />
            <Button type="submit" className="w-full h-12">Send Broadcast</Button>
          </form>
        </div>

        <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/50 space-y-4">
          <h3 className="font-bold uppercase tracking-widest text-sm text-red-500">Danger Zone</h3>
          <Button variant="destructive" className="w-full h-12" onClick={async () => {
            if (!window.confirm('Wipe ALL teams, scores, wheel spins, and the leaderboard? This cannot be undone.')) return;
            try {
              const fdb = db;
              if (fdb) {
                const wipeCollection = async (name: string) => {
                  const snap = await getDocs(collection(fdb, name));
                  if (snap.empty) return;
                  const batch = writeBatch(fdb);
                  snap.docs.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                };
                await Promise.all([
                  wipeCollection('teams'),
                  wipeCollection('events'),
                  wipeCollection('longestDrives'),
                ]);
                await setDoc(doc(fdb, 'config', 'tournament'), { resetAt: serverTimestamp() }, { merge: true });
              }
              // 3. Wipe THIS device's local state immediately and reload.
              localStorage.clear();
              toast({ title: 'Tournament reset', description: 'Reloading…' });
              setTimeout(() => window.location.href = '/', 600);
            } catch (e) {
              console.error(e);
              toast({ title: 'Reset failed', description: String(e), variant: 'destructive' });
            }
          }}>
            RESET TOURNAMENT
          </Button>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Wipes all teams, scores, wheel spins, and the leaderboard from Firestore. Every connected device will be reset to the home screen automatically.
          </p>
        </div>
      </div>
    </div>
  );
}