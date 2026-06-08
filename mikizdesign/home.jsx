// home.jsx — homepage: hero + daily status + game grid + mini leaderboard peek.
const { useState: useStateHome } = React;

function HeroDaily({ go, semantikState }) {
  const game = window.GAMES[0]; // Sémantik is the featured daily
  const done = semantikState && semantikState.won;
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-content">
        <div className="hero-left">
          <Pill accent={game.accent}>● Jeu du jour · n°{window.PUZZLE_NO}</Pill>
          <h1 className="hero-title">
            Un nouveau défi<br />chaque jour à minuit.
          </h1>
          <p className="hero-sub">
            {window.TODAY_LABEL}. Joue, compare ton score avec tes amis,
            et garde ta série en vie.
          </p>
          <div className="hero-cta">
            <Button accent={game.accent} size="lg" onClick={() => go("semantik")}>
              {done ? "Rejouer Sémantik" : "Jouer à Sémantik"} <span className="arr">→</span>
            </Button>
            <Button variant="ghost" size="lg" onClick={() => go("leaderboard")}>
              Voir le classement
            </Button>
          </div>
        </div>

        <div className="hero-card" style={{ "--g": game.accent }}>
          <div className="hero-card-top">
            <GameGlyph game={game} size={48} />
            <div>
              <div className="hero-card-name">{game.name}</div>
              <div className="hero-card-cat">{game.category}</div>
            </div>
            <Pill tone="live" style={{ marginLeft: "auto" }}>EN LIGNE</Pill>
          </div>
          <p className="hero-card-blurb">{game.blurb}</p>
          <div className="hero-thermo">
            <div className="hero-thermo-fill" />
            <span className="hero-thermo-label">froid</span>
            <span className="hero-thermo-label hot">brûlant</span>
          </div>
          <div className="hero-card-stats">
            <div><b>{game.players.toLocaleString("fr-FR")}</b><span>joueurs aujourd'hui</span></div>
            <div><b>{game.avgTries}</b><span>essais en moyenne</span></div>
          </div>
          {done && <div className="hero-card-done">✓ Résolu en {semantikState.tries} essais</div>}
        </div>
      </div>
    </section>
  );
}

function GameCard({ game, go, state }) {
  const live = game.status === "live";
  const done = game.id === "semantik" && state && state.won;
  return (
    <button
      className={"game-card" + (live ? "" : " is-soon")}
      style={{ "--g": game.accent, "--hue": game.hue }}
      onClick={() => live && go(game.id === "semantik" ? "semantik" : game.id)}
      disabled={!live}
    >
      <div className="game-card-sheen" />
      <div className="game-card-head">
        <GameGlyph game={game} />
        {live ? (
          done ? <Pill tone="done">✓ Joué</Pill> : <Pill accent={game.accent}>À jouer</Pill>
        ) : (
          <Pill tone="soon">Bientôt</Pill>
        )}
      </div>
      <div className="game-card-body">
        <h3 className="game-card-name">{game.name}</h3>
        <p className="game-card-tag">{game.tagline}</p>
      </div>
      <div className="game-card-foot">
        <span className="game-card-cat">{game.category}</span>
        {live && (
          <span className="game-card-players">
            {game.players.toLocaleString("fr-FR")} joueurs
          </span>
        )}
      </div>
    </button>
  );
}

function MiniLeaderboard({ go }) {
  const rows = window.leaderboard("semantik", "daily", true).slice(0, 5);
  return (
    <div className="mini-lb">
      <div className="mini-lb-head">
        <div>
          <div className="section-kicker">Entre amis · Sémantik</div>
          <h3 className="mini-lb-title">Classement du jour</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => go("leaderboard")}>Tout voir →</Button>
      </div>
      <ol className="mini-lb-list">
        {rows.map((r) => (
          <li key={r.user.id} className={"mini-lb-row" + (r.user.id === "me" ? " is-me" : "")}>
            <span className="mini-lb-rank">{r.rank}</span>
            <Avatar user={r.user} size={30} />
            <span className="mini-lb-name">{r.user.name}{r.user.id === "me" && " (toi)"}</span>
            <span className="mini-lb-score">{r.tries} essais</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Home({ go, semantikState }) {
  return (
    <div className="page home">
      <HeroDaily go={go} semantikState={semantikState} />

      <section className="section">
        <SectionHead
          kicker="La sélection"
          title="Tous les jeux"
          action={<span className="section-meta">{window.GAMES.filter(g=>g.status==="live").length} en ligne · {window.GAMES.filter(g=>g.status==="soon").length} à venir</span>}
        />
        <div className="game-grid">
          {window.GAMES.map((g) => (
            <GameCard key={g.id} game={g} go={go} state={semantikState} />
          ))}
        </div>
      </section>

      <section className="section section-split">
        <MiniLeaderboard go={go} />
        <div className="streak-panel">
          <div className="section-kicker">Ta progression</div>
          <h3 className="mini-lb-title">Garde la série</h3>
          <div className="streak-big"><span className="streak-flame-big">🔥</span><b>7</b><span>jours d'affilée</span></div>
          <div className="streak-week">
            {["L","M","M","J","V","S","D"].map((d,i)=>(
              <div key={i} className={"streak-day" + (i<5?" on":"") + (i===4?" today":"")}>
                <span>{d}</span>
              </div>
            ))}
          </div>
          <p className="streak-note">Reviens chaque jour avant minuit pour ne pas perdre ta série.</p>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { Home });
