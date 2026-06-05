---
name: jsdom Radix Dialog UI tests
description: How to render and drive shadcn/Radix Dialog flows in wfc-app vitest UI tests without flakiness
---

# Testing Radix Dialog flows under jsdom (wfc-app)

wfc-app's vitest is `environment: 'node'` by default. Opt a UI test into a DOM with
a `// @vitest-environment jsdom` docblock as the file's first line. `.test.tsx` is
picked up by the `include` glob, and `esbuild.jsx: 'automatic'` in `vitest.config.ts`
lets JSX compile without importing React.

**Use `fireEvent`, not `userEvent`, to drive a Radix/shadcn Dialog.**
**Why:** `userEvent.type`/`click`'s pointer+focus sequence trips Radix Dialog's
dismiss-on-interact-outside under jsdom and silently closes the dialog mid-test
(the whole DialogContent unmounts — input, buttons, title all gone). `fireEvent.change`
+ `fireEvent.submit(form)` reproduce the real onChange/submit without that artefact.
**How to apply:** open with `fireEvent.click`, set inputs with `fireEvent.change`,
submit the gate by `fireEvent.submit(button.closest('form'))`.

Other gotchas:
- Radix needs jsdom polyfills: `matchMedia`, `ResizeObserver`,
  `Element.prototype.scrollIntoView`/`hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`.
- Seed an active tournament with `setActiveTournamentId(id)` (sets the module global AND
  localStorage) BEFORE render, or the `/home` route Guard redirects to `/`.
- A hard `window.location.href = BASE_URL` redirect can't navigate in jsdom. Replace
  `window.location` with a plain object exposing `pathname` (so wouter renders the route)
  plus an href getter/setter that records assignments, to assert the redirect target.
- vitest swallows `console.log` here; surface debug values via an assertion message instead.
