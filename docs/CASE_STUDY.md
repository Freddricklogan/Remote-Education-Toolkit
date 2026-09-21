# Case Study — Remote Education Toolkit

**Repository:** [Remote-Education-Toolkit](https://github.com/Freddricklogan/Remote-Education-Toolkit) · **Live demo:** [freddricklogan.github.io/Remote-Education-Toolkit](https://freddricklogan.github.io/Remote-Education-Toolkit/) · **Author:** Freddrick Logan

---

## 1. Who has this problem

Teachers running remote or hybrid sessions who need a timer, an attendance record and a fair way to call on students, without installing software, creating accounts, or sending a roster to a third party; instructional technologists asked to recommend such tools; and students who build them and need to see what "working" means beyond "the button did something".

## 2. The problem, as a scenario

A teacher shares her screen, starts a ten-minute timer in another tab, and moves on. The browser throttles the hidden tab; the timer ends late and the breakout runs over. Next session she generates discussion groups and the same two students land together for the fourth week running, because each draw forgets the last. Her attendance sheet says a student is at 60 % but cannot say that he has missed the last three sessions in a row, which is the fact that would prompt a call. The earlier version of this toolkit did all three of those things.

## 3. What it costs to leave it alone

Small tools set the tone for a class. A timer that runs long teaches students that the schedule is decorative. A randomizer that is not fair teaches that "random" is a word teachers use. An attendance rate without an absence run means the intervention that matters most — reaching a student who has quietly stopped coming — happens late or not at all. A tool that cannot import its own export locks the record into one laptop.

## 4. The approach, and the alternative I rejected

I rejected rewriting the tools as a framework app with a backend; the value of the toolkit is that it runs from a static page with no account, and nothing about the problems required more. Instead the logic moved out of the page scripts into three pure modules. `src/timer.js` is a state machine over wall-clock timestamps: elapsed time is computed from the clock on every render, and a tick advances through as many segments as the elapsed time covers, carrying overshoot, so a throttled tab lands on the right second. `src/randomizer.js` replaces the biased comparator shuffle with Fisher–Yates over an injected random source, draws cold calls without replacement until a round is complete, and chooses among two hundred candidate groupings the one with the fewest pairs repeated from the last twenty sessions. `src/attendance.js` adds an excused status that neither counts against a student nor extends an absence run, computes consecutive absences, and writes a CSV its own importer reads back exactly.

## 5. What the code does today

The hub page holds the three tools in keyboard-navigable tabs; each tool also keeps its original URL as a standalone page. The Class Timer takes an agenda in plain text — "Warm-up 5, Mini-lecture 15, Breakout 12, Share-back 8" — validates it, shows the current segment, its countdown and progress through the agenda, supports start, pause, skip and reset, and beeps at each boundary from the Web Audio API. The Attendance Tracker takes names in bulk with de-duplication, marks each student present, late, absent or excused per date, summarises the day, shows per-student rate and consecutive absences with rows at two or more highlighted, and exports and imports CSV with warnings. The Discussion Randomizer sets a roster, picks a student who has not yet been called this round, shows who remains, makes groups of a chosen size, and reports whether any pair has worked together in the remembered history. Everything persists in the browser's local storage.

## 6. Evidence

Fifteen Vitest tests cover agenda parsing with rejected segments, exact elapsed time across pause and resume, segment advance with overshoot, a single tick completing every segment, roster de-duplication, status validation, rate and consecutive-absence arithmetic with an excused break, CSV round trip with quoted names and reported bad rows, the cold-call permutation and new-round rollover, group-size balance, zero repeated pairs when history allows and an honest score when it does not. Statement coverage of the three modules is 100 %. In headless Chrome the agenda loaded at 05:00 and ran, skipped and paused; a roster of three rejected a duplicate; two marked sessions gave one student two consecutive absences with the row highlighted; six cold calls over six names were a permutation and the seventh opened a new round; two group draws produced no repeated pair; there were zero console errors and no horizontal scroll at 1280 or 400 pixels on any tab. `AUDIT.md` records ten findings against the earlier build.

## 7. What it would take to run this in production

It is usable as it stands for a single teacher on a single device. To share a roster across devices, add import and export in the institution's SIS format and an encrypted sync the teacher controls; to run it in a district, package the pages as a progressive web app. The modules do not change for either.

## 8. Limits and next steps

One roster per browser, no accounts, no multi-device sync, and names in local storage that a shared computer would expose — the tool says so, and the clear-all button exists for that reason. The timer's sound needs a user gesture to unlock audio in some browsers. Next, in order: a progressive web app manifest and service worker for offline use, a printable attendance sheet, and a seating-chart view for the randomizer.

## 9. Who should look at this

**Hiring manager:** evidence that I take small tools seriously enough to test their arithmetic and to fix the failures a teacher actually hits.
**Consulting client:** a set of no-install, no-account classroom tools whose data-handling you can verify by reading one file.
**Engineer:** read `src/timer.js` with `tests/timer.test.js` for the timestamp state machine, and `makeGroupsAvoidingRepeats` in `src/randomizer.js` for the pair-history search.
