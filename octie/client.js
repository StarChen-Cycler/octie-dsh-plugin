// octie-dsh client half — a sidebar task panel inside the DSH web GUI.
//
// Hand-written `window.__ModuleLoader__.load` bundle (no bundler): the factory
// returns a Cordis plugin whose `apply(ctx)` registers two additive slots —
// a sidebar footer action and a frame-wide overlay panel — and drives them
// through the Node half's `/api/octie/*` read routes plus an SSE events stream.
window.__ModuleLoader__.load({
  id: 'octie-cli',
  factory: (require) => {
    const React = require('react');

    // --- shared panel store (module-scoped; both slots render from it) ---
    const state = {
      open: false,
      projects: [],
      project: null,
      tasks: [],
      graph: null,
      selectedTask: null,
      error: null,
    };
    const listeners = new Set();
    function patch(next) {
      Object.assign(state, next);
      for (const fn of listeners) fn();
    }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    function useOctieState() {
      const [, force] = React.useState(0);
      React.useEffect(() => subscribe(() => force((x) => x + 1)), []);
      return state;
    }

    async function fetchJson(url) {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }

    async function refresh() {
      try {
        const projects = await fetchJson('/api/octie/projects');
        const project = state.project || (projects[0] && projects[0].path) || null;
        patch({ projects, project });
        if (!project) { patch({ tasks: [], graph: null, error: null }); return; }
        const data = await fetchJson('/api/octie/state?project=' + encodeURIComponent(project));
        patch({ tasks: data.tasks || [], graph: data.graph || null, error: null });
      } catch (err) {
        patch({ error: String((err && err.message) || err) });
      }
    }

    function connectSse() {
      const es = new EventSource('/api/octie/events');
      es.onmessage = () => refresh(); // task changed on the host → re-read state
      return () => es.close();
    }

    const e = React.createElement;

    function StatusBadge(props) {
      return e('span', { className: 'octie-badge octie-' + props.status }, props.status);
    }

    function TaskRow(props) {
      const t = props.task;
      return e('button', {
        className: 'octie-task-row',
        onClick: () => {
          const base = '/api/octie/task?project=' + encodeURIComponent(state.project || '') + '&id=' + encodeURIComponent(t.id);
          fetchJson(base).then((task) => patch({ selectedTask: task })).catch(() => {});
        },
      }, e('span', { className: 'octie-task-title' }, t.title), StatusBadge({ status: t.status }));
    }

    function DetailPopup() {
      const t = state.selectedTask;
      if (!t) return null;
      const criteria = (t.success_criteria || []).map((c) => e('li', { key: c.id }, c.text + (c.completed ? ' \u2713' : '')));
      const deliverables = (t.deliverables || []).map((d) => e('li', { key: d.id }, d.text + (d.completed ? ' \u2713' : '')));
      return e('div', { className: 'octie-popup-backdrop', onClick: () => patch({ selectedTask: null }) },
        e('div', { className: 'octie-popup', onClick: (ev) => ev.stopPropagation() },
          e('h3', null, t.title),
          e('p', { className: 'octie-popup-desc' }, t.description),
          e('h4', null, 'Criteria'),
          e('ul', null, criteria),
          e('h4', null, 'Deliverables'),
          e('ul', null, deliverables),
          e('button', { className: 'octie-close', onClick: () => patch({ selectedTask: null }) }, 'Close'),
        ));
    }

    function Panel() {
      const s = useOctieState();
      React.useEffect(() => {
        refresh();
        return connectSse();
      }, []);
      if (!s.open) return null;
      const options = s.projects.map((p) => e('option', { key: p.path, value: p.path }, p.name));
      const rows = (s.tasks || []).map((t) => e(TaskRow, { key: t.id, task: t }));
      const counts = s.graph && s.graph.byStatus
        ? Object.entries(s.graph.byStatus).map(([k, v]) => k + ' ' + v).join(' \u00b7 ')
        : '';
      return e('div', { className: 'octie-panel' },
        e('div', { className: 'octie-panel-header' },
          e('strong', null, 'Octie Tasks'),
          e('button', { className: 'octie-close', onClick: () => patch({ open: false }) }, '\u00d7'),
        ),
        e('select', {
          className: 'octie-project-select',
          value: s.project || '',
          onChange: (ev) => { patch({ project: ev.target.value }); refresh(); },
        }, options),
        counts ? e('div', { className: 'octie-counts' }, counts) : null,
        e('div', { className: 'octie-task-list' }, rows.length ? rows : e('div', { className: 'octie-empty' }, 'No tasks')),
        s.error ? e('div', { className: 'octie-error' }, String(s.error)) : null,
        DetailPopup(),
      );
    }

    function FooterButton() {
      const s = useOctieState();
      return e('button', {
        className: 'octie-footer-button',
        title: 'Octie tasks',
        onClick: () => patch({ open: !s.open }),
      }, 'Octie');
    }

    // Injected during materialization: the module loader claims and removes it.
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = [
        '.octie-panel{position:fixed;top:48px;right:8px;bottom:8px;width:340px;display:flex;flex-direction:column;z-index:1000;pointer-events:auto;background:var(--color-bg,#1e1f22);color:var(--color-text,#e6e6e6);border:1px solid rgba(128,128,128,.3);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:13px/1.4 system-ui,sans-serif}',
        '.octie-panel-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(128,128,128,.2)}',
        '.octie-close{background:none;border:none;color:inherit;cursor:pointer;font-size:16px}',
        '.octie-project-select{margin:10px 12px;padding:6px;background:transparent;color:inherit;border:1px solid rgba(128,128,128,.4);border-radius:6px}',
        '.octie-task-list{flex:1;overflow-y:auto;padding:0 8px 8px}',
        '.octie-task-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;padding:8px 10px;margin:2px 0;background:rgba(255,255,255,.04);border:1px solid transparent;border-radius:6px;color:inherit;cursor:pointer}',
        '.octie-task-row:hover{background:rgba(255,255,255,.09)}',
        '.octie-task-title{flex:1;margin-right:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.octie-badge{font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(128,128,128,.2)}',
        '.octie-ready{color:#8ab4f8}.octie-in_progress{color:#fdd663}.octie-in_review{color:#b39dfb}.octie-completed{color:#81c995}.octie-blocked{color:#f28b82}',
        '.octie-counts{padding:0 12px 8px;color:rgba(230,230,230,.6);font-size:12px}',
        '.octie-empty{padding:20px;text-align:center;color:rgba(230,230,230,.5)}',
        '.octie-error{padding:0 12px;color:#f28b82;font-size:12px}',
        '.octie-popup-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1100}',
        '.octie-popup{width:min(560px,90vw);max-height:80vh;overflow-y:auto;background:var(--color-bg,#1e1f22);color:var(--color-text,#e6e6e6);border-radius:10px;padding:16px 20px;box-shadow:0 12px 40px rgba(0,0,0,.5)}',
        '.octie-popup h3{margin:0 0 8px}.octie-popup h4{margin:12px 0 4px}.octie-popup ul{margin:0;padding-left:18px}',
        '.octie-popup-desc{color:rgba(230,230,230,.75)}',
        '.octie-footer-button{background:none;border:none;color:inherit;cursor:pointer;font:inherit}',
      ].join('\n');
      document.head.appendChild(style);
    }

    return {
      name: 'octie-dsh-client',
      apply(ctx) {
        const slots = ctx.get('slots');
        if (slots === undefined) return;

        slots.inject('sidebar.footer.action', () => slots.register(
          { name: 'sidebar.footer.action', id: 'octie-panel', order: 90, label: 'Octie' },
          () => e(FooterButton),
        ));

        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'octie-panel', order: 90 },
          () => e(Panel),
        ));
      },
    };
  },
});
