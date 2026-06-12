// @vitest-environment jsdom
//
// Join-flow tests for the "team code required" host setting. These exercise the
// real JoinTournament screen — resolving a join code, listing teams, and tapping
// a team — and assert the three backward-compat rules the published WFC 2026
// tournament relies on:
//
//   • A tournament doc WITHOUT `requireTeamCode` is treated as code-required
//     (the `requireTeamCode !== false` default), so tapping a team prompts for
//     the 4-char team code rather than adopting it silently.
//   • When `requireTeamCode === false`, tapping a team adopts it directly with
//     no code prompt.
//   • When the code is required, a wrong code is rejected and the right one is
//     accepted.
//
// Firebase is forced ON here (db + isFirebaseConfigured) so resolveCode runs and
// the real-time team list effect fires, but firebase/firestore is faked: the
// onSnapshot subscription synchronously delivers a canned team list. The
// tournament context is mocked so we can drive lookupJoinCode and spy on
// enterAsPlayer (the call enterAsTeam ultimately makes to enter the tournament).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// Firebase appears configured so resolveCode proceeds and the team-list effect
// (guarded by isFirebaseConfigured && db) runs.
vi.mock('@/lib/firebase', () => ({ db: {}, isFirebaseConfigured: true }));

// Fake firebase/firestore: the only calls JoinTournament makes are collection()
// and onSnapshot(). onSnapshot immediately invokes its callback with the canned
// team list, then returns a no-op unsubscribe. Other named exports are stubbed
// so the real tournamentContext module (loaded via importOriginal) can import
// them without error.
const fs = vi.hoisted(() => {
  let teams: Array<{ id: string; teamName: string; players: string[]; teamCode: string }> = [];
  const setTeams = (t: typeof teams) => { teams = t; };
  const onSnapshot = (_col: unknown, cb: (snap: unknown) => void) => {
    cb({
      docs: teams.map(t => ({
        id: t.id,
        data: () => ({
          teamName: t.teamName,
          players: t.players,
          teamCode: t.teamCode,
          lastUpdated: 0,
        }),
      })),
    });
    return () => {};
  };
  return { setTeams, onSnapshot };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: fs.onSnapshot,
}));

// Tournament context: keep the real module's helpers but replace the hook so we
// can hand the component a controllable lookupJoinCode and observe enterAsPlayer.
const ctx = vi.hoisted(() => ({
  enterAsPlayer: vi.fn(),
  enterSpectator: vi.fn(),
  lookupJoinCode: vi.fn(),
}));

vi.mock('@/lib/tournamentContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tournamentContext')>();
  return {
    ...actual,
    useTournament: () => ctx,
    fetchTeamsForTournament: vi.fn(async () => []),
  };
});

import JoinTournament from '@/pages/JoinTournament';
import type { TournamentConfig } from '@/lib/tournament';

// A minimal resolved-tournament config. Only id + the requireTeamCode field
// matter to the code-required logic; the rest satisfies the type.
function makeTournament(overrides: Partial<TournamentConfig>): TournamentConfig {
  return {
    id: 't_join',
    name: 'Test Cup',
    courseName: 'Test CC',
    holes: [],
    trackYardages: false,
    teamSize: 2,
    startType: 'normal',
    autoTeeRule: false,
    requireTeamCode: true,
    adminCode: 'x',
    hostKey: 'KEY',
    joinCode: 'WFCDUN',
    holeRules: [],
    status: 'live',
    createdAt: 0,
    ...overrides,
  };
}

const TEAM = { id: 'team-1', teamName: 'The Mulligans', players: ['Alice', 'Bob'], teamCode: 'WXYZ' };

// Resolve the join code on the code-entry step and wait for the team list to
// render so the team's Join button is tappable.
async function resolveToChoose() {
  render(<JoinTournament />);
  const input = screen.getByTestId('input-join-code') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'WFCDUN' } });
  fireEvent.click(screen.getByTestId('button-resolve-code'));
  return screen.findByTestId(`button-team-${TEAM.id}`);
}

describe('JoinTournament — team code required setting', () => {
  beforeEach(() => {
    localStorage.clear();
    ctx.enterAsPlayer.mockReset();
    ctx.enterSpectator.mockReset();
    ctx.lookupJoinCode.mockReset();
    fs.setTeams([TEAM]);
  });

  afterEach(() => {
    cleanup();
  });

  it('treats a tournament WITHOUT requireTeamCode as code-required (prompts for the code)', async () => {
    // Absent field → requireTeamCode !== false → code required.
    const { requireTeamCode: _omit, ...rest } = makeTournament({});
    ctx.lookupJoinCode.mockResolvedValue(rest as TournamentConfig);

    const joinBtn = await resolveToChoose();
    fireEvent.click(joinBtn);

    // The team-code prompt appears, and the team is NOT adopted yet.
    expect(await screen.findByTestId('input-team-code')).toBeTruthy();
    expect(ctx.enterAsPlayer).not.toHaveBeenCalled();
  });

  it('adopts a team directly with no code prompt when requireTeamCode === false', async () => {
    ctx.lookupJoinCode.mockResolvedValue(makeTournament({ requireTeamCode: false }));

    const joinBtn = await resolveToChoose();
    fireEvent.click(joinBtn);

    // Entered straight away; no team-code step is ever shown.
    await waitFor(() => expect(ctx.enterAsPlayer).toHaveBeenCalledWith('t_join'));
    expect(screen.queryByTestId('input-team-code')).toBeNull();
    // The adopted team id is persisted so the store picks it up on entry.
    expect(localStorage.getItem('wfc-team-id::t_join')).toBe(TEAM.id);
  });

  it('rejects a wrong team code and accepts the right one when required', async () => {
    ctx.lookupJoinCode.mockResolvedValue(makeTournament({ requireTeamCode: true }));

    const joinBtn = await resolveToChoose();
    fireEvent.click(joinBtn);

    const codeInput = (await screen.findByTestId('input-team-code')) as HTMLInputElement;

    // Wrong code → error, not entered.
    fireEvent.change(codeInput, { target: { value: 'ZZZZ' } });
    fireEvent.click(screen.getByTestId('button-confirm-rejoin'));
    await screen.findByText(/wrong code/i);
    expect(ctx.enterAsPlayer).not.toHaveBeenCalled();

    // Right code (case-insensitive) → entered.
    fireEvent.change(codeInput, { target: { value: 'wxyz' } });
    fireEvent.click(screen.getByTestId('button-confirm-rejoin'));
    await waitFor(() => expect(ctx.enterAsPlayer).toHaveBeenCalledWith('t_join'));
  });
});
