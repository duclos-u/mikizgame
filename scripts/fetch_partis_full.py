#!/usr/bin/env python3
"""
Full party history from Wikidata P102 (member of political party).

Phase 1 : Wikipedia action API  → QID per politician    (50 titles/request)
Phase 2 : Wikidata wbgetentities → P102 claims per QID  (50 QIDs/request)
Phase 3 : Wikidata wbgetentities → French party labels  (50 QIDs/request)
Phase 4 : Write partis[] + currentOrLastParti back to politics.json
"""
import json, time, urllib.request, urllib.parse, sys, os

sys.stdout.reconfigure(line_buffering=True)

WP_ACTION   = "https://fr.wikipedia.org/w/api.php"
WD_ACTION   = "https://www.wikidata.org/w/api.php"
POLITICS    = "MikizBack/src/data/politics.json"
QID_CACHE   = "/tmp/qid_cache.json"
P102_CACHE  = "/tmp/p102_cache.json"
PARTY_CACHE = "/tmp/party_names_cache.json"
BATCH       = 50


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def api_get(base_url, params, retries=3):
    params["format"] = "json"
    url = base_url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, headers={"User-Agent": "PartisFullBot/1.0 (politics.json enrichment)"}
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 60)) + 5
                print(f"  [429 wait {wait}s]", flush=True)
                time.sleep(wait)
            elif attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
        except Exception:
            if attempt < retries - 1:
                time.sleep(2)
    return None


def load_cache(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def save_cache(data, path):
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Phase 1: Wikipedia → QIDs
# ---------------------------------------------------------------------------

def fetch_qids_batch(titles):
    resp = api_get(WP_ACTION, {
        "action": "query",
        "prop": "pageprops",
        "ppprop": "wikibase_item",
        "titles": "|".join(titles),
        "redirects": "1",
    })
    if not resp:
        return {}

    # Build reverse maps: normalized/redirected title → original query title
    norm_map   = {n["from"]: n["to"] for n in resp.get("query", {}).get("normalized", [])}
    redir_map  = {r["from"]: r["to"] for r in resp.get("query", {}).get("redirects", [])}

    # Final title → canonical resolved title
    def resolve(t):
        t2 = norm_map.get(t, t)
        return redir_map.get(t2, t2)

    resolved_to_orig = {resolve(t): t for t in titles}

    result = {}
    for page in resp.get("query", {}).get("pages", {}).values():
        title = page.get("title", "")
        qid   = page.get("pageprops", {}).get("wikibase_item")
        orig  = resolved_to_orig.get(title)
        if qid and orig:
            result[orig] = qid
    return result


# ---------------------------------------------------------------------------
# Phase 2: Wikidata → P102 claims
# ---------------------------------------------------------------------------

def fetch_p102_batch(qids):
    resp = api_get(WD_ACTION, {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "claims",
    })
    if not resp:
        return {}

    result = {}
    for qid, entity in resp.get("entities", {}).items():
        raw_claims = entity.get("claims", {}).get("P102", [])
        parties = []
        for claim in raw_claims:
            ms = claim.get("mainsnak", {})
            if ms.get("snaktype") != "value":
                continue
            party_qid = ms.get("datavalue", {}).get("value", {}).get("id")
            if not party_qid:
                continue
            quals = claim.get("qualifiers", {})

            def _snak_time(snak_list):
                if not snak_list:
                    return ""
                s = snak_list[0]
                if s.get("snaktype") != "value":
                    return ""
                return s.get("datavalue", {}).get("value", {}).get("time", "")

            start = _snak_time(quals.get("P580", []))
            end   = _snak_time(quals.get("P582", []))
            parties.append({"qid": party_qid, "start": start, "end": end})
        result[qid] = parties
    return result


# ---------------------------------------------------------------------------
# Phase 3: Wikidata → French party labels
# ---------------------------------------------------------------------------

def fetch_labels_batch(qids):
    resp = api_get(WD_ACTION, {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "labels",
        "languages": "fr",
    })
    if not resp:
        return {}

    result = {}
    for qid, entity in resp.get("entities", {}).items():
        label = entity.get("labels", {}).get("fr", {}).get("value")
        if label:
            result[qid] = label
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def time_key(t):
    """'+2000-01-01T00:00:00Z' → '2000-01-01' (sortable)."""
    return t.lstrip("+").split("T")[0] if t else ""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    with open(POLITICS) as f:
        data = json.load(f)
    membres = data["membres"]
    total   = len(membres)

    # ---- Phase 1 ----
    print("Phase 1: Wikipedia QIDs …", flush=True)
    qid_cache = load_cache(QID_CACHE)
    need_qid  = [f"{m['prenom']} {m['nom']}" for m in membres
                 if f"{m['prenom']} {m['nom']}" not in qid_cache]
    print(f"  Cached: {len(qid_cache)}, need: {len(need_qid)}", flush=True)

    for i in range(0, len(need_qid), BATCH):
        batch  = need_qid[i:i + BATCH]
        result = fetch_qids_batch(batch)
        for title in batch:
            qid_cache[title] = result.get(title)
        save_cache(qid_cache, QID_CACHE)
        found = sum(1 for v in qid_cache.values() if v)
        print(f"  [{min(i+BATCH, len(need_qid))}/{len(need_qid)}] QIDs: {found} found", flush=True)
        time.sleep(1.0)

    total_qids = sum(1 for v in qid_cache.values() if v)
    print(f"  QIDs resolved: {total_qids}/{total}", flush=True)

    # ---- Phase 2 ----
    print("\nPhase 2: Wikidata P102 claims …", flush=True)
    p102_cache = load_cache(P102_CACHE)
    all_qids   = [v for v in qid_cache.values() if v]
    need_p102  = [q for q in all_qids if q not in p102_cache]
    print(f"  Cached: {len(p102_cache)}, need: {len(need_p102)}", flush=True)

    for i in range(0, len(need_p102), BATCH):
        batch  = need_p102[i:i + BATCH]
        result = fetch_p102_batch(batch)
        p102_cache.update(result)
        save_cache(p102_cache, P102_CACHE)
        print(f"  [{min(i+BATCH, len(need_p102))}/{len(need_p102)}] P102 batches done", flush=True)
        time.sleep(1.5)

    with_parties = sum(1 for v in p102_cache.values() if v)
    print(f"  QIDs with P102: {with_parties}/{len(p102_cache)}", flush=True)

    # ---- Phase 3 ----
    print("\nPhase 3: Party French labels …", flush=True)
    party_qids  = {p["qid"] for parties in p102_cache.values() for p in parties}
    party_names = load_cache(PARTY_CACHE)
    need_labels = [q for q in party_qids if q not in party_names]
    print(f"  Unique party QIDs: {len(party_qids)}, need labels: {len(need_labels)}", flush=True)

    for i in range(0, len(need_labels), BATCH):
        batch  = need_labels[i:i + BATCH]
        result = fetch_labels_batch(batch)
        party_names.update(result)
        save_cache(party_names, PARTY_CACHE)
        print(f"  [{min(i+BATCH, len(need_labels))}/{len(need_labels)}] label batches done", flush=True)
        time.sleep(1.0)

    print(f"  Party labels resolved: {len(party_names)}", flush=True)

    # ---- Phase 4 ----
    print("\nPhase 4: Writing politics.json …", flush=True)
    updated  = 0
    fallback = 0

    for m in membres:
        name_key = f"{m['prenom']} {m['nom']}"
        qid      = qid_cache.get(name_key)

        # Groupe fallback for deputies
        groupe = next(
            (mn["groupe"] for mn in m.get("mandats", []) if mn.get("groupe")),
            None,
        )

        if not qid or qid not in p102_cache or not p102_cache[qid]:
            # No Wikidata party data — keep existing data or groupe fallback
            if not m.get("partis"):
                m["partis"] = [groupe] if groupe else None
                m["currentOrLastParti"] = groupe
            elif not m.get("currentOrLastParti"):
                m["currentOrLastParti"] = m["partis"][-1]
            fallback += 1
            continue

        # Resolve party names
        named = []
        for p in p102_cache[qid]:
            label = party_names.get(p["qid"])
            if label:
                named.append({
                    "name":  label,
                    "start": time_key(p["start"]),
                    "end":   time_key(p["end"]),
                })

        if not named:
            # QID resolved but no named parties found
            if not m.get("partis"):
                m["partis"] = [groupe] if groupe else None
                m["currentOrLastParti"] = groupe
            elif not m.get("currentOrLastParti"):
                m["currentOrLastParti"] = m["partis"][-1]
            fallback += 1
            continue

        # Sort chronologically (unknown start date → put at beginning)
        named.sort(key=lambda x: x["start"] or "0000")

        # Deduplicate by name (keep first occurrence for order stability)
        seen, unique = set(), []
        for p in named:
            if p["name"] not in seen:
                seen.add(p["name"])
                unique.append(p)

        m["partis"] = [p["name"] for p in unique]

        # currentOrLastParti: prefer active membership (no end date).
        # When multiple active: if any have start dates, pick most recent;
        # otherwise take the last by Wikidata order (successor parties are added later).
        active = [p for p in unique if not p["end"]]
        if active:
            dated = [p for p in active if p["start"]]
            if dated:
                dated.sort(key=lambda x: x["start"], reverse=True)
                m["currentOrLastParti"] = dated[0]["name"]
            else:
                m["currentOrLastParti"] = active[-1]["name"]
        else:
            m["currentOrLastParti"] = unique[-1]["name"]

        updated += 1

    with open(POLITICS, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_cp = sum(1 for m in membres if m.get("currentOrLastParti"))
    total_p  = sum(1 for m in membres if m.get("partis"))
    print(f"\nDone!")
    print(f"  Updated via Wikidata:  {updated}/{total}")
    print(f"  Fallback (no P102):    {fallback}/{total}")
    print(f"  currentOrLastParti:    {total_cp}/{total}")
    print(f"  partis non-empty:      {total_p}/{total}", flush=True)


if __name__ == "__main__":
    main()
