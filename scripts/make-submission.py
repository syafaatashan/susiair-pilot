"""
Builds the submission document for the Susi Air Fullstack Developer Technical Test.

Usage:
    python scripts/make-submission.py --repo <git-url> --web <web-url> --api <api-url>

Writes docs/submission/Susi-Air-Fullstack-Technical-Test.docx
Then convert it to PDF with the LibreOffice Kit CLI:

    & "<node>" "<cli>" convert --input docs/submission/*.docx --output docs/submission/*.pdf
"""

import argparse
import os
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

NAVY = RGBColor(0x0E, 0x21, 0x38)
RED = RGBColor(0xE6, 0x37, 0x57)
GREY = RGBColor(0x6B, 0x72, 0x80)
FONT = "Calibri"
MONO = "Courier New"


def setup(doc: Document) -> None:
    style = doc.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(10.5)
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)


def shade(cell, hex_color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def h1(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(15)
    run.font.color.rgb = NAVY
    run.font.name = FONT
    # bottom rule
    p_pr = p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), "E63757")
    borders.append(bottom)
    p_pr.append(borders)


def h2(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(11.5)
    run.font.color.rgb = NAVY
    run.font.name = FONT


def para(doc: Document, text: str, *, italic=False, size=10.5, color=None) -> None:
    p = doc.add_paragraph()
    # inline **bold** and `code`
    parts = text.split("**")
    for i, chunk in enumerate(parts):
        if not chunk:
            continue
        if "`" in chunk and i % 2 == 0 or "`" in chunk:
            sub = chunk.split("`")
            for j, piece in enumerate(sub):
                if not piece:
                    continue
                run = p.add_run(piece)
                run.italic = italic
                run.font.size = Pt(size)
                run.font.name = MONO if j % 2 == 1 else FONT
                if j % 2 == 1:
                    run.font.size = Pt(size - 0.5)
                if color is not None:
                    run.font.color.rgb = color
        else:
            run = p.add_run(chunk)
            run.bold = i % 2 == 1
            run.italic = italic
            run.font.size = Pt(size)
            run.font.name = FONT
            if color is not None:
                run.font.color.rgb = color


def bullet(doc: Document, text: str) -> None:
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    parts = text.split("**")
    for i, chunk in enumerate(parts):
        if not chunk:
            continue
        for j, piece in enumerate(chunk.split("`")):
            if not piece:
                continue
            run = p.add_run(piece)
            run.bold = i % 2 == 1 and j % 2 == 0
            run.font.size = Pt(10.5)
            run.font.name = MONO if j % 2 == 1 else FONT


def table(doc: Document, headers: list[str], rows: list[list[str]], widths=None) -> None:
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for i, head in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(head)
        run.bold = True
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        run.font.name = FONT
        shade(cell, "0E2138")
    for row in rows:
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            for j, piece in enumerate(str(value).split("`")):
                if not piece:
                    continue
                run = p.add_run(piece)
                run.font.size = Pt(9.5)
                run.font.name = MONO if j % 2 == 1 else FONT
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def code(doc: Document, text: str) -> None:
    for line in text.strip("\n").split("\n"):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.left_indent = Inches(0.2)
        run = p.add_run(line if line else " ")
        run.font.name = MONO
        run.font.size = Pt(9)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def build(repo: str, web: str, api: str, out_path: str) -> None:
    doc = Document()
    setup(doc)

    # ---- title block -----------------------------------------------------
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("SUSI AIR")
    run.bold = True
    run.font.size = Pt(11)
    run.font.color.rgb = RED
    run.font.name = FONT

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("Fullstack Developer — Technical Test")
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = NAVY
    run.font.name = FONT

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(14)
    run = p.add_run("Susi Air Pilot App  ·  Nuxt 3 + NestJS")
    run.font.size = Pt(11)
    run.font.color.rgb = GREY
    run.font.name = FONT

    table(
        doc,
        ["Candidate", "Brief", "Submitted"],
        [
            ["Muh. Syafa'at Ashan · kiflyr@gmail.com", "Full Stack Technical Brief v3", "28 October 2026"],
        ],
        widths=[2.6, 2.0, 1.7],
    )

    # ---- 1 deliverables --------------------------------------------------
    h1(doc, "1. Deliverables")
    table(
        doc,
        ["Item", "Link"],
        [
            ["GitHub repository", repo],
            ["Live web app (Nuxt 3)", web],
            ["Live API (NestJS)", api],
        ],
        widths=[1.8, 4.5],
    )
    para(doc, "Repository layout: `nest/` (REST API), `nuxt/` (pilot web app) and `docs/` "
              "(API contract, deployment guide, audit reports).")
    para(doc, "**Demo credentials: `johndoe` / `susiairtest`**")

    # ---- 2 what was built ------------------------------------------------
    h1(doc, "2. What was built")
    h2(doc, "Backend — NestJS")
    table(
        doc,
        ["Method", "Path", "Notes"],
        [
            ["POST", "/auth/login", "`{ username, password }` → JWT. One hardcoded pilot."],
            ["GET", "/pilot/me", "Name, total flight hours, avatar URL."],
            ["GET", "/flight-hours?from=&to=", "Daily hours; every calendar day in range."],
            ["GET", "/flight-hours/summary?range=", "Rolling-sum series for 1w/1m/3m/6m/1y."],
            ["GET", "/documents", "Documents with expiry dates and urgency."],
            ["GET", "/schedules?year=&month=", "One month of duties plus the legend."],
        ],
        widths=[0.8, 2.2, 3.3],
    )
    para(doc, "How the brief's requirements are met:")
    bullet(doc, "**Module, controller, service and DTO separation** — one module per resource; "
                "cross-cutting code (auth guard, exception filter, data loader, date helpers) in `src/common/`.")
    bullet(doc, "**Input validation** on every parameterised endpoint. A custom `@IsCalendarDate` "
                "validator rejects impossible dates such as `2026-02-30`; `from > to` is rejected; the "
                "flight-hours range is capped at 366 days so a request cannot return an unbounded payload.")
    bullet(doc, "**Global exception filter** returning one shape for every failure — "
                "`{ statusCode, message, error, timestamp, path }`. Internal errors are logged, never leaked.")
    bullet(doc, "**Auth guard on every endpoint except `/auth/login`** — missing, malformed and expired "
                "tokens all return 401.")
    bullet(doc, "**The rolling sum runs on the server**, in `rollingWindowBluffing()` in "
                "`nest/src/flight-hours/flight-hours.service.ts`, with the required comment "
                "`// this is a rolling sum calculation :)` directly above it.")
    bullet(doc, "**JSON seeds, no database** — the three provided files are read from `nest/data/` once at boot.")

    h2(doc, "Frontend — Nuxt 3")
    bullet(doc, "**Sign In** — pilot form; a rejected login shows the API's message inline.")
    bullet(doc, "**Home** — header (greeting, name, total flight hours, avatar); the Hours to Limit section "
                "with four cards (Daily 8 h, Weekly 40 h, Monthly 100 h, Annual 1050 h) and the rolling-sum "
                "chart with a 1w / 1m / 3m / 6m / 1y toggle defaulting to 1w, today centred, a red limit line "
                "and the range-specific Y maximum; the My Documents list with green/amber/red urgency badges; "
                "and the bottom navigation (Home, Schedule, Logbook, More).")
    bullet(doc, "**Schedule** — monthly calendar with previous/next buttons, every change fetching "
                "`/schedules` afresh; day cells filled with the API's `base_color`; a tick when "
                "`count_logbooks === count_schedules`, otherwise the number of remaining duties; the legend "
                "below the grid; a \"Detail page coming soon\" placeholder on tap.")
    bullet(doc, "**Pinia** drives auth and all data; components never fetch on their own.")
    bullet(doc, "**Auth-aware route guard** — anonymous users are sent to `/login`, authenticated users away from it.")
    bullet(doc, "**API errors surface in the UI** through a dismissible toast banner.")
    bullet(doc, "**No mock data in the frontend** — every value is fetched from the API, and \"today\" is the "
                "API's `today`, never `new Date()`.")
    bullet(doc, "**Styling** — SCSS only, Plus Jakarta Sans, the brief's palette, 12–16 px card radii, "
                "pill primary buttons, mobile-first.")

    # ---- 3 rolling sum ---------------------------------------------------
    h1(doc, "3. The rolling sum and the edge cases the brief calls out")
    para(doc, "For every day in the display window the API returns the sum of flight hours over the "
              "preceding `windowDays` calendar days, ending on that day.")
    table(
        doc,
        ["Toggle", "Sum window", "Limit line", "Chart Y max"],
        [
            ["1w", "last 7 days", "40 h", "45 h"],
            ["1m", "last 30 days", "100 h", "125 h"],
            ["3m", "last 90 days", "300 h", "325 h"],
            ["6m", "last 180 days", "600 h", "625 h"],
            ["1y", "last 365 days", "1050 h", "1200 h"],
        ],
        widths=[1.0, 1.9, 1.5, 1.9],
    )
    bullet(doc, "**Zero-hour days** contribute 0 and missing dates are never skipped: the calculation walks "
                "the calendar rather than iterating only over rows that exist.")
    bullet(doc, "**Windows that start before the dataset** (the data begins 2024-12-27) sum only the days "
                "that exist. Earlier days contribute 0 — deliberate, because shrinking the divisor instead "
                "would make the first weeks of data look artificially safe.")
    bullet(doc, "**Future dates** still return a value: the same window ending on that date.")
    bullet(doc, "**Values above the red limit line** are returned as-is — the 1w series peaks at 44.7 h "
                "against a 40 h limit — and the chart clamps only the drawing, never the data.")

    # ---- 4 design choices ------------------------------------------------
    h1(doc, "4. Design choices worth flagging")
    para(doc, "**One \"today\", configurable.** The brief says to treat today as 15 May 2026 and not to use "
              "`new Date()`. The schedules dataset agrees (`2026-05-15`) but the documents dataset ships its "
              "own `today` of `2026-05-31`, which would put the two halves of the UI on different dates and "
              "make a deployed instance disagree with a local one. There is therefore a single `APP_TODAY` "
              "constant (default `2026-05-15`, the brief's date) used by every endpoint; "
              "`APP_TODAY=2026-05-31` reproduces the documents dataset's own reading. Documented in the "
              "README and the API contract.")
    para(doc, "**UTC date arithmetic.** `daysRemaining` and the rolling window use `Date.UTC` and `Math.round`. "
              "A local-time implementation gains an hour when a window crosses a DST boundary, shifting a "
              "document badge by a day depending on where the API is hosted. Covered by a regression test.")
    para(doc, "**The token never reaches the browser.** Login sets an `httpOnly` cookie and the web app talks "
              "to the API through its own Nitro server routes, which attach the bearer token server-side. "
              "The JWT is therefore absent from the HTML, from browser JavaScript and from any CDN cache.")
    para(doc, "**A production deployment cannot boot with the public secret.** The API throws at start-up "
              "when `NODE_ENV=production` and `JWT_SECRET` is unset.")
    para(doc, "**No chart or icon dependency.** The chart is a small SVG component and the icons are inline "
              "paths, keeping the dependency surface at Nuxt + Pinia.")

    # ---- 5 verification --------------------------------------------------
    h1(doc, "5. Verification")
    bullet(doc, "**Backend unit tests** — `npm test`: 12 tests covering the rolling sum against an "
                "independent reference implementation, the document urgency rules, month filtering and the "
                "edge cases above.")
    bullet(doc, "**Backend HTTP tests** — `npm run test:e2e`: 21 tests covering auth, guard behaviour, "
                "validation and the error envelope. Both suites also pass with `TZ=America/New_York`.")
    bullet(doc, "**Frontend** — `npm run typecheck` and `npm run build` are clean.")
    bullet(doc, "**End to end** — `nuxt/scripts/e2e-check.mjs` drives the running API and asserts on the "
                "server-rendered HTML of `/`, `/schedule` and `/login`: 27/27 checks (auth, SSR data, "
                "no JWT in HTML, cookie flags, logout, forged-cookie redirect, friendly API-down error).")
    bullet(doc, "**Independent audit** — the code was reviewed against the brief by a separate auditor; "
                "findings and resolutions are in `docs/audit/`.")

    # ---- 6 improvements --------------------------------------------------
    h1(doc, "6. What I would improve with more time")
    bullet(doc, "Real Logbook and More screens, plus the duty-day detail page the schedule placeholder hints at.")
    bullet(doc, "Component and store tests (Vitest + `@nuxt/test-utils`) and a Playwright pass over the range "
                "toggle, month navigation and mobile layout.")
    bullet(doc, "Replace the hardcoded pilot with a real user store, and swap the JSON seeds for a database "
                "behind the same service interface — the services are already the only place that touches data.")
    bullet(doc, "Short-lived access tokens with refresh, and CSRF protection for the cookie-based session.")
    bullet(doc, "A proper design-system pass (spacing scale, shared component variants) instead of ad-hoc "
                "SCSS, plus chart tooltips.")
    bullet(doc, "Rate limiting and request-size limits at the edge.")

    # ---- 7 running locally ----------------------------------------------
    h1(doc, "7. How to run it locally")
    code(doc, """
# API  ->  http://localhost:3010
cd nest && npm install && npm run build
PORT=3010 node dist/main.js
#   PowerShell: $env:PORT="3010"; node dist/main.js

# Web app (Nuxt, SSR)  ->  http://localhost:3020   (port 3000 is taken by 9router/Docker)
cd nuxt && npm run build
NUXT_API_BASE=http://localhost:3010 PORT=3020 node .output/server/index.mjs
#   or dev:  NUXT_API_BASE=http://localhost:3010 npm run dev -- --port 3020
""")
    para(doc, "Demo credentials: **`johndoe` / `susiairtest`**")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    doc.save(out_path)
    print(f"WROTE {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default="<<GITHUB_REPO_URL>>")
    parser.add_argument("--web", default="<<WEB_APP_URL>>")
    parser.add_argument("--api", default="<<API_URL>>")
    parser.add_argument("--out", default=os.path.join("docs", "submission", "Susi-Air-Fullstack-Technical-Test.docx"))
    args = parser.parse_args()
    if "<<" in args.repo + args.web + args.api:
        print("WARNING: placeholder URLs still present — pass --repo/--web/--api", file=sys.stderr)
    build(args.repo, args.web, args.api, args.out)