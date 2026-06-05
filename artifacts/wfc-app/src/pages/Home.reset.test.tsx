// @vitest-environment jsdom
//
// On-screen device-reset flow test. The helper that does the wiping
// (`clearAllLocalAppState`) is unit-tested in tournament.test.ts; this exercises
// the *actual home screen* a user sees: the reset icon, the password gate, and
// the return-to-main-menu behaviour, all wired together through the real App,
// providers, and route Guard. Firebase is unconfigured in tests, so the app runs
// in its localStorage-only mode and no Firestore calls fire.
//
// Note: we drive the dialog with fireEvent rather than userEvent. userEvent's
// pointer/focus sequence trips Radix Dialog's dismiss-on-interact-outside under
// jsdom and closes the dialog mid-test; fireEvent reproduces the real onChange /
// submit behaviour without that artefact.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// This suite exercises the localStorage-only device-reset path (see header note),
// so force Firebase off regardless of any VITE_FIREBASE_* env present in the
// runner. With `db` null the reset skips its Firestore wipe and only clears
// local state + redirects — exactly the flow asserted below.
vi.mock('@/lib/firebase', () => ({ db: null, isFirebaseConfigured: false }));

import App from '@/App';
import {
  WFC_2026_ID,
  setActiveTournamentId,
  getActiveTournamentId,
  storeKey,
  teamIdKey,
} from '@/lib/tournament';

const RESET_PASSWORD = '0010110';
const BASE_URL = import.meta.env.BASE_URL;

// ── jsdom polyfills for Radix Dialog ────────────────────────────────────────
// Radix primitives reach for browser APIs jsdom doesn't implement. Stub the
// minimum the reset dialog needs to mount and focus-trap without throwing.
function installBrowserPolyfills() {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
}

// ── window.location stub ────────────────────────────────────────────────────
// The reset performs a hard `window.location.href = BASE_URL` redirect, which
// jsdom can't actually navigate. Replace location with a plain object that holds
// the requested path (so wouter renders the right route) and records every href
// assignment so the test can assert the redirect target.
let hrefHistory: string[] = [];

function installLocationStub(pathname: string) {
  hrefHistory = [];
  const real = window.location;
  const loc: Record<string, unknown> = {
    origin: real.origin,
    protocol: real.protocol,
    host: real.host,
    hostname: real.hostname,
    port: real.port,
    pathname,
    search: '',
    hash: '',
    assign: vi.fn((v: string) => hrefHistory.push(v)),
    replace: vi.fn((v: string) => hrefHistory.push(v)),
    reload: vi.fn(),
  };
  let href = real.href;
  Object.defineProperty(loc, 'href', {
    configurable: true,
    enumerable: true,
    get: () => href,
    set: (v: string) => {
      href = v;
      hrefHistory.push(v);
    },
  });
  Object.defineProperty(window, 'location', { configurable: true, value: loc });
}

// Seed an active tournament plus a couple of per-tournament local keys, mirroring
// a device that has been used in a live round.
function seedActiveTournament() {
  setActiveTournamentId(WFC_2026_ID);
  localStorage.setItem(
    storeKey(WFC_2026_ID),
    JSON.stringify({ teamInfo: { teamName: 'Test Team', players: ['Alice'] }, scores: Array(18).fill(null) }),
  );
  localStorage.setItem(teamIdKey(WFC_2026_ID), 'team-xyz');
}

function localWfcKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('wfc-')) keys.push(k);
  }
  return keys;
}

// Open the reset dialog, enter a password, and submit the gate form.
function submitResetPassword(password: string) {
  fireEvent.click(screen.getByTestId('button-open-reset'));
  const input = screen.getByTestId('input-reset-password') as HTMLInputElement;
  fireEvent.change(input, { target: { value: password } });
  const form = screen.getByTestId('button-confirm-reset').closest('form')!;
  fireEvent.submit(form);
}

describe('Home device reset (on-screen flow)', () => {
  beforeEach(() => {
    installBrowserPolyfills();
    localStorage.clear();
    setActiveTournamentId(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the reset icon and opens the password dialog', async () => {
    seedActiveTournament();
    installLocationStub('/home');

    render(<App />);

    const resetBtn = await screen.findByTestId('button-open-reset');
    expect(resetBtn).toBeTruthy();

    fireEvent.click(resetBtn);

    expect(await screen.findByTestId('input-reset-password')).toBeTruthy();
    expect(screen.getByTestId('button-confirm-reset')).toBeTruthy();
  });

  it('rejects a wrong password and clears nothing', async () => {
    seedActiveTournament();
    installLocationStub('/home');

    render(<App />);
    await screen.findByTestId('button-open-reset');

    submitResetPassword('wrong-password');

    const errorEl = await screen.findByTestId('text-reset-error');
    expect(errorEl.textContent ?? '').toMatch(/incorrect password/i);

    // Nothing wiped: the active tournament and seeded local keys survive, and no
    // redirect was attempted.
    expect(getActiveTournamentId()).toBe(WFC_2026_ID);
    expect(localStorage.getItem(storeKey(WFC_2026_ID))).not.toBeNull();
    expect(localStorage.getItem(teamIdKey(WFC_2026_ID))).toBe('team-xyz');
    expect(hrefHistory).toHaveLength(0);
  });

  it('wipes local data and returns to the clean main menu with the correct password', async () => {
    seedActiveTournament();
    installLocationStub('/home');

    render(<App />);
    await screen.findByTestId('button-open-reset');

    submitResetPassword(RESET_PASSWORD);

    // Local data is wiped and the active tournament pointer is cleared.
    await waitFor(() => expect(getActiveTournamentId()).toBeNull());
    expect(localWfcKeys()).toHaveLength(0);

    // The app hard-redirects to the app root (the main menu).
    expect(hrefHistory.at(-1)).toBe(BASE_URL);

    // Simulate the redirect/reload landing on the root: a fresh App with no
    // active tournament renders the clean main menu (create/join), not a team
    // already in a tournament.
    cleanup();
    installLocationStub('/');
    render(<App />);

    expect(await screen.findByTestId('button-create')).toBeTruthy();
    expect(screen.queryByTestId('button-continue-tournament')).toBeNull();
  });
});
