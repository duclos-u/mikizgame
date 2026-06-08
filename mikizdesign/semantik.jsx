// semantik.jsx — the playable Cemantix-style semantic guesser.
const { useState: useS, useEffect: useE, useRef: useR } = React;

const HEAT_GRAD =
  "linear-gradient(90deg, oklch(0.55 0.16 250) 0%, oklch(0.62 0.15 200) 22%, oklch(0.82 0.14 150) 40%, oklch(0.86 0.15 95) 58%, oklch(0.78 0.18 55) 78%, oklch(0.62 0.22 28) 100%)";

function tempColor(score) {
  // map 0..100 → cold blue .. hot red
  const t = Math.max(0, Math.min(100, score)) / 100;
  const hue = 250 - t * 222; // 250 (blue) -> 28 (red)
  const chroma = 0.13 + t * 0.09;
  const light = 0.7 - t * 0.06;
  return `oklch(${light} ${chroma} ${hue})`;
}

function GuessRow({ g, highlight }) {
  const tier = window.tierFor(g.score);
  const pct = Math.max(2, Math.min(100, g.score));
  return (
    <li className={"g-row" + (highlight ? " g-row-new" : "") + (g.score >= 100 ? " g-row-win" : "")}>
      <span className="g-rank">{g.order}</span>
      <span className="g-word">{g.display}</span>
      <span className="g-bar-wrap">
        <span className="g-bar" style={{ width: pct + "%", background: tempColor(g.score) }} />
      </span>
      <span className="g-score" style={{ color: tempColor(g.score) }}>
        {g.score.toFixed(g.score >= 1 ? 1 : 1)}°
      </span>
      <span className="g-tier"><span className="g-emoji">{tier.emoji}</span>{tier.label}</span>
    </li>
  );
}

function WinPanel({ tries, onShare, copied, go }) {
  return (
    <div className="win-panel">
      <div className="win-burst">🎉</div>
      <h3 className="win-title">Bravo ! Mot trouvé.</h3>
      <p className="win-sub">
        Le mot du jour était <b>« {window.SECRET_WORD} »</b>. Tu l'as deviné en
        <b> {tries} essais</b>.
      </p>
      <div className="win-stats">
        <div className="win-stat"><b>{tries}</b><span>essais</span></div>
        <div className="win-stat"><b>8</b><span>de série 🔥</span></div>
        <div className="win-stat"><b>#3</b><span>chez tes amis</span></div>
      </div>
      <div className="win-cta">
        <Button accent={window.GAMES[0].accent} onClick={onShare}>
          {copied ? "✓ Copié !" : "Partager mon score"}
        </Button>
        <Button variant="ghost" onClick={() => go("leaderboard")}>Voir le classement</Button>
      </div>
      <p className="win-foot">Prochain mot dans <b>11 h 24 min</b>.</p>
    </div>
  );
}

function Semantik({ go, state, setState }) {
  const game = window.GAMES[0];
  const [value, setValue] = useS("");
  const [guesses, setGuesses] = useS(() => (state && state.guesses) || []);
  const [last, setLast] = useS(null);
  const [error, setError] = useS("");
  const [copied, setCopied] = useS(false);
  const [revealed, setRevealed] = useS((state && state.won) || false);
  const inputRef = useR(null);

  const won = guesses.some((g) => g.score >= 100);

  useE(() => { inputRef.current && inputRef.current.focus(); }, []);

  // persist up to app + localStorage
  useE(() => {
    const tries = guesses.length;
    setState({ guesses, won, tries });
  }, [guesses]);

  function submit(e) {
    e && e.preventDefault();
    const res = window.scoreGuess(value);
    setError("");
    if (!res) return;
    // already guessed?
    const existing = guesses.find((g) => g.norm === res.norm);
    if (existing) {
      setError(`« ${existing.display} » a déjà été proposé`);
      setLast(existing.id);
      setValue("");
      return;
    }
    const entry = { ...res, id: Date.now() + Math.random(), order: guesses.length + 1 };
    const next = [...guesses, entry];
    setGuesses(next);
    setLast(entry.id);
    setValue("");
    if (entry.score >= 100) setRevealed(true);
  }

  function giveUp() {
    if (won) return;
    const entry = { display: window.SECRET_WORD, score: 100, known: true, norm: window.normalizeWord(window.SECRET_WORD), id: Date.now(), order: guesses.length + 1, gaveUp: true };
    setGuesses([...guesses, entry]);
    setRevealed(true);
  }

  function share() {
    const t = guesses.length;
    navigator.clipboard && navigator.clipboard.writeText(
      `MikizGame · Sémantik n°${window.PUZZLE_NO}\nTrouvé en ${t} essais 🌡️\nmikizgame.app`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  // sorted by score desc; last guess pinned separately
  const sorted = [...guesses].sort((a, b) => b.score - a.score);
  const lastEntry = guesses.length ? guesses[guesses.length - 1] : null;
  const best = sorted.length ? sorted[0].score : 0;

  return (
    <div className="page game-page" style={{ "--g": game.accent }}>
      <div className="game-top">
        <button className="back-link" onClick={() => go("home")}>← Tous les jeux</button>
        <div className="game-top-mid">
          <GameGlyph game={game} size={40} />
          <div>
            <div className="game-top-name">{game.name}</div>
            <div className="game-top-sub">n°{window.PUZZLE_NO} · {window.TODAY_LABEL}</div>
          </div>
        </div>
        <div className="game-top-right">
          <span className="game-counter"><b>{guesses.length}</b> essais</span>
          {!won && <Button variant="ghost" size="sm" onClick={giveUp}>Abandonner</Button>}
        </div>
      </div>

      <div className="game-body">
        <div className="game-main">
          {!won && (
            <p className="game-help">
              Devine le mot secret du jour. Pour chaque mot proposé, tu obtiens une
              <b> température</b> : plus elle est élevée, plus ton mot est <b>proche du sens</b> recherché.
            </p>
          )}

          {revealed ? (
            <WinPanel tries={guesses.filter(g=>!g.gaveUp).length} onShare={share} copied={copied} go={go} />
          ) : (
            <form className="guess-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="guess-input"
                placeholder="Tape un mot…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <Button accent={game.accent} size="lg" disabled={!value.trim()}>Proposer</Button>
            </form>
          )}
          {error && <div className="guess-error">{error}</div>}

          {lastEntry && !revealed && (
            <div className="last-guess">
              <div className="last-guess-label">Dernier essai</div>
              <GuessRow g={lastEntry} highlight />
            </div>
          )}

          <div className="heat-legend">
            <span>0°</span>
            <span className="heat-legend-bar" style={{ background: HEAT_GRAD }} />
            <span>100°</span>
          </div>

          {guesses.length === 0 ? (
            <div className="empty-guesses">
              <div className="empty-thermo">🌡️</div>
              <p>Aucun essai pour l'instant. Lance-toi — un mot du quotidien fait souvent un bon départ.</p>
            </div>
          ) : (
            <ol className="guess-list">
              {sorted.map((g) => (
                <GuessRow key={g.id} g={g} highlight={g.id === last} />
              ))}
            </ol>
          )}
        </div>

        <aside className="game-aside">
          <div className="aside-card">
            <div className="aside-stat">
              <span className="aside-stat-label">Meilleure température</span>
              <span className="aside-stat-val" style={{ color: tempColor(best) }}>{best.toFixed(1)}°</span>
            </div>
            <div className="aside-thermo">
              <div className="aside-thermo-track" style={{ background: HEAT_GRAD }}>
                <div className="aside-thermo-marker" style={{ left: Math.max(2, Math.min(98, best)) + "%" }} />
              </div>
            </div>
            <div className="aside-tier">{window.tierFor(best).emoji} {window.tierFor(best).label}</div>
          </div>

          <div className="aside-card">
            <div className="aside-mini-head">Comment ça marche</div>
            <ul className="aside-steps">
              <li><span className="dot" style={{background:tempColor(8)}} /> <span><b>0–18°</b> — loin du sens</span></li>
              <li><span className="dot" style={{background:tempColor(30)}} /> <span><b>18–45°</b> — tu te rapproches</span></li>
              <li><span className="dot" style={{background:tempColor(70)}} /> <span><b>45–99°</b> — brûlant, presque !</span></li>
              <li><span className="dot" style={{background:tempColor(100)}} /> <span><b>100°</b> — le mot exact</span></li>
            </ul>
          </div>

          <div className="aside-card aside-hint">
            <div className="aside-mini-head">Besoin d'un coup de pouce ?</div>
            <p>Le mot du jour est lié à la lumière et à la chaleur. ☀️</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Semantik });
