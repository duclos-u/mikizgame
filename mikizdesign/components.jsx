// components.jsx — shared shell UI. Attached to window at the bottom.
const { useState, useEffect, useRef } = React;

// ---- Logo -----------------------------------------------------------------
function Logo({ onClick }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Accueil MikizGame">
      <span className="logo-mark">
        <span className="logo-dot" style={{ background: "oklch(0.74 0.16 45)" }} />
        <span className="logo-dot" style={{ background: "oklch(0.74 0.16 152)" }} />
        <span className="logo-dot" style={{ background: "oklch(0.74 0.16 292)" }} />
      </span>
      <span className="logo-word">Mikiz<span className="logo-word-accent">Game</span></span>
    </button>
  );
}

// ---- Avatar ---------------------------------------------------------------
function Avatar({ user, size = 36, ring = false }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `color-mix(in oklch, ${user.color} 32%, var(--card-2))`,
        color: user.color,
        boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${user.color}` : "none",
      }}
      title={user.name}
    >
      {user.initials}
    </span>
  );
}

// ---- Flame / streak chip --------------------------------------------------
function StreakChip({ count }) {
  return (
    <span className="streak-chip" title={`Série de ${count} jours`}>
      <span className="streak-flame">🔥</span>
      <span className="streak-num">{count}</span>
    </span>
  );
}

// ---- Header / nav ---------------------------------------------------------
function Header({ route, go, streak }) {
  const tabs = [
    { id: "home", label: "Accueil" },
    { id: "semantik", label: "Jouer" },
    { id: "leaderboard", label: "Classement" },
  ];
  return (
    <header className="app-header">
      <div className="header-inner">
        <Logo onClick={() => go("home")} />
        <nav className="nav">
          {tabs.map((t) => {
            const active =
              route === t.id || (t.id === "semantik" && route === "semantik");
            return (
              <button
                key={t.id}
                className={"nav-link" + (active ? " active" : "")}
                onClick={() => go(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="header-right">
          <StreakChip count={streak} />
          <button className="avatar-btn" onClick={() => go("home")} aria-label="Profil">
            <Avatar user={window.ME} size={38} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ---- Button ---------------------------------------------------------------
function Button({ children, onClick, variant = "primary", accent, size = "md", style, disabled, full }) {
  const cls = `btn btn-${variant} btn-${size}` + (full ? " btn-full" : "");
  const accentVars = accent
    ? { "--btn-accent": accent, "--btn-accent-soft": `color-mix(in oklch, ${accent} 16%, transparent)` }
    : {};
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={{ ...accentVars, ...style }}>
      {children}
    </button>
  );
}

// ---- Pill / tag -----------------------------------------------------------
function Pill({ children, tone = "neutral", accent, style }) {
  const accentStyle = accent
    ? { color: accent, background: `color-mix(in oklch, ${accent} 14%, transparent)`, borderColor: `color-mix(in oklch, ${accent} 30%, transparent)` }
    : {};
  return <span className={`pill pill-${tone}`} style={{ ...accentStyle, ...style }}>{children}</span>;
}

// ---- Section heading ------------------------------------------------------
function SectionHead({ kicker, title, action }) {
  return (
    <div className="section-head">
      <div>
        {kicker && <div className="section-kicker">{kicker}</div>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---- Game glyph tile ------------------------------------------------------
function GameGlyph({ game, size = 54 }) {
  return (
    <span
      className="game-glyph"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `color-mix(in oklch, ${game.accent} 18%, var(--card-2))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${game.accent} 30%, transparent)`,
      }}
    >
      {game.glyph}
    </span>
  );
}

Object.assign(window, {
  Logo, Avatar, StreakChip, Header, Button, Pill, SectionHead, GameGlyph,
});
