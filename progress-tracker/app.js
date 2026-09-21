// ---------------------------------------------------------------------------
// Cynthia's Glow Up Plan — Progress Tracker
// Plan content (pillars, actions, life audits) is seeded from the plan PDF.
// All user progress (checks, notes, evidence, journal) lives in localStorage.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'glow-up-tracker-state-v1';

const PLAN = {
  pillars: [
    {
      id: 'health',
      number: 'I',
      name: 'Health',
      color: 'var(--health)',
      description: "Build a consistent, healthy lifestyle by eating out less, making more nutritious food choices, staying consistent at the gym, working toward abs and a lower BMI, and prioritizing my mental wellbeing through stress management and gratitude.",
      actions: [
        { id: 'health-1', text: 'Meal prep every Sunday' },
        { id: 'health-2', text: 'Limit Deliveroo to one order a week — eat intentionally otherwise' },
        { id: 'health-3', text: 'Get to the gym three times a week' },
        { id: 'health-4', text: 'Hold a floor of 7,000 steps a day' },
        { id: 'health-5', text: 'Go back to therapy — book the first session' },
        { id: 'health-6', text: "Write down what I'm grateful for once a week" },
      ],
    },
    {
      id: 'wealth',
      number: 'II',
      name: 'Wealth',
      color: 'var(--wealth)',
      description: "Get strategic guidance and find a financial advisor by December, up my investments to 2,000/month, align with advisor on strategy to diversify portfolio and identify long term wealth strategy.",
      actions: [
        { id: 'wealth-1', text: 'Find and hire a financial advisor by December' },
        { id: 'wealth-2', text: 'Cap my checking account at a set number' },
      ],
    },
    {
      id: 'career',
      number: 'III',
      name: 'Career',
      color: 'var(--career)',
      description: "Leave Databricks by next December with a clear vision for what I want from my career, backed by stronger public speaking and communication skills.",
      actions: [
        { id: 'career-1', text: 'Sign up for a public speaking class by December' },
        { id: 'career-2', text: 'Start researching the companies I want to move into by the end of March' },
        { id: 'career-3', text: 'Talk to more recruiters and respond to my LinkedIn messages' },
        { id: 'career-4', text: 'Sign up with a life coach by December to work on limiting beliefs' },
      ],
    },
    {
      id: 'spirituality',
      number: 'IV',
      name: 'Spirituality',
      color: 'var(--spirituality)',
      description: "Deepen my spiritual life by attending church twice a month, praying more, and expressing gratitude regularly.",
      actions: [
        { id: 'spirituality-1', text: 'Research churches and pick one to visit on 25 Oct' },
      ],
    },
    {
      id: 'hobbies',
      number: 'V',
      name: 'Hobbies & Fun',
      color: 'var(--hobbies)',
      description: "Make more room for fun by trying different hobbies for the enjoyment rather than to be good at them, doing something outside my comfort zone once a month, filling more weeknights with plans, and travelling with intention.",
      actions: [
        { id: 'hobbies-1', text: 'Try one new thing every month' },
        { id: 'hobbies-2', text: 'Do something during the week, Mon–Thurs, every week' },
      ],
    },
    {
      id: 'creative',
      number: 'VI',
      name: 'Creative',
      color: 'var(--creative)',
      description: "Build my personal brand with intention and a tech social platform to niche into.",
      actions: [
        { id: 'creative-1', text: 'Personal brand — post one TikTok every month' },
        { id: 'creative-2', text: 'Tech influencer — four hours a week, from w/c 10 Oct' },
      ],
    },
  ],
  lifeAudits: [
    {
      id: 'audit-1',
      label: 'Life Audit 01',
      defaultDate: '2026-10-28',
      milestones: [
        { id: 'a1-health', category: 'Health', text: "Stuck to one Deliveroo a week, with each other's orders audited as proof, and 12 workout classes completed." },
        { id: 'a1-wealth', category: 'Wealth', text: 'A monthly fun budget set and stuck to.' },
        { id: 'a1-career', category: 'Career', text: 'Signed up with a life coach.' },
        { id: 'a1-spirituality', category: 'Spirituality', text: 'Pick a church for the 25 October session.' },
        { id: 'a1-hobbies', category: 'Hobbies & Fun', text: 'Made it to salsa class on the 19th, and picked one new hobby to try in October.' },
        { id: 'a1-creative', category: 'Creative', text: 'Posted on the personal brand TikTok, created the Cynthia Tech Talks account, and established the CTT TikTok strategy.' },
      ],
    },
    { id: 'audit-2', label: 'Life Audit 02', defaultDate: '2026-11-25', milestones: [] },
    { id: 'audit-3', label: 'Life Audit 03', defaultDate: '2026-12-28', milestones: [] },
  ],
};

const MOODS = {
  rough: '😞', meh: '😐', okay: '🙂', good: '😊', glowing: '🤩',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function defaultState() {
  return {
    actions: {},       // { actionId: { done: bool, note: string } }
    evidence: {},       // { pillarId: [ { id, title, description, link, date } ] }
    milestones: {},     // { milestoneId: { done: bool } }
    customMilestones: {}, // { auditId: [ { id, category, text } ] }
    auditDates: {},      // { auditId: 'YYYY-MM-DD' }
    journal: [],         // [ { id, date, mood, wins, feelings, gratitude, createdAt } ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    console.warn('Could not load saved data, starting fresh.', e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('Could not save your data — your browser storage may be full or blocked.');
  }
}

let state = loadState();

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function mostRecentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

function actionState(actionId) {
  return state.actions[actionId] || { done: false, note: '' };
}

function pillarProgress(pillar) {
  const total = pillar.actions.length;
  const done = pillar.actions.filter((a) => actionState(a.id).done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function overallProgress() {
  let done = 0, total = 0;
  for (const pillar of PLAN.pillars) {
    total += pillar.actions.length;
    done += pillar.actions.filter((a) => actionState(a.id).done).length;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

function goToPillarsTab(pillarId) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="pillars"]').classList.add('active');
  document.getElementById('tab-pillars').classList.add('active');
  renderPillars(pillarId);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function renderDashboard() {
  const overall = overallProgress();
  const ring = document.getElementById('overall-ring');
  const circumference = 2 * Math.PI * 52;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference - (overall.pct / 100) * circumference;
  document.getElementById('overall-percent').textContent = overall.pct + '%';
  document.getElementById('overall-summary').textContent = `${overall.done} of ${overall.total} actions done across all six pillars.`;

  // Next audit
  const upcoming = PLAN.lifeAudits
    .map((a) => ({ audit: a, date: state.auditDates[a.id] || a.defaultDate }))
    .filter((x) => x.date)
    .map((x) => ({ ...x, diff: daysUntil(x.date) }))
    .sort((a, b) => a.diff - b.diff);
  const nextBody = document.getElementById('next-audit-body');
  const future = upcoming.filter((x) => x.diff >= 0);
  if (future.length) {
    const n = future[0];
    nextBody.innerHTML = `<strong>${escapeHtml(n.audit.label)}</strong><br>${formatDate(n.date)}<br><span style="color:var(--accent);font-weight:700;">${n.diff === 0 ? 'Today!' : n.diff + ' day' + (n.diff === 1 ? '' : 's') + ' away'}</span>`;
  } else if (upcoming.length) {
    const last = upcoming[upcoming.length - 1];
    nextBody.innerHTML = `All audits so far have passed.<br>Most recent: <strong>${escapeHtml(last.audit.label)}</strong> (${formatDate(last.date)})`;
  } else {
    nextBody.innerHTML = 'Set your audit dates on the <strong>Life Audits</strong> tab.';
  }

  // Latest journal
  const journalBody = document.getElementById('latest-journal-body');
  if (state.journal.length) {
    const latest = [...state.journal].sort((a, b) => b.date.localeCompare(a.date))[0];
    journalBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:20px;">${MOODS[latest.mood] || ''}</span>
        <strong>Week of ${formatDate(latest.date)}</strong>
      </div>
      <p style="margin:0;font-size:13px;color:var(--text-muted);">${escapeHtml((latest.feelings || latest.wins || '').slice(0, 140))}${(latest.feelings || latest.wins || '').length > 140 ? '…' : ''}</p>`;
  } else {
    journalBody.innerHTML = 'No entries yet — start your first one on the <strong>Gratitude Journal</strong> tab.';
  }

  // Pillar grid
  const grid = document.getElementById('pillar-progress-grid');
  grid.innerHTML = '';
  for (const pillar of PLAN.pillars) {
    const p = pillarProgress(pillar);
    const card = el('div', {
      class: 'pillar-progress-card',
      style: `--pillar-color:${pillar.color}`,
      onclick: () => goToPillarsTab(pillar.id),
    }, [
      el('h4', {}, `${pillar.number} · ${pillar.name}`),
      el('div', { class: 'progress-bar-track' }, [
        el('div', { class: 'progress-bar-fill', style: `width:${p.pct}%` }),
      ]),
      el('div', { class: 'progress-bar-text' }, `${p.done}/${p.total} actions · ${p.pct}%`),
    ]);
    grid.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Pillars tab
// ---------------------------------------------------------------------------

let activePillarId = PLAN.pillars[0].id;

function renderPillarNav() {
  const nav = document.getElementById('pillar-nav');
  nav.innerHTML = '';
  for (const pillar of PLAN.pillars) {
    const btn = el('button', {
      class: 'pillar-nav-btn' + (pillar.id === activePillarId ? ' active' : ''),
      style: `--pillar-color:${pillar.color}`,
      onclick: () => renderPillars(pillar.id),
    }, `${pillar.number} · ${pillar.name}`);
    nav.appendChild(btn);
  }
}

function renderPillars(pillarId) {
  activePillarId = pillarId || activePillarId;
  renderPillarNav();

  const pillar = PLAN.pillars.find((p) => p.id === activePillarId);
  const detail = document.getElementById('pillar-detail');
  detail.innerHTML = '';

  detail.appendChild(el('div', { class: 'pillar-header' }, [
    el('div', { class: 'pillar-number', style: `--pillar-color:${pillar.color};background:${pillar.color}` }, pillar.number),
    el('div', {}, [
      el('h2', {}, pillar.name),
      el('p', {}, pillar.description),
    ]),
  ]));

  const list = el('div', { class: 'action-list' });
  for (const action of pillar.actions) {
    list.appendChild(renderActionItem(pillar, action));
  }
  detail.appendChild(list);

  detail.appendChild(renderEvidenceSection(pillar));
}

function renderActionItem(pillar, action) {
  const st = actionState(action.id);
  const item = el('div', { class: 'action-item' + (st.done ? ' done' : '') });

  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = !!st.done;
  checkbox.addEventListener('change', () => {
    if (!state.actions[action.id]) state.actions[action.id] = { done: false, note: '' };
    state.actions[action.id].done = checkbox.checked;
    saveState();
    item.classList.toggle('done', checkbox.checked);
    renderDashboard();
  });

  const text = el('span', { class: 'action-text', onclick: () => checkbox.click() }, action.text);

  const main = el('div', { class: 'action-main' }, [checkbox, text]);
  item.appendChild(main);

  const noteToggle = el('button', { class: 'action-note-toggle', style: 'margin-top:8px;' }, st.note ? 'Edit note' : '+ Add note');
  item.appendChild(noteToggle);

  const noteArea = el('textarea', {
    class: 'action-note',
    placeholder: 'Notes, context, how it went...',
    hidden: st.note ? null : 'hidden',
    rows: 2,
  });
  noteArea.value = st.note || '';
  if (st.note) noteArea.removeAttribute('hidden');
  item.appendChild(noteArea);

  noteToggle.addEventListener('click', () => {
    noteArea.hidden = !noteArea.hidden;
    if (!noteArea.hidden) noteArea.focus();
  });

  noteArea.addEventListener('input', () => {
    if (!state.actions[action.id]) state.actions[action.id] = { done: st.done, note: '' };
    state.actions[action.id].note = noteArea.value;
    saveState();
    noteToggle.textContent = noteArea.value ? 'Edit note' : '+ Add note';
  });

  return item;
}

function renderEvidenceSection(pillar) {
  const wrap = el('div', { class: 'evidence-section' });
  wrap.appendChild(el('h3', {}, 'Evidence of achievements'));
  wrap.appendChild(el('p', { class: 'hint' }, `Screenshots aren't stored here, but link to them (e.g. a photo in your cloud drive) or just describe the proof — a receipt, a class completed, a message sent.`));

  const list = el('div', { class: 'evidence-list' });
  const entries = (state.evidence[pillar.id] || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!entries.length) {
    list.appendChild(el('div', { class: 'empty-state' }, 'No evidence logged yet for this pillar.'));
  } else {
    for (const ev of entries) {
      list.appendChild(renderEvidenceItem(pillar, ev));
    }
  }
  wrap.appendChild(list);

  wrap.appendChild(renderEvidenceForm(pillar));
  return wrap;
}

function renderEvidenceItem(pillar, ev) {
  const item = el('div', { class: 'evidence-item', style: `--pillar-color:${pillar.color}` });
  item.appendChild(el('div', { class: 'evidence-item-top' }, [
    el('h5', {}, ev.title || 'Untitled'),
    el('span', { class: 'evidence-date' }, formatDate(ev.date)),
  ]));
  if (ev.description) item.appendChild(el('p', {}, ev.description));
  if (ev.link) {
    const a = el('a', { href: ev.link, target: '_blank', rel: 'noopener noreferrer' }, ev.link);
    item.appendChild(el('div', { style: 'margin-top:6px;' }, a));
  }
  const del = el('button', { class: 'btn btn-ghost btn-small btn-danger' }, 'Delete');
  del.addEventListener('click', () => {
    state.evidence[pillar.id] = (state.evidence[pillar.id] || []).filter((e) => e.id !== ev.id);
    saveState();
    renderPillars(pillar.id);
  });
  item.appendChild(el('div', { class: 'row-actions' }, del));
  return item;
}

function renderEvidenceForm(pillar) {
  const form = el('form', { class: 'evidence-form' });
  const title = el('input', { type: 'text', placeholder: 'Title — e.g. "12th gym class completed"', required: 'required' });
  const date = el('input', { type: 'date' });
  date.value = new Date().toISOString().slice(0, 10);
  const desc = el('textarea', { rows: 2, placeholder: 'Details (optional)' });
  const link = el('input', { type: 'url', placeholder: 'Link to proof — photo, post, confirmation email (optional)' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary btn-small' }, '+ Log evidence');

  form.appendChild(el('label', {}, ['Add new evidence']));
  form.appendChild(title);
  form.appendChild(date);
  form.appendChild(desc);
  form.appendChild(link);
  form.appendChild(el('div', { class: 'form-actions' }, submit));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!title.value.trim()) return;
    if (!state.evidence[pillar.id]) state.evidence[pillar.id] = [];
    state.evidence[pillar.id].push({
      id: uid(),
      title: title.value.trim(),
      date: date.value || new Date().toISOString().slice(0, 10),
      description: desc.value.trim(),
      link: link.value.trim(),
    });
    saveState();
    renderPillars(pillar.id);
  });

  return form;
}

// ---------------------------------------------------------------------------
// Life Audits tab
// ---------------------------------------------------------------------------

function allMilestonesFor(audit) {
  const custom = (state.customMilestones[audit.id] || []);
  return [...audit.milestones, ...custom];
}

function renderAudits() {
  const wrap = document.getElementById('audits-list');
  wrap.innerHTML = '';
  for (const audit of PLAN.lifeAudits) {
    wrap.appendChild(renderAuditCard(audit));
  }
}

function renderAuditCard(audit) {
  const card = el('div', { class: 'card audit-card' });

  const dateInput = el('input', { type: 'date', class: 'audit-date-input' });
  dateInput.value = state.auditDates[audit.id] || audit.defaultDate || '';
  const countdown = el('span', { class: 'audit-countdown' });

  function updateCountdown() {
    const d = daysUntil(dateInput.value);
    if (d === null) { countdown.textContent = ''; return; }
    countdown.textContent = d === 0 ? 'Today' : d > 0 ? `${d} day${d === 1 ? '' : 's'} to go` : `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
  }
  updateCountdown();

  dateInput.addEventListener('change', () => {
    state.auditDates[audit.id] = dateInput.value;
    saveState();
    updateCountdown();
    renderDashboard();
  });

  const top = el('div', { class: 'audit-card-top' }, [
    el('h3', {}, audit.label),
    el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [dateInput, countdown]),
  ]);
  card.appendChild(top);
  if (dateInput.value) {
    card.appendChild(el('p', { class: 'hint', style: 'margin-top:-6px;' }, formatDate(dateInput.value)));
  }

  const list = el('div', { class: 'milestone-list' });
  const items = allMilestonesFor(audit);
  if (!items.length) {
    list.appendChild(el('div', { class: 'empty-state' }, 'No checkpoints yet — add what you want to hold yourself to below.'));
  } else {
    for (const m of items) {
      list.appendChild(renderMilestoneItem(audit, m));
    }
  }
  card.appendChild(list);

  const addRow = el('form', { class: 'add-milestone-row' });
  const input = el('input', { type: 'text', placeholder: 'Add your own checkpoint...' });
  const catSelect = el('select', { style: 'border:1px solid var(--border);border-radius:8px;padding:8px 6px;background:var(--bg);color:var(--text);font-size:13px;' });
  ['Health', 'Wealth', 'Career', 'Spirituality', 'Hobbies & Fun', 'Creative', 'General'].forEach((c) => {
    catSelect.appendChild(el('option', { value: c }, c));
  });
  catSelect.value = 'General';
  const addBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-small' }, 'Add');
  addRow.appendChild(catSelect);
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  addRow.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    if (!state.customMilestones[audit.id]) state.customMilestones[audit.id] = [];
    state.customMilestones[audit.id].push({ id: uid(), category: catSelect.value, text: input.value.trim() });
    saveState();
    renderAudits();
  });
  card.appendChild(addRow);

  return card;
}

function renderMilestoneItem(audit, milestone) {
  const st = state.milestones[milestone.id] || { done: false };
  const isCustom = (state.customMilestones[audit.id] || []).some((m) => m.id === milestone.id);

  const item = el('div', { class: 'milestone-item' + (st.done ? ' done' : '') });
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = !!st.done;
  checkbox.addEventListener('change', () => {
    state.milestones[milestone.id] = { done: checkbox.checked };
    saveState();
    item.classList.toggle('done', checkbox.checked);
  });
  item.appendChild(checkbox);

  const label = el('span', { class: 'milestone-text' }, [
    milestone.category ? el('span', { class: 'milestone-category' }, milestone.category) : null,
    milestone.text,
  ]);
  item.appendChild(label);

  if (isCustom) {
    const remove = el('button', { class: 'milestone-remove', title: 'Remove' }, '✕');
    remove.addEventListener('click', () => {
      state.customMilestones[audit.id] = state.customMilestones[audit.id].filter((m) => m.id !== milestone.id);
      delete state.milestones[milestone.id];
      saveState();
      renderAudits();
    });
    item.appendChild(remove);
  }

  return item;
}

// ---------------------------------------------------------------------------
// Gratitude Journal tab
// ---------------------------------------------------------------------------

let editingJournalId = null;
let selectedMood = 'okay';

function setupJournalForm() {
  const dateInput = document.getElementById('journal-date');
  dateInput.value = mostRecentMonday();

  document.querySelectorAll('.mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMood = btn.dataset.mood;
      document.querySelectorAll('.mood-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  document.querySelector(`.mood-btn[data-mood="${selectedMood}"]`).classList.add('selected');

  document.getElementById('journal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const wins = document.getElementById('journal-wins').value.trim();
    const feelings = document.getElementById('journal-feelings').value.trim();
    const gratitude = document.getElementById('journal-gratitude').value.trim();
    const date = dateInput.value || mostRecentMonday();

    if (editingJournalId) {
      const entry = state.journal.find((j) => j.id === editingJournalId);
      Object.assign(entry, { date, mood: selectedMood, wins, feelings, gratitude });
    } else {
      state.journal.push({ id: uid(), date, mood: selectedMood, wins, feelings, gratitude, createdAt: Date.now() });
    }
    saveState();
    resetJournalForm();
    renderJournalList();
    renderDashboard();
  });

  document.getElementById('journal-cancel-edit').addEventListener('click', resetJournalForm);
}

function resetJournalForm() {
  editingJournalId = null;
  document.getElementById('journal-form').reset();
  document.getElementById('journal-date').value = mostRecentMonday();
  selectedMood = 'okay';
  document.querySelectorAll('.mood-btn').forEach((b) => b.classList.remove('selected'));
  document.querySelector('.mood-btn[data-mood="okay"]').classList.add('selected');
  document.getElementById('journal-submit').textContent = 'Save entry';
  document.getElementById('journal-cancel-edit').hidden = true;
}

function startEditJournal(entry) {
  editingJournalId = entry.id;
  document.getElementById('journal-date').value = entry.date;
  document.getElementById('journal-wins').value = entry.wins || '';
  document.getElementById('journal-feelings').value = entry.feelings || '';
  document.getElementById('journal-gratitude').value = entry.gratitude || '';
  selectedMood = entry.mood || 'okay';
  document.querySelectorAll('.mood-btn').forEach((b) => b.classList.toggle('selected', b.dataset.mood === selectedMood));
  document.getElementById('journal-submit').textContent = 'Update entry';
  document.getElementById('journal-cancel-edit').hidden = false;
  document.getElementById('journal-form').scrollIntoView({ behavior: 'smooth' });
}

function renderJournalList() {
  const wrap = document.getElementById('journal-list');
  wrap.innerHTML = '';
  const entries = [...state.journal].sort((a, b) => b.date.localeCompare(a.date));
  if (!entries.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, 'No entries yet. Your first weekly reflection starts above.'));
    return;
  }
  for (const entry of entries) {
    wrap.appendChild(renderJournalEntry(entry));
  }
}

function renderJournalEntry(entry) {
  const card = el('div', { class: 'card journal-entry' });
  card.appendChild(el('div', { class: 'journal-entry-top' }, [
    el('h4', {}, `Week of ${formatDate(entry.date)}`),
    el('span', { class: 'journal-mood-emoji' }, MOODS[entry.mood] || ''),
  ]));
  if (entry.wins) {
    card.appendChild(el('div', { class: 'field-label' }, "Proud of"));
    card.appendChild(el('p', {}, entry.wins));
  }
  if (entry.feelings) {
    card.appendChild(el('div', { class: 'field-label' }, 'How I genuinely feel'));
    card.appendChild(el('p', {}, entry.feelings));
  }
  if (entry.gratitude) {
    card.appendChild(el('div', { class: 'field-label' }, 'Grateful for'));
    card.appendChild(el('p', {}, entry.gratitude));
  }

  const editBtn = el('button', { class: 'btn btn-ghost btn-small' }, 'Edit');
  editBtn.addEventListener('click', () => startEditJournal(entry));
  const delBtn = el('button', { class: 'btn btn-ghost btn-small btn-danger' }, 'Delete');
  delBtn.addEventListener('click', () => {
    if (!confirm('Delete this journal entry?')) return;
    state.journal = state.journal.filter((j) => j.id !== entry.id);
    saveState();
    renderJournalList();
    renderDashboard();
  });
  card.appendChild(el('div', { class: 'row-actions' }, [editBtn, delBtn]));

  return card;
}

// ---------------------------------------------------------------------------
// Export / Import / Reset
// ---------------------------------------------------------------------------

function setupDataControls() {
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glow-up-plan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!confirm('Import this backup? It will replace your current progress in this browser.')) return;
        state = Object.assign(defaultState(), imported);
        saveState();
        renderAll();
      } catch (err) {
        alert('That file could not be read as a valid backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset ALL progress, notes, evidence, and journal entries? This cannot be undone (export a backup first if unsure).')) return;
    state = defaultState();
    saveState();
    renderAll();
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function renderAll() {
  renderDashboard();
  renderPillars(activePillarId);
  renderAudits();
  renderJournalList();
}

function init() {
  setupTabs();
  setupJournalForm();
  setupDataControls();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
