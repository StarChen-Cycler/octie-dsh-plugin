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
      physics: true,
      projects: [],
      project: null,
      tasks: [],
      graph: null,
      selectedTask: null,
      hover: null,
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

    function connectSse(project) {
      const url = '/api/octie/events' + (project ? '?project=' + encodeURIComponent(project) : '');
      const es = new EventSource(url);
      // Any host-side change (in-session tool event, the Node half's .octie
      // file watcher, or the mtime fallback poll) → re-read state for the
      // list + graph + picker.
      es.onmessage = () => refresh();
      // Self-heal: if the stream errors (dropped connection, server restart),
      // immediately re-read state; EventSource itself reconnects automatically.
      es.onerror = () => refresh();
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
    // Canonical priority colors (design-tokens.css --priority-top/second/later).
    const PRIORITY_COLORS = { top: '#f43f5e', second: '#ff9f1c', later: '#6e7681' };
    // Section accent colors mirroring the original TaskDetail view.
    const SEC_COLORS = { cyan: '#00d4ff', amber: '#ff9f1c', rose: '#f43f5e', violet: '#a78bfa', emerald: '#10b981' };

    // List view execution order: kanban flow first (ready → in_progress →
    // in_review → blocked → completed), then priority (top → second → later),
    // then title alphabetical.
    const STATUS_ORDER = { ready: 0, in_progress: 1, in_review: 2, blocked: 3, completed: 4 };
    const PRIORITY_ORDER = { top: 0, second: 1, later: 2 };
    function sortTasks(tasks) {
      return [...(tasks || [])].sort((a, b) => {
        const ds = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5);
        if (ds !== 0) return ds;
        const dp = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (dp !== 0) return dp;
        return (a.title || '').localeCompare(b.title || '');
      });
    }

    function StatusBadge(props) {
      return e('span', { className: 'octie-badge octie-' + props.status }, props.status);
    }

    function PriorityTag(props) {
      const color = PRIORITY_COLORS[props.priority] || '#6e7681';
      return e('span', { className: 'octie-tag', style: { color: color, background: color + '22' } }, props.priority);
    }

    function TaskRow(props) {
      const t = props.task;
      return e('button', {
        className: 'octie-task-row',
        onClick: () => openDetail(t.id),
        onPointerEnter: (ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          patch({ hover: { title: t.title, status: t.status, id: t.id, left: r.left, top: r.top } });
        },
        onPointerLeave: () => patch({ hover: null }),
      },
        e('span', { className: 'octie-task-title' }, t.title),
        e('span', { className: 'octie-row-badges' },
          StatusBadge({ status: t.status }),
          PriorityTag({ priority: t.priority }),
        ));
    }

    function openDetail(id) {
      const base = '/api/octie/task?project=' + encodeURIComponent(state.project || '') + '&id=' + encodeURIComponent(id);
      fetchJson(base).then((task) => patch({ selectedTask: task })).catch(() => {});
    }

    function shortId(id) { return id ? id.slice(0, 7) : ''; }

    // Project picker: ranked by the latest task-graph change (project.json
    // mtime, served as lastUpdated) with a relative-time hint, and indented by
    // subproject depth so a parent's subprojects (and sub-subprojects) group
    // visually under it.
    function projectDepth(path) {
      return ((path || '').replace(/\\/g, '/').match(/\/\.octie\/subprojects\//g) || []).length;
    }
    function relTime(iso) {
      if (!iso) return '';
      const ms = Date.now() - new Date(iso).getTime();
      if (!Number.isFinite(ms) || ms < 0) return '';
      const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
      if (ms < MIN) return 'just now';
      if (ms < HOUR) return Math.floor(ms / MIN) + 'm ago';
      if (ms < DAY) return Math.floor(ms / HOUR) + 'h ago';
      if (ms < 30 * DAY) return Math.floor(ms / DAY) + 'd ago';
      return Math.floor(ms / (30 * DAY)) + 'mo ago';
    }
    function projectOptions(projects) {
      const sorted = [...(projects || [])].sort((a, b) =>
        (b.lastUpdated || '').localeCompare(a.lastUpdated || '') ||
        (a.name || '').localeCompare(b.name || ''));
      return sorted.map((p) => {
        const d = projectDepth(p.path);
        const ago = relTime(p.lastUpdated);
        const label = (d > 0 ? '\u00a0\u00a0'.repeat(d) + '\u21b3 ' : '') + p.name +
          (ago ? '  \u00b7  ' + ago : '');
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
        level: 0, x: 0, y: 0, vx: 0, vx0: null,
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

      // Barycenter ordering (Sugiyama): minimize edge crossings by sorting
      // each level on the mean neighbor order index (down+up sweeps), then
      // give every node an evenly spaced target x in the final order. Nodes
      // with no neighbors keep their id order (they add no crossings). The
      // force sim's hidden target springs then settle the layout near these
      // crossing-minimized, stable positions.
      const dependents = new Map();
      for (const [s, t] of edges) {
        if (!dependents.has(s)) dependents.set(s, []);
        dependents.get(s).push(t);
      }
      const levelOrder = new Map();
      for (const [lv, list] of byLevel) {
        list.sort((a, b) => (a.id < b.id ? -1 : 1));
        levelOrder.set(lv, list.map((n) => n.id));
      }
      const orderIndexOf = (lv) => {
        const m = new Map();
        (levelOrder.get(lv) || []).forEach((id, i) => m.set(id, i));
        return m;
      };
      for (let sweep = 0; sweep < 4; sweep++) {
        for (let lv = 1; lv <= maxLevel; lv++) {
          const parentIdx = orderIndexOf(lv - 1);
          const curIdx = orderIndexOf(lv);
          const keyed = (levelOrder.get(lv) || []).map((id) => {
            const n = byId.get(id);
            let sum = 0, count = 0;
            for (const b of n.blockers) {
              const idx = parentIdx.get(b);
              if (idx !== undefined) { sum += idx; count++; }
            }
            return { id, bary: count > 0 ? sum / count : curIdx.get(id) };
          });
          keyed.sort((a, b) => a.bary - b.bary);
          levelOrder.set(lv, keyed.map((k) => k.id));
        }
        for (let lv = maxLevel - 1; lv >= 0; lv--) {
          const childIdx = orderIndexOf(lv + 1);
          const curIdx = orderIndexOf(lv);
          const keyed = (levelOrder.get(lv) || []).map((id) => {
            const kids = dependents.get(id) || [];
            let sum = 0, count = 0;
            for (const c of kids) {
              const idx = childIdx.get(c);
              if (idx !== undefined) { sum += idx; count++; }
            }
            return { id, bary: count > 0 ? sum / count : curIdx.get(id) };
          });
          keyed.sort((a, b) => a.bary - b.bary);
          levelOrder.set(lv, keyed.map((k) => k.id));
        }
      }
      const spanX = W - 48;
      for (const [, ids] of levelOrder) {
        ids.forEach((id, i) => {
          const n = byId.get(id);
          n.vx0 = ids.length === 1 ? W / 2 : 24 + (i * spanX) / (ids.length - 1);
          n.x = n.vx0; // start near the crossing-minimized equilibrium
        });
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
          const f = 250 / d2; // repulsion
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
      // Hidden target springs hold every node near its crossing-minimized x.
      for (const n of nodes) {
        if (n.vx0 !== null && sim.dragging !== n.id) {
          fx.set(n.id, fx.get(n.id) + (n.vx0 - n.x) * 0.15);
        }
      }
      for (const n of nodes) {
        if (sim.dragging === n.id) continue;
        const f = fx.get(n.id) || 0;
        n.vx = (n.vx + f * alpha) * 0.6; // integrate + velocity decay
        n.x += n.vx;
        n.x += (W / 2 - n.x) * 0.02 * alpha; // center
        n.x = Math.max(12, Math.min(W - 12, n.x));
      }
      sim.alpha = Math.max(0.02, sim.alpha * 0.98); // temperature cool
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
      // The key must cover everything the graph renders: a status change
      // (update/approve) or a blocker change (wire) must rebuild the sim so
      // node classes pick up the new status color — keying by id alone kept
      // stale node colors in the graph view after updates.
      const tasksKey = tasks
        .map((t) => t.id + ':' + t.status + ':' + (t.blockers || []).join(','))
        .join('|');
      const { physics } = useOctieState();
      const sim = React.useMemo(() => buildSim(tasks), [tasksKey]);
      const simRef = React.useRef(sim);
      const nodeElsRef = React.useRef(new Map());
      const edgeElsRef = React.useRef(new Map());
      const rafRef = React.useRef(null);
      const dragMovedRef = React.useRef(false);
      const physicsRef = React.useRef(physics);
      const prevPhysicsRef = React.useRef(physics);
      physicsRef.current = physics;

      function loop() {
        const s = simRef.current;
        if (!s) { rafRef.current = null; return; }

        // Silky stop: physics was just turned off — glide every node back to
        // the tidy crossing-minimized layout (vx0 targets), then freeze. A
        // node under the pointer keeps following it until release, then it
        // glides home too.
        if (s.coasting) {
          let maxD = 0;
          for (const n of s.nodes) {
            if (s.dragging === n.id) continue;
            if (n.vx0 !== null) {
              const target = Math.max(12, Math.min(s.W - 12, n.vx0));
              n.x += (target - n.x) * 0.16;
              maxD = Math.max(maxD, Math.abs(target - n.x));
            }
          }
          applySim(s, nodeElsRef.current, edgeElsRef.current);
          if (maxD < 0.4) {
            for (const n of s.nodes) {
              if (n.vx0 !== null) n.x = Math.max(12, Math.min(s.W - 12, n.vx0));
            }
            s.coasting = false;
            applySim(s, nodeElsRef.current, edgeElsRef.current);
            rafRef.current = null;
            return;
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // Physics off: static — no force integration at all.
        if (!physicsRef.current) {
          applySim(s, nodeElsRef.current, edgeElsRef.current);
          rafRef.current = null;
          return;
        }

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
      // Reheat with a small horizontal perturbation so the force system is
      // instantly visible: repulsion + target springs wobble everything back
      // to the crossing-minimized equilibrium.
      function reheat(magnitude) {
        const s = simRef.current;
        if (!s) return;
        for (const n of s.nodes) n.x = Math.max(12, Math.min(s.W - 12, n.x + (Math.random() - 0.5) * magnitude));
        s.coasting = false;
        s.alpha = 0.6;
        startLoop();
      }

      React.useEffect(() => {
        simRef.current = sim;
        if (physicsRef.current) reheat(12); // initial visible settle when physics is on
        return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
      }, [sim]);

      // Physics toggle transitions (skip the mount run — mount is handled above).
      React.useEffect(() => {
        if (prevPhysicsRef.current === physics) return;
        prevPhysicsRef.current = physics;
        const s = simRef.current;
        if (!s) return;
        if (physics) {
          reheat(12);
        } else {
          s.coasting = true; // glide home to the tidy layout instead of snapping
          startLoop();
        }
      }, [physics]);

      function onDown(ev, node) {
        ev.preventDefault();
        const s = simRef.current;
        dragMovedRef.current = false;
        const startX = ev.clientX, startNodeX = node.x;
        let dragging = false;
        const move = (e2) => {
          const dx = e2.clientX - startX;
          if (Math.abs(dx) <= 4) return; // plain click: no force, no pinning
          dragMovedRef.current = true;
          if (!dragging) {
            // First real movement: only now engage the drag forces.
            dragging = true;
            s.dragging = node.id;
            s.alpha = 0.5;
            startLoop();
          }
          node.x = Math.max(12, Math.min(s.W - 12, startNodeX + dx));
          applySim(s, nodeElsRef.current, edgeElsRef.current);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (dragging) {
            s.dragging = null;
            s.alpha = 0.35;
            startLoop();
          }
          // Simple click: nothing is reheated; onClick opens the detail.
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }

      function onEnter(ev, node) {
        const r = ev.currentTarget.getBoundingClientRect();
        patch({ hover: { title: node.title, status: node.status, id: node.id, left: r.left, top: r.top } });
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
        onPointerLeave: () => patch({ hover: null }),
      }));
      if (sim.nodes.length === 0) return e('div', { className: 'octie-empty' }, 'No tasks');
      return e('div', { className: 'octie-graph-wrap' },
        e('label', {
          className: 'octie-physics-switch',
          title: physics
            ? 'Physics on \u2014 forces react when you drag a node; turn off for a static layout'
            : 'Physics off \u2014 nodes glide back to the tidy layout and freeze',
        },
          e('input', { type: 'checkbox', checked: physics, onChange: (ev) => patch({ physics: !!ev.target.checked }) }),
          e('span', { className: 'octie-physics-track' }, e('span', { className: 'octie-physics-thumb' })),
          e('span', { className: 'octie-physics-label' }, 'Physics'),
        ),
        e('svg', { className: 'octie-graph', viewBox: '0 0 ' + sim.W + ' ' + sim.H, preserveAspectRatio: 'xMidYMid meet' }, arrow, lines, dots),
      );
    }

    function DetailPopup() {
      const t = state.selectedTask;
      if (!t) return null;

      const statusColor = STATUS_COLORS[t.status] || '#e6e6e6';
      const priorityColor = PRIORITY_COLORS[t.priority] || '#6e7681';

      const sectionTitle = (label, count, color) => e('h4', { className: 'octie-section-title' },
        e('span', { style: color ? { color: color } : null }, label),
        count !== undefined ? e('span', { className: 'octie-section-count', style: color ? { color: color } : null }, '  ' + count) : null);

      const check = (done, accent) => e('span', {
        className: 'octie-check' + (done ? ' octie-check-on' : ''),
        style: !done && accent ? { borderColor: accent, background: accent + '2e' } : null,
      }, done ? '\u2713' : '');

      const criteria = (t.success_criteria || []).map((c) => e('li', { key: c.id, className: 'octie-li' },
        check(c.completed),
        e('div', { className: 'octie-li-body' },
          e('span', { className: c.completed ? 'octie-done' : '' }, c.text),
          c.evidence ? e('div', { className: 'octie-mono-muted' }, 'Evidence: ' + c.evidence) : null,
        )));
      const critDone = (t.success_criteria || []).filter((c) => c.completed).length;

      const deliverables = (t.deliverables || []).map((d) => e('li', { key: d.id, className: 'octie-li' },
        check(d.completed),
        e('div', { className: 'octie-li-body' },
          e('span', { className: d.completed ? 'octie-done' : '' }, d.text),
          d.file_path ? e('code', { className: 'octie-chip' }, d.file_path) : null,
        )));
      const delDone = (t.deliverables || []).filter((d) => d.completed).length;

      const needFix = (t.need_fix || []).map((f) => e('li', { key: f.id, className: 'octie-li' },
        check(f.completed, SEC_COLORS.rose),
        e('div', { className: 'octie-li-body' },
          e('span', { className: f.completed ? 'octie-done' : '' }, f.text),
          f.file_path ? e('code', { className: 'octie-chip' }, f.file_path) : null,
          f.source ? e('span', { className: 'octie-source-chip' }, f.source) : null,
        )));
      const fixDone = (t.need_fix || []).filter((f) => f.completed).length;

      const related = (t.related_files || []).map((f, i) => e('li', { key: 'rf' + i }, e('code', { className: 'octie-chip' }, f)));
      const blockers = (t.blockers || []).map((b, i) => e('li', { key: 'bl' + i }, e('code', { className: 'octie-chip octie-chip-rose' }, b)));
      const subs = (t.sub_items || []).map((s, i) => e('li', { key: 'sub' + i }, e('code', { className: 'octie-chip' }, s)));
      const c7 = (t.c7_verified || []).map((v, i) => e('li', { key: 'c7' + i, className: 'octie-c7-box' },
        e('code', { className: 'octie-mono-cyan' }, v.library_id),
        v.notes ? e('p', { className: 'octie-muted' }, v.notes) : null,
        v.verified_at ? e('p', { className: 'octie-mono-muted' }, 'Verified: ' + new Date(v.verified_at).toLocaleString()) : null,
      ));

      const fmt = (iso) => { if (!iso) return ''; try { return new Date(iso).toLocaleString(); } catch { return String(iso); } };

      return e('div', { className: 'octie-popup-backdrop', onClick: () => patch({ selectedTask: null }) },
        e('div', { className: 'octie-popup', onClick: (ev) => ev.stopPropagation() },
          e('button', { className: 'octie-close octie-popup-close', onClick: () => patch({ selectedTask: null }) }, '\u00d7'),
          e('div', { className: 'octie-popup-head' },
            e('code', { className: 'octie-popup-id' }, t.id),
            e('h3', { className: 'octie-popup-title' }, t.title),
            e('div', { className: 'octie-popup-badges' },
              e('span', { className: 'octie-status-chip', style: { background: statusColor + '22', color: statusColor } }, (t.status || '').replace('_', ' ')),
              e('span', { className: 'octie-status-chip', style: { background: priorityColor + '22', color: priorityColor } }, t.priority || ''),
            ),
          ),
          t.description ? e('div', { className: 'octie-section' },
            sectionTitle('Description'),
            e('p', { className: 'octie-desc' }, t.description)) : null,
          criteria.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Success Criteria', '(' + critDone + '/' + criteria.length + ')', SEC_COLORS.cyan),
            e('ul', { className: 'octie-ul' }, criteria)) : null,
          deliverables.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Deliverables', '(' + delDone + '/' + deliverables.length + ')', SEC_COLORS.amber),
            e('ul', { className: 'octie-ul' }, deliverables)) : null,
          needFix.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Need Fix', '(' + fixDone + '/' + needFix.length + ')', SEC_COLORS.rose),
            e('ul', { className: 'octie-ul' }, needFix)) : null,
          blockers.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Blocked By', '(' + blockers.length + ')', SEC_COLORS.rose),
            e('ul', { className: 'octie-ul octie-ul-inline' }, blockers)) : null,
          t.dependencies ? e('div', { className: 'octie-section' },
            sectionTitle('Dependencies'),
            e('div', { className: 'octie-box', style: { borderLeftColor: SEC_COLORS.amber } }, t.dependencies)) : null,
          related.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Related Files'),
            e('ul', { className: 'octie-ul octie-ul-inline' }, related)) : null,
          subs.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('Sub-tasks', '(' + subs.length + ')'),
            e('ul', { className: 'octie-ul octie-ul-inline' }, subs)) : null,
          c7.length > 0 ? e('div', { className: 'octie-section' },
            sectionTitle('C7 Verified', '(' + c7.length + ')', SEC_COLORS.cyan),
            e('ul', { className: 'octie-ul' }, c7)) : null,
          t.notes ? e('div', { className: 'octie-section' },
            sectionTitle('Notes'),
            e('div', { className: 'octie-box', style: { borderLeftColor: SEC_COLORS.violet } }, t.notes)) : null,
          e('div', { className: 'octie-meta' },
            e('div', { className: 'octie-meta-row' }, e('span', { className: 'octie-meta-label' }, 'Created'), e('span', { className: 'octie-mono-muted' }, fmt(t.created_at))),
            e('div', { className: 'octie-meta-row' }, e('span', { className: 'octie-meta-label' }, 'Updated'), e('span', { className: 'octie-mono-muted' }, fmt(t.updated_at))),
            t.completed_at ? e('div', { className: 'octie-meta-row' }, e('span', { className: 'octie-meta-label' }, 'Completed'), e('span', { className: 'octie-mono-muted', style: { color: SEC_COLORS.emerald } }, fmt(t.completed_at))) : null,
            t.assignee ? e('div', { className: 'octie-meta-row' }, e('span', { className: 'octie-meta-label' }, 'Assignee'), e('span', { className: 'octie-mono-muted' }, t.assignee)) : null,
            t.edges && t.edges.length > 0 ? e('div', { className: 'octie-meta-row' }, e('span', { className: 'octie-meta-label' }, 'Unlocks'), e('span', { className: 'octie-mono-muted' }, t.edges.length + ' task(s)')) : null,
          ),
        ));
    }

    // Shared hover tooltip for both the list rows and the graph nodes: the
    // full title plus a status-colored short id + status line.
    function tooltipOf(hover) {
      if (!hover) return null;
      return e('div', {
        className: 'octie-tooltip',
        style: { left: hover.left - 8, top: hover.top - 8 },
      },
        e('strong', null, hover.title),
        e('span', { className: 'octie-tooltip-meta', style: { color: STATUS_COLORS[hover.status] || '#e6e6e6' } }, shortId(hover.id) + ' \u00b7 ' + hover.status));
    }

    function Panel() {
      const s = useOctieState();
      React.useEffect(() => {
        refresh();
        // Reconnect the SSE channel when the viewed project changes so the
        // Node half's .octie file watcher watches the right directory.
        const offSse = connectSse(s.project);
        // Self-heal stale tabs: when the page becomes visible again, force a
        // refresh so a missed SSE window never leaves the panel outdated.
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          offSse();
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [s.project]);
      if (!s.open) return null;
      const options = projectOptions(s.projects);
      const rows = sortTasks(s.tasks).map((t) => e(TaskRow, { key: t.id, task: t }));
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
        tooltipOf(s.hover),
        DetailPopup(),
      );
    }

    // Mini-DAG logo: one top dot feeding two bottom dots, in status colors.
    function Logo() {
      return e('svg', { className: 'octie-logo', width: 20, height: 20, viewBox: '0 0 20 20' },
        e('line', { x1: 10, y1: 4.5, x2: 4.5, y2: 14.5, className: 'octie-logo-edge' }),
        e('line', { x1: 10, y1: 4.5, x2: 15.5, y2: 14.5, className: 'octie-logo-edge' }),
        e('circle', { cx: 10, cy: 4.5, r: 2.8, className: 'octie-logo-amber' }),
        e('circle', { cx: 4.5, cy: 14.5, r: 2.8, className: 'octie-logo-cyan' }),
        e('circle', { cx: 15.5, cy: 14.5, r: 2.8, className: 'octie-logo-emerald' }),
      );
    }

    function FooterButton(props) {
      const s = useOctieState();
      const wide = !!(props && props.wide);
      return e('button', {
        className: 'octie-footer-button' + (wide ? ' octie-footer-wide' : ''),
        title: 'Octie tasks',
        onClick: () => patch({ open: !s.open }),
      }, Logo(), wide ? e('span', { className: 'octie-footer-label' }, 'Octie') : null);
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
        '.octie-physics-switch{position:absolute;top:6px;right:6px;z-index:2;display:inline-flex;align-items:center;gap:5px;cursor:pointer;background:rgba(30,31,34,.85);border:1px solid rgba(128,128,128,.35);border-radius:999px;padding:3px 8px 3px 6px;font-size:11px;color:rgba(230,230,230,.85);backdrop-filter:blur(2px)}',
        '.octie-physics-switch input{display:none}',
        '.octie-physics-track{position:relative;width:28px;height:16px;border-radius:999px;background:rgba(128,128,128,.35);transition:background .25s ease}',
        '.octie-physics-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#e6e6e6;transition:transform .25s cubic-bezier(.4,0,.2,1)}',
        '.octie-physics-switch input:checked + .octie-physics-track{background:#00d4ff}',
        '.octie-physics-switch input:checked + .octie-physics-track .octie-physics-thumb{transform:translateX(12px)}',
        '.octie-physics-label{user-select:none}',
        '.octie-tooltip{position:fixed;pointer-events:none;background:#000;border:1px solid rgba(128,128,128,.4);border-radius:6px;padding:6px 8px;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,.5);transform:translate(-100%,-100%);z-index:1200;width:max-content;max-width:340px}',
        '.octie-tooltip strong{display:block;white-space:normal;word-break:break-word;line-height:1.35}',
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
        '.octie-row-badges{display:flex;align-items:center;gap:4px;flex-shrink:0}',
        '.octie-tag{font-size:11px;padding:1px 6px;border-radius:999px;font-family:ui-monospace,Consolas,monospace}',
        '.octie-ready{color:#ff9f1c}.octie-in_progress{color:#00d4ff}.octie-in_review{color:#a78bfa}.octie-completed{color:#10b981}.octie-blocked{color:#f43f5e}',
        '.octie-counts{padding:0 12px 8px;color:rgba(230,230,230,.6);font-size:12px}',
        '.octie-empty{padding:20px;text-align:center;color:rgba(230,230,230,.5)}',
        '.octie-error{padding:0 12px;color:#f28b82;font-size:12px}',
        '.octie-popup-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1100}',
        '.octie-popup{position:relative;width:min(620px,92vw);max-height:82vh;overflow-y:auto;background:var(--color-bg,#1e1f22);color:var(--color-text,#e6e6e6);border-radius:10px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.5)}',
        '.octie-popup-close{position:absolute;top:10px;right:12px}',
        '.octie-popup-head{padding-right:24px;margin-bottom:4px}',
        '.octie-popup-id{font-size:10px;color:rgba(230,230,230,.45);font-family:ui-monospace,Consolas,monospace;display:block;margin-bottom:4px;word-break:break-all}',
        '.octie-popup-title{margin:0 0 8px;font-size:17px}',
        '.octie-popup-badges{display:flex;gap:6px;flex-wrap:wrap}',
        '.octie-status-chip{font-size:11px;padding:2px 8px;border-radius:999px;text-transform:uppercase;font-family:ui-monospace,Consolas,monospace}',
        '.octie-section{margin-top:14px}',
        '.octie-section-title{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;color:rgba(230,230,230,.55);font-family:ui-monospace,Consolas,monospace}',
        '.octie-section-count{opacity:.95}',
        '.octie-ul{list-style:none;margin:0;padding:0}',
        '.octie-ul-inline{display:flex;flex-wrap:wrap;gap:6px}',
        '.octie-li{display:flex;align-items:flex-start;gap:8px;padding:3px 0;font-size:13px;color:rgba(230,230,230,.85)}',
        '.octie-check{width:15px;height:15px;border-radius:4px;border:1px solid rgba(128,128,128,.5);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;font-size:10px}',
        '.octie-check-on{background:#10b981;border-color:#10b981;color:#04120b;font-weight:bold}',
        '.octie-li-body{flex:1;min-width:0}',
        '.octie-done{text-decoration:line-through;color:rgba(230,230,230,.4)}',
        '.octie-mono-muted{font-size:11px;color:rgba(230,230,230,.55);font-family:ui-monospace,Consolas,monospace;margin-top:2px;display:block}',
        '.octie-mono-cyan{font-size:12px;color:#00d4ff;font-family:ui-monospace,Consolas,monospace}',
        '.octie-chip{font-size:11px;font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.05);border:1px solid rgba(128,128,128,.25);border-radius:5px;padding:2px 6px;color:rgba(230,230,230,.85);word-break:break-all;display:inline-block;margin:2px 0}',
        '.octie-chip-rose{color:#f43f5e;border-color:rgba(244,63,94,.35);background:rgba(244,63,94,.08)}',
        '.octie-source-chip{font-size:10px;text-transform:uppercase;color:#f43f5e;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);border-radius:4px;padding:0 5px;margin-top:4px;display:inline-block;font-family:ui-monospace,Consolas,monospace}',
        '.octie-c7-box{background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.25);border-radius:6px;padding:6px 8px;margin:4px 0}',
        '.octie-muted{font-size:12px;color:rgba(230,230,230,.65);margin:4px 0 0}',
        '.octie-box{background:rgba(255,255,255,.04);border-left:3px solid transparent;border-radius:6px;padding:8px 10px;font-size:12px;color:rgba(230,230,230,.8);white-space:pre-wrap}',
        '.octie-desc{font-size:13px;color:rgba(230,230,230,.75);white-space:pre-wrap;margin:0}',
        '.octie-meta{border-top:1px solid rgba(128,128,128,.2);margin-top:14px;padding-top:10px;display:flex;flex-direction:column;gap:4px}',
        '.octie-meta-row{display:flex;gap:8px;font-size:12px;align-items:baseline}',
        '.octie-meta-label{color:rgba(230,230,230,.5);min-width:76px;flex-shrink:0}',
        '.octie-footer-button{display:flex;align-items:center;justify-content:center;gap:6px;background:none;border:none;color:inherit;cursor:pointer;font:inherit;padding:4px}',
        '.octie-footer-label{font-size:12px}',
        '.octie-logo{display:block;flex-shrink:0}',
        '.octie-logo-edge{stroke:rgba(170,170,170,.55);stroke-width:1.2}',
        '.octie-logo-amber{fill:#ff9f1c;filter:drop-shadow(0 0 3px rgba(255,159,28,.6))}',
        '.octie-logo-cyan{fill:#00d4ff;filter:drop-shadow(0 0 3px rgba(0,212,255,.6))}',
        '.octie-logo-emerald{fill:#10b981;filter:drop-shadow(0 0 3px rgba(16,185,129,.6))}',
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
          (props) => e(FooterButton, props),
        ));

        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'octie-panel', order: 90 },
          () => e(Panel),
        ));
      },
    };
  },
});
