#!/usr/bin/env python3
"""
Re-derive politiscore for senate-primary politicians from their SEN groupe.
Applies only to politicians whose only active mandat is SEN (no DEP/ED/PM/etc.).
Sets null for NI or unmapped groups.
"""
from __future__ import annotations
import json
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "src/data/politics.json"

# Full group name or code → politiscore (left=0, right=100)
# Sources: senate group positions, cross-referenced with existing deputy politiscores
GROUPE_SCORE: dict[str, int | None] = {
    # Left
    "CRCE": 18,     # Communiste, Républicain, Citoyen et Écologiste
    "CRCE-K": 18,   # variant (Kanaky split)
    "GEST": 30,     # Écologistes, Solidarité et Territoires
    "RDSE": 32,     # Rassemblement Démocratique et Social Européen (radicaux)
    "SER": 36,      # Socialiste et Républicain
    "PS": 36,
    # Centre
    "RDPI": 52,     # Rassemblement des Démocrates Progressistes et Indépendants (Renaissance)
    "UC": 58,       # Union Centriste
    # Right
    "Les Indépendants": 62,
    "INDEP": 62,
    "Les Républicains": 64,
    "LR": 64,
    # Far right
    "RN": 86,
    # Unknown
    "NI": None,     # Non-inscrits
}

EXECUTIVE_CODES = {"PR", "PM", "ME", "M", "MD", "MC", "SE", "DEP", "ED", "CP"}


def resolve_score(groupe: str) -> int | None:
    g = (groupe or "").strip()
    if g in GROUPE_SCORE:
        return GROUPE_SCORE[g]
    # substring fallback for hyphenated variants
    g_lower = g.lower()
    for key, score in GROUPE_SCORE.items():
        if key.lower() in g_lower:
            return score
    return None  # unmapped


def main() -> None:
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    updated = 0
    nulled = 0
    skipped_has_other = 0

    for m in data["membres"]:
        mandats = m.get("mandats", [])
        active = [man for man in mandats if not man.get("date_fin_fonction")]
        codes = {man["code_fonction"] for man in active}

        if "SEN" not in codes:
            continue

        if codes & EXECUTIVE_CODES:
            skipped_has_other += 1
            continue  # politiscore comes from their other role

        sen = next(
            (man for man in active if man["code_fonction"] == "SEN"), None
        )
        if not sen:
            continue

        groupe = sen.get("groupe") or ""
        score = resolve_score(groupe)
        old = m.get("politiscore")

        if score == old:
            continue

        m["politiscore"] = score
        if score is None:
            nulled += 1
            print(f"  null  {m['prenom']} {m['nom']:30s} ({groupe})")
        else:
            updated += 1
            print(f"  {old:>4} → {score:>4}  {m['prenom']} {m['nom']:30s} ({groupe})")

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nUpdated: {updated}, Set null: {nulled}, Skipped (other active role): {skipped_has_other}")


if __name__ == "__main__":
    main()
