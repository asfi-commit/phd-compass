(() => {
  'use strict';

  const STORE = 'phd_compass_v1';
  const CATS = {
    Research: { icon: '⌁', label: 'Research', color: 'blue' },
    Learning: { icon: '▧', label: 'ML / DL', color: 'purple' },
    Lab: { icon: '◈', label: 'Lab / class', color: 'gold' },
    Fitness: { icon: '♡', label: 'Fitness', color: 'green' }
  };
  const PAGES = [
    ['today', '⌂', 'Today'],
    ['calendar', '▦', 'Calendar'],
    ['projects', '◇', 'Projects'],
    ['learning', '▤', 'Learning'],
    ['insights', '◔', 'Insights']
  ];
  const STATUSES = ['Not Started', 'In Progress', 'Done', 'Blocked', 'Skipped'];
  const seed = window.PHD_SEED || { tasks: [], milestones: [], schedule: [], dailyNotes: {} };

  let state = load();
  let ui = {
    page: 'today',
    date: localTodayIST(),
    month: localTodayIST().slice(0, 7),
    project: 'All',
    courseWeek: 'All'
  };
  let toastTimer = null;
  let lastFocusedEl = null;

  function normalizeState(s) {
    const fallback = structuredClone(seed);
    if (!s || typeof s !== 'object') return fallback;
    return {
      version: s.version || 1,
      source: s.source || fallback.source,
      tasks: Array.isArray(s.tasks) ? s.tasks : fallback.tasks,
      milestones: Array.isArray(s.milestones) ? s.milestones : fallback.milestones,
      schedule: Array.isArray(s.schedule) && s.schedule.length ? s.schedule : fallback.schedule,
      dailyNotes: s.dailyNotes && typeof s.dailyNotes === 'object' ? s.dailyNotes : {},
      theme: s.theme || 'light'
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.milestones)) {
          return normalizeState(parsed);
        }
      }
    } catch (e) {
      // Ignore storage read errors and fall back to seed
    }
    return normalizeState(null);
  }

  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      return true;
    } catch (e) {
      showToast('Storage unavailable; export a backup to keep changes.');
      return false;
    }
  }

  function todayPart(dt) {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(dt);
    const out = Object.fromEntries(p.map(x => [x.type, x.value]));
    return `${out.year}-${out.month}-${out.day}`;
  }

  function localTodayIST() {
    return todayPart(new Date());
  }

  function dateObj(s) {
    return new Date(s + 'T12:00:00');
  }

  function fmtDate(s, opts) {
    if (!s) return '';
    const d = dateObj(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleDateString('en-IN', opts || {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function dayName(s) {
    return dateObj(s).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function dateMove(s, n) {
    const d = dateObj(s);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }

  function monthMove(m, n) {
    const d = new Date(m + '-15T12:00:00');
    d.setMonth(d.getMonth() + n);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}`;
  }

  function z(n) {
    return String(n).padStart(2, '0');
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function eAttr(v) {
    return esc(v);
  }

  function cleanText(v) {
    return String(v || '').slice(0, 2000).trim();
  }

  function safeLink(url) {
    const trimmed = String(url || '').trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
  }

  function pct(doneCount, total) {
    return total ? Math.round((doneCount / total) * 100) : 0;
  }

  function done(items) {
    return items.filter(x => x.status === 'Done').length;
  }

  function activeItems(items) {
    return items.filter(x => x.status !== 'Skipped');
  }

  function catOrder(c) {
    const idx = ['Research', 'Learning', 'Lab', 'Fitness'].indexOf(c);
    return idx === -1 ? 99 : idx;
  }

  function dayTasks(date) {
    return state.tasks
      .filter(x => x.date === date)
      .sort((a, b) => {
        const aSkip = a.status === 'Skipped' ? 1 : 0;
        const bSkip = b.status === 'Skipped' ? 1 : 0;
        if (aSkip !== bSkip) return aSkip - bSkip;
        return catOrder(a.category) - catOrder(b.category);
      });
  }

  function relevantTasks(date) {
    return dayTasks(date).filter(x => x.status !== 'Skipped');
  }

  function monthTasks(m) {
    return state.tasks.filter(x => x.date.startsWith(m) && x.status !== 'Skipped');
  }

  function progress(items) {
    const active = activeItems(items);
    return pct(done(active), active.length);
  }

  function time(min) {
    const total = Number(min) || 0;
    if (!total) return '0m';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
  }

  function dateIsOverdue(s) {
    return s < localTodayIST();
  }

  function showToast(s) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = s;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2700);
  }

  function updateNav() {
    const page = ui.page;
    const html = PAGES.map(([key, ico, name]) =>
      `<button type="button" data-action="nav" data-page="${key}" aria-label="${name}" ${page === key ? 'aria-current="page"' : ''} class="${page === key ? 'active' : ''}"><span class="nav-ico" aria-hidden="true">${ico}</span><span>${name}</span></button>`
    ).join('');
    document.getElementById('bottom-nav').innerHTML = html;
    document.getElementById('desktop-nav').innerHTML = html;
    const monthLabel = fmtDate(ui.month + '-01', { month: 'long', year: 'numeric' }).toUpperCase();
    document.getElementById('top-context').textContent = `${monthLabel} · RESEARCH & LEARNING`;
  }

  function setPage(page) {
    ui.page = page;
    if (location.hash.replace('#', '') !== page) {
      location.hash = page;
    }
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function render(keepScroll = false) {
    const prev = window.scrollY;
    updateNav();
    let html = '';
    if (ui.page === 'today') html = homeView();
    else if (ui.page === 'calendar') html = calendarView();
    else if (ui.page === 'projects') html = projectView();
    else if (ui.page === 'learning') html = learningView();
    else if (ui.page === 'insights') html = insightsView();
    else if (ui.page === 'settings') html = settingsView();

    const fab = (ui.page === 'today' || ui.page === 'calendar')
      ? '<button type="button" class="fab" title="Add a task" aria-label="Add a task" data-action="add-task">+</button>'
      : '';
    document.getElementById('view').innerHTML = html + fab;
    if (keepScroll) {
      window.scrollTo({ top: prev, behavior: 'instant' });
    }
  }

  function statCard(label, value, sub, ico) {
    return `<div class="stat"><div class="stat-label">${ico} ${esc(label)}</div><div class="stat-number">${esc(value)}</div><div class="stat-sub">${esc(sub)}</div></div>`;
  }

  function homeView() {
    const date = ui.date;
    const activeDay = relevantTasks(date);
    const monthly = monthTasks(date.slice(0, 7));
    const d = done(activeDay);
    const mProgress = progress(monthly);
    const upcoming = state.milestones
      .filter(m => m.status !== 'Done' && m.status !== 'Skipped')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 2);
    const learned = monthly.filter(t => t.category === 'Learning');
    const fitness = monthly.filter(t => t.category === 'Fitness');
    const quote = date === localTodayIST()
      ? 'Today is a good day to make one thing measurable.'
      : 'Focus on progress, not perfection.';

    return `<section class="hero"><span class="eyebrow">Your personal research space</span><h1>Make steady progress.<br>One day at a time.</h1><p>${quote} Your plan is ready — simply check off what you finish and record the evidence.</p><div class="hero-bottom"><div class="hero-date">◷ <strong>${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div><span class="pill white">✳ No subscription · Private</span></div></section>
<div class="stats">${statCard('Today done', `${d}/${activeDay.length}`, `${progress(activeDay)}% complete`, '✓')}${statCard('Month completed', `${mProgress}%`, 'Scheduled activities', '▤')}${statCard('Course lessons', `${done(learned)}/${learned.length}`, 'ML / DL this month', '▧')}${statCard('Fitness days', `${done(fitness)}`, 'Completed sessions', '♡')}</div>
<div class="date-picker-line"><div><div class="eyebrow">Daily focus</div><h2 class="day-heading">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p class="category-count">${activeDay.length ? `${d} of ${activeDay.length} tasks complete` : 'No scheduled tasks'}</p></div><div class="date-nav"><button class="nav-square" type="button" data-action="day-prev" aria-label="Previous day">‹</button><button class="nav-square" type="button" data-action="day-next" aria-label="Next day">›</button></div></div>
${dailyTasksHtml(date)}
<div class="inline-grid"><section><div class="section-heading"><div><h2>Daily research note</h2><p>What worked? What should you do next?</p></div></div><div class="card"><textarea class="notes-field" data-day-note="${date}" placeholder="Example: Completed baseline script; next, compare gap-length MAE...">${esc((state.dailyNotes || {})[date] || '')}</textarea><p class="tip-line">Auto-saved on this device as you type.</p></div></section><section><div class="section-heading"><div><h2>Next milestones</h2><p>Keep deliverables visible</p></div><button class="subtle-btn" data-action="nav" data-page="projects">See all →</button></div>${upcoming.length ? upcoming.map(m => `<div class="project-card" style="margin-bottom:8px"><span class="pill ${m.project.includes('Missing') ? 'green' : m.project.includes('placement') ? 'purple' : 'blue'}">${esc(m.project)}</span><div class="project-title">${esc(m.title)}</div><span class="tiny muted">Due ${fmtDate(m.date, { day: 'numeric', month: 'short' })}</span></div>`).join('') : '<div class="empty">All milestones complete!</div>'}</section></div>
<section><div class="section-heading"><div><h2>Day rhythm</h2><p>Suggested hours — adjust for classes and travel</p></div></div><div class="card"><div class="schedule-list">${scheduleRows(date)}</div></div></section><div class="footer-note">All progress stays on this device. Use Settings to export a backup.</div>`;
  }

  function dailyTasksHtml(date) {
    const list = dayTasks(date);
    if (!list.length) {
      return `<div class="empty" style="margin-top:16px"><div class="empty-symbol">☀</div><h3>Your schedule is clear</h3><p>Enjoy a recovery day, or add a one-off task if something needs attention.</p><button class="primary-btn" data-action="add-task">+ Add a task</button></div>`;
    }
    return `<div class="section-heading"><div><h2>Today's checklist</h2><p>Mark done or tap ••• to edit status and actual time</p></div><button class="subtle-btn" data-action="add-task">+ Add</button></div><div class="task-list">${list.map(taskCard).join('')}</div>`;
  }

  function taskCard(t) {
    const c = CATS[t.category] || CATS.Research;
    const statusClass = t.status === 'Done' ? 'completed' : t.status === 'Blocked' ? 'blocked' : t.status === 'Skipped' ? 'skipped' : '';
    const statusLabel = t.status === 'Done' ? 'Completed' : t.status === 'Blocked' ? 'Blocked' : t.status === 'In Progress' ? 'In progress' : t.status === 'Skipped' ? 'Skipped' : 'Planned';
    const subText = t.notes || t.practice || '';
    const link = safeLink(t.evidence);
    const timeMeta = t.minutes
      ? `<span class="dot"></span><span>${time(t.minutes)} logged</span>`
      : t.targetMinutes
        ? `<span class="dot"></span><span>Plan: ${time(t.targetMinutes)}</span>`
        : '';

    return `<div class="task-card ${statusClass}"><button type="button" class="task-check" data-action="toggle-task" data-id="${eAttr(t.id)}" aria-label="${t.status === 'Done' ? 'Mark incomplete' : 'Mark completed'}: ${eAttr(t.title)}" aria-pressed="${t.status === 'Done'}">✓</button><span class="task-icon ${c === CATS.Research ? 'Research' : eAttr(t.category)}" aria-hidden="true">${c.icon}</span><div class="task-body"><strong>${esc(t.title)}</strong>${subText ? `<div class="task-sub">${esc(subText)}</div>` : ''}<div class="task-meta"><span>${esc(c.label)}</span><span class="dot"></span><span>${statusLabel}</span>${timeMeta}${link ? `<span class="dot"></span><a href="${eAttr(link)}" target="_blank" rel="noopener noreferrer">Evidence ↗</a>` : ''}</div></div><button type="button" class="task-more" data-action="edit-task" data-id="${eAttr(t.id)}" aria-label="Edit ${eAttr(t.title)}">•••</button></div>`;
  }

  function scheduleRows(date) {
    const day = dayName(date);
    const typ = day === 'Sat' ? 'Saturday' : day === 'Sun' ? 'Sunday' : ['Mon', 'Wed', 'Fri'].includes(day) ? 'Mon / Wed / Fri' : 'Tue / Thu';
    return state.schedule
      .filter(x => x.pattern === typ)
      .map(x => `<div class="schedule-row"><div class="schedule-time">${esc(x.start)}${x.start !== 'Any' ? `–${esc(x.end)}` : ''}</div><div><strong>${esc(x.title)}</strong>${x.location && x.location !== '—' ? `<p>${esc(x.location)}${x.hint ? ' · ' + esc(x.hint) : ''}</p>` : ''}</div></div>`)
      .join('') || '<p class="muted small">No template for this day.</p>';
  }

  function calendarGrid(month) {
    const first = new Date(month + '-01T12:00:00');
    const off = (first.getDay() + 6) % 7;
    const year = first.getFullYear();
    const mo = first.getMonth();
    const days = new Date(year, mo + 1, 0).getDate();
    const cells = [];
    const totalCells = Math.ceil((off + days) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const num = i - off + 1;
      const day = new Date(year, mo, num, 12);
      const ds = `${day.getFullYear()}-${z(day.getMonth() + 1)}-${z(day.getDate())}`;
      const t = relevantTasks(ds);
      const p = progress(t);
      const outside = day.getMonth() !== mo;
      cells.push(`<button type="button" data-action="select-date" data-date="${ds}" class="date-cell ${outside ? 'outside' : ''} ${ds === ui.date ? 'selected' : ''} ${ds === localTodayIST() ? 'today' : ''}" aria-label="${fmtDate(ds)}; ${t.length} activities; ${p}% completed" ${ds === ui.date ? 'aria-current="date"' : ''}><span class="num">${day.getDate()}</span>${t.length ? `<span class="cal-progress"><span style="width:${p}%"></span></span>` : '<span class="cal-progress none"><span></span></span>'}</button>`);
    }
    return cells.join('');
  }

  function calendarView() {
    const date = ui.date;
    const allDay = dayTasks(date);
    const activeDay = relevantTasks(date);
    return `<div class="section-heading" style="margin-top:4px"><div><span class="eyebrow">Plan & progress</span><h2>Monthly calendar</h2><p>Tap a date to see and update activities</p></div><button class="secondary-btn" data-action="calendar-today">Today</button></div><div class="calendar"><div class="calendar-header"><h2>${fmtDate(ui.month + '-01', { month: 'long', year: 'numeric' })}</h2><div class="date-nav"><button class="nav-square" data-action="month-prev" aria-label="Previous month">‹</button><button class="nav-square" data-action="month-next" aria-label="Next month">›</button></div></div><div class="calendar-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span class="weekday">${x}</span>`).join('')}${calendarGrid(ui.month)}</div><div class="tip-line">Blue outline = selected day · Green bar = completed share · Rest days have no mandatory tasks.</div></div><div class="section-heading"><div><h2>${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'long' })}</h2><p>${activeDay.length} planned activities</p></div><button class="subtle-btn" data-action="add-task">+ Add task</button></div>${allDay.length ? `<div class="task-list">${allDay.map(taskCard).join('')}</div>` : `<div class="empty"><h3>No planned activities</h3><p>Enjoy the break or add something useful.</p></div>`}<div class="section-heading"><div><h2>Today's schedule</h2><p>Flexible class and lab timetable</p></div></div><div class="card"><div class="schedule-list">${scheduleRows(date)}</div></div>`;
  }

  function projectView() {
    const projects = ['All', ...new Set(state.milestones.map(x => x.project))];
    const ms = state.milestones
      .filter(m => ui.project === 'All' || m.project === ui.project)
      .sort((a, b) => a.date.localeCompare(b.date));
    const activeMs = activeItems(state.milestones);
    const monthMs = activeMs.filter(m => m.date.startsWith(ui.month));

    return `<div class="section-heading" style="margin-top:4px"><div><span class="eyebrow">Research pipeline</span><h2>Project milestones</h2><p>Link deliverables, not just hours</p></div><button class="primary-btn" data-action="add-milestone">+ New</button></div><div class="stats">${statCard('Completed', `${done(activeMs)}/${activeMs.length}`, 'Across projects', '✓')}${statCard('This month', `${done(monthMs)}/${monthMs.length}`, fmtDate(ui.month + '-01', { month: 'short', year: 'numeric' }), '◷')}</div><div class="filter-tabs">${projects.map(p => `<button class="filter-btn ${ui.project === p ? 'active' : ''}" data-action="filter-project" data-project="${eAttr(p)}">${esc(p)}</button>`).join('')}</div><div>${ms.length ? ms.map(m => {
      const d = m.status === 'Done';
      const css = m.project.includes('Missing') ? 'green' : m.project.includes('placement') ? 'purple' : 'blue';
      const statusBadge = d ? 'green' : m.status === 'Blocked' ? 'red' : m.status === 'In Progress' ? 'gold' : 'gray';
      const overdue = !d && m.status !== 'Skipped' && dateIsOverdue(m.date);
      return `<article class="project-card"><div class="row"><span class="pill ${css}">${esc(m.project)}</span><span class="pill ${statusBadge}">${esc(m.status)}</span></div><h3 class="project-title">${esc(m.title)}</h3><p class="project-output">Expected: ${esc(m.output)}</p>${m.notes ? `<p class="task-sub">${esc(m.notes)}</p>` : ''}<div class="due"><span class="${overdue ? 'overdue-text' : ''}">◷ ${fmtDate(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}${overdue ? ' · Overdue' : ''}</span><span>${esc(m.priority)} priority</span></div>${m.evidence ? `<div class="tiny muted" style="margin-bottom:8px">Evidence: ${safeLink(m.evidence) ? `<a href="${eAttr(safeLink(m.evidence))}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : esc(m.evidence)}</div>` : ''}<div class="project-footer"><span class="small muted"><span class="progress-dot ${d ? 'done' : m.status === 'Blocked' ? 'blocked' : ''}"></span>${d ? 'Deliverable completed' : m.status === 'Skipped' ? 'Skipped' : 'Awaiting deliverable'}</span><div><button class="link-btn" data-action="toggle-milestone" data-id="${eAttr(m.id)}">${d ? 'Reopen' : '✓ Mark done'}</button><button class="link-btn" data-action="edit-milestone" data-id="${eAttr(m.id)}">Edit →</button></div></div></article>`;
    }).join('') : '<div class="empty">No milestones here. Add one to begin.</div>'}</div>`;
  }

  function learningView() {
    const all = state.tasks
      .filter(t => t.category === 'Learning')
      .sort((a, b) => a.date.localeCompare(b.date));
    const activeAll = activeItems(all);
    const filtered = all.filter(t => ui.courseWeek === 'All' || String(weekNumber(t.date)) === String(ui.courseWeek));
    const groups = [...new Set(filtered.map(t => weekNumber(t.date)))].sort((a, b) => a - b);

    return `<div class="section-heading" style="margin-top:4px"><div><span class="eyebrow">Learning lab</span><h2>ML / DL course tracker</h2><p>Python and machine learning fundamentals</p></div><button class="secondary-btn" data-action="add-learning">+ Lesson</button></div><div class="stats">${statCard('Lessons done', `${done(activeAll)}/${activeAll.length}`, 'Course plan', '▧')}${statCard('Hours logged', time(all.reduce((s, t) => s + (Number(t.minutes) || 0), 0)), 'Actual practice time', '◷')}</div><div class="card" style="margin-bottom:17px"><div class="row"><div><strong class="small">Learning progress</strong><p class="tiny muted" style="margin:3px 0 0">A lesson counts when marked Done.</p></div><strong>${progress(activeAll)}%</strong></div><div class="progress-track" style="margin-top:13px"><div class="progress-fill" style="width:${progress(activeAll)}%"></div></div></div><div class="filter-tabs">${['All', 1, 2, 3, 4, 5].map(w => `<button class="filter-btn ${String(ui.courseWeek) === String(w) ? 'active' : ''}" data-action="filter-week" data-week="${w}">${w === 'All' ? 'All lessons' : 'Week ' + w}</button>`).join('')}</div>${groups.map(w => {
      const weekItems = filtered.filter(t => weekNumber(t.date) === w);
      const activeWeek = activeItems(weekItems);
      return `<section class="card" style="margin-bottom:12px"><div class="row" style="margin-bottom:2px"><strong>Week ${w}</strong><span class="tiny muted">${done(activeWeek)} / ${activeWeek.length} done</span></div>${weekItems.map(t => {
        const stepClass = t.status === 'Done' ? 'done' : t.status === 'Blocked' ? 'blocked' : t.status === 'In Progress' ? 'in-progress' : '';
        const stepSymbol = t.status === 'Done' ? '✓' : t.status === 'Blocked' ? '!' : z(Number(t.date.slice(-2)));
        const link = safeLink(t.evidence);
        return `<div class="lesson"><div class="lesson-step ${stepClass}">${stepSymbol}</div><div><strong>${esc(t.title)}</strong><small>${fmtDate(t.date, { day: 'numeric', month: 'short' })}${t.practice ? ' · ' + esc(t.practice) : ''}${t.minutes ? ' · ' + time(t.minutes) + ' logged' : ''}${t.status !== 'Not Started' && t.status !== 'Done' ? ' · ' + esc(t.status) : ''}</small>${t.notes ? `<small>${esc(t.notes)}</small>` : ''}${link ? `<small><a href="${eAttr(link)}" target="_blank" rel="noopener noreferrer">Open notebook / evidence ↗</a></small>` : ''}</div><div class="lesson-actions"><button class="lesson-action" data-action="toggle-task" data-id="${eAttr(t.id)}" title="Toggle completion" aria-label="Toggle ${eAttr(t.title)}">${t.status === 'Done' ? '↶' : '✓'}</button><button class="lesson-action" data-action="edit-task" data-id="${eAttr(t.id)}" title="Edit lesson" aria-label="Edit lesson">•••</button></div></div>`;
      }).join('')}</section>`;
    }).join('') || '<div class="empty">No lessons scheduled.</div>'}<p class="footer-note">Tip: link a notebook or GitHub commit in each lesson's edit screen.</p>`;
  }

  function weekNumber(date) {
    const d = Number(String(date).slice(-2)) || 1;
    return Math.min(5, Math.ceil(d / 7));
  }

  function insightsView() {
    const m = ui.month;
    const ts = monthTasks(m);
    const completed = done(ts);
    const learn = ts.filter(t => t.category === 'Learning');
    const research = ts.filter(t => t.category === 'Research');
    const fitness = ts.filter(t => t.category === 'Fitness');
    const lab = ts.filter(t => t.category === 'Lab');
    const sum = arr => arr.reduce((a, b) => a + (Number(b.minutes) || 0), 0);
    const monthDays = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
    const weeks = [];
    for (let start = 1; start <= monthDays; start += 7) {
      const end = Math.min(monthDays, start + 6);
      const w = ts.filter(t => {
        const d = Number(t.date.slice(-2));
        return d >= start && d <= end;
      });
      weeks.push({ title: `${start}–${end}`, pct: progress(w), n: w.length });
    }
    const activeMs = activeItems(state.milestones);

    return `<div class="section-heading" style="margin-top:4px"><div><span class="eyebrow">Your momentum</span><h2>Progress & insights</h2><p>${fmtDate(m + '-01', { month: 'long', year: 'numeric' })} · Measured from recorded work</p></div><div class="date-nav"><button class="nav-square" type="button" data-action="month-prev" aria-label="Previous month">‹</button><button class="nav-square" type="button" data-action="month-next" aria-label="Next month">›</button></div></div><div class="insights-top">${statCard('Completion', `${progress(ts)}%`, `${completed}/${ts.length} tasks`, '◎')}${statCard('Research hours', `${(sum(research) / 60).toFixed(1)}h`, 'Actual logged time', '⌁')}${statCard('Learning hours', `${(sum(learn) / 60).toFixed(1)}h`, 'Actual logged time', '▧')}${statCard('Fitness days', `${done(fitness)}`, `${(sum(fitness) / 60).toFixed(1)}h logged`, '♡')}</div><div class="desktop-grid" style="margin-top:16px"><section class="card"><div class="row"><div><strong>Weekly task completion</strong><p class="tiny muted" style="margin:5px 0">Week-by-week share of scheduled tasks done</p></div></div><div class="chart-bars">${weeks.map(w => `<div class="chart-bar-wrap"><span class="tiny muted">${w.pct}%</span><div class="chart-bar" style="height:${Math.max(3, w.pct)}%"></div></div>`).join('')}</div><div class="chart-labels">${weeks.map(w => `<span class="chart-label">${w.title}</span>`).join('')}</div></section><section class="card"><strong>Monthly completion</strong><div style="display:flex;justify-content:center;margin:18px 0"><div class="donut" style="--pct:${progress(ts)}%"><span>${progress(ts)}%</span></div></div><div class="kpi-row"><span>Research tasks</span><b>${done(research)} / ${research.length}</b></div><div class="kpi-row"><span>Course lessons</span><b>${done(learn)} / ${learn.length}</b></div><div class="kpi-row"><span>Lab/class sessions (${(sum(lab) / 60).toFixed(1)}h)</span><b>${done(lab)} / ${lab.length}</b></div><div class="kpi-row"><span>Fitness sessions</span><b>${done(fitness)} / ${fitness.length}</b></div></section></div><section style="margin-top:16px" class="card"><div class="row"><strong>Research deliverables</strong><span class="pill blue">${done(activeMs)} / ${activeMs.length} complete</span></div><div class="progress-track" style="margin-top:13px"><div class="progress-fill" style="width:${progress(activeMs)}%"></div></div><p class="tip-line">Checking off a task logs its planned duration automatically; tap ••• on any task to customize actual minutes.</p></section><div class="button-row" style="margin-top:16px"><button class="secondary-btn" data-action="export-csv">↓ Export progress CSV</button><button class="secondary-btn" data-action="nav" data-page="settings">Backup options →</button></div>`;
  }

  function settingsView() {
    return `<div class="section-heading" style="margin-top:4px"><div><span class="eyebrow">Your app</span><h2>Settings & data</h2><p>Private, offline-friendly, free to use</p></div></div><div class="card settings-block"><h3>Back up your progress</h3><p>Your tasks, research notes, tracked time and milestones are stored in this browser on this device. Export a JSON backup regularly, especially before changing phones or clearing browser data.</p><div class="button-row"><button class="primary-btn" data-action="export-json">↓ Download backup (.json)</button><button class="secondary-btn" data-action="import-json">↑ Restore backup</button></div></div><div class="card settings-block"><h3>Use with Google Sheets or Calendar</h3><p>Export a CSV for Google Sheets, or an iCalendar file to import your planned sessions into Google Calendar. These are manual exports, not live synchronization.</p><div class="button-row"><button class="secondary-btn" data-action="export-csv">↓ Tasks CSV</button><button class="secondary-btn" data-action="export-milestones-csv">↓ Milestones CSV</button><button class="secondary-btn" data-action="export-ics">◷ Calendar (.ics)</button></div></div><div class="card settings-block"><h3>App information</h3><p><strong>PhD Compass · Version 1.1</strong><br>Based on your November 2026 research tracker. Works without paid subscriptions and has no ads or external tracking. New months can be used by adding your own tasks.</p><p>When hosted on a secure HTTPS website, this app can be installed to your phone's home screen and work offline. Opening the standalone HTML file also works, but installation and persistent storage vary between browsers.</p></div><div class="card settings-block"><h3>Reset local progress</h3><p>Restore the original November schedule. Export a backup first: reset cannot be undone.</p><button class="danger-btn" data-action="reset">Reset to original schedule</button></div>`;
  }

  function openModal(body) {
    lastFocusedEl = document.activeElement;
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="Edit progress">${body}</div></div>`;
    const field = document.getElementById('modal-root').querySelector('input:not([type="hidden"]),select,textarea');
    field?.focus();
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (!root || !root.innerHTML) return;
    root.innerHTML = '';
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function' && document.contains(lastFocusedEl)) {
      lastFocusedEl.focus();
    }
    lastFocusedEl = null;
  }

  function taskModal(t = null, cat = 'Research') {
    const v = t || {
      title: '',
      category: cat,
      date: ui.date,
      status: 'Not Started',
      minutes: 0,
      targetMinutes: 60,
      notes: '',
      practice: '',
      evidence: ''
    };
    const edit = Boolean(t);
    const body = `<div class="modal-head"><h2>${edit ? 'Edit activity' : 'New activity'}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="Close">×</button></div><form id="task-form" class="form-grid"><input name="id" value="${eAttr(t?.id || '')}" type="hidden"><label><span class="field-label">What are you working on?</span><input class="text-field" name="title" maxlength="180" value="${eAttr(v.title)}" required placeholder="E.g. Analyze missing-value gaps"></label><div class="form-two"><label><span class="field-label">Date</span><input class="text-field" type="date" name="date" value="${eAttr(v.date)}" required></label><label><span class="field-label">Category</span><select class="select-field" name="category">${Object.keys(CATS).map(c => `<option value="${c}" ${c === v.category ? 'selected' : ''}>${CATS[c].label}</option>`).join('')}</select></label></div><div class="form-two"><label><span class="field-label">Status</span><select class="select-field" name="status">${STATUSES.map(s => `<option value="${s}" ${s === v.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label><span class="field-label">Actual time (minutes)</span><input class="text-field" type="number" min="0" max="1440" step="1" name="minutes" value="${Number(v.minutes) || 0}"></label></div><div class="form-two"><label><span class="field-label">Planned time (minutes)</span><input class="text-field" type="number" min="0" max="1440" step="5" name="targetMinutes" value="${Number(v.targetMinutes) || 60}"></label><label><span class="field-label">Suggested practice (optional)</span><input class="text-field" name="practice" maxlength="200" value="${eAttr(v.practice || '')}" placeholder="E.g. Summarize PM2.5 data"></label></div><label><span class="field-label">Notes / research evidence / next steps</span><textarea class="notes-field" name="notes" maxlength="2000" placeholder="What happened? What will you do next?">${esc(v.notes || '')}</textarea></label><label><span class="field-label">Notebook, paper or GitHub URL (optional)</span><input class="text-field" type="url" name="evidence" value="${eAttr(v.evidence || '')}" placeholder="https://..."></label><div class="modal-foot">${edit ? `<button class="danger-btn" type="button" data-action="delete-task" data-id="${eAttr(v.id)}">Delete</button>` : '<span></span>'}<div class="button-row"><button class="secondary-btn" type="button" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit">Save activity</button></div></div></form>`;
    openModal(body);
  }

  function milestoneModal(m = null) {
    const v = m || {
      title: '',
      project: 'Missing-value handling',
      date: ui.date,
      output: '',
      priority: 'High',
      status: 'Not Started',
      evidence: '',
      notes: ''
    };
    const projects = [...new Set([
      'ACEdge-Hampel',
      'Missing-value handling',
      'Optimal sensor placement',
      'All projects',
      ...state.milestones.map(x => x.project)
    ])];
    openModal(`<div class="modal-head"><h2>${m ? 'Edit milestone' : 'New milestone'}</h2><button class="icon-btn" type="button" data-action="close-modal" aria-label="Close">×</button></div><form class="form-grid" id="milestone-form"><input name="id" type="hidden" value="${eAttr(m?.id || '')}"><label><span class="field-label">Milestone / action</span><input class="text-field" name="title" value="${eAttr(v.title)}" maxlength="180" required placeholder="What result should exist?"></label><label><span class="field-label">Project</span><select name="project" class="select-field">${projects.map(p => `<option ${p === v.project ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><div class="form-two"><label><span class="field-label">Due date</span><input type="date" name="date" class="text-field" value="${eAttr(v.date)}" required></label><label><span class="field-label">Priority</span><select name="priority" class="select-field">${['High', 'Medium', 'Low'].map(p => `<option ${p === v.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div><label><span class="field-label">Expected output</span><input class="text-field" name="output" value="${eAttr(v.output || '')}" maxlength="200" placeholder="Notebook, plot, manuscript section..."></label><label><span class="field-label">Status</span><select name="status" class="select-field">${STATUSES.map(s => `<option ${s === v.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label><span class="field-label">Evidence URL</span><input class="text-field" type="url" name="evidence" value="${eAttr(v.evidence || '')}" placeholder="https://..."></label><label><span class="field-label">Notes</span><textarea name="notes" class="notes-field">${esc(v.notes || '')}</textarea></label><div class="modal-foot">${m ? `<button class="danger-btn" data-action="delete-milestone" data-id="${eAttr(v.id)}" type="button">Delete</button>` : '<span></span>'}<div class="button-row"><button class="secondary-btn" data-action="close-modal" type="button">Cancel</button><button class="primary-btn" type="submit">Save milestone</button></div></div></form>`);
  }

  function saveTask(form) {
    const v = Object.fromEntries(new FormData(form));
    const old = state.tasks.find(x => x.id === v.id);
    const targetMinutes = Math.min(1440, Math.max(0, Number(v.targetMinutes) || old?.targetMinutes || 60));
    let minutes = Math.min(1440, Math.max(0, Number(v.minutes) || 0));
    let autoMinutes = false;
    if (v.status === 'Done' && minutes === 0 && targetMinutes > 0 && (!old || old.status !== 'Done')) {
      minutes = targetMinutes;
      autoMinutes = true;
    }

    const newTask = {
      ...(old || {}),
      id: old?.id || 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      date: v.date,
      category: v.category,
      title: cleanText(v.title),
      status: v.status,
      minutes,
      targetMinutes,
      autoMinutes,
      practice: cleanText(v.practice),
      notes: cleanText(v.notes),
      evidence: cleanText(v.evidence),
      planned: true
    };
    if (!newTask.title) return;
    if (old) {
      Object.assign(old, newTask);
    } else {
      state.tasks.push(newTask);
    }
    persist();
    closeModal();
    ui.date = v.date;
    ui.month = v.date.slice(0, 7);
    render(true);
    showToast('Activity saved');
  }

  function saveMilestone(form) {
    const v = Object.fromEntries(new FormData(form));
    const old = state.milestones.find(x => x.id === v.id);
    const record = {
      id: old?.id || 'milestone-' + Date.now(),
      date: v.date,
      project: cleanText(v.project),
      title: cleanText(v.title),
      output: cleanText(v.output),
      priority: v.priority,
      status: v.status,
      evidence: cleanText(v.evidence),
      notes: cleanText(v.notes)
    };
    if (!record.title) return;
    if (old) Object.assign(old, record);
    else state.milestones.push(record);
    persist();
    closeModal();
    render(true);
    showToast('Milestone saved');
  }

  function downloadFile(name, text, mime) {
    const b = new Blob([text], { type: mime });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportBackup() {
    downloadFile(
      'PhD_Compass_Backup_' + localTodayIST() + '.json',
      JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
      'application/json'
    );
    showToast('Backup downloaded');
  }

  function csvSafeCell(val) {
    let s = String(val ?? '').replace(/\r?\n/g, ' ');
    if (/^[=+\-@]/.test(s)) {
      s = "'" + s;
    }
    return '"' + s.replaceAll('"', '""') + '"';
  }

  function csvRows(arr, cols) {
    return '\uFEFF' + [cols, ...arr.map(r => cols.map(k => r[k] ?? ''))]
      .map(row => row.map(csvSafeCell).join(','))
      .join('\r\n');
  }

  function exportTasks() {
    const cols = ['date', 'category', 'title', 'status', 'minutes', 'targetMinutes', 'notes', 'practice', 'evidence'];
    downloadFile('PhD_Compass_Tasks.csv', csvRows(state.tasks, cols), 'text/csv;charset=utf-8');
    showToast('Task CSV exported');
  }

  function exportMilestones() {
    const cols = ['date', 'project', 'title', 'output', 'priority', 'status', 'evidence', 'notes'];
    downloadFile('PhD_Compass_Milestones.csv', csvRows(state.milestones, cols), 'text/csv;charset=utf-8');
    showToast('Milestone CSV exported');
  }

  function icsEsc(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\r?\n/g, '\\n');
  }

  function icsDate(s, hm, addMinutes) {
    const [y, m, d] = s.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    const date = new Date(y, m - 1, d, h, mi + addMinutes);
    return `${date.getFullYear()}${z(date.getMonth() + 1)}${z(date.getDate())}T${z(date.getHours())}${z(date.getMinutes())}00`;
  }

  function taskStart(t) {
    const day = dayName(t.date);
    if (t.category === 'Fitness') return day === 'Sat' ? '07:30' : '07:15';
    if (t.category === 'Learning') return day === 'Sat' ? '11:15' : '19:30';
    if (t.category === 'Lab') return '12:15';
    if (day === 'Sat') return '14:30';
    return '08:30';
  }

  function exportIcs() {
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const vtimezone = [
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Kolkata',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0530',
      'TZOFFSETTO:+0530',
      'TZNAME:IST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE'
    ].join('\r\n');

    const events = state.tasks
      .filter(t => t.date && t.status !== 'Skipped')
      .map(t => {
        const start = taskStart(t);
        const mins = Number(t.targetMinutes) || 60;
        const details = [
          t.practice ? `Practice: ${t.practice}` : '',
          t.notes ? `Notes: ${t.notes}` : '',
          'PhD Compass planned activity. Update status and actual time in the app.'
        ].filter(Boolean).join('\n');
        return [
          'BEGIN:VEVENT',
          `UID:${icsEsc(t.id)}@phd-compass`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART;TZID=Asia/Kolkata:${icsDate(t.date, start, 0)}`,
          `DTEND;TZID=Asia/Kolkata:${icsDate(t.date, start, mins)}`,
          `SUMMARY:${icsEsc(t.category + ' · ' + t.title)}`,
          `DESCRIPTION:${icsEsc(details)}`,
          'BEGIN:VALARM',
          'TRIGGER:-PT10M',
          'ACTION:DISPLAY',
          `DESCRIPTION:${icsEsc(t.title)}`,
          'END:VALARM',
          'END:VEVENT'
        ].join('\r\n');
      });

    downloadFile(
      'PhD_Compass_Schedule.ics',
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PhD Compass//Research Planner//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:PhD Compass Schedule',
        vtimezone,
        ...events,
        'END:VCALENDAR'
      ].join('\r\n'),
      'text/calendar;charset=utf-8'
    );
    showToast('Calendar file downloaded — import it manually');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || !Array.isArray(s.tasks) || !Array.isArray(s.milestones)) {
          throw new Error('Invalid backup');
        }
        if (!confirm('Replace all progress on this device with the contents of this backup?')) return;
        state = normalizeState(s);
        persist();
        closeModal();
        render();
        showToast('Backup restored');
      } catch (e) {
        alert('Unable to import that file. Choose a PhD Compass JSON backup.');
      }
    };
    reader.readAsText(file);
  }

  function onAction(btn) {
    const a = btn.dataset.action;
    const id = btn.dataset.id;
    switch (a) {
      case 'nav':
        setPage(btn.dataset.page);
        break;
      case 'day-prev':
        ui.date = dateMove(ui.date, -1);
        ui.month = ui.date.slice(0, 7);
        render(true);
        break;
      case 'day-next':
        ui.date = dateMove(ui.date, 1);
        ui.month = ui.date.slice(0, 7);
        render(true);
        break;
      case 'select-date':
        ui.date = btn.dataset.date;
        ui.month = ui.date.slice(0, 7);
        render(true);
        break;
      case 'month-prev':
        ui.month = monthMove(ui.month, -1);
        ui.date = ui.month + '-01';
        render(true);
        break;
      case 'month-next':
        ui.month = monthMove(ui.month, 1);
        ui.date = ui.month + '-01';
        render(true);
        break;
      case 'calendar-today':
        ui.date = localTodayIST();
        ui.month = ui.date.slice(0, 7);
        render();
        break;
      case 'add-task':
        taskModal();
        break;
      case 'add-learning':
        taskModal(null, 'Learning');
        break;
      case 'edit-task': {
        const task = state.tasks.find(t => t.id === id);
        if (task) taskModal(task);
        break;
      }
      case 'toggle-task': {
        const t = state.tasks.find(x => x.id === id);
        if (!t) return;
        if (t.status === 'Done') {
          t.status = 'Not Started';
          if (t.autoMinutes) {
            t.minutes = 0;
            delete t.autoMinutes;
          }
          persist();
          render(true);
          showToast('Task reopened');
        } else {
          t.status = 'Done';
          if (!t.minutes && t.targetMinutes) {
            t.minutes = Number(t.targetMinutes);
            t.autoMinutes = true;
          }
          persist();
          render(true);
          showToast(t.minutes ? `Task completed ✓ (${time(t.minutes)} logged)` : 'Task completed ✓');
        }
        break;
      }
      case 'delete-task':
        if (confirm('Delete this activity?')) {
          state.tasks = state.tasks.filter(t => t.id !== id);
          persist();
          closeModal();
          render(true);
          showToast('Activity deleted');
        }
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'add-milestone':
        milestoneModal();
        break;
      case 'edit-milestone': {
        const milestone = state.milestones.find(m => m.id === id);
        if (milestone) milestoneModal(milestone);
        break;
      }
      case 'toggle-milestone': {
        const m = state.milestones.find(x => x.id === id);
        if (!m) return;
        m.status = m.status === 'Done' ? 'Not Started' : 'Done';
        persist();
        render(true);
        showToast('Milestone updated');
        break;
      }
      case 'delete-milestone':
        if (confirm('Delete this milestone?')) {
          state.milestones = state.milestones.filter(m => m.id !== id);
          persist();
          closeModal();
          render(true);
          showToast('Milestone deleted');
        }
        break;
      case 'filter-project':
        ui.project = btn.dataset.project;
        render(true);
        break;
      case 'filter-week':
        ui.courseWeek = btn.dataset.week;
        render(true);
        break;
      case 'export-json':
        exportBackup();
        break;
      case 'export-csv':
        exportTasks();
        break;
      case 'export-milestones-csv':
        exportMilestones();
        break;
      case 'export-ics':
        exportIcs();
        break;
      case 'import-json':
        document.getElementById('import-file').click();
        break;
      case 'reset':
        if (confirm('Reset ALL activities, milestones and notes to the original November 2026 tracker? This cannot be undone.')) {
          state = normalizeState(null);
          persist();
          render();
          showToast('Original schedule restored');
        }
        break;
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.preventDefault();
      onAction(btn);
      return;
    }
    if (e.target.id === 'overlay') {
      closeModal();
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.getAttribute('id') === 'task-form') {
      e.preventDefault();
      saveTask(e.target);
    } else if (e.target.getAttribute('id') === 'milestone-form') {
      e.preventDefault();
      saveMilestone(e.target);
    }
  });

  document.addEventListener('input', e => {
    if (e.target.matches('[data-day-note]')) {
      state.dailyNotes = state.dailyNotes || {};
      state.dailyNotes[e.target.dataset.dayNote] = e.target.value;
      persist();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('go-settings').addEventListener('click', () => setPage('settings'));
  document.getElementById('go-today').addEventListener('click', () => {
    ui.date = localTodayIST();
    ui.month = ui.date.slice(0, 7);
    setPage('today');
  });
  document.getElementById('import-file').addEventListener('change', e => {
    importBackup(e.target.files?.[0]);
    e.target.value = '';
  });

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (PAGES.some(([p]) => p === hash) || hash === 'settings') {
      if (ui.page !== hash) {
        ui.page = hash;
        render();
      }
    }
  });

  const initialHash = location.hash.replace('#', '');
  if (PAGES.some(([p]) => p === initialHash) || initialHash === 'settings') {
    ui.page = initialHash;
  }

  // The imported calendar is for November 2026; on first launch outside that month,
  // show the seeded month rather than a blank calendar.
  if (
    !(function () {
      try {
        return localStorage.getItem(STORE);
      } catch (e) {
        return null;
      }
    })() &&
    ui.date.slice(0, 7) !== '2026-11'
  ) {
    ui.date = '2026-11-02';
    ui.month = '2026-11';
  }

  render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
