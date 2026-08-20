import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETPLACE_CATALOG, MARKETPLACE_ORDER, marketplaceList } from '../../../lib/gameplay/marketplace/catalog';

/**
 * The store quotes a price and the purchase route charges one. They have to be
 * the same number.
 *
 * They used to be two hand-maintained tables — `MARKETPLACE_ITEMS` in
 * service.ts and a private `ITEMS` array in MarketplaceStore.tsx — with nothing
 * keeping them equal. The rulebook would have been a third. These tests hold the
 * catalog as the single table all three read.
 */

const root = join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

describe('marketplace catalog', () => {
  it('is what the purchase path charges against', () => {
    const service = read('lib', 'gameplay', 'marketplace', 'service.ts');
    expect(service).toMatch(/from '@\/lib\/gameplay\/marketplace\/catalog'/);
    // A literal price table in service.ts would mean the drift is back.
    expect(service).not.toMatch(/costEmerald:\s*\d/);
  });

  it('is what the store quotes', () => {
    const store = read('components', 'game', 'marketplace', 'MarketplaceStore.tsx');
    expect(store).toMatch(/marketplaceList\(\)/);
    expect(store).not.toMatch(/costEmerald:\s*\d/);
  });

  it('is what the rulebook prints', () => {
    const rulebook = read('features', 'dashboard', 'rulebook.tsx');
    expect(rulebook).toMatch(/marketplaceList/);
  });

  it('lists every item exactly once, in display order', () => {
    const keys = Object.keys(MARKETPLACE_CATALOG).sort();
    expect([...MARKETPLACE_ORDER].sort()).toEqual(keys);
    expect(new Set(MARKETPLACE_ORDER).size).toBe(MARKETPLACE_ORDER.length);
    expect(marketplaceList().map((entry) => entry.item)).toEqual([...MARKETPLACE_ORDER]);
  });

  it('gives every item a positive price and a description', () => {
    for (const entry of marketplaceList()) {
      expect(entry.costEmerald, entry.item).toBeGreaterThan(0);
      expect(entry.label.length, entry.item).toBeGreaterThan(0);
      expect(entry.description.length, entry.item).toBeGreaterThan(0);
    }
  });

  it('keys every entry to itself, so a lookup cannot return another item', () => {
    for (const [key, entry] of Object.entries(MARKETPLACE_CATALOG)) {
      expect(entry.item).toBe(key);
    }
  });

  it('keeps the database out of the catalog, so clients can import it', () => {
    const catalog = read('lib', 'gameplay', 'marketplace', 'catalog.ts');
    expect(catalog).not.toMatch(/supabase/i);
    expect(catalog).not.toMatch(/^import /m);
  });
});
