/**
 * Browser-local drafts of in-progress answers.
 *
 * These used to be keyed `mineverse:round:<round>:question:<question>:draft`,
 * with nothing identifying the team. At an offline event that runs in a computer
 * lab, machines are shared: the next team to sign in on the same browser opened
 * the round and found the previous team's typed answers already in the boxes.
 *
 * Keys carry the team code now, and `purgeForeignDrafts` clears everything that
 * belongs to anyone else — including the old unscoped keys, which no team can
 * safely claim.
 *
 * A draft is a convenience against an accidental refresh, never a record of
 * anything. What counts is what the server accepted.
 */

const PREFIX = 'mineverse:team:';
/** Keys written before drafts were scoped to a team. */
const LEGACY_PREFIX = 'mineverse:round:';

function base(teamCode: string, roundId: number, questionId: string) {
  return `${PREFIX}${teamCode}:round:${roundId}:question:${questionId}`;
}

export function draftKey(teamCode: string, roundId: number, questionId: string) {
  return `${base(teamCode, roundId, questionId)}:draft`;
}

export function languageKey(teamCode: string, roundId: number, questionId: string) {
  return `${base(teamCode, roundId, questionId)}:language`;
}

export function readDraft(teamCode: string | null | undefined, roundId: number, questionId: string): string {
  if (!teamCode || typeof window === 'undefined') return '';
  return window.localStorage.getItem(draftKey(teamCode, roundId, questionId)) ?? '';
}

export function writeDraft(teamCode: string | null | undefined, roundId: number, questionId: string, value: string) {
  if (!teamCode || typeof window === 'undefined') return;
  window.localStorage.setItem(draftKey(teamCode, roundId, questionId), value);
}

export function clearDraft(teamCode: string | null | undefined, roundId: number, questionId: string) {
  if (!teamCode || typeof window === 'undefined') return;
  window.localStorage.removeItem(draftKey(teamCode, roundId, questionId));
}

export function readLanguage(teamCode: string | null | undefined, roundId: number, questionId: string): string | null {
  if (!teamCode || typeof window === 'undefined') return null;
  return window.localStorage.getItem(languageKey(teamCode, roundId, questionId));
}

export function writeLanguage(teamCode: string | null | undefined, roundId: number, questionId: string, value: string) {
  if (!teamCode || typeof window === 'undefined') return;
  window.localStorage.setItem(languageKey(teamCode, roundId, questionId), value);
}

/**
 * Drop every stored draft that is not this team's. Call it once the team code is
 * known — one sweep on a shared machine is what stops a handover leaking.
 */
export function purgeForeignDrafts(teamCode: string | null | undefined) {
  if (!teamCode || typeof window === 'undefined') return;

  const mine = `${PREFIX}${teamCode}:`;
  const doomed: string[] = [];

  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.startsWith(LEGACY_PREFIX)) doomed.push(key);
    else if (key.startsWith(PREFIX) && !key.startsWith(mine)) doomed.push(key);
  }

  for (const key of doomed) window.localStorage.removeItem(key);
}
