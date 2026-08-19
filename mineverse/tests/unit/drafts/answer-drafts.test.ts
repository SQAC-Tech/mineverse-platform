import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  draftKey,
  languageKey,
  readDraft,
  writeDraft,
  clearDraft,
  readLanguage,
  writeLanguage,
  purgeForeignDrafts,
} from '../../../lib/client/answer-drafts';

/**
 * Regression guard for a cross-team answer leak.
 *
 * Drafts were keyed `mineverse:round:<round>:question:<question>:draft` with
 * nothing identifying the team. The event runs in a computer lab where machines
 * are shared, so the next team to sign in on the same browser opened the round
 * and found the previous team's typing already in the boxes.
 */

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: store });
});

describe('draft keys', () => {
  it('carry the team code', () => {
    expect(draftKey('MNV-111', 1, 'q1')).toContain('MNV-111');
    expect(languageKey('MNV-111', 1, 'q1')).toContain('MNV-111');
  });

  it('differ between two teams on the same question', () => {
    expect(draftKey('MNV-111', 1, 'q1')).not.toBe(draftKey('MNV-222', 1, 'q1'));
  });

  it('separate a draft from a language choice', () => {
    expect(draftKey('MNV-111', 1, 'q1')).not.toBe(languageKey('MNV-111', 1, 'q1'));
  });
});

describe('read/write', () => {
  it('round-trips a draft', () => {
    writeDraft('MNV-111', 1, 'q1', 'my answer');
    expect(readDraft('MNV-111', 1, 'q1')).toBe('my answer');
  });

  it('never serves one team the other team\'s draft', () => {
    writeDraft('MNV-111', 1, 'q1', 'team one answer');
    expect(readDraft('MNV-222', 1, 'q1')).toBe('');
  });

  it('keeps rounds apart', () => {
    writeDraft('MNV-111', 1, 'q1', 'round one');
    expect(readDraft('MNV-111', 2, 'q1')).toBe('');
  });

  it('clears only the one draft', () => {
    writeDraft('MNV-111', 1, 'q1', 'a');
    writeDraft('MNV-111', 1, 'q2', 'b');
    clearDraft('MNV-111', 1, 'q1');
    expect(readDraft('MNV-111', 1, 'q1')).toBe('');
    expect(readDraft('MNV-111', 1, 'q2')).toBe('b');
  });

  it('round-trips a language choice', () => {
    writeLanguage('MNV-111', 1, 'q1', 'python');
    expect(readLanguage('MNV-111', 1, 'q1')).toBe('python');
    expect(readLanguage('MNV-222', 1, 'q1')).toBeNull();
  });

  it.each([null, undefined, ''])('writes nothing when the team code is %p', (code) => {
    writeDraft(code, 1, 'q1', 'should not persist');
    expect(store.length).toBe(0);
    expect(readDraft(code, 1, 'q1')).toBe('');
  });
});

describe('purgeForeignDrafts', () => {
  it('removes another team\'s drafts and keeps this team\'s', () => {
    writeDraft('MNV-111', 1, 'q1', 'mine');
    writeDraft('MNV-222', 1, 'q1', 'theirs');
    writeLanguage('MNV-222', 1, 'q1', 'python');

    purgeForeignDrafts('MNV-111');

    expect(readDraft('MNV-111', 1, 'q1')).toBe('mine');
    expect(readDraft('MNV-222', 1, 'q1')).toBe('');
    expect(readLanguage('MNV-222', 1, 'q1')).toBeNull();
  });

  it('removes the old unscoped keys, which no team can safely claim', () => {
    store.setItem('mineverse:round:1:question:q1:draft', 'from before the fix');
    purgeForeignDrafts('MNV-111');
    expect(store.getItem('mineverse:round:1:question:q1:draft')).toBeNull();
  });

  it('leaves unrelated keys alone', () => {
    store.setItem('theme', 'dark');
    purgeForeignDrafts('MNV-111');
    expect(store.getItem('theme')).toBe('dark');
  });

  it('does nothing without a team code, rather than wiping everything', () => {
    writeDraft('MNV-111', 1, 'q1', 'mine');
    purgeForeignDrafts(null);
    expect(readDraft('MNV-111', 1, 'q1')).toBe('mine');
  });

  it('is not fooled by a team code that prefixes another', () => {
    writeDraft('MNV-11', 1, 'q1', 'short');
    writeDraft('MNV-111', 1, 'q1', 'long');
    purgeForeignDrafts('MNV-111');
    expect(readDraft('MNV-111', 1, 'q1')).toBe('long');
    expect(readDraft('MNV-11', 1, 'q1')).toBe('');
  });
});
