# AUDIT — Remote Education Toolkit (pre-refactor)

Audit of the previous build: a hub `index.html` (87 lines) and three
self-contained tool pages — `tools/class-timer.html` (277 lines),
`tools/attendance-tracker.html` (334) and
`tools/discussion-randomizer.html` (346) — each with its own inline
CSS and script. Unlike most pages in this portfolio, the tools worked:
the timer counted, attendance persisted, the randomizer picked. The
findings are about correctness under real classroom conditions,
untestable structure, and policy. The three tool URLs are unchanged.

---

## A. Correctness

### A1 — The timer drifted
`class-timer.html:206–207`: `setInterval(…, 1000)` with
`remainingSeconds--`. Browsers throttle timers in background tabs to
once a minute or less, so a ten-minute timer left in another tab while
sharing a screen ran long by however much it was throttled. **Fix:**
`src/timer.js` is a state machine over wall-clock timestamps; elapsed
time is `now − startedAt`, and a tick that arrives late still lands on
the right second, carrying overshoot into the next segment. Tested with
a single tick spanning every segment.

### A2 — One segment only
The timer had one duration and two presets. A class runs as an agenda.
**Fix:** a plain-text agenda ("Warm-up 5, Lecture 20, Breakout 15")
parsed with named problems, with per-segment and whole-agenda progress,
skip, and a sound at each segment end.

### A3 — Biased shuffle
`discussion-randomizer.html:315`: `sort(() => Math.random() - 0.5)`.
This is not a uniform shuffle; the resulting group assignments depend on
the sort algorithm and are skewed. **Fix:** Fisher–Yates with an
injected random source (`crypto.getRandomValues` in the page, a seeded
generator in tests), verified to produce a permutation.

### A4 — Groups did not remember previous groups
Every "Generate groups" was independent, so the same students were
paired week after week. **Fix:** the last twenty groupings are kept;
two hundred candidate groupings are drawn and the one with the fewest
repeated pairs is used, and the page says when repeats were unavoidable.

### A5 — Attendance rate ignored excusal and runs
`attendance-tracker.html:187–201` counted present and late as present
and everything else as absent; there was no excused status and no
notion of consecutive absences, which is what a teacher acts on.
**Fix:** four statuses; excused is excluded from the rate and breaks an
absence run; a per-student consecutive-absence count is shown and rows
with two or more are highlighted.

### A6 — Dates in local time, keys in UTC
`attendance-tracker.html:142` set the date from
`toISOString().split('T')[0]` (UTC) while the teacher works in local
time; late in the evening in the Americas the default date was tomorrow.
**Fix:** the same UTC convention is used deliberately and only as a
default; the date field is the source of truth and every record is keyed
by the field's value.

### A7 — CSV export was not importable
The export wrote a table; nothing read it back, and quoting was not
handled. **Fix:** `toCsv` and `fromCsv` round-trip byte-for-byte
(tested), quote names containing commas or quotes, validate date
columns and statuses, and report bad rows.

## B. Structure and security

### B1 — 26 inline handlers, `innerHTML` with names, `alert`/`confirm`
`onclick` handlers across the three tools; student names inserted with
`innerHTML` (`discussion-randomizer.html:240`); blocking `alert()` and
`confirm()` dialogs. **Fix:** `addEventListener`, `textContent` and
`el()` for every name, and inline status messages with `aria-live`.

### B2 — No CSP; three copies of the styles and the storage code
**Fix:** `default-src 'none'; script-src 'self'` (no CDN at all —
the toolkit needs none), one stylesheet, one storage wrapper that
survives a blocked `localStorage`, and the hub page mounts all three
tools in accessible tabs while each tool page keeps its URL.

## C. Engineering

### C1 — No tests, no CI
**Fix:** 15 Vitest tests at 100 % statement coverage over the three
logic modules, including bad agendas, bad CSV rows, the finished-timer
edge, the new-round rollover and the unavoidable-repeat case; ESLint and
html-validate over all four pages; security scan; Pages deployment.
