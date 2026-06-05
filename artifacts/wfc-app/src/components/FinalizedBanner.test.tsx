// @vitest-environment jsdom
//
// Behaviour test for the finalized-tournament banner. The banner is the user's
// escape hatch when a tournament has been finalized: a finalized tournament
// makes setScore silently no-op, so the steppers look broken ("nothing works").
// The banner makes the locked state visible and lets the host reopen scoring in
// one tap. We mock the tournament context so we can drive status/host directly
// without the Firestore fake.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const reopenTournament = vi.fn(async () => {});
const toast = vi.fn();

let mockState: { status: 'live' | 'final'; isHost: boolean };

vi.mock('@/lib/tournamentContext', () => ({
  useTournament: () => ({
    tournament: { status: mockState.status },
    isHost: mockState.isHost,
    reopenTournament,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

import { FinalizedBanner } from './FinalizedBanner';

describe('FinalizedBanner', () => {
  beforeEach(() => {
    mockState = { status: 'final', isHost: true };
    reopenTournament.mockClear();
    toast.mockClear();
  });
  afterEach(() => cleanup());

  it('renders nothing while the tournament is live', () => {
    mockState = { status: 'live', isHost: true };
    render(<FinalizedBanner />);
    expect(screen.queryByTestId('banner-finalized')).toBeNull();
  });

  it('shows the host a reopen button when finalized', () => {
    render(<FinalizedBanner />);
    expect(screen.getByTestId('banner-finalized')).toBeTruthy();
    expect(screen.getByTestId('button-reopen-scoring')).toBeTruthy();
  });

  it('hides the reopen button from non-host players', () => {
    mockState = { status: 'final', isHost: false };
    render(<FinalizedBanner />);
    expect(screen.getByTestId('banner-finalized')).toBeTruthy();
    expect(screen.queryByTestId('button-reopen-scoring')).toBeNull();
  });

  it('calls reopenTournament and toasts on success', async () => {
    render(<FinalizedBanner />);
    fireEvent.click(screen.getByTestId('button-reopen-scoring'));
    await waitFor(() => expect(reopenTournament).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Scoring reopened' }),
      ),
    );
  });

  it('toasts a destructive error when reopen fails', async () => {
    reopenTournament.mockRejectedValueOnce(new Error('offline'));
    render(<FinalizedBanner />);
    fireEvent.click(screen.getByTestId('button-reopen-scoring'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
  });
});
