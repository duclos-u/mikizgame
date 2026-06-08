// Script de génération du dataset CinéClue via l'API TMDB
// Usage : node generate-dataset.mjs <TA_CLE_API>
// ou :    bun generate-dataset.mjs <TA_CLE_API>

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error("❌ Usage : node generate-dataset.mjs <TA_CLE_API>");
  process.exit(1);
}

const BASE = "https://api.themoviedb.org/3";
const LANG = "fr-FR";
const TARGET = 1000;

// Genres TMDB → nos ~30 genres normalisés
// Hiérarchie : clé = genre normalisé, valeur = parent (null si racine)
const GENRE_MAP = {
  28:   { nom: "Action",          parent: null },
  12:   { nom: "Aventure",        parent: null },
  16:   { nom: "Animation",       parent: null },
  35:   { nom: "Comédie",         parent: null },
  80:   { nom: "Crime",           parent: null },
  99:   { nom: "Documentaire",    parent: null },
  18:   { nom: "Drame",           parent: null },
  10751:{ nom: "Famille",         parent: null },
  14:   { nom: "Fantastique",     parent: null },
  36:   { nom: "Histoire",        parent: null },
  27:   { nom: "Horreur",         parent: null },
  10402:{ nom: "Musical",         parent: null },
  9648: { nom: "Mystère",         parent: "Thriller" },
  10749:{ nom: "Romance",         parent: null },
  878:  { nom: "Science-fiction", parent: null },
  10770:{ nom: "Téléfilm",        parent: null },
  53:   { nom: "Thriller",        parent: null },
  10752:{ nom: "Guerre",          parent: null },
  37:   { nom: "Western",         parent: null },
};

// Récompenses majeures à récupérer
const RECOMPENSES_KEYWORDS = [
  "Academy Award for Best Picture",
  "Palme d'Or",
  "César du meilleur film",
  "Golden Lion",
  "Golden Bear",
  "Golden Globe Award for Best Motion Picture",
];

// IDs des récompenses dans TMDB (awards) — on les mappe manuellement
// car TMDB n'a pas d'endpoint awards propre, on va chercher via les keywords
// À la place, on va utiliser une approche plus simple : vote_average + popularity

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function getTopFilms() {
  const films = new Map(); // id → data brute
  let page = 1;

  console.log(`🎬 Récupération des ${TARGET} films les plus populaires...`);

  while (films.size < TARGET) {
    const url = `${BASE}/discover/movie?api_key=${API_KEY}&language=${LANG}&sort_by=popularity.desc&vote_count.gte=1000&page=${page}`;
    const data = await fetchJSON(url);
    
    if (!data.results?.length) break;
    
    for (const film of data.results) {
      if (films.size >= TARGET) break;
      films.set(film.id, film);
    }

    process.stdout.write(`\r  → ${films.size}/${TARGET} films récupérés (page ${page})`);
    page++;
    await sleep(250); // respect rate limit TMDB
  }

  console.log(`\n✅ ${films.size} films récupérés`);
  return [...films.values()];
}

async function getDetails(filmId) {
  const url = `${BASE}/movie/${filmId}?api_key=${API_KEY}&language=${LANG}&append_to_response=credits,keywords`;
  return fetchJSON(url);
}

function normaliserGenres(genreIds) {
  return genreIds
    .map((id) => GENRE_MAP[id]?.nom)
    .filter(Boolean)
    .slice(0, 3); // max 3 genres par film
}

function normaliserRecompenses(keywords) {
  const noms = keywords?.keywords?.map((k) => k.name.toLowerCase()) ?? [];
  const recompenses = [];
  
  if (noms.some(k => k.includes("academy award for best picture") || k.includes("oscar for best picture"))) {
    recompenses.push("Oscar du meilleur film");
  }
  if (noms.some(k => k.includes("palme d'or") || k.includes("palme d or") || k.includes("cannes"))) {
    recompenses.push("Palme d'Or");
  }
  if (noms.some(k => k.includes("césar") || k.includes("cesar du meilleur film"))) {
    recompenses.push("César du meilleur film");
  }
  if (noms.some(k => k.includes("golden lion") || k.includes("lion d'or") || k.includes("venice"))) {
    recompenses.push("Lion d'Or");
  }
  if (noms.some(k => k.includes("golden bear") || k.includes("ours d'or") || k.includes("berlinale"))) {
    recompenses.push("Ours d'Or");
  }
  if (noms.some(k => k.includes("golden globe") && k.includes("best motion picture"))) {
    recompenses.push("Golden Globe du meilleur film");
  }

  return recompenses;
}

function normaliserDecennie(annee) {
  if (!annee) return null;
  return Math.floor(annee / 10) * 10;
}

function normaliserActeurs(credits) {
  return (credits?.cast ?? [])
    .slice(0, 5)
    .map((a) => a.name)
    .filter(Boolean);
}

function normaliserRealisateurs(credits) {
  return (credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .slice(0, 3)
    .map((c) => c.name)
    .filter(Boolean);
}

function normaliserPays(productionCountries) {
  const MAP_PAYS = {
    "US": "États-Unis", "FR": "France", "GB": "Royaume-Uni",
    "DE": "Allemagne", "IT": "Italie", "ES": "Espagne",
    "JP": "Japon", "CN": "Chine", "KR": "Corée du Sud",
    "IN": "Inde", "AU": "Australie", "CA": "Canada",
    "BR": "Brésil", "MX": "Mexique", "RU": "Russie",
    "SE": "Suède", "DK": "Danemark", "NO": "Norvège",
    "BE": "Belgique", "CH": "Suisse", "AT": "Autriche",
    "PL": "Pologne", "CZ": "République tchèque", "HK": "Hong Kong",
    "TW": "Taïwan", "NZ": "Nouvelle-Zélande", "AR": "Argentine",
  };
  return (productionCountries ?? [])
    .map((p) => MAP_PAYS[p.iso_3166_1] ?? p.name)
    .filter(Boolean);
}

function normaliserLangue(code) {
  const MAP = {
    "en": "Anglais", "fr": "Français", "de": "Allemand",
    "it": "Italien", "es": "Espagnol", "ja": "Japonais",
    "ko": "Coréen", "zh": "Chinois", "pt": "Portugais",
    "ru": "Russe", "sv": "Suédois", "da": "Danois",
    "no": "Norvégien", "nl": "Néerlandais", "ar": "Arabe",
    "hi": "Hindi", "fa": "Persan", "pl": "Polonais",
  };
  return MAP[code] ?? code;
}

async function main() {
  console.log("🎬 CinéClue Dataset Generator — TMDB Edition\n");

  const filmsBase = await getTopFilms();
  const dataset = [];
  let erreurs = 0;

  console.log("\n📦 Récupération des détails (crédits, keywords)...");

  for (let i = 0; i < filmsBase.length; i++) {
    const film = filmsBase[i];
    process.stdout.write(`\r  → ${i + 1}/${filmsBase.length} — ${film.title.slice(0, 40).padEnd(40)}`);

    try {
      const details = await getDetails(film.id);

      const annee = details.release_date ? parseInt(details.release_date.slice(0, 4)) : null;

      const obj = {
        id: details.id,
        titre: details.title,
        realisateurs: normaliserRealisateurs(details.credits),
        acteurs: normaliserActeurs(details.credits),
        genres: normaliserGenres(details.genre_ids ?? details.genres?.map(g => g.id) ?? []),
        pays: normaliserPays(details.production_countries),
        decennie: normaliserDecennie(annee),
        langue: normaliserLangue(details.original_language),
        recompenses: normaliserRecompenses(details.keywords),
      };

      // On skip les films sans données essentielles
      if (!obj.titre || !obj.realisateurs.length || !obj.acteurs.length) {
        erreurs++;
        continue;
      }

      dataset.push(obj);
      await sleep(150); // rate limit TMDB : ~40 req/10s
    } catch (e) {
      erreurs++;
      await sleep(500);
    }
  }

  console.log(`\n\n✅ ${dataset.length} films valides (${erreurs} ignorés)\n`);

  // Génération du fichier JS
  const genresHierarchie = Object.entries(GENRE_MAP).reduce((acc, [, { nom, parent }]) => {
    if (!acc[nom]) acc[nom] = parent;
    return acc;
  }, {});

  const output = `// Dataset CinéClue — généré automatiquement via TMDB
// ${dataset.length} films — ${new Date().toISOString().slice(0, 10)}
// Ne pas modifier manuellement — utiliser generate-dataset.mjs pour régénérer

const CINECLUE_GENRES_HIERARCHIE = ${JSON.stringify(genresHierarchie, null, 2)};

const CINECLUE_FILMS = ${JSON.stringify(dataset, null, 2)};
`;

  await Bun.write("cineclue-data.js", output).catch(() =>
    require("fs").writeFileSync("cineclue-data.js", output)
  );

  console.log(`📁 Fichier généré : cineclue-data.js (${(Buffer.byteLength(output) / 1024).toFixed(0)} Ko)`);
  console.log(`\n🎯 Répartition des récompenses :`);
  const compteur = {};
  for (const f of dataset) for (const r of f.recompenses) compteur[r] = (compteur[r] ?? 0) + 1;
  for (const [r, n] of Object.entries(compteur).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${r.padEnd(40)} ${n} films`);
  }
  console.log(`\n✨ Done ! Importe cineclue-data.js dans ton projet.`);
}

main().catch((e) => {
  console.error("\n❌ Erreur :", e.message);
  process.exit(1);
});
