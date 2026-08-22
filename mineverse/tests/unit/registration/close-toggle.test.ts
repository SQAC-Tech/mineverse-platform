import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registrationOpenDefault } from '@/lib/platform/settings';

/**
 * Closing registration has to close it, not hide the button.
 *
 * `registration_open` reached exactly two places — the landing page and
 * `/api/event/config` — and both only decided whether to *show* the call to
 * action. `POST /api/register` never looked at it. So "registration closed"
 * meant the link was unadvertised, while anyone holding it, or posting straight
 * at the endpoint, sailed through.
 *
 * These are source assertions rather than a live request: the failure was a
 * check that did not exist in a file, which is exactly what reading the file
 * catches, and it needs no database.
 */

const root = join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

describe('the registration switch', () => {
  it('is enforced by the endpoint that creates teams', () => {
    const route = read('app', 'api', 'register', 'route.ts');
    expect(route).toMatch(/isRegistrationOpen/);
    expect(route).toMatch(/403/);
  });

  it('is checked before the request body is even read', () => {
    // A closed form has nothing to say about a malformed payload or a spent
    // rate-limit budget, and answering those first leaks that it is still live.
    const route = read('app', 'api', 'register', 'route.ts');
    const gate = route.indexOf('isRegistrationOpen');
    const parse = route.indexOf('await req.json()');
    expect(gate).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(parse);
  });

  it('reaches the landing page and the public config', () => {
    for (const parts of [
      ['app', 'landing', 'page.tsx'],
      ['app', 'api', 'event', 'config', 'route.ts'],
    ]) {
      const source = read(...parts);
      expect(source, parts.join('/')).toMatch(/isRegistrationOpen/);
      // Both used to be captured at build time. A prerendered "open" would keep
      // inviting sign-ups after the switch was thrown.
      expect(source, parts.join('/')).toMatch(/export const dynamic = 'force-dynamic'/);
    }
  });

  it('no longer reads the env var directly at any call site', () => {
    // One resolver, so the database override cannot be bypassed by a page that
    // kept the old line.
    for (const parts of [
      ['app', 'landing', 'page.tsx'],
      ['app', 'api', 'event', 'config', 'route.ts'],
      ['app', 'api', 'register', 'route.ts'],
    ]) {
      expect(read(...parts), parts.join('/')).not.toMatch(/NEXT_PUBLIC_REGISTRATION_OPEN/);
    }
  });

  it('keeps the env var as the default when nothing has been set', () => {
    // `platform_settings` holding no row must mean "whatever the deployment
    // says", so an untouched deployment behaves exactly as it did before.
    const settings = read('lib', 'platform', 'settings.ts');
    expect(settings).toMatch(/NEXT_PUBLIC_REGISTRATION_OPEN/);
    expect(typeof registrationOpenDefault()).toBe('boolean');
  });

  it('falls back to the environment if the settings read throws', () => {
    // The landing page is the busiest thing on the site during registration
    // week; an unreachable settings table must not be what takes it down.
    const settings = read('lib', 'platform', 'settings.ts');
    expect(settings).toMatch(/catch/);
    expect(settings).toMatch(/registrationOpenDefault/);
  });
});
