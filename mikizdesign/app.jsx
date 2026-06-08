// app.jsx — shell: routing, localStorage persistence, tweaks, mount.
const { useState: useApp, useEffect: useAppE } = React;

const LS_KEY = "mikizgame.v1";
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.74 0.16 45)",
  "display": "Bricolage Grotesque",
  "corners": "rounded"
}/*EDITMODE-END*/;

function App() {
  const persisted = loadState();
  const [route, setRoute] = useApp(persisted.route && persisted.route !== "semantik" ? persisted.route : (persisted.route || "home"));
  const [semantikState, setSemantikState] = useApp(persisted.semantik || { guesses: [], won: false, tries: 0 });
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  function go(r) { setRoute(r); window.scrollTo({ top: 0 }); }

  // persist route + game state
  useAppE(() => { saveState({ ...loadState(), route, semantik: semantikState }); }, [route, semantikState]);

  // apply tweaks to :root
  useAppE(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", t.accent);
    r.style.setProperty("--font-display", `"${t.display}", "Bricolage Grotesque", sans-serif`);
    r.style.setProperty("--radius", t.corners === "sharp" ? "5px" : t.corners === "round" ? "22px" : "14px");
  }, [t]);

  const streak = 7;

  return (
    <div className="app-root">
      <Header route={route} go={go} streak={streak} />
      <main className="app-main">
        {route === "home" && <Home go={go} semantikState={semantikState} />}
        {route === "semantik" && (
          <Semantik
            go={go}
            state={semantikState}
            setState={(s) => setSemantikState(s)}
          />
        )}
        {route === "leaderboard" && <Leaderboard go={go} initialGame="semantik" />}
        {(route === "lexio" || route === "cinedle") && <ComingSoon go={go} gameId={route} />}
      </main>
      <footer className="app-footer">
        <Logo onClick={() => go("home")} />
        <span className="foot-note">Fait maison · un jeu chaque jour à minuit · © 2026 MikizGame</span>
        <div className="foot-links">
          <button onClick={() => go("home")}>Accueil</button>
          <button onClick={() => go("leaderboard")}>Classement</button>
        </div>
      </footer>

      <TweaksPanel>
        <TweakSection label="Couleur d'accent" />
        <TweakColor
          label="Accent du hub"
          value={t.accent}
          options={[
            "oklch(0.74 0.16 45)",
            "oklch(0.74 0.16 152)",
            "oklch(0.74 0.16 292)",
            "oklch(0.74 0.16 232)",
            "oklch(0.74 0.16 352)",
          ]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakSection label="Typographie" />
        <TweakSelect
          label="Police titres"
          value={t.display}
          options={["Bricolage Grotesque", "Space Grotesk", "Fraunces", "Hanken Grotesk"]}
          onChange={(v) => setTweak("display", v)}
        />
        <TweakSection label="Forme" />
        <TweakRadio
          label="Coins"
          value={t.corners}
          options={["sharp", "rounded", "round"]}
          onChange={(v) => setTweak("corners", v)}
        />
        <TweakButton label="Réinitialiser ma partie" onClick={() => { localStorage.removeItem(LS_KEY); location.reload(); }}>
          Effacer ma progression
        </TweakButton>
      </TweaksPanel>
    </div>
  );
}

function ComingSoon({ go, gameId }) {
  const game = window.GAMES.find((g) => g.id === gameId);
  return (
    <div className="page coming-soon" style={{ "--g": game.accent }}>
      <GameGlyph game={game} size={72} />
      <h1>{game.name}</h1>
      <p>{game.blurb}</p>
      <Button accent={game.accent} onClick={() => go("home")}>← Retour aux jeux</Button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
