// leaderboard.jsx — classement: game selector + daily/all-time tabs + friends + podium + table.
const { useState: useLB } = React;

function Podium({ rows }) {
  const top3 = rows.slice(0, 3);
  // display order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <div className="podium">
      {order.map((r) => {
        const place = r.rank;
        return (
          <div key={r.user.id} className={"podium-col podium-" + place + (r.user.id === "me" ? " is-me" : "")}>
            <div className="podium-medal">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
            <Avatar user={r.user} size={place === 1 ? 64 : 52} ring />
            <div className="podium-name">{r.user.name}{r.user.id === "me" && " (toi)"}</div>
            <div className="podium-bar" style={{ height: place === 1 ? 104 : place === 2 ? 78 : 58 }}>
              <span className="podium-rank">{place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Leaderboard({ go, initialGame }) {
  const liveGames = window.GAMES.filter((g) => g.status === "live");
  const [gameId, setGameId] = useLB(initialGame && liveGames.find(g=>g.id===initialGame) ? initialGame : "semantik");
  const [scope, setScope] = useLB("daily");
  const [friends, setFriends] = useLB(false);

  const game = window.GAMES.find((g) => g.id === gameId);
  const rows = window.leaderboard(gameId, scope, friends);
  const meRow = rows.find((r) => r.user.id === "me");

  return (
    <div className="page lb-page" style={{ "--g": game.accent }}>
      <div className="lb-hero">
        <div className="section-kicker">Classement</div>
        <h1 className="lb-title">Qui domine aujourd'hui ?</h1>
        <p className="lb-sub">Compare tes scores par jeu, en quotidien ou sur tous les temps.</p>
      </div>

      <div className="lb-controls">
        <div className="game-tabs">
          {liveGames.map((g) => (
            <button
              key={g.id}
              className={"game-tab" + (g.id === gameId ? " active" : "")}
              style={{ "--g": g.accent }}
              onClick={() => setGameId(g.id)}
            >
              <span className="game-tab-glyph">{g.glyph}</span>
              {g.name}
            </button>
          ))}
        </div>
        <div className="lb-control-right">
          <div className="seg">
            <button className={"seg-btn" + (scope === "daily" ? " active" : "")} onClick={() => setScope("daily")}>Quotidien</button>
            <button className={"seg-btn" + (scope === "all" ? " active" : "")} onClick={() => setScope("all")}>Tous les temps</button>
          </div>
          <button className={"friends-toggle" + (friends ? " on" : "")} onClick={() => setFriends(!friends)}>
            <span className="ft-dot" /> Amis seulement
          </button>
        </div>
      </div>

      {rows.length >= 3 && <Podium rows={rows} />}

      <div className="lb-table">
        <div className="lb-head-row">
          <span>#</span>
          <span>Joueur</span>
          {scope === "daily" ? (
            <React.Fragment>
              <span className="ta-r">Essais</span>
              <span className="ta-r">Temps</span>
              <span className="ta-r">Série</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <span className="ta-r">Série</span>
              <span className="ta-r">Victoires</span>
              <span className="ta-r">Parties</span>
            </React.Fragment>
          )}
        </div>
        {rows.map((r) => (
          <div key={r.user.id} className={"lb-row" + (r.user.id === "me" ? " is-me" : "")}>
            <span className={"lb-rank" + (r.rank <= 3 ? " top" : "")}>{r.rank}</span>
            <span className="lb-player">
              <Avatar user={r.user} size={34} />
              <span className="lb-player-name">{r.user.name}{r.user.id === "me" && <span className="you-tag">toi</span>}</span>
              {r.user.friend && r.user.id !== "me" && <span className="friend-tag">ami</span>}
            </span>
            {scope === "daily" ? (
              <React.Fragment>
                <span className="ta-r mono"><b>{r.tries}</b></span>
                <span className="ta-r mono">{window.fmtTime(r.seconds)}</span>
                <span className="ta-r"><span className="mini-flame">🔥</span>{r.streak}</span>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <span className="ta-r"><span className="mini-flame">🔥</span><b>{r.streak}</b></span>
                <span className="ta-r mono">{r.winRate}%</span>
                <span className="ta-r mono">{r.plays}</span>
              </React.Fragment>
            )}
          </div>
        ))}
      </div>

      {meRow && (
        <div className="lb-sticky-me">
          <span className="lb-rank top">{meRow.rank}</span>
          <span className="lb-player">
            <Avatar user={window.ME} size={32} />
            <span className="lb-player-name">Toi</span>
          </span>
          <span className="lb-me-note">
            {scope === "daily"
              ? `${meRow.tries} essais · ${window.fmtTime(meRow.seconds)}`
              : `série de ${meRow.streak} · ${meRow.winRate}% de victoires`}
          </span>
          <Button accent={game.accent} size="sm" onClick={() => go(gameId === "semantik" ? "semantik" : "home")}>
            {gameId === "semantik" ? "Rejouer" : "Ouvrir"}
          </Button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Leaderboard });
