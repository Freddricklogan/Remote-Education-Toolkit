/** Mounts the toolkit hub (index.html, all three tools in tabs) or a single tool page (tools/*.html) plus the Executive Shell. */
import { mountExecShell } from './exec-shell.js';
import { mountAttendance, mountRandomizer, mountTimer } from './tools.js';
import { $ } from './ui.js';

const TOOLS = {
  timer: { title: 'Class Timer', mount: mountTimer, blurb: 'Agenda timer: segments with labels, driven by the clock so a background tab stays exact; sound at each segment end.' },
  attendance: { title: 'Attendance Tracker', mount: mountAttendance, blurb: 'Roster, per-session marks (present, late, absent, excused), rates and consecutive-absence alerts, CSV export and import. Data stays in this browser.' },
  randomizer: { title: 'Discussion Randomizer', mount: mountRandomizer, blurb: 'Cold-call queue that calls everyone once per round, and groups that avoid repeating pairs across sessions.' }
};

const single = document.body.dataset.tool;
const mounted = {};
if (single) {
  mounted[single] = TOOLS[single].mount($('tool-root'));
} else {
  for (const [key, t] of Object.entries(TOOLS)) mounted[key] = t.mount($(`panel-${key}`));
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const select = (key) => {
    for (const tab of tabs) {
      const on = tab.dataset.tab === key;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $(`panel-${tab.dataset.tab}`).hidden = !on;
    }
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.tab));
    tab.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[j].focus(); select(tabs[j].dataset.tab); } });
  });
  select('timer');
}
window.__tools = mounted;

const shell = mountExecShell({
  theme: 'ember',
  accent: 'secondary',
  title: single ? TOOLS[single].title : 'Remote Education Toolkit',
  tagline: single ? TOOLS[single].blurb : 'Three classroom tools with tested logic and no server: an agenda timer that cannot drift, an attendance tracker with rates, alerts and CSV round-trip, and a randomizer whose cold calls are fair and whose groups avoid repeated pairs. Everything stays in your browser.',
  repo: 'https://github.com/Freddricklogan/Remote-Education-Toolkit',
  pagesUrl: `https://freddricklogan.github.io/Remote-Education-Toolkit/${single ? `tools/${single === 'timer' ? 'class-timer' : single === 'attendance' ? 'attendance-tracker' : 'discussion-randomizer'}.html` : ''}`,
  badges: [{ label: 'No server', tone: 'accent' }, { label: 'Logic unit-tested', dot: true }, { label: single ? 'Single tool' : 'Three tools', dot: true }],
  kpis: [
    { label: 'Roster', compute: () => mounted.attendance?.data.roster.length ?? '—', tone: 'accent' },
    { label: 'Sessions recorded', compute: () => Object.keys(mounted.attendance?.data.records ?? {}).length, tone: 'ok' },
    { label: 'Cold-call roster', compute: () => mounted.randomizer?.data.names.length ?? '—' },
    { label: 'Groupings remembered', compute: () => mounted.randomizer?.data.history.length ?? '—', tone: 'muted' }
  ],
  tour: single ? [{ selector: '#tool-root', title: TOOLS[single].title, body: `${TOOLS[single].blurb} The hub page has all three tools with a full tour.` }] : [
    { selector: '#panel-timer', title: 'A timer that cannot drift', body: 'Segments come from a plain-text agenda. Elapsed time is computed from timestamps, not from counting ticks, so a throttled background tab still lands on the right second. Start it.', action: () => { document.querySelector('[data-tab=timer]').click(); } },
    { selector: '#panel-attendance', title: 'Attendance with arithmetic', body: 'Present and late count as present; excused breaks an absence run; the rate is per student over sessions actually marked. Export is a CSV that imports back byte-for-byte.', action: () => { document.querySelector('[data-tab=attendance]').click(); } },
    { selector: '#panel-randomizer', title: 'Fair cold calls and fresh groups', body: 'Everyone is called once before anyone is called twice. Groups are drawn 200 times and the draw with the fewest repeated pairs from previous sessions wins — and the note says when repeats were unavoidable.', action: () => { document.querySelector('[data-tab=randomizer]').click(); } }
  ]
});
shell.refreshKpis();
setInterval(() => shell.refreshKpis(), 2000);
