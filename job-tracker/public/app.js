const state = {
  activeView: 'jobs',
  jobs: [],
  filtered: [],
  selected: new Set(),
  search: '',
  jobAppliedState: 'all',
  posts: [],
  postFiltered: [],
  postSearch: '',
  postDateFrom: '',
  postDateTo: '',
  onlyWithLink: true,
  postAppliedState: 'all',
};

const els = {
  summary: document.getElementById('summary'),
  exportBtn: document.getElementById('exportBtn'),
  themeToggle: document.getElementById('themeToggle'),
  jobsTab: document.getElementById('jobsTab'),
  postsTab: document.getElementById('postsTab'),
  jobsView: document.getElementById('jobsView'),
  postsView: document.getElementById('postsView'),
  orderBy: document.getElementById('orderBy'),
  jobAppliedState: document.getElementById('jobAppliedState'),
  search: document.getElementById('search'),
  selectionCount: document.getElementById('selectionCount'),
  bulkApply: document.getElementById('bulkApply'),
  bulkUnapply: document.getElementById('bulkUnapply'),
  selectAll: document.getElementById('selectAll'),
  tbody: document.getElementById('jobsBody'),
  empty: document.getElementById('emptyState'),
  postSearch: document.getElementById('postSearch'),
  postOrderBy: document.getElementById('postOrderBy'),
  postAppliedState: document.getElementById('postAppliedState'),
  postDateFrom: document.getElementById('postDateFrom'),
  postDateTo: document.getElementById('postDateTo'),
  onlyWithLink: document.getElementById('onlyWithLink'),
  postsBody: document.getElementById('postsBody'),
  postsEmpty: document.getElementById('postsEmptyState'),
  toast: document.getElementById('toast'),
};

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString();
}

function fmtDateOnly(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showToast(msg, ok = true) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  els.toast.classList.toggle('error', !ok);
  setTimeout(() => els.toast.classList.add('hidden'), 1500);
}

function renderSummary() {
  if (state.activeView === 'posts') {
    const total = state.posts.length;
    const applied = state.posts.filter((post) => post.applied).length;
    els.summary.textContent = `${applied} applied / ${total} total posts`;
    return;
  }

  const total = state.jobs.length;
  const applied = state.jobs.filter((job) => job.applied).length;
  els.summary.textContent = `${applied} applied / ${total} total`;
}

function renderSelection() {
  els.selectionCount.textContent = `${state.selected.size} selected`;
  els.selectAll.checked = state.filtered.length > 0 && state.filtered.every((job) => state.selected.has(job.id));
}

function row(job) {
  const tr = document.createElement('tr');
  tr.dataset.id = job.id;
  tr.innerHTML = `
    <td><input type="checkbox" class="rowSelect" ${state.selected.has(job.id) ? 'checked' : ''}></td>
    <td class="mono">${job.id}</td>
    <td>${job.company_name ?? ''}</td>
    <td class="center">
      <label class="switch">
        <input type="checkbox" class="applyToggle" ${job.applied ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </td>
    <td class="linkCell"><a href="${job.job_link}" target="_blank" rel="noopener">${job.job_link}</a></td>
    <td class="nowrap">${fmtDate(job.applied_at)}</td>
    <td class="nowrap">${fmtDateOnly(job.posted_at)}</td>
    <td>
      <textarea class="notes" rows="1" placeholder="Add notes...">${job.notes ?? ''}</textarea>
    </td>
    <td class="actions">
      <button class="small copy">Copy Link</button>
      <a class="small" href="${job.job_link}" target="_blank" rel="noopener">Open</a>
    </td>
  `;
  return tr;
}

function postRow(post) {
  const tr = document.createElement('tr');
  tr.dataset.id = post.id;
  const safeLink = post.post_link ?? '';
  tr.innerHTML = `
    <td class="mono">${post.id ?? ''}</td>
    <td class="linkCell">${safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener">${safeLink}</a>` : '<span class="muted">No link</span>'}</td>
    <td class="nowrap">${fmtDate(post.posted_date)}</td>
    <td class="center">
      <label class="switch">
        <input type="checkbox" class="postApplyToggle" ${post.applied ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </td>
    <td class="actions">
      <button class="small copyPost" ${safeLink ? '' : 'disabled'}>Copy Link</button>
      ${safeLink ? `<a class="small" href="${safeLink}" target="_blank" rel="noopener">Open</a>` : ''}
    </td>
  `;
  return tr;
}

function render() {
  renderSummary();
  els.tbody.innerHTML = '';
  state.filtered.forEach((job) => els.tbody.appendChild(row(job)));
  els.empty.classList.toggle('hidden', state.filtered.length !== 0);
  renderSelection();
}

function renderPosts() {
  renderSummary();
  els.postsBody.innerHTML = '';
  state.postFiltered.forEach((post) => els.postsBody.appendChild(postRow(post)));
  els.postsEmpty.classList.toggle('hidden', state.postFiltered.length !== 0);
}

function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.jobs.filter((job) => {
    const matches = !q || job.company_name?.toLowerCase().includes(q) || job.job_link?.toLowerCase().includes(q);
    const matchesApplied =
      state.jobAppliedState === 'all' ||
      (state.jobAppliedState === 'applied' && job.applied) ||
      (state.jobAppliedState === 'not_applied' && !job.applied);
    return matches && matchesApplied;
  });
  render();
}

function applyPostFilters() {
  const q = state.postSearch.toLowerCase();
  const start = state.postDateFrom ? new Date(`${state.postDateFrom}T00:00:00`) : null;
  const end = state.postDateTo ? new Date(`${state.postDateTo}T23:59:59.999`) : null;

  state.postFiltered = state.posts.filter((post) => {
    const posted = post.posted_date ? new Date(post.posted_date) : null;
    const matchesSearch = !q || String(post.id ?? '').includes(q) || post.post_link?.toLowerCase().includes(q);
    const matchesLink = !state.onlyWithLink || Boolean(post.post_link?.trim());
    const matchesStart = !start || (posted && posted >= start);
    const matchesEnd = !end || (posted && posted <= end);
    const matchesApplied =
      state.postAppliedState === 'all' ||
      (state.postAppliedState === 'applied' && post.applied) ||
      (state.postAppliedState === 'not_applied' && !post.applied);
    return matchesSearch && matchesLink && matchesStart && matchesEnd && matchesApplied;
  });

  renderPosts();
}

async function fetchJobs() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.jobAppliedState !== 'all') params.set('appliedState', state.jobAppliedState);
  if (els.orderBy.value) params.set('orderBy', els.orderBy.value);
  const res = await fetch(`/api/jobs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load jobs');
  state.jobs = await res.json();
  applyFilters();
}

async function fetchPosts() {
  const params = new URLSearchParams();
  if (state.postSearch) params.set('search', state.postSearch);
  if (state.postDateFrom) params.set('postedFrom', state.postDateFrom);
  if (state.postDateTo) params.set('postedTo', state.postDateTo);
  if (state.onlyWithLink) params.set('onlyWithLink', 'true');
  if (state.postAppliedState !== 'all') params.set('appliedState', state.postAppliedState);
  if (els.postOrderBy.value) params.set('orderBy', els.postOrderBy.value);
  const res = await fetch(`/api/posts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load posts');
  state.posts = await res.json();
  applyPostFilters();
}

async function togglePostApplied(id, applied) {
  const res = await fetch(`/api/posts/${id}/apply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applied }),
  });
  if (!res.ok) throw new Error('Failed to update post');
  const updated = await res.json();
  const idx = state.posts.findIndex((post) => post.id === id);
  if (idx !== -1) state.posts[idx] = updated;
  applyPostFilters();
}

function setActiveView(view) {
  state.activeView = view;
  const showPosts = view === 'posts';
  els.jobsView.classList.toggle('hidden', showPosts);
  els.postsView.classList.toggle('hidden', !showPosts);
  els.jobsTab.classList.toggle('active', !showPosts);
  els.postsTab.classList.toggle('active', showPosts);
  els.exportBtn.classList.toggle('hidden', showPosts);
  renderSummary();
}

async function toggleApplied(id, applied) {
  const res = await fetch(`/api/jobs/${id}/apply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applied }),
  });
  if (!res.ok) throw new Error('Failed to update');
  const updated = await res.json();
  const idx = state.jobs.findIndex((job) => String(job.id) === String(id));
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
  els.jobsTab.addEventListener('click', () => setActiveView('jobs'));
  els.postsTab.addEventListener('click', async () => {
    setActiveView('posts');
    if (state.posts.length === 0) {
      try {
        await fetchPosts();
      } catch (e) {
        showToast(e.message, false);
      }
    }
  });

  els.search.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });
  els.jobAppliedState.addEventListener('change', (e) => {
    state.jobAppliedState = e.target.value;
    applyFilters();
  });

  els.postSearch.addEventListener('input', (e) => {
    state.postSearch = e.target.value;
    applyPostFilters();
  });
  els.postAppliedState.addEventListener('change', (e) => {
    state.postAppliedState = e.target.value;
    applyPostFilters();
  });
  els.postDateFrom.addEventListener('change', (e) => {
    state.postDateFrom = e.target.value;
    applyPostFilters();
  });
  els.postDateTo.addEventListener('change', (e) => {
    state.postDateTo = e.target.value;
    applyPostFilters();
  });
  els.onlyWithLink.addEventListener('change', (e) => {
    state.onlyWithLink = e.target.checked;
    applyPostFilters();
  });

  els.exportBtn.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (state.search) params.set('search', state.search);
    if (state.jobAppliedState !== 'all') params.set('appliedState', state.jobAppliedState);
    if (els.orderBy.value) params.set('orderBy', els.orderBy.value);
    window.location.href = `/api/export?${params.toString()}`;
  });

  els.orderBy.addEventListener('change', () => {
    fetchJobs().catch((e) => showToast(e.message, false));
  });
  els.postOrderBy.addEventListener('change', () => {
    fetchPosts().catch((e) => showToast(e.message, false));
  });

  els.bulkApply.addEventListener('click', async () => {
    if (state.selected.size === 0) return;
    try {
      await bulkApply([...state.selected], true);
      showToast('Marked applied');
      state.selected.clear();
      renderSelection();
    } catch (e) {
      showToast(e.message, false);
    }
  });

  els.bulkUnapply.addEventListener('click', async () => {
    if (state.selected.size === 0) return;
    try {
      await bulkApply([...state.selected], false);
      showToast('Marked unapplied');
      state.selected.clear();
      renderSelection();
    } catch (e) {
      showToast(e.message, false);
    }
  });

  els.selectAll.addEventListener('change', () => {
    if (els.selectAll.checked) state.filtered.forEach((job) => state.selected.add(job.id));
    else state.selected.clear();
    renderSelection();
    els.tbody.querySelectorAll('input.rowSelect').forEach((cb) => {
      cb.checked = els.selectAll.checked;
    });
  });

  els.tbody.addEventListener('change', async (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = tr.dataset.id;

    if (e.target.classList.contains('applyToggle')) {
      try {
        await toggleApplied(id, e.target.checked);
        showToast('Saved');
      } catch (err) {
        showToast(err.message, false);
        e.target.checked = !e.target.checked;
      }
    }

    if (e.target.classList.contains('rowSelect')) {
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      renderSelection();
    }
  });

  const noteTimers = new Map();
  els.tbody.addEventListener('input', (e) => {
    if (!e.target.classList.contains('notes')) return;
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    clearTimeout(noteTimers.get(id));
    noteTimers.set(id, setTimeout(async () => {
      try {
        await updateNotes(id, e.target.value);
        showToast('Notes saved');
      } catch (err) {
        showToast(err.message, false);
      }
    }, 600));
  });

  els.tbody.addEventListener('blur', (e) => {
    if (!e.target.classList.contains('notes')) return;
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    (async () => {
      try {
        await updateNotes(id, e.target.value);
        showToast('Notes saved');
      } catch (err) {
        showToast(err.message, false);
      }
    })();
  }, true);

  els.tbody.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('copy')) return;
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    const job = state.jobs.find((item) => String(item.id) === id);
    try {
      await navigator.clipboard.writeText(job.job_link);
      showToast('Copied');
    } catch {
      showToast('Copy failed', false);
    }
  });

  els.postsBody.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('copyPost')) return;
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    const post = state.posts.find((item) => String(item.id) === id);
    if (!post?.post_link) return;
    try {
      await navigator.clipboard.writeText(post.post_link);
      showToast('Copied');
    } catch {
      showToast('Copy failed', false);
    }
  });

  els.postsBody.addEventListener('change', async (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (!e.target.classList.contains('postApplyToggle')) return;
    const id = tr.dataset.id;
    try {
      await togglePostApplied(id, e.target.checked);
      showToast('Saved');
    } catch (err) {
      showToast(err.message, false);
      e.target.checked = !e.target.checked;
    }
  });

  const applyThemeLabel = () => {
    const light = document.body.classList.contains('light');
    els.themeToggle.textContent = light ? 'Dark Mode' : 'Light Mode';
  };
  els.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    applyThemeLabel();
  });
  applyThemeLabel();
}

(async function init() {
  const saved = localStorage.getItem('theme') ?? 'light';
  if (saved === 'light') document.body.classList.add('light');
  attachHandlers();
  setActiveView('jobs');
  try {
    await fetchJobs();
  } catch (e) {
    showToast(e.message, false);
  }
})();
