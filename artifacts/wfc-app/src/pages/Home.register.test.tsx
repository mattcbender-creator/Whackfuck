// @vitest-environment jsdom
//
// Optional-team-name registration tests. The team name field is optional: on
// submit, Home derives the stored name from the typed name, falling back to the
// formatted player list, then a generic "Team" label. Player 1 stays required.
//
// Firebase is forced off so the store runs in localStorage-only mode; submitting
// persists the team to the per-tournament store key, which is what we assert.
// Home is rendered inside the real Tournament + Store providers (no App Switch),
// so the post-submit setLocation('/hole') just changes the URL without mounting
// another page.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/firebase', () => ({ db: null, isFirebaseConfigured: false }));

import Home from '@/pages/Home';
import { StoreProvider } from '@/lib/store';
import { TournamentProvider } from '@/lib/tournamentContext';
import { setActiveTournamentId, storeKey } from '@/lib/tournament';

const TID = 't_register';

function renderHome() {
  return render(
    <TournamentProvider>
      <StoreProvider>
        <Home />
      </StoreProvider>
    </TournamentProvider>,
  );
}

// Read the team name persisted to this tournament's store key.
function storedTeamName(): string | undefined {
  const raw = localStorage.getItem(storeKey(TID));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw)?.teamInfo?.teamName;
  } catch {
    return undefined;
  }
}

describe('Home — optional team name registration', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveTournamentId(TID);
  });

  afterEach(() => {
    cleanup();
    setActiveTournamentId(null);
  });

  it('registers with a blank team name, deriving the name from the player list', async () => {
    renderHome();

    const submit = await screen.findByTestId('button-submit-team');
    // Leave the team name blank; fill only player 1 and 2.
    fireEvent.change(screen.getByTestId('input-player-1'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('input-player-2'), { target: { value: 'Bob' } });
    fireEvent.click(submit);

    // Stored team name falls back to the formatted player list.
    await waitFor(() => expect(storedTeamName()).toBe('Alice & Bob'));
  });

  it('requires at least player 1 — submitting with everything blank stores nothing', async () => {
    renderHome();

    const submit = await screen.findByTestId('button-submit-team');
    // The player 1 field is marked required, so a real submit would be blocked
    // by the browser; assert the attribute and that no team is persisted.
    const player1 = screen.getByTestId('input-player-1') as HTMLInputElement;
    expect(player1.required).toBe(true);

    fireEvent.click(submit);

    // Nothing registered: handleSubmit bails when no player names are present.
    await new Promise(r => setTimeout(r, 50));
    expect(storedTeamName()).toBeUndefined();
  });

  it('uses the typed team name when one is provided', async () => {
    renderHome();

    const submit = await screen.findByTestId('button-submit-team');
    fireEvent.change(screen.getByTestId('input-team-name'), { target: { value: 'The Mulligans' } });
    fireEvent.change(screen.getByTestId('input-player-1'), { target: { value: 'Alice' } });
    fireEvent.click(submit);

    await waitFor(() => expect(storedTeamName()).toBe('The Mulligans'));
  });
});
