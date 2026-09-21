/** DOM mounting for the three tools. Logic lives in timer.js, attendance.js and randomizer.js; this file only binds it. */
import { addNames, daySummary, dates, fromCsv, mark, removeName, STATUSES, summarise, toCsv, unmark } from './attendance.js';
import { cryptoRandom, makeGroupsAvoidingRepeats, pickNext } from './randomizer.js';
import { createTimer, parseAgenda, pause, reset, skip, start, tick, view } from './timer.js';
import { el } from './ui.js';

const KEYS = { attendance: 'ret-attendance-v1', randomizer: 'ret-randomizer-v1', timer: 'ret-timer-v1' };
export const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or quota: keep working in memory */ } }
};
const today = () => new Date().toISOString().slice(0, 10);

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Two short beeps from the Web Audio API — no media file, so the CSP stays at default-src 'none'. */
function beep(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i += 1) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.2);
    }
  } catch { /* no audio available */ }
}

// ---------- Timer ----------
export function mountTimer(root) {
  const saved = store.get(KEYS.timer, { agenda: 'Warm-up 5, Mini-lecture 15, Breakout 12, Share-back 8' });
  const agenda = el('textarea', { id: 'agenda', rows: '3', 'aria-describedby': 'agenda-help' });
  agenda.value = saved.agenda;
  const problems = el('p', { class: 'problems', 'aria-live': 'polite' });
  const label = el('div', { class: 'seg-label', text: '—' });
  const display = el('div', { class: 'time-display', text: '00:00', role: 'timer', 'aria-live': 'off' });
  const segBar = el('progress', { class: 'bar', max: '100', value: '0', 'aria-label': 'Segment progress' });
  const allBar = el('progress', { class: 'bar bar--thin', max: '100', value: '0', 'aria-label': 'Whole agenda progress' });
  const status = el('p', { class: 'meta', 'aria-live': 'polite', text: 'Load an agenda to begin.' });
  const btnLoad = el('button', { type: 'button', class: 'btn', text: 'Load agenda' });
  const btnStart = el('button', { type: 'button', class: 'btn btn--primary', text: 'Start' });
  const btnPause = el('button', { type: 'button', class: 'btn', text: 'Pause' });
  const btnSkip = el('button', { type: 'button', class: 'btn', text: 'Skip segment' });
  const btnReset = el('button', { type: 'button', class: 'btn', text: 'Reset' });
  const sound = el('input', { type: 'checkbox', id: 'sound', checked: '' });
  const list = el('ol', { class: 'segments' });
  root.append(
    el('div', { class: 'field' }, [el('label', { for: 'agenda', text: 'Agenda (label and minutes, comma or line separated)' }), agenda, el('p', { class: 'meta', id: 'agenda-help', text: 'Example: Warm-up 5, Mini-lecture 15, Breakout 12, Share-back 8' })]),
    problems,
    el('div', { class: 'button-row' }, [btnLoad, btnStart, btnPause, btnSkip, btnReset, el('span', { class: 'check' }, [sound, el('label', { for: 'sound', text: 'Sound at segment end' })])]),
    label, display, segBar, allBar, status, list
  );
  let t = null;
  let handle = null;
  const render = () => {
    if (!t) return;
    const v = view(t, Date.now());
    label.textContent = `${v.index + 1} of ${v.count} · ${v.label}`;
    display.textContent = v.remainingText;
    display.className = `time-display tone-${v.tone}`;
    segBar.value = v.segmentPct;
    allBar.value = v.overallPct;
    [...list.children].forEach((li, i) => { li.className = i < v.index || v.finished ? 'is-done' : i === v.index ? 'is-current' : ''; });
    btnStart.disabled = t.running || v.finished;
    btnPause.disabled = !t.running;
    status.textContent = v.finished ? 'Agenda complete.' : t.running ? 'Running — timing uses the clock, so a background tab stays accurate.' : 'Paused.';
  };
  const loop = () => {
    if (!t) return;
    const r = tick(t, Date.now());
    t = r.state;
    if (r.completed.length && sound.checked) beep(r.state.finished ? 3 : 2);
    render();
    if (t.running) handle = requestAnimationFrame(loop); else handle = null;
  };
  const load = () => {
    const { segments, problems: p } = parseAgenda(agenda.value);
    problems.textContent = p.join(' · ');
    if (!segments.length) return;
    store.set(KEYS.timer, { agenda: agenda.value });
    t = createTimer(segments);
    list.replaceChildren(...segments.map((s) => el('li', { text: `${s.label} — ${s.minutes} min` })));
    render();
  };
  btnLoad.addEventListener('click', load);
  btnStart.addEventListener('click', () => { if (!t) load(); if (!t) return; t = start(t, Date.now()); render(); if (!handle) loop(); });
  btnPause.addEventListener('click', () => { if (!t) return; t = pause(t, Date.now()); render(); });
  btnSkip.addEventListener('click', () => { if (!t) return; t = skip(t, Date.now()); render(); if (t.running && !handle) loop(); });
  btnReset.addEventListener('click', () => { if (!t) return; t = reset(t); render(); });
  load();
  return { get state() { return t; } };
}

// ---------- Attendance ----------
export function mountAttendance(root) {
  let data = store.get(KEYS.attendance, { roster: [], records: {} });
  const date = el('input', { type: 'date', id: 'att-date', value: today() });
  const names = el('textarea', { id: 'att-names', rows: '2', placeholder: 'One name per line, or comma-separated' });
  const btnAdd = el('button', { type: 'button', class: 'btn', text: 'Add to roster' });
  const note = el('p', { class: 'meta', 'aria-live': 'polite' });
  const dayNote = el('p', { class: 'meta', 'aria-live': 'polite' });
  const tbody = el('tbody');
  const btnAllPresent = el('button', { type: 'button', class: 'btn', text: 'Mark all present' });
  const btnExport = el('button', { type: 'button', class: 'btn btn--primary', text: 'Export CSV' });
  const file = el('input', { type: 'file', id: 'att-file', accept: '.csv,text/csv', 'aria-label': 'Import attendance CSV' });
  const btnClear = el('button', { type: 'button', class: 'btn', text: 'Clear all data' });
  const summaryBody = el('tbody');
  root.append(
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'field' }, [el('label', { for: 'att-date', text: 'Session date' }), date]),
      el('div', { class: 'field' }, [el('label', { for: 'att-names', text: 'Add students' }), names, el('div', {}, [btnAdd])])
    ]),
    note,
    el('div', { class: 'button-row' }, [btnAllPresent, btnExport, file, btnClear]),
    dayNote,
    el('div', { class: 'table-wrapper' }, [el('table', { class: 'att' }, [el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'Student' }), ...STATUSES.map((s) => el('th', { scope: 'col', text: s })), el('th', { scope: 'col', text: '' })])]), tbody])]),
    el('h3', { text: 'Attendance to date' }),
    el('div', { class: 'table-wrapper' }, [el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'Student' }), el('th', { scope: 'col', text: 'Sessions' }), el('th', { scope: 'col', text: 'Present (incl. late)' }), el('th', { scope: 'col', text: 'Late' }), el('th', { scope: 'col', text: 'Absent' }), el('th', { scope: 'col', text: 'Rate' }), el('th', { scope: 'col', text: 'Consecutive absences' })])]), summaryBody])])
  );
  const save = () => store.set(KEYS.attendance, data);
  const render = () => {
    const d = date.value;
    tbody.replaceChildren();
    for (const n of data.roster) {
      const tr = el('tr');
      tr.append(el('td', { text: n }));
      const current = data.records[d]?.[n];
      for (const s of STATUSES) {
        const id = `att-${d}-${n}-${s}`.replace(/\W/g, '_');
        const input = el('input', { type: 'radio', name: `st-${n}`, id, value: s, 'aria-label': `${n}: ${s}` });
        if (current === s) input.checked = true;
        input.addEventListener('change', () => { data = { ...data, records: mark(data.records, d, n, s) }; save(); render(); });
        tr.append(el('td', {}, [input]));
      }
      const rm = el('button', { type: 'button', class: 'btn btn--small', text: current ? 'Unmark' : 'Remove' });
      rm.addEventListener('click', () => { if (current) data = { ...data, records: unmark(data.records, d, n) }; else data = { ...data, roster: removeName(data.roster, n) }; save(); render(); });
      tr.append(el('td', {}, [rm]));
      tbody.append(tr);
    }
    const ds = daySummary(data.roster, data.records, d);
    dayNote.textContent = data.roster.length ? `${d}: ${ds.marked} of ${data.roster.length} marked · present ${ds.counts.present}, late ${ds.counts.late}, absent ${ds.counts.absent}, excused ${ds.counts.excused}${ds.presentRate === null ? '' : ` · ${ds.presentRate.toFixed(0)}% present`} · ${dates(data.records).length} session(s) recorded` : 'Roster is empty.';
    summaryBody.replaceChildren();
    for (const s of summarise(data.roster, data.records)) {
      const tr = el('tr', { class: s.consecutiveAbsences >= 2 ? 'is-alert' : '' });
      tr.append(el('td', { text: s.name }), el('td', { text: s.marked }), el('td', { text: s.present }), el('td', { text: s.late }), el('td', { text: s.absent }), el('td', { text: s.rate === null ? '—' : `${s.rate.toFixed(0)}%` }), el('td', { text: s.consecutiveAbsences }));
      summaryBody.append(tr);
    }
  };
  btnAdd.addEventListener('click', () => { const r = addNames(data.roster, names.value); data = { ...data, roster: r.roster }; names.value = ''; note.textContent = r.skipped.length ? `Already on the roster: ${r.skipped.join(', ')}` : ''; save(); render(); });
  btnAllPresent.addEventListener('click', () => { let rec = data.records; for (const n of data.roster) if (!rec[date.value]?.[n]) rec = mark(rec, date.value, n, 'present'); data = { ...data, records: rec }; save(); render(); });
  btnExport.addEventListener('click', () => download(`attendance-${today()}.csv`, toCsv(data.roster, data.records), 'text/csv'));
  file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; try { const r = fromCsv(await f.text()); data = { roster: r.roster, records: r.records }; note.textContent = `Imported ${r.roster.length} students, ${dates(r.records).length} sessions${r.warnings.length ? ` · ${r.warnings.join('; ')}` : ''}`; save(); render(); } catch (err) { note.textContent = `Import failed: ${err.message}`; } });
  btnClear.addEventListener('click', () => { data = { roster: [], records: {} }; save(); render(); });
  date.addEventListener('change', render);
  render();
  return { get data() { return data; } };
}

// ---------- Randomizer ----------
export function mountRandomizer(root, random = cryptoRandom) {
  let data = store.get(KEYS.randomizer, { names: [], called: [], history: [] });
  const names = el('textarea', { id: 'rnd-names', rows: '3', placeholder: 'One name per line, or comma-separated' });
  const btnSet = el('button', { type: 'button', class: 'btn', text: 'Set roster' });
  const picked = el('div', { class: 'picked', text: '?', 'aria-live': 'polite' });
  const pickNote = el('p', { class: 'meta' });
  const btnPick = el('button', { type: 'button', class: 'btn btn--primary', text: 'Pick a student' });
  const btnRound = el('button', { type: 'button', class: 'btn', text: 'New round' });
  const size = el('input', { type: 'number', id: 'grp-size', value: '3', min: '2', step: '1' });
  const btnGroups = el('button', { type: 'button', class: 'btn btn--primary', text: 'Make groups' });
  const btnForget = el('button', { type: 'button', class: 'btn', text: 'Forget grouping history' });
  const groupsOut = el('div', { class: 'groups', 'aria-live': 'polite' });
  const groupNote = el('p', { class: 'meta' });
  const chips = el('p', { class: 'chips' });
  root.append(
    el('div', { class: 'field' }, [el('label', { for: 'rnd-names', text: 'Roster' }), names, el('div', {}, [btnSet])]),
    chips,
    el('h3', { text: 'Cold call' }), picked, pickNote, el('div', { class: 'button-row' }, [btnPick, btnRound]),
    el('h3', { text: 'Groups' }),
    el('div', { class: 'button-row' }, [el('span', { class: 'field field--inline' }, [el('label', { for: 'grp-size', text: 'Group size' }), size]), btnGroups, btnForget]),
    groupsOut, groupNote
  );
  const save = () => store.set(KEYS.randomizer, data);
  const render = () => {
    names.value = data.names.join('\n');
    chips.replaceChildren(...data.names.map((n) => el('span', { class: `chip ${data.called.includes(n) ? 'is-called' : ''}`, text: n })));
    pickNote.textContent = data.names.length ? `${data.names.length - data.called.length} not yet called this round · ${data.history.length} grouping(s) remembered` : 'Set a roster first.';
  };
  btnSet.addEventListener('click', () => { const r = addNames([], names.value); data = { names: r.roster, called: [], history: data.history }; save(); render(); });
  btnPick.addEventListener('click', () => {
    if (!data.names.length) { pickNote.textContent = 'Set a roster first.'; return; }
    const r = pickNext(data.names, data.called, random);
    data = { ...data, called: r.called };
    picked.textContent = r.picked;
    save(); render();
    pickNote.textContent = `${r.newRound ? 'New round — ' : ''}${r.remaining} not yet called this round.`;
  });
  btnRound.addEventListener('click', () => { data = { ...data, called: [] }; picked.textContent = '?'; save(); render(); });
  btnGroups.addEventListener('click', () => {
    if (!data.names.length) { groupNote.textContent = 'Set a roster first.'; return; }
    const r = makeGroupsAvoidingRepeats(data.names, { size: Number(size.value) || 3 }, data.history, random);
    groupsOut.replaceChildren(...r.groups.map((g, i) => el('div', { class: 'group' }, [el('strong', { text: `Group ${i + 1}` }), el('ul', {}, g.map((n) => el('li', { text: n })))])));
    data = { ...data, history: [...data.history, r.groups].slice(-20) };
    save(); render();
    groupNote.textContent = `${r.groups.length} groups · ${r.repeatedPairs === 0 ? 'no pair has worked together before' : `${r.repeatedPairs} repeated pairing(s) — unavoidable with this history`} · history of ${data.history.length} grouping(s) used to avoid repeats.`;
  });
  btnForget.addEventListener('click', () => { data = { ...data, history: [] }; save(); render(); groupNote.textContent = 'Grouping history cleared.'; });
  render();
  return { get data() { return data; } };
}
