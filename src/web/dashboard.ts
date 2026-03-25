/**
 * Dashboard HTML generator — single-file inline CSS + JS.
 * Renders a shell HTML that fetches data from /api/* endpoints.
 */

export function renderDashboard(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>fugue — ${escHtml(projectName)}</title>
  <style>
    :root {
      --bg: #fafafa;
      --card-bg: #ffffff;
      --text: #1a1a2e;
      --text-muted: #6b7280;
      --text-dim: #9ca3af;
      --border: #e5e7eb;
      --key: #1a1a2e;
      --accent: #3b82f6;
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --radius: 8px;
      --shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg); color: var(--text);
      max-width: 1200px; margin: 0 auto; padding: 24px 20px;
      line-height: 1.5;
    }

    /* Header */
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 1.4rem; font-weight: 700; color: var(--key); }
    .header .meta { font-size: 0.85rem; color: var(--text-muted); margin-top: 2px; }
    .header .meta span { margin-right: 16px; }

    /* Cards */
    .card {
      background: var(--card-bg); border-radius: var(--radius);
      padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow);
      border: 1px solid var(--border);
    }
    .card h2 {
      font-size: 1rem; font-weight: 600; color: var(--text-muted);
      margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    }
    .card h2 .badge {
      font-size: 0.75rem; background: var(--border); color: var(--text-muted);
      padding: 1px 8px; border-radius: 10px; font-weight: 500;
    }

    /* Progress bar */
    .progress-bar { background: var(--border); border-radius: 4px; height: 24px; overflow: hidden; margin-bottom: 12px; }
    .progress-fill {
      background: var(--green); height: 100%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 0.8rem; font-weight: 600;
      min-width: 32px; transition: width 0.4s ease;
    }

    /* Status counters */
    .counters { display: flex; flex-wrap: wrap; gap: 16px; }
    .counter { text-align: center; min-width: 80px; }
    .counter .value { font-size: 1.6rem; font-weight: 700; }
    .counter .label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }
    .counter.done .value { color: var(--green); }
    .counter.dev .value { color: var(--yellow); }
    .counter.confirmed .value { color: var(--accent); }
    .counter.draft .value { color: var(--text-dim); }
    .counter.stale .value { color: var(--red); }
    .counter.deprecated .value { color: var(--text-dim); text-decoration: line-through; }

    /* Deliverables */
    .del-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 0.9rem; }
    .del-icon { width: 20px; text-align: center; font-size: 0.85rem; }
    .del-icon.done { color: var(--green); }
    .del-icon.wip { color: var(--yellow); }
    .del-icon.warn { color: var(--yellow); }
    .del-icon.pending { color: var(--text-dim); }
    .del-id { font-weight: 600; color: var(--accent); width: 40px; }
    .del-name { flex: 1; }
    .del-detail { color: var(--text-muted); font-size: 0.85rem; }

    /* Filters */
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center; }
    .filter-group { display: flex; gap: 4px; align-items: center; }
    .filter-group label { font-size: 0.8rem; color: var(--text-muted); margin-right: 4px; font-weight: 600; }
    .filter-btn {
      padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--card-bg); cursor: pointer; font-size: 0.8rem; transition: all 0.15s;
    }
    .filter-btn:hover { border-color: #999; }
    .filter-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
    .filter-btn.active-high { background: var(--red); color: white; border-color: var(--red); }
    .filter-btn.active-medium { background: var(--yellow); color: white; border-color: var(--yellow); }
    .filter-btn.active-low { background: var(--text-dim); color: white; border-color: var(--text-dim); }
    .search-box {
      padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px;
      font-size: 0.85rem; width: 220px; background: var(--card-bg);
    }
    .search-box:focus { outline: none; border-color: var(--accent); }
    select.domain-select {
      padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px;
      font-size: 0.85rem; background: var(--card-bg);
    }

    /* REQ Table */
    .req-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .req-table th { text-align: left; padding: 8px; border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: 0.8rem; }
    .req-table td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .req-row { cursor: pointer; user-select: none; }
    .req-row:hover { background: #f8f9fa; }
    .status { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
    .status-done { color: var(--green); }
    .status-dev { color: var(--yellow); }
    .status-confirmed { color: var(--accent); }
    .status-draft { color: var(--text-dim); }
    .status-stale { color: var(--red); }
    .status-deprecated { color: var(--text-dim); text-decoration: line-through; }
    .status-accepted { color: #059669; }
    .status-rejected { color: var(--red); }
    .priority-high { color: var(--red); font-weight: 600; }
    .priority-medium { color: var(--yellow); font-weight: 600; }
    .priority-low { color: var(--text-dim); }

    /* Detail row */
    .req-detail { display: none; }
    .req-detail.open { display: table-row; }
    .req-detail td { padding: 14px 20px; background: #f9fafb; border-bottom: 1px solid var(--border); }
    .detail-grid { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; font-size: 0.85rem; }
    .detail-label { color: var(--text-muted); font-weight: 600; }
    .detail-value { color: var(--text); word-break: break-word; }
    .detail-value code { background: #e5e7eb; padding: 1px 5px; border-radius: 3px; font-size: 0.8rem; }
    .chevron { display: inline-block; transition: transform 0.15s; font-size: 0.7rem; margin-right: 4px; }
    .chevron.open { transform: rotate(90deg); }

    /* Feedback section */
    .feedback-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .feedback-history { margin-bottom: 10px; }
    .fb-entry { font-size: 0.8rem; padding: 4px 0; color: var(--text-muted); }
    .fb-entry .fb-action { font-weight: 600; text-transform: uppercase; }
    .fb-entry .fb-action.accept { color: var(--green); }
    .fb-entry .fb-action.reject { color: var(--red); }
    .fb-entry .fb-action.comment { color: var(--accent); }
    .feedback-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .fb-btn {
      padding: 5px 14px; border: 1px solid var(--border); border-radius: 4px;
      cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.15s;
      background: var(--card-bg);
    }
    .fb-btn:hover { opacity: 0.85; }
    .fb-btn.accept { background: var(--green); color: white; border-color: var(--green); }
    .fb-btn.reject { background: var(--red); color: white; border-color: var(--red); }
    .fb-btn.comment-btn { background: var(--accent); color: white; border-color: var(--accent); }
    .fb-input {
      flex: 1; min-width: 200px; padding: 5px 10px;
      border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;
    }
    .fb-input:focus { outline: none; border-color: var(--accent); }
    .fb-from {
      width: 100px; padding: 5px 8px;
      border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;
    }

    /* Confirm button */
    .confirm-section { margin-top: 12px; display: flex; gap: 8px; align-items: center; }
    .confirm-btn {
      padding: 8px 20px; border: none; border-radius: 4px;
      cursor: pointer; font-size: 0.85rem; font-weight: 600;
      background: var(--key); color: white; transition: opacity 0.15s;
    }
    .confirm-btn:hover { opacity: 0.85; }
    .confirm-btn:disabled { opacity: 0.4; cursor: default; }
    .confirm-result { font-size: 0.85rem; color: var(--green); }

    /* Pagination */
    .pagination { display: flex; justify-content: center; gap: 4px; margin-top: 12px; align-items: center; }
    .page-btn {
      padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--card-bg); cursor: pointer; font-size: 0.8rem;
    }
    .page-btn:hover { border-color: #999; }
    .page-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .page-info { font-size: 0.8rem; color: var(--text-muted); margin: 0 8px; }

    /* Tasks */
    .task-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 0.9rem; border-bottom: 1px solid #f0f0f0; }
    .task-id { font-weight: 600; color: var(--accent); width: 80px; }
    .task-status { width: 90px; }
    .task-title { flex: 1; }
    .task-reqs { color: var(--text-muted); font-size: 0.85rem; }

    /* Toast */
    .toast {
      position: fixed; bottom: 20px; right: 20px;
      background: var(--key); color: white; padding: 10px 20px;
      border-radius: var(--radius); font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 1000;
    }
    .toast.show { opacity: 1; }

    /* Responsive */
    @media (max-width: 768px) {
      body { padding: 12px; }
      .filters { flex-direction: column; align-items: stretch; }
      .search-box { width: 100%; }
      .counters { justify-content: space-around; }
      .feedback-actions { flex-direction: column; }
      .fb-input { min-width: auto; width: 100%; }
    }

    /* Refresh indicator */
    .refresh-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--green); margin-left: 8px; vertical-align: middle;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    .loading { text-align: center; padding: 40px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="header">
    <h1>fugue — Project Dashboard <span class="refresh-dot" title="Auto-refreshing"></span></h1>
    <div class="meta" id="headerMeta">Loading...</div>
  </div>

  <div class="card" id="progressCard">
    <h2>Progress</h2>
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%">0%</div></div>
    <div class="counters" id="counters"></div>
  </div>

  <div class="card" id="deliverablesCard">
    <h2>Deliverables</h2>
    <div id="deliverablesList"></div>
  </div>

  <div class="card" id="reqsCard">
    <h2>Requirements <span class="badge" id="reqCount">0</span></h2>
    <div class="filters">
      <div class="filter-group">
        <label>Domain:</label>
        <select class="domain-select" id="domainFilter"></select>
      </div>
      <div class="filter-group">
        <label>Priority:</label>
        <button class="filter-btn" data-filter="priority" data-value="HIGH">HIGH</button>
        <button class="filter-btn" data-filter="priority" data-value="MEDIUM">MEDIUM</button>
        <button class="filter-btn" data-filter="priority" data-value="LOW">LOW</button>
      </div>
      <div class="filter-group">
        <label>Status:</label>
        <button class="filter-btn" data-filter="status" data-value="DRAFT">DRAFT</button>
        <button class="filter-btn" data-filter="status" data-value="ACCEPTED">ACCEPTED</button>
        <button class="filter-btn" data-filter="status" data-value="CONFIRMED">CONFIRMED</button>
        <button class="filter-btn" data-filter="status" data-value="DEV">DEV</button>
        <button class="filter-btn" data-filter="status" data-value="DONE">DONE</button>
        <button class="filter-btn" data-filter="status" data-value="REJECTED">REJECTED</button>
      </div>
      <div class="filter-group" style="margin-left:auto;">
        <input type="text" class="search-box" id="searchBox" placeholder="Search REQ ID or title...">
      </div>
    </div>

    <div class="confirm-section">
      <button class="confirm-btn" id="confirmBtn" onclick="doConfirm()">Confirm All (ACCEPTED/DRAFT → CONFIRMED)</button>
      <span class="confirm-result" id="confirmResult"></span>
    </div>

    <table class="req-table">
      <thead><tr><th></th><th>ID</th><th>Status</th><th>Priority</th><th>Title</th></tr></thead>
      <tbody id="reqTableBody"></tbody>
    </table>
    <div class="pagination" id="pagination"></div>
  </div>

  <div class="card" id="tasksCard">
    <h2>Tasks <span class="badge" id="taskCount">0</span></h2>
    <div id="tasksList"></div>
  </div>

  <div class="card" id="auditCard">
    <h2>Audit Summary</h2>
    <div id="auditSummary"><span class="loading">Not loaded</span></div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
  (function() {
    // ============ State ============
    var allReqs = [];
    var filteredReqs = [];
    var currentPage = 1;
    var PAGE_SIZE = 50;
    var openDetails = {};
    var activePriorities = {};
    var activeStatuses = {};
    var domains = [];

    // ============ API ============
    function api(method, url, body) {
      var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      return fetch(url, opts).then(function(r) { return r.json(); });
    }

    // ============ Toast ============
    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }

    // ============ Escape HTML ============
    function escH(s) {
      if (!s) return '';
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    // ============ Load Status ============
    function loadStatus() {
      api('GET', '/api/status').then(function(data) {
        var hdr = document.getElementById('headerMeta');
        hdr.innerHTML = '<span>' + escH(data.project_name) + '</span>' +
          '<span>conductor: ' + escH(data.conductor || 'none') + '</span>' +
          '<span>' + data.counts.total + ' REQs</span>';

        var pct = data.counts.total > 0 ? Math.round((data.counts.done / data.counts.total) * 100) : 0;
        var fill = document.getElementById('progressFill');
        fill.style.width = pct + '%';
        fill.textContent = pct + '%';

        var counters = document.getElementById('counters');
        var items = [
          { cls: 'done', label: 'DONE', val: data.counts.done },
          { cls: 'dev', label: 'DEV', val: data.counts.dev },
          { cls: 'confirmed', label: 'CONFIRMED', val: data.counts.confirmed },
          { cls: 'draft', label: 'DRAFT', val: data.counts.draft },
          { cls: 'stale', label: 'STALE', val: data.counts.stale },
          { cls: 'deprecated', label: 'DEPRECATED', val: data.counts.deprecated },
        ];
        counters.innerHTML = items.map(function(it) {
          return '<div class="counter ' + it.cls + '"><div class="value">' + it.val + '</div><div class="label">' + it.label + '</div></div>';
        }).join('');
      });
    }

    // ============ Load Deliverables ============
    function loadDeliverables() {
      api('GET', '/api/deliverables').then(function(data) {
        var el = document.getElementById('deliverablesList');
        var iconMap = { done: '\\u2713', wip: '\\u25C9', warn: '\\u25B3', pending: '\\u25CB', stale: '!' };
        el.innerHTML = Object.keys(data).map(function(id) {
          var d = data[id];
          return '<div class="del-row"><span class="del-icon ' + d.icon + '">' + (iconMap[d.icon] || '\\u25CB') + '</span>' +
            '<span class="del-id">' + id + '</span>' +
            '<span class="del-name">' + escH(d.name) + '</span>' +
            '<span class="del-detail">' + escH(d.detail) + '</span></div>';
        }).join('');
      });
    }

    // ============ Load Specs ============
    function loadSpecs() {
      api('GET', '/api/specs').then(function(data) {
        allReqs = data;
        // Build domain list
        var domSet = {};
        for (var i = 0; i < allReqs.length; i++) {
          if (allReqs[i].domain) domSet[allReqs[i].domain] = true;
        }
        domains = Object.keys(domSet).sort();
        var sel = document.getElementById('domainFilter');
        var curVal = sel.value;
        sel.innerHTML = '<option value="">All</option>' +
          domains.map(function(d) { return '<option value="' + escH(d) + '">' + escH(d) + '</option>'; }).join('');
        sel.value = curVal;
        applyFilters();
      });
    }

    // ============ Load Tasks ============
    function loadTasks() {
      api('GET', '/api/tasks').then(function(data) {
        document.getElementById('taskCount').textContent = data.length;
        var el = document.getElementById('tasksList');
        if (data.length === 0) {
          el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No tasks</div>';
          return;
        }
        el.innerHTML = data.map(function(t) {
          return '<div class="task-row">' +
            '<span class="task-id">' + escH(t.id) + '</span>' +
            '<span class="task-status status status-' + t.status.toLowerCase() + '">' + escH(t.status) + '</span>' +
            '<span class="task-title">' + escH(t.title) + '</span>' +
            '<span class="task-reqs">' + (t.req_ids ? t.req_ids.length : 0) + ' REQs</span></div>';
        }).join('');
      });
    }

    // ============ Load Audit ============
    function loadAudit() {
      api('GET', '/api/audit').then(function(data) {
        var el = document.getElementById('auditSummary');
        if (data.error) {
          el.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">' + escH(data.error) + '</span>';
          return;
        }
        var r = data.results || {};
        el.innerHTML = '<div style="display:flex;gap:20px;font-size:0.9rem;">' +
          '<span style="color:var(--green);font-weight:600;">Pass: ' + (r.pass || 0) + '</span>' +
          '<span style="color:var(--yellow);font-weight:600;">Warn: ' + (r.warn || 0) + '</span>' +
          '<span style="color:var(--text-muted);font-weight:600;">Todo: ' + (r.todo || 0) + '</span>' +
          '<span style="color:var(--red);font-weight:600;">Stale: ' + (r.stale || 0) + '</span>' +
          (data.gate ? '<span style="font-weight:700;margin-left:12px;">Gate: ' + escH(data.gate) + '</span>' : '') +
          '</div>';
      });
    }

    // ============ Filters ============
    function applyFilters() {
      var domain = document.getElementById('domainFilter').value;
      var search = document.getElementById('searchBox').value.toLowerCase().trim();
      var prioKeys = Object.keys(activePriorities);
      var statusKeys = Object.keys(activeStatuses);

      filteredReqs = allReqs.filter(function(r) {
        if (domain && r.domain !== domain) return false;
        if (prioKeys.length > 0 && !activePriorities[r.priority]) return false;
        if (statusKeys.length > 0 && !activeStatuses[r.status]) return false;
        if (search && r.id.toLowerCase().indexOf(search) === -1 && r.title.toLowerCase().indexOf(search) === -1) return false;
        return true;
      });

      currentPage = 1;
      renderReqs();
    }
    window.applyFilters = applyFilters;

    // ============ Toggle filter ============
    window.toggleFilter = function(btn) {
      var filter = btn.getAttribute('data-filter');
      var value = btn.getAttribute('data-value');
      var map = filter === 'priority' ? activePriorities : activeStatuses;

      if (map[value]) {
        delete map[value];
        btn.className = 'filter-btn';
      } else {
        map[value] = true;
        if (filter === 'priority') {
          btn.classList.add('active-' + value.toLowerCase());
        } else {
          btn.classList.add('active');
        }
      }
      applyFilters();
    };

    // ============ Render REQs ============
    function renderReqs() {
      var total = filteredReqs.length;
      var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      document.getElementById('reqCount').textContent = total + ' / ' + allReqs.length;

      var start = (currentPage - 1) * PAGE_SIZE;
      var pageReqs = filteredReqs.slice(start, start + PAGE_SIZE);

      var html = '';
      for (var i = 0; i < pageReqs.length; i++) {
        var r = pageReqs[i];
        var isOpen = openDetails[r.id];
        html += '<tr class="req-row" onclick="toggleDetail(\\'' + escH(r.id) + '\\')">';
        html += '<td><span class="chevron' + (isOpen ? ' open' : '') + '">\\u25B6</span></td>';
        html += '<td>' + escH(r.id) + '</td>';
        html += '<td class="status status-' + r.status.toLowerCase() + '">' + escH(r.status) + '</td>';
        html += '<td class="priority-' + (r.priority || '').toLowerCase() + '">' + escH(r.priority) + '</td>';
        html += '<td>' + escH(r.title) + '</td>';
        html += '</tr>';

        // Detail row
        html += '<tr class="req-detail' + (isOpen ? ' open' : '') + '" id="detail-' + escH(r.id) + '">';
        html += '<td colspan="5"><div class="detail-grid">';
        html += '<span class="detail-label">Description</span><span class="detail-value">' + escH(r.description || '(none)') + '</span>';
        html += '<span class="detail-label">Created</span><span class="detail-value">' + escH(r.created || '(unknown)') + '</span>';
        html += '<span class="detail-label">Code Refs</span><span class="detail-value">' + (r.code_refs && r.code_refs.length > 0 ? r.code_refs.map(function(c) { return '<code>' + escH(c) + '</code>'; }).join(' ') : '(none)') + '</span>';
        html += '<span class="detail-label">Test Refs</span><span class="detail-value">' + (r.test_refs && r.test_refs.length > 0 ? r.test_refs.map(function(c) { return '<code>' + escH(c) + '</code>'; }).join(' ') : '(none)') + '</span>';
        if (r.assigned_model) {
          html += '<span class="detail-label">Model</span><span class="detail-value">' + escH(r.assigned_model) + '</span>';
        }
        html += '</div>';

        // Feedback history
        var feedbackList = r.feedback || [];
        html += '<div class="feedback-section">';
        if (feedbackList.length > 0) {
          html += '<div class="feedback-history">';
          for (var fi = 0; fi < feedbackList.length; fi++) {
            var fb = feedbackList[fi];
            html += '<div class="fb-entry"><span class="fb-action ' + (fb.action || '') + '">' + escH(fb.action || '') + '</span>';
            html += ' by ' + escH(fb.from || 'unknown');
            if (fb.message) html += ' — ' + escH(fb.message);
            html += ' <span style="color:var(--text-dim);font-size:0.75rem;">' + escH((fb.at || '').slice(0, 19)) + '</span></div>';
          }
          html += '</div>';
        }

        // Feedback actions
        html += '<div class="feedback-actions">';
        html += '<input type="text" class="fb-from" id="from-' + escH(r.id) + '" placeholder="From" value="reviewer">';
        html += '<input type="text" class="fb-input" id="msg-' + escH(r.id) + '" placeholder="Message (required for comment)">';
        html += '<button class="fb-btn accept" onclick="event.stopPropagation(); doFeedback(\\'' + escH(r.id) + '\\', \\'accept\\')">Accept</button>';
        html += '<button class="fb-btn reject" onclick="event.stopPropagation(); doFeedback(\\'' + escH(r.id) + '\\', \\'reject\\')">Reject</button>';
        html += '<button class="fb-btn comment-btn" onclick="event.stopPropagation(); doFeedback(\\'' + escH(r.id) + '\\', \\'comment\\')">Comment</button>';
        html += '</div></div>';

        html += '</td></tr>';
      }
      document.getElementById('reqTableBody').innerHTML = html;

      // Pagination
      var pagHtml = '';
      if (totalPages > 1) {
        pagHtml += '<button class="page-btn" onclick="goToPage(1)"' + (currentPage === 1 ? ' disabled' : '') + '>\\u00AB</button>';
        pagHtml += '<button class="page-btn" onclick="goToPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>\\u2039</button>';
        var startP = Math.max(1, currentPage - 3);
        var endP = Math.min(totalPages, currentPage + 3);
        for (var p = startP; p <= endP; p++) {
          pagHtml += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" onclick="goToPage(' + p + ')">' + p + '</button>';
        }
        pagHtml += '<button class="page-btn" onclick="goToPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>\\u203A</button>';
        pagHtml += '<button class="page-btn" onclick="goToPage(' + totalPages + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>\\u00BB</button>';
        pagHtml += '<span class="page-info">' + (start + 1) + '-' + Math.min(start + PAGE_SIZE, total) + ' of ' + total + '</span>';
      }
      document.getElementById('pagination').innerHTML = pagHtml;
    }

    // ============ Toggle detail ============
    window.toggleDetail = function(id) {
      openDetails[id] = !openDetails[id];
      renderReqs();
    };

    // ============ Page navigation ============
    window.goToPage = function(p) {
      currentPage = p;
      renderReqs();
    };

    // ============ Feedback ============
    window.doFeedback = function(reqId, action) {
      var msgEl = document.getElementById('msg-' + reqId);
      var fromEl = document.getElementById('from-' + reqId);
      var message = msgEl ? msgEl.value : '';
      var from = fromEl ? fromEl.value : 'reviewer';

      if (action === 'comment' && !message.trim()) {
        showToast('Message is required for comment');
        return;
      }

      var body = { action: action, from: from || 'reviewer' };
      if (message.trim()) body.message = message.trim();

      api('POST', '/api/specs/' + encodeURIComponent(reqId) + '/feedback', body)
        .then(function(res) {
          if (res.error) { showToast('Error: ' + res.error); return; }
          showToast(reqId + ': ' + action + ' \\u2714');
          if (msgEl) msgEl.value = '';
          loadSpecs();
        });
    };

    // ============ Confirm ============
    window.doConfirm = function() {
      var btn = document.getElementById('confirmBtn');
      btn.disabled = true;
      api('POST', '/api/confirm', {})
        .then(function(res) {
          btn.disabled = false;
          if (res.error) { showToast('Error: ' + res.error); return; }
          var msg = 'Confirmed: ' + (res.confirmed || 0) + ', Deprecated: ' + (res.deprecated || 0);
          document.getElementById('confirmResult').textContent = msg;
          showToast(msg);
          refreshAll();
        });
    };

    // ============ Event listeners ============
    document.getElementById('domainFilter').addEventListener('change', applyFilters);
    document.getElementById('searchBox').addEventListener('input', applyFilters);
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { toggleFilter(btn); });
    });

    // ============ Refresh ============
    function refreshAll() {
      loadStatus();
      loadDeliverables();
      loadSpecs();
      loadTasks();
      loadAudit();
    }

    // Initial load
    refreshAll();

    // Auto-refresh every 5 seconds
    setInterval(refreshAll, 5000);
  })();
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
