const state = {
  jobs: [],
  filtered: [],
  selected: new Set(),
  search: '',
  onlyUnapplied: false,
};

const els = {
  summary: document.getElementById('summary'),
  exportBtn: document.getElementById('exportBtn'),
  themeToggle: document.getElementById('themeToggle'),
  search: document.getElementById('search'),
  onlyUnapplied: document.getElementById('onlyUnapplied'),
  selectionCount: document.getElementById('selectionCount'),
  bulkApply: document.getElementById('bulkApply'),
  bulkUnapply: document.getElementById('bulkUnapply'),
  selectAll: document.getElementById('selectAll'),
  tbody: document.getElementById('jobsBody'),
  empty: document.getElementById('emptyState'),
  toast: document.getElementById('toast'),
};

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString();
}

function showToast(msg, ok = true) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  els.toast.classList.toggle('error', !ok);
  setTimeout(() => els.toast.classList.add('hidden'), 1500);
}

function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.jobs.filter(j => {
    const matches = !q || j.company_name?.toLowerCase().includes(q) || j.job_link?.toLowerCase().includes(q);
    const pass = state.onlyUnapplied ? !j.applied : true;
    return matches && pass;
  });
  render();
}

function renderSummary() {
  const total = state.jobs.length;
  const applied = state.jobs.filter(j => j.applied).length;
  els.summary.textContent = `${applied} applied / ${total} total`;
}

function renderSelection() {
  els.selectionCount.textContent = `${state.selected.size} selected`;
  els.selectAll.checked = state.filtered.length > 0 && state.filtered.every(j => state.selected.has(j.id));
}

function row(j) {
  const tr = document.createElement('tr');
  tr.dataset.id = j.id;
  tr.innerHTML = `
    <td><input type="checkbox" class="rowSelect" ${state.selected.has(j.id) ? 'checked' : ''}></td>
    <td class="mono">${j.id}</td>
    <td>${j.company_name ?? ''}</td>
    <td><a href="${j.job_link}" target="_blank" rel="noopener">${j.job_link}</a></td>
    <td class="center">
      <label class="switch">
        <input type="checkbox" class="applyToggle" ${j.applied ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </td>
    <td class="nowrap">${fmtDate(j.applied_at)}</td>
    <td>
      <textarea class="notes" rows="1" placeholder="Add notes...">${j.notes ?? ''}</textarea>
    </td>
    <td class="actions">
      <button class="small copy">Copy Link</button>
      <a class="small" href="${j.job_link}" target="_blank" rel="noopener">Open</a>
    </td>
  `;
  return tr;
}

function render() {
  renderSummary();
  els.tbody.innerHTML = '';
  state.filtered.forEach(j => els.tbody.appendChild(row(j)));
  els.empty.classList.toggle('hidden', state.filtered.length !== 0);
  renderSelection();
}

async function fetchJobs() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.onlyUnapplied) params.set('onlyUnapplied', 'true');
  const res = await fetch(`/api/jobs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load jobs');
  state.jobs = await res.json();
  applyFilters();
}

async function toggleApplied(id, applied) {
  const res = await fetch(`/api/jobs/${id}/apply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applied }),
  });
  if (!res.ok) throw new Error('Failed to update');
  const updated = await res.json();
  const idx = state.jobs.findIndex(j => j.id === id);
  if (idx !== -1) state.jobs[idx] = updated;
  applyFilters();
}

async function updateNotes(id, notes) {
  const res = await fetch(`/api/jobs/${id}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to save notes');
}

async function bulkApply(ids, applied) {
  const res = await fetch('/api/jobs/bulk/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, applied }),
  });
  if (!res.ok) throw new Error('Bulk update failed');
  await fetchJobs();
}

function attachHandlers() {
  els.search.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });
  els.onlyUnapplied.addEventListener('change', (e) => {
    state.onlyUnapplied = e.target.checked;
    applyFilters();
  });

  els.exportBtn.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (state.search) params.set('search', state.search);
    if (state.onlyUnapplied) params.set('onlyUnapplied', 'true');
    window.location.href = `/api/export?${params.toString()}`;
  });

  els.bulkApply.addEventListener('click', async () => {
    if (state.selected.size === 0) return;
    try {
      await bulkApply([...state.selected], true);
      showToast('Marked applied');
      state.selected.clear();
      renderSelection();
    } catch (e) { showToast(e.message, false); }
  });

  els.bulkUnapply.addEventListener('click', async () => {
    if (state.selected.size === 0) return;
    try {
      await bulkApply([...state.selected], false);
      showToast('Marked unapplied');
      state.selected.clear();
      renderSelection();
    } catch (e) { showToast(e.message, false); }
  });

  els.selectAll.addEventListener('change', () => {
    if (els.selectAll.checked) state.filtered.forEach(j => state.selected.add(j.id));
    else state.selected.clear();
    renderSelection();
    els.tbody.querySelectorAll('input.rowSelect').forEach(cb => cb.checked = els.selectAll.checked);
  });

  // Delegate row events
  els.tbody.addEventListener('change', async (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = Number(tr.dataset.id);

    if (e.target.classList.contains('applyToggle')) {
      try { await toggleApplied(id, e.target.checked); showToast('Saved'); }
      catch (err) { showToast(err.message, false); e.target.checked = !e.target.checked; }
    }
    if (e.target.classList.contains('rowSelect')) {
      if (e.target.checked) state.selected.add(id); else state.selected.delete(id);
      renderSelection();
    }
  });

  // Notes: debounce save on blur or after typing pause
  let noteTimers = new Map();
  els.tbody.addEventListener('input', (e) => {
    if (!e.target.classList.contains('notes')) return;
    const tr = e.target.closest('tr');
    const id = Number(tr.dataset.id);
    clearTimeout(noteTimers.get(id));
    noteTimers.set(id, setTimeout(async () => {
      try { await updateNotes(id, e.target.value); showToast('Notes saved'); }
      catch (err) { showToast(err.message, false); }
    }, 600));
  });
  els.tbody.addEventListener('blur', (e) => {
    if (!e.target.classList.contains('notes')) return;
    const tr = e.target.closest('tr');
    const id = Number(tr.dataset.id);
    (async () => {
      try { await updateNotes(id, e.target.value); showToast('Notes saved'); }
      catch (err) { showToast(err.message, false); }
    })();
  }, true);

  // Copy link button
  els.tbody.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('copy')) return;
    const tr = e.target.closest('tr');
    const id = Number(tr.dataset.id);
    const j = state.jobs.find(x => x.id === id);
    try { await navigator.clipboard.writeText(j.job_link); showToast('Copied'); }
    catch { showToast('Copy failed', false); }
  });

  // Theme toggle
  const applyThemeLabel = () => {
    const light = document.body.classList.contains('light');
    if (els.themeToggle) els.themeToggle.textContent = light ? 'Dark Mode' : 'Light Mode';
  };
  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
      applyThemeLabel();
    });
  }
  applyThemeLabel();
}

(async function init() {
  // Initialize theme from localStorage
  const saved = localStorage.getItem('theme') ?? 'light';
  if (saved === 'light') document.body.classList.add('light');
  attachHandlers();
  try {
    await fetchJobs();
  } catch (e) {
    showToast(e.message, false);
  }
})();
