#!/usr/bin/env python3
"""Independent recomputation + regression checks for the Susi Air NestJS backend.

Written by the QA auditor, not the author. It recomputes the documented numbers
from the raw JSON datasets with Python date arithmetic and asserts them against
the live API. It also pins every fix claimed for defects D-1 .. D-9.

Usage:
    cd nest && npm run build && ($env:PORT="3010"; node dist/main.js)
    python docs/audit/verify_backend.py http://127.0.0.1:3010

Exit code 0 = every assertion passed.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3010"

FH = json.loads((ROOT / "mock-flight-hours.json").read_text(encoding="utf-8"))
DOCS = json.loads((ROOT / "mock-documents.json").read_text(encoding="utf-8"))
SCHED = json.loads((ROOT / "mock-schedules.json").read_text(encoding="utf-8"))

HOURS = {e["date"]: e["hours"] for e in FH["flightHours"]}
# ONE app-wide today, defaulting to the brief's 2026-05-15 (nest/src/common/config.ts).
TODAY = os.environ.get("APP_TODAY", "2026-05-15")
BOUNDS = FH["chartBounds"]
DISPLAY_DAYS = 7
RANGES = ("1w", "1m", "3m", "6m", "1y")
MAX_RANGE_DAYS = 366
JWT_SECRET_DEFAULT = b"susiair-technical-test-secret"

fails = []


def http(path, token=None, method="GET", body=None, raw_body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    if raw_body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = raw_body.encode()
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text or "null")
        except json.JSONDecodeError:
            return e.code, text


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not ok:
        fails.append(name)


def d(s):
    y, m, dd = (int(x) for x in s.split("-"))
    return date(y, m, dd)


def iso(dt):
    return dt.isoformat()


# ---------------------------------------------------------------- rolling sums
def rolling_series(window_days):
    """Independent rolling sum: the window covers the day itself and window_days-1 days before it."""
    out = {}
    cur = d(TODAY) - timedelta(days=DISPLAY_DAYS)
    end = d(TODAY) + timedelta(days=DISPLAY_DAYS)
    while cur <= end:
        total = sum(HOURS.get(iso(cur - timedelta(days=j)), 0) for j in range(window_days))
        out[iso(cur)] = round(total, 1)
        cur += timedelta(days=1)
    return out


def doc_rows(reference):
    rows = {}
    for doc in DOCS["documents"]:
        rem = (d(doc["expiryDate"]) - reference).days
        status = "expired" if rem <= 0 else "soon" if rem <= DOCS["thresholds"]["warningDays"] else "safe"
        rows[doc["id"]] = (rem, status)
    return rows


print("=" * 78)
print("BASE", BASE, "| app-wide today=", TODAY)
print("=" * 78)

# ---------------------------------------------------------------- §1/§3 auth
status, login = http("/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
check("POST /auth/login 200 + contract keys", status == 200 and sorted(login) == ["access_token", "expires_in", "token_type"], f"http={status} keys={sorted(login)}")
token = login.get("access_token", "")
h, p, sig = token.split(".")
hdr = json.loads(base64.urlsafe_b64decode(h + "=="))
pl = json.loads(base64.urlsafe_b64decode(p + "=="))
expected_sig = base64.urlsafe_b64encode(hmac.new(JWT_SECRET_DEFAULT, f"{h}.{p}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
check("JWT verifies (HS256 default secret, 30d, pilot claim)",
      hdr.get("alg") == "HS256" and pl["exp"] - pl["iat"] == 2592000 and pl["username"] == "johndoe" and hmac.compare_digest(sig, expected_sig),
      f"payload={pl}")
s, b = http("/auth/login", method="POST", body={"username": "johndoe", "password": "wrong"})
check("wrong password -> 401 Invalid credentials", s == 401 and b.get("message") == "Invalid credentials", f"http={s}")

# ---------------------------------------------------------------- §2 guard
PROTECTED = ["/pilot/me", "/flight-hours?from=2026-05-01&to=2026-05-05", "/flight-hours/summary", "/documents", "/schedules?year=2026&month=5"]
for path in PROTECTED:
    s0, _ = http(path)
    s1, _ = http(path, token)
    s2, _ = http(path, "not.a.jwt")
    check(f"guard {path}", (s0, s2, s1) == (401, 401, 200), f"got no-token={s0} malformed={s2} valid={s1}")

# ---------------------------------------------------------------- §5 error shape (D-6)
ERR_KEYS = {"statusCode", "message", "error", "timestamp", "path"}
shape_cases = [
    ("400 validation", "/flight-hours?from=abc&to=zzz", 400),
    ("400 missing params", "/flight-hours", 400),
    ("400 bad range", "/flight-hours/summary?range=2w", 400),
    ("400 month range", "/schedules?year=2026&month=13", 400),
    ("401", "/documents", 401),
    ("404", "/no-such-route", 404),
]
for label, path, expect in shape_cases:
    s, b = http(path, None if expect == 401 else token)
    check(f"error shape {label}", s == expect and isinstance(b, dict) and set(b) == ERR_KEYS and isinstance(b.get("error"), str),
          f"http={s} keys={sorted(b) if isinstance(b, dict) else b}")

s, b = http("/auth/login", method="POST", raw_body='{"username": ')
check("D-6 malformed JSON body -> 400 'Invalid JSON payload' (no parser internals)", s == 400 and b.get("message") == "Invalid JSON payload", f"http={s} msg={b.get('message')!r}")

# ---------------------------------------------------------------- §4 validation (D-3/4/5/7)
s, b = http("/flight-hours?from=2026-05-10&to=2026-05-01", token)
check("D-3 reversed range -> 400", s == 400 and "from must not be after to" in str(b.get("message")), f"http={s} msg={b.get('message')}")
s, b = http("/flight-hours?from=2026-02-30&to=2026-03-02", token)
check("D-4 impossible date 2026-02-30 -> 400", s == 400, f"http={s} msg={b.get('message')}")
far = iso(d(TODAY) - timedelta(days=MAX_RANGE_DAYS + 1))
s, b = http(f"/flight-hours?from={far}&to={TODAY}", token)
check(f"D-5 range > {MAX_RANGE_DAYS} days -> 400", s == 400 and "must not exceed" in str(b.get("message")), f"http={s} msg={b.get('message')}")
near = iso(d(TODAY) - timedelta(days=MAX_RANGE_DAYS))
s, b = http(f"/flight-hours?from={near}&to={TODAY}", token)
check(f"D-5 boundary {MAX_RANGE_DAYS} days -> 200", s == 200 and isinstance(b, list) and len(b) == MAX_RANGE_DAYS + 1, f"http={s} rows={len(b) if isinstance(b, list) else b}")
s, b = http("/flight-hours?from=1900-01-01&to=2100-01-01", token)
check("D-5 absurd range -> 400 (no multi-MB payload)", s == 400, f"http={s}")
s, b = http("/flight-hours", token)
check("D-7 missing from/to -> 'is required' messages", s == 400 and isinstance(b.get("message"), list) and any("is required" in m for m in b["message"]), f"msg={b.get('message')}")
s, b = http("/schedules?year=2026", token)
check("D-7 missing month -> 'month is required'", s == 400 and any("month is required" in m for m in b.get("message", [])), f"msg={b.get('message')}")

# ---------------------------------------------------------------- §7 rolling sums
for rng in RANGES:
    s, resp = http(f"/flight-hours/summary?range={rng}", token)
    if s != 200:
        check(f"summary {rng} 200", False, f"http={s}")
        continue
    expected = rolling_series(BOUNDS[rng]["windowDays"])
    api = {pt["date"]: pt["value"] for pt in resp["chartData"]}
    diffs = [f"{k} api={api.get(k)} py={v}" for k, v in expected.items() if api.get(k) != v]
    check(f"summary {rng}: 15/15 rolling sums match independent Python recomputation", not diffs, "; ".join(diffs[:5]))
    check(f"summary {rng}: limit={BOUNDS[rng]['limit']} yMax={BOUNDS[rng]['max']} (brief bounds table)",
          (resp["limit"], resp["yMax"]) == (BOUNDS[rng]["limit"], BOUNDS[rng]["max"]), f"api={resp['limit']}/{resp['yMax']}")
    dates = [pt["date"] for pt in resp["chartData"]]
    check(f"summary {rng}: 15 points, today at index 7, -7d/+7d span",
          len(dates) == 15 and dates[7] == TODAY and dates[0] == iso(d(TODAY) - timedelta(days=7)) and dates[-1] == iso(d(TODAY) + timedelta(days=7)))
    if rng in ("1w", "1m"):
        over = [pt for pt in resp["chartData"] if pt["value"] > resp["limit"]]
        check(f"summary {rng}: over-limit values still returned (chart must not clip)", bool(over),
              f"n_over={len(over)} max={max(pt['value'] for pt in resp['chartData'])} limit={resp['limit']}")

s, _ = http("/flight-hours/summary", token)
check("summary defaults to range=1w", s == 200, f"http={s}")

# ---------------------------------------------------------------- §8 edge cases
s, daily = http("/flight-hours?from=2026-05-01&to=2026-05-05", token)
exp = [{"date": iso(d("2026-05-01") + timedelta(days=i)), "hours": HOURS.get(iso(d("2026-05-01") + timedelta(days=i)), 0)} for i in range(5)]
check("zero/missing days filled with 0, none skipped", s == 200 and [(r["date"], r["hours"]) for r in daily] == [(r["date"], r["hours"]) for r in exp])
s, resp = http("/flight-hours/summary?range=1w", token)
future = [pt for pt in resp["chartData"] if pt["date"] > TODAY]
check("future dates in display range still carry a value", len(future) == 7 and all(isinstance(pt["value"], (int, float)) for pt in future))
s, y1 = http("/flight-hours/summary?range=1y", token)
pre = iso(d(TODAY) - timedelta(days=364))
check("1y window fully inside the dataset and matches the Python sum",
      s == 200 and pre >= FH["flightHours"][0]["date"] and y1["chartData"][7]["value"] == rolling_series(365)[TODAY],
      f"window start {pre} vs dataset start {FH['flightHours'][0]['date']}")
s, before = http("/flight-hours?from=2024-01-01&to=2024-01-05", token)
check("range before the dataset start -> 200, every day 0 (no error, no gap)",
      s == 200 and len(before) == 5 and all(r["hours"] == 0 for r in before), f"http={s}")

# ---------------------------------------------------------------- §9 documents (D-1 + today)
s, docs = http("/documents", token)
py = doc_rows(d(TODAY))
api = {r["id"]: (r["daysRemaining"], r["status"]) for r in docs}
check("GET /documents matches app-wide today (152/224/14/27/-14 per contract)", s == 200 and api == py, f"api={api} py={py}")
check("doc_license is 'soon' (not 'expired') under the single-today reading", api.get("doc_license") == (14, "soon"), f"{api.get('doc_license')}")

# D-1: UTC-only maths must be timezone invariant
ENV_JS = (
    "const f=s=>new Date(s+'T00:00:00');"
    "const d=(a,b)=>Math.ceil((f(b).getTime()-f(a).getTime())/864e5);"
    "console.log(d('2026-05-15','2026-10-14'),d('2026-05-15','2026-12-25'),d('2026-05-15','2026-05-29'),d('2026-05-15','2026-06-11'),d('2026-05-15','2026-05-01'))"
)
outs = {}
for tz in ("Asia/Makassar", "America/New_York", "Europe/London"):
    outs[tz] = subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True, env=dict(os.environ, TZ=tz)).stdout.split()
print(f"      proof the old local-Date maths drifts: TZ=America/New_York gives {' '.join(outs['America/New_York'])}, TZ=Asia/Makassar gives {' '.join(outs['Asia/Makassar'])}")
src = (ROOT / "nest" / "src" / "documents" / "documents.service.ts").read_text(encoding="utf-8")
check("D-1 documents.service has no local-time Date (UTC helper only)", "new Date(" not in src and "daysBetween" in src)
cfg = (ROOT / "nest" / "src" / "common" / "config.ts").read_text(encoding="utf-8")
check("D-1 config.daysBetween uses Date.UTC + Math.round", "Date.UTC(" in cfg and "Math.round(" in cfg)

# ---------------------------------------------------------------- §10 schedules
for mm, n in ((4, 17), (5, 21), (6, 16)):
    s, m = http(f"/schedules?year=2026&month={mm:02d}", token)
    got = m.get("schedules", [])
    check(f"schedules 2026-{mm:02d}: only that month, n={n}", s == 200 and len(got) == n and all(e["duty_date"].startswith(f"2026-{mm:02d}") for e in got), f"n={len(got)}")
    check(f"schedules 2026-{mm:02d}: today + 10-entry legend", m.get("today") == TODAY and len(m.get("legend", [])) == 10, f"today={m.get('today')} legend={len(m.get('legend', []))}")
s, m = http("/schedules?year=2026&month=07", token)
check("schedules empty month -> 200 []", s == 200 and m.get("schedules") == [], f"http={s}")

# ---------------------------------------------------------------- one today everywhere
s1, sum1 = http("/flight-hours/summary", token)
s2, sch = http("/schedules?year=2026&month=5", token)
check("ONE app-wide today used by flight-hours + schedules", sum1["today"] == sch["today"] == TODAY, f"{sum1['today']} / {sch['today']}")

# ---------------------------------------------------------------- D-9 dead code gone
svc = (ROOT / "nest" / "src" / "flight-hours" / "flight-hours.service.ts").read_text(encoding="utf-8")
check("D-9 getCurrentValue/getDailyTotal removed", "getCurrentValue" not in svc and "getDailyTotal" not in svc)
check("§6 rollingWindowBluffing + exact comment on the line above",
      "\n  // this is a rolling sum calculation :)\n  rollingWindowBluffing(" in svc)

print("=" * 78)
print("FAILURES:", fails if fails else "none")
sys.exit(1 if fails else 0)