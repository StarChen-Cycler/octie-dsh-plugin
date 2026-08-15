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
      view: 'list',
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

    // Canonical status colors from the original octie web UI design tokens
    // (octie/web-ui/src/design-tokens.css): ready #ff9f1c, in_progress #00d4ff,
    // in_review #a78bfa, completed #10b981, blocked #f43f5e.
    const STATUS_COLORS = {
      ready: '#ff9f1c', in_progress: '#00d4ff', in_review: '#a78bfa',
      completed: '#10b981', blocked: '#f43f5e',
    };

    function StatusBadge(props) {
      return e('span', { className: 'octie-badge octie-' + props.status }, props.status);
    }

    function TaskRow(props) {
      const t = props.task;
      return e('button', {
        className: 'octie-task-row',
        onClick: () => openDetail(t.id),
      }, e('span', { className: 'octie-task-title' }, t.title), StatusBadge({ status: t.status }));
    }

    function openDetail(id) {
      const base = '/api/octie/task?project=' + encodeURIComponent(state.project || '') + '&id=' + encodeURIComponent(id);
      fetchJson(base).then((task) => patch({ selectedTask: task })).catch(() => {});
    }

    function shortId(id) { return id ? id.slice(0, 7) : ''; }

    // Project picker: indented by subproject depth, so a parent's subprojects
    // (and sub-subprojects) group visually under it.
    function projectDepth(path) {
      return ((path || '').replace(/\\/g, '/').match(/\/\.octie\/subprojects\//g) || []).length;
    }
    function projectOptions(projects) {
      const norm = (p) => (p.path || '').replace(/\\/g, '/');
      const sorted = [...projects].sort((a, b) => norm(a.path).localeCompare(norm(b.path)));
      return sorted.map((p) => {
        const d = projectDepth(p.path);
        const label = (d > 0 ? '\u00a0\u00a0'.repeat(d) + '\u21b3 ' : '') + p.name;
        return e('option', { key: p.path, value: p.path }, label);
      });
    }

    // Live layered force simulation. Y is pinned to dependency depth (roots/ready
    // on top, deeper/blocked toward the bottom); X relaxes toward a force
    // equilibrium (repulsion + edge spring + centering) under temperature
    // annealing, like Obsidian's organic settling. Positions are applied
    // imperatively (no React re-render per frame) and the loop stops once cool.
    function buildSim(tasks) {
      const nodes = (tasks || []).map((t) => ({
        id: t.id, title: t.title, status: t.status, blockers: t.blockers || [],
        level: 0, x: 0, y: 0, vx: 0,
      }));
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const edges = [];
      for (const n of nodes) for (const b of n.blockers) if (byId.has(b)) edges.push([b, n.id]);
      for (let pass = 0; pass <= nodes.length; pass++) {
        let changed = false;
        for (const n of nodes) {
          let lv = 0;
          for (const b of n.blockers) { const bb = byId.get(b); if (bb) lv = Math.max(lv, bb.level + 1); }
          if (lv !== n.level) { n.level = lv; changed = true; }
        }
        if (!changed) break;
      }
      const W = 320, levelGap = 58;
      const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0);
      const H = Math.max(200, 28 + maxLevel * levelGap + 28);
      for (const n of nodes) n.y = 28 + n.level * levelGap;
      const byLevel = new Map();
      for (const n of nodes) { if (!byLevel.has(n.level)) byLevel.set(n.level, []); byLevel.get(n.level).push(n); }
      for (const [, list] of byLevel) {
        list.sort((a, b) => (a.id < b.id ? -1 : 1));
        const span = W - 48;
        list.forEach((n, i) => { n.x = 24 + (list.length === 1 ? span / 2 : (i * span) / (list.length - 1)); });
      }
      return { nodes, edges, byId, W, H, levelGap, alpha: 1, dragging: null };
    }

    // One simulation step on X only (the dragged node's x is pinned by the pointer).
    function tickSim(sim) {
      const { nodes, edges, byId, W, levelGap } = sim;
      const alpha = sim.alpha;
      const fx = new Map(nodes.map((n) => [n.id, 0]));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dy = a.y - b.y;
          if (Math.abs(dy) > levelGap * 1.2) continue;
          let dx = a.x - b.x;
          if (Math.abs(dx) < 0.5) dx = 0.5 * (i < j ? -1 : 1);
          const d2 = dx * dx + dy * dy + 4;
          const f = 1400 / d2; // repulsion
          fx.set(a.id, fx.get(a.id) + f * dx);
          fx.set(b.id, fx.get(b.id) - f * dx);
        }
      }
      const rest = 52;
      for (const [s, t] of edges) {
        const a = byId.get(s), b = byId.get(t);
        if (!a || !b) continue;
        const dx = a.x - b.x;
        const f = 0.05 * (Math.abs(dx) - rest) * (dx >= 0 ? 1 : -1); // spring
        fx.set(a.id, fx.get(a.id) - f);
        fx.set(b.id, fx.get(b.id) + f);
      }
      for (const n of nodes) {
        if (sim.dragging === n.id) continue;
        const f = fx.get(n.id) || 0;
        n.vx = (n.vx + f * alpha) * 0.82; // integrate + velocity decay
        n.x += n.vx;
        n.x += (W / 2 - n.x) * 0.03 * alpha; // center
        n.x = Math.max(12, Math.min(W - 12, n.x));
      }
      sim.alpha = Math.max(0.02, sim.alpha * 0.96); // temperature cool
    }

    function applySim(sim, nodeEls, edgeEls) {
      for (const n of sim.nodes) {
        const el = nodeEls.get(n.id);
        if (el) { el.setAttribute('cx', n.x); el.setAttribute('cy', n.y); }
      }
      sim.edges.forEach(([s, t], i) => {
        const line = edgeEls.get(i);
        const a = sim.byId.get(s), b = sim.byId.get(t);
        if (line && a && b) {
          line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
          line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        }
      });
    }

    function GraphView(props) {
      const tasks = props.tasks || [];
      const tasksKey = tasks.map((t) => t.id).join('|');
      const sim = React.useMemo(() => buildSim(tasks), [tasksKey]);
      const simRef = React.useRef(sim);
      const nodeElsRef = React.useRef(new Map());
      const edgeElsRef = React.useRef(new Map());
      const rafRef = React.useRef(null);
      const dragMovedRef = React.useRef(false);
      const [hover, setHover] = React.useState(null);

      function loop() {
        const s = simRef.current;
        if (!s) { rafRef.current = null; return; }
        if (s.dragging === null && s.alpha <= 0.02) {
          applySim(s, nodeElsRef.current, edgeElsRef.current);
          rafRef.current = null; // settled → stop consuming CPU
          return;
        }
        tickSim(s);
        applySim(s, nodeElsRef.current, edgeElsRef.current);
        rafRef.current = requestAnimationFrame(loop);
      }
      function startLoop() {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(loop);
      }

      React.useEffect(() => {
        simRef.current = sim;
        sim.alpha = 1;
        startLoop();
        return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
      }, [sim]);

      function onDown(ev, node) {
        ev.preventDefault();
        const s = simRef.current;
        dragMovedRef.current = false;
        s.dragging = node.id;
        s.alpha = 0.5;
        startLoop();
        const startX = ev.clientX, startNodeX = node.x;
        const move = (e2) => {
          const dx = e2.clientX - startX;
          if (Math.abs(dx) > 4) dragMovedRef.current = true;
          node.x = Math.max(12, Math.min(s.W - 12, startNodeX + dx));
          applySim(s, nodeElsRef.current, edgeElsRef.current);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          s.dragging = null;
          s.alpha = 0.35;
          startLoop();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }

      function onEnter(ev, node) {
        const r = ev.currentTarget.getBoundingClientRect();
        setHover({ title: node.title, status: node.status, id: node.id, left: r.left, top: r.top });
      }

      const byId = sim.byId;
      const arrow = e('defs', null, e('marker', {
        id: 'octie-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse',
      }, e('path', { d: 'M 0 0 L 10 5 L 0 10 z', className: 'octie-arrow' })));
      const lines = sim.edges.map(([s, t], i) => {
        const a = byId.get(s), b = byId.get(t);
        return e('line', {
          key: 'e' + i,
          ref: (el) => { if (el) edgeElsRef.current.set(i, el); else edgeElsRef.current.delete(i); },
          x1: a ? a.x : 0, y1: a ? a.y : 0, x2: b ? b.x : 0, y2: b ? b.y : 0,
          className: 'octie-edge', markerEnd: 'url(#octie-arrow)',
        });
      });
      const dots = sim.nodes.map((n) => e('circle', {
        key: n.id,
        ref: (el) => { if (el) nodeElsRef.current.set(n.id, el); else nodeElsRef.current.delete(n.id); },
        cx: n.x, cy: n.y, r: 6,
        className: 'octie-node octie-node-' + n.status,
        onClick: () => { if (!dragMovedRef.current) openDetail(n.id); },
        onPointerDown: (ev) => onDown(ev, n),
        onPointerEnter: (ev) => onEnter(ev, n),
        onPointerLeave: () => setHover(null),
      }));
      const tooltip = hover ? e('div', {
        className: 'octie-tooltip',
        style: { left: hover.left - 8, top: hover.top - 8 },
      }, e('strong', null, hover.title),
        e('span', { className: 'octie-tooltip-meta', style: { color: STATUS_COLORS[hover.status] || '#e6e6e6' } }, shortId(hover.id) + ' \u00b7 ' + hover.status)) : null;

      if (sim.nodes.length === 0) return e('div', { className: 'octie-empty' }, 'No tasks');
      return e('div', { className: 'octie-graph-wrap' },
        e('svg', { className: 'octie-graph', viewBox: '0 0 ' + sim.W + ' ' + sim.H, preserveAspectRatio: 'xMidYMid meet' }, arrow, lines, dots),
        tooltip,
      );
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
      const options = projectOptions(s.projects);
      const rows = (s.tasks || []).map((t) => e(TaskRow, { key: t.id, task: t }));
      const counts = s.graph && s.graph.byStatus
        ? Object.entries(s.graph.byStatus).map(([k, v]) => k + ' ' + v).join(' \u00b7 ')
        : '';
      const body = s.view === 'graph'
        ? e(GraphView, { tasks: s.tasks || [] })
        : e('div', { className: 'octie-task-list' }, rows.length ? rows : e('div', { className: 'octie-empty' }, 'No tasks'));
      return e('div', { className: 'octie-panel' },
        e('div', { className: 'octie-panel-header' },
          e('strong', null, 'Octie Tasks'),
          e('div', { className: 'octie-header-actions' },
            e('button', {
              className: 'octie-toggle',
              title: s.view === 'graph' ? 'Switch to list' : 'Switch to graph',
              onClick: () => patch({ view: s.view === 'graph' ? 'list' : 'graph' }),
            }, s.view === 'graph' ? 'List' : 'Graph'),
            e('button', { className: 'octie-close', onClick: () => patch({ open: false }) }, '\u00d7'),
          ),
        ),
        e('select', {
          className: 'octie-project-select',
          value: s.project || '',
          onChange: (ev) => { patch({ project: ev.target.value }); refresh(); },
        }, options),
        counts ? e('div', { className: 'octie-counts' }, counts) : null,
        body,
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
        '.octie-header-actions{display:flex;align-items:center;gap:8px}',
        '.octie-toggle{background:none;border:1px solid rgba(128,128,128,.4);border-radius:6px;color:inherit;cursor:pointer;padding:2px 8px;font:inherit}',
        '.octie-graph{flex:1;width:100%;height:100%;min-height:0}',
        '.octie-graph-wrap{flex:1;position:relative;min-height:0;display:flex}',
        '.octie-tooltip{position:fixed;pointer-events:none;background:#000;border:1px solid rgba(128,128,128,.4);border-radius:6px;padding:6px 8px;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,.5);transform:translate(-100%,-100%);z-index:1200;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.octie-tooltip strong{display:block;overflow:hidden;text-overflow:ellipsis}',
        '.octie-tooltip-meta{color:rgba(230,230,230,.6);font-size:11px}',
        '.octie-node{cursor:pointer}',
        '.octie-node-ready{fill:#ff9f1c;filter:drop-shadow(0 0 5px rgba(255,159,28,.5))}',
        '.octie-node-in_progress{fill:#00d4ff;filter:drop-shadow(0 0 5px rgba(0,212,255,.5))}',
        '.octie-node-in_review{fill:#a78bfa;filter:drop-shadow(0 0 5px rgba(167,139,250,.5))}',
        '.octie-node-completed{fill:#10b981;filter:drop-shadow(0 0 5px rgba(16,185,129,.5))}',
        '.octie-node-blocked{fill:#f43f5e;filter:drop-shadow(0 0 5px rgba(244,63,94,.5))}',
        '.octie-edge{stroke:rgba(160,160,160,.4);stroke-width:1}',
        '.octie-arrow{fill:rgba(160,160,160,.5)}',
        '.octie-project-select{margin:10px 12px;padding:6px;background:#1e1f22;color:#e6e6e6;border:1px solid rgba(128,128,128,.4);border-radius:6px}',
        '.octie-project-select option{background:#1e1f22;color:#e6e6e6}',
        '.octie-task-list{flex:1;overflow-y:auto;padding:0 8px 8px}',
        '.octie-task-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;padding:8px 10px;margin:2px 0;background:rgba(255,255,255,.04);border:1px solid transparent;border-radius:6px;color:inherit;cursor:pointer}',
        '.octie-task-row:hover{background:rgba(255,255,255,.09)}',
        '.octie-task-title{flex:1;margin-right:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.octie-badge{font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(128,128,128,.2)}',
        '.octie-ready{color:#ff9f1c}.octie-in_progress{color:#00d4ff}.octie-in_review{color:#a78bfa}.octie-completed{color:#10b981}.octie-blocked{color:#f43f5e}',
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
