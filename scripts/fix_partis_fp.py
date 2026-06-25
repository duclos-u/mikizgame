import json

INVALID = {
    "François|Ortoli": None,
    "Noëlle|Lenoir": None,
    "Jean-Pierre|Jouyet": None,
    "Charlotte|Caubel": "Horizons",
    "Patrice|Vergriete": None,
}

with open("MikizBack/src/data/politics.json") as f:
    data = json.load(f)

for m in data["membres"]:
    key = f"{m.get('prenom', '')}|{m.get('nom', '')}"
    if key in INVALID:
        new_val = INVALID[key]
        if new_val:
            m["partis"] = [new_val]
            m["currentOrLastParti"] = new_val
            print(f"Fixed {key}: '{new_val}'")
        else:
            m.pop("partis", None)
            m["currentOrLastParti"] = None
            print(f"Cleared {key}")

with open("MikizBack/src/data/politics.json", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

total = len(data["membres"])
cp = sum(1 for m in data["membres"] if m.get("currentOrLastParti"))
p = sum(1 for m in data["membres"] if m.get("partis"))
print(f"currentOrLastParti: {cp}/{total}")
print(f"partis non-empty:   {p}/{total}")
