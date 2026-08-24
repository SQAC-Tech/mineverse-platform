import { roundChrome } from './round-presentation';
import './round-ui.css';
import '@/app/theme-kit.css';
import '@/app/(game)/biome.css';

/**
 * What a round shows while the server is still deciding whether you may enter.
 *
 * There are two waits on the way into a round and they are separate problems.
 * The one inside `CustomRoundShell` is the data fetch, and the shell now draws
 * its own skeletons through that. This is the earlier one: `requireRoundAccess`
 * runs on the server before any of that markup exists, checking the round's
 * status, the team's unlock and its attendance. Until it answers, Next has
 * nothing to render — so the browser sat on the dashboard, or on white, and a
 * team pressed ENTER again thinking the first press had missed.
 *
 * Rendering this from a `loading.tsx` gives the navigation something immediate
 * to land on. It is deliberately the round's own chrome — the biome backdrop,
 * the palette, the round name — so the transition into the real shell is the
 * paper filling in rather than a second page arriving.
 *
 * No client JavaScript: it is a Server Component with no state, which is the
 * whole point. If it needed to hydrate before it could paint it would be
 * waiting on the same thing it exists to cover.
 */
export function RoundLoading({ roundId }: { roundId: number }) {
  const chrome = roundChrome(roundId);

  return (
    <main className={`round-ui ${chrome.themeClass}`} aria-busy="true">
      <div className="round-ui__backdrop" aria-hidden="true" />
      <div className="round-ui__shade" aria-hidden="true" />

      <div className="round-ui__page">
        <header className="round-ui__header">
          <div className="round-ui__panel round-ui__panel--glass round-ui__brand">
            {/* The logo and the biome are known from the route itself, so they
                are drawn for real. Only what depends on the server is pending. */}
            <img src="/logo.svg" alt="" />
            <div>
              <p className="round-ui__brand-name">MINEVERSE</p>
              <p className="round-ui__brand-tag">CODE. CRAFT. CONQUER.</p>
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__biome">
            <chrome.Icon size={26} aria-hidden="true" />
            <div className="round-ui__biome-text">
              <p className="round-ui__eyebrow">{chrome.eyebrow}</p>
              <p className="round-ui__biome-name">{chrome.name}</p>
              <p className="round-ui__biome-meta">{chrome.day} <i>•</i> {chrome.mode}</p>
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__team">
            <span className="round-ui__skel round-ui__skel--crest" aria-hidden="true" />
            <div className="round-ui__team-text" style={{ flex: 1 }} aria-hidden="true">
              <div className="round-ui__skel round-ui__skel--text" style={{ width: '80%' }} />
              <div className="round-ui__skel round-ui__skel--line" style={{ width: '52%', marginTop: 5 }} />
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__timer">
            <div>
              <p className="round-ui__timer-label">ROUND ENDS IN</p>
              <div className="round-ui__skel round-ui__skel--title" style={{ width: 132, marginTop: 6 }} aria-hidden="true" />
            </div>
          </div>
        </header>

        {/* `round-ui__main` is the board + rail grid, and `round-ui__board-grid`
            inside it is three columns. Both are reproduced exactly, because the
            point of a skeleton is that the real thing lands in the same place —
            a two-column stand-in for a three-column board would shift every
            question sideways at the moment the paper arrives. */}
        <div className="round-ui__main">
          <section className="round-ui__board">
            <div className="round-ui__board-grid">
              <aside className="round-ui__tile round-ui__qlist">
                <p className="round-ui__tile-title">Questions</p>
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="round-ui__skel-row" aria-hidden="true">
                    <span className="round-ui__skel" />
                    <span className="round-ui__skel round-ui__skel--text" />
                  </div>
                ))}
              </aside>

              <div className="round-ui__tile">
                {/*
                  * The one announcement on the page.
                  *
                  * Every block around it is `aria-hidden`, because a screen
                  * reader reading out a dozen anonymous placeholders is worse
                  * than silence. This says the thing once, in words.
                  */}
                <p role="status">Opening {chrome.name}…</p>
                <div className="round-ui__skel round-ui__skel--title" style={{ width: '46%', marginTop: 16 }} aria-hidden="true" />
                <div className="round-ui__skel-lines" style={{ marginTop: 16 }} aria-hidden="true">
                  <div className="round-ui__skel round-ui__skel--text" />
                  <div className="round-ui__skel round-ui__skel--text" />
                  <div className="round-ui__skel round-ui__skel--text" />
                </div>
                <div className="round-ui__skel" style={{ height: 96, marginTop: 20 }} aria-hidden="true" />
              </div>

              <aside className="round-ui__tile">
                <p className="round-ui__tile-title">Rewards</p>
                <div className="round-ui__skel-lines" aria-hidden="true">
                  <div className="round-ui__skel round-ui__skel--text" />
                  <div className="round-ui__skel round-ui__skel--text" />
                </div>
              </aside>
            </div>
          </section>

          <aside className="round-ui__rail">
            <div className="round-ui__tile">
              <div className="round-ui__skel round-ui__skel--line" style={{ width: '44%' }} aria-hidden="true" />
              <div className="round-ui__skel" style={{ height: 72, marginTop: 10 }} aria-hidden="true" />
            </div>
            <div className="round-ui__tile" style={{ marginTop: 10 }}>
              <div className="round-ui__skel round-ui__skel--line" style={{ width: '52%' }} aria-hidden="true" />
              <div className="round-ui__skel-lines" style={{ marginTop: 10 }} aria-hidden="true">
                <div className="round-ui__skel round-ui__skel--text" />
                <div className="round-ui__skel round-ui__skel--text" />
              </div>
            </div>
          </aside>
        </div>

      </div>
    </main>
  );
}
