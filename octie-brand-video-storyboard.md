# Octie Brand Video — 分镜脚本 (2min · 总分结构)

## Video Specs

| Parameter | Value |
|-----------|-------|
| Resolution | 1920×1080 |
| FPS | 30 |
| Total Duration | 120s (3600 frames) |
| Framework | Remotion 4.0.419 + React 19 + TypeScript |
| Transitions | TransitionSeries (fade / slide / wipe / flip / clockWipe) |
| Audio | Added in post (no in-code audio) |
| Visual Rhythm | Dark theme consistent (graph-tech aesthetic) |

## Octie Design System Reference (from `web-ui/src/design-tokens.css`)

> All colors below are the EXACT tokens used in the Octie Web UI. Use these directly in Remotion scene `constants.ts`.

### Color Palette

#### Surface Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-void` | `#050508` | Deepest background |
| `--surface-abyss` | `#0a0a0f` | Header, sidebar, toolbar bg |
| `--surface-base` | `#0d1117` | Main page / scene background |
| `--surface-raised` | `#161b22` | Card backgrounds |
| `--surface-overlay` | `#1c2128` | Modal/overlay surfaces |
| `--surface-elevated` | `#21262d` | Inputs, code blocks, elevated cards |
| `--surface-floating` | `#2d333b` | Highest elevation |

#### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#f0f6fc` | Headings, main text |
| `--text-secondary` | `#8b949e` | Body, descriptions |
| `--text-muted` | `#484f58` | Labels, placeholders, IDs |

#### Accent Colors (Neon Cyber)
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-cyan` | `#00d4ff` | Primary accent, selected, edges, glow |
| `--accent-cyan-dim` | `#0098b8` | Hover states |
| `--accent-cyan-glow` | `rgba(0,212,255,0.3)` | Cyan glow/shadow |
| `--accent-amber` | `#ff9f1c` | Ready status, priority-second |
| `--accent-amber-glow` | `rgba(255,159,28,0.3)` | Amber glow |
| `--accent-violet` | `#a78bfa` | In-review, gradient partner |
| `--accent-violet-glow` | `rgba(167,139,250,0.3)` | Violet glow |
| `--accent-emerald` | `#10b981` | Completed status, success |
| `--accent-emerald-glow` | `rgba(16,185,129,0.3)` | Emerald glow |
| `--accent-rose` | `#f43f5e` | Blocked, top-priority, errors |

#### Status Colors (with backgrounds)
| Status | Hex | Badge BG | Kanban Column BG | Kanban Border | Kanban Glow |
|--------|-----|----------|-----------------|---------------|-------------|
| ready | `#ff9f1c` | `rgba(255,159,28,0.1)` | `rgba(255,159,28,0.12)` | `rgba(255,159,28,0.25)` | `0 0 20px rgba(255,159,28,0.2)` |
| in_progress | `#00d4ff` | `rgba(0,212,255,0.15)` | `rgba(0,212,255,0.12)` | `rgba(0,212,255,0.3)` | `0 0 20px rgba(0,212,255,0.3)` |
| in_review | `#a78bfa` | `rgba(167,139,250,0.15)` | `rgba(167,139,250,0.12)` | `rgba(167,139,250,0.3)` | `0 0 20px rgba(167,139,250,0.3)` |
| completed | `#10b981` | `rgba(16,185,129,0.15)` | `rgba(16,185,129,0.12)` | `rgba(16,185,129,0.3)` | `0 0 20px rgba(16,185,129,0.3)` |
| blocked | `#f43f5e` | `rgba(244,63,94,0.15)` | `rgba(244,63,94,0.12)` | `rgba(244,63,94,0.3)` | `0 0 20px rgba(244,63,94,0.3)` |

#### Priority Colors
| Priority | Hex | Glow |
|----------|-----|------|
| `top` | `#f43f5e` | `rgba(244,63,94,0.15)` |
| `second` | `#ff9f1c` | `rgba(255,159,28,0.15)` |
| `later` | `#6e7681` | `rgba(110,118,129,0.15)` |

#### Graph Node Glow Colors (TaskNode)
| Status | Glow (unselected) | Glow (selected) |
|--------|-------------------|-----------------|
| ready | `0 0 8px rgba(255,159,28,0.4)` | `0 0 15px rgba(255,159,28,0.4), 0 0 30px rgba(255,159,28,0.4)` |
| in_progress | `0 0 8px rgba(0,212,255,0.4)` | `0 0 15px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.4)` |
| in_review | `0 0 8px rgba(167,139,250,0.4)` | `0 0 15px rgba(167,139,250,0.4), 0 0 30px rgba(167,139,250,0.4)` |
| completed | `0 0 8px rgba(16,185,129,0.4)` | `0 0 15px rgba(16,185,129,0.4), 0 0 30px rgba(16,185,129,0.4)` |
| blocked | `0 0 8px rgba(244,63,94,0.4)` | `0 0 15px rgba(244,63,94,0.4), 0 0 30px rgba(244,63,94,0.4)` |

#### Border Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--border-default` | `#30363d` | Standard dividers, borders |
| `--border-muted` | `#21262d` | Subtle dividers |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace` | Code, IDs, badges, stats |
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` | Body, general UI |
| `--font-display` | `'Space Grotesk', 'Inter', sans-serif` | Headings, brand "octie", titles |

**Key sizes**: `text-[10px]` (IDs, badges), `text-xs` (labels), `text-sm` (body), `text-lg` (task titles), `text-3xl` (hero)

### Shapes & Spacing

| Token | Value |
|-------|-------|
| `--radius-md` | `0.5rem` (8px) — buttons, inputs, badges |
| `--radius-lg` | `0.75rem` (12px) — containers |
| `--radius-xl` | `1rem` (16px) — cards, glass cards |
| `--radius-full` | `9999px` — pills, status dots |

**Graph node dimensions**: `NODE_WIDTH: 280px`, `NODE_HEIGHT: 120px`, `RANK_SPACING: 80px`, `NODE_SPACING: 30px`

### Key Visual Effects

| Effect | Value |
|--------|-------|
| Glass card | `rgba(22,27,34,0.8)` + `backdrop-filter: blur(16px)` + `1px solid #30363d` + `border-radius: 16px` |
| Gradient text | `linear-gradient(135deg, #00d4ff 0%, #a78bfa 100%)` + `-webkit-background-clip: text` |
| Gradient border | `::before` pseudo with cyan→violet gradient, visible on hover |
| ReactFlow edge | `smoothstep`, `animated: true`, stroke `#00d4ff`, `strokeWidth: 2` |
| Avatar gradient | `linear-gradient(135deg, #00d4ff, #a78bfa)` |
| Homepage grid | 32×32px grid, cyan at 3% opacity |
| Homepage orbs | 500-600px circles, `blur(100-120px)`, opacity 15-20% |

### Transitions & Easing (use in Remotion spring configs)

| Token | Value |
|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Interactive hover | `transform: translateY(-2px)`, 200ms ease-out |
| Sidebar expand | `300ms ease-out` |
| Kanban card hover | `translateX(2px)`, 150ms ease |

### CSS Animations (map to Remotion spring/Sequence)
| Name | Duration | Behavior |
|------|----------|----------|
| `fadeInUp` | 300ms | opacity 0→1, translateY 10px→0, ease-out |
| `fadeIn` | 300ms | opacity 0→1, ease-out |
| `slideInLeft` | 300ms | opacity 0→1, translateX -20px→0, ease-out |
| `pulse-glow` | infinite | boxShadow alternates between glow states |
| Stagger delays | 50ms intervals | `.stagger-1` to `.stagger-6` |

### Web UI Component Patterns to Reference

**TaskNode (graph node)** — `src/components/TaskNode.tsx`:
- `rounded-lg border-2`, bg `var(--surface-elevated)`, min-w 200px, max-w 300px
- Status border color + glow shadow, title `font-semibold text-sm truncate`
- Priority badge `px-1.5 py-0.5 rounded text-xs`, monospace

**KanbanCard** — `src/components/KanbanBoard.tsx`:
- `p-3 rounded-lg`, bg `var(--surface-raised)`, `1px solid var(--border-default)`
- Selected: gradient BG + cyan border + cyan glow
- ID: `text-[10px] tabular-nums`, title: `text-sm font-medium line-clamp-2`

**GlassCard** — CSS class `.glass-card`:
- `rgba(22,27,34,0.8)` + `backdrop-filter blur(16px)` + `1px solid border` + `radius-xl`

**Status Badge** — `.badge` class:
- `inline-flex px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-mono`

**Graph Edge** — from `GraphView.tsx`:
- Type `smoothstep`, `animated: true`, stroke `#00d4ff`, `strokeWidth: 2`

---

## Scene 1 · Opening Hook (0s-10s · 300f)

### Visuals
- Deep dark background `#0d1117` (`--surface-base`) with procedurally generated particle stars drifting via noise
- Center: Octie logo mark fades in — a minimal hexagon/nodes icon constructed from 6 animated SVG circles connected by lines, growing from scale 0 to 1 with a spring
- Title "OCTIE" appears via `CharacterReveal` (letter-by-letter, staggered 3f per character)
- Subtitle "Graph-Based Task Management" fades in below with a 0.5s delay, rendered in cyan glow

### Animation
- Particles: 80 seeded stars with `noise2D` drift (x * 0.08, y * 0.08), amplitude 3px
- Logo: Spring `{ damping: 18, stiffness: 90, mass: 0.4 }`, scale 0→1 over 20f
- Title: `CharacterReveal` with stagger, each letter scales in from 0.5→1 + opacity 0→1
- Subtitle: Opacity spring with 15f delay, slight y offset: `interpolate(spr, [0,1], [20, 0])`
- Subtle glow pulse on logo using `Math.sin(frame * 0.05)` for boxShadow radius modulation

### Sound Direction (post)
- Low ambient drone + rising synth swell
- Soft "whoosh" on logo appearance

### Transition Out → Scene 2
- `fade()` 18 frames to black, particles dissolve last

---

## Scene 2 · What is Octie (10s-25s · 300f)

### Visuals
- Background: `GridBackground` — fine cyan grid lines on dark surface, subtle perspective tilt via CSS `perspective(800px) rotateX(60deg)`, scrolls slowly downward
- Center: A DAG visualization — 6 nodes arranged in a clean dependency layout:
  - 3 roots at top (glowing `#00d4ff` cyan), connected by animated SVG edges to 2 middle nodes (`#a78bfa` violet), connected to 1 leaf node at bottom (`#10b981` emerald)
  - Edges drawn using `evolvePath()` — each line draws from root→leaf sequentially
- Text left of graph: "A graph-based task management system" — appears via `SplitText`, words slide up from below
- Right of graph: Feature tags appear with staggered delay:
  - "CLI + Web UI" · "DAG Architecture" · "JSON Storage" · "AI-Ready"
  - Each tag is a frost-glass pill (`rgba(22,27,34,0.8)` BG + `blur(16px)` backdrop + `1px solid #30363d`) with a thin `#00d4ff` cyan border, springing in

### Animation
- Grid: `translateY` from `frame * 0.5`, infinite scroll illusion
- Graph edges: Sequential `evolvePath()` — edge 1 at frame 20, edge 2 at 35, ... stagger 15f each
- Nodes: Spring scale 0→1, stagger 10f per node, top-to-bottom
- Node halos pulse with `Math.sin(frame * 0.03 + nodeIndex) * 0.3 + 0.7`
- Tags: Staggered spring entrance, 8f delay each, `{ damping: 12, stiffness: 120 }`

### Sound Direction (post)
- Steady driving beat begins
- Subtle percussive hit on each tag appearance

### Transition Out → Scene 3
- `slide()` 20 frames, direction `from-right`, grid + graph slide out right

---

## Scene 3 · Dual-Edge Graph Architecture (25s-40s · 300f)

### Visuals
- Background: Dark surface `#0d1117` (`--surface-base`) with `ParticleField` — sparse `#00d4ff` cyan dots floating at varying z-depths (CSS scale-based depth illusion)
- Left half (70%): An animated DAG diagram showing the dual-edge structure:
  - Three columns: `Node A` (blue) → `Node B` (cyan) → `Node C` (purple)
  - **Stage 1** (0-60f): Forward edges drawn — A→B, B→C using animated lines with arrow heads
  - **Stage 2** (60-120f): The graph visually "flips" — same layout but reversed arrows appear in orange, showing incoming edges: C←B, B←A
  - **Stage 3** (120-200f): Code snippet appears below graph, showing the dual Map structure:
    ```
    outgoingEdges: Map<id, Set>
    incomingEdges: Map<id, Set>
    ```
  - Lines of code highlight in sequence via background color pulse
- Right half (30%): Stat callouts on glass panels:
  - "O(1) node lookup" (springs in at 30f)
  - "O(1) edge checking" (springs in at 60f)
  - "Bidirectional traversal" (springs in at 90f)

### Animation
- Edges: `evolvePath()` with different stroke colors (`#00d4ff` cyan for forward, `#ff9f1c` amber for reverse)
- Code snippet: `Typewriter` effect typing each line, cursor blinking with `Math.round(frame/15) % 2`
- Stats: Spring in from right, `{ damping: 15, stiffness: 100 }`, each with `translateX` from 60→0
- Float: Each node drifts slightly with noise2D for organic feel

### Sound Direction (post)
- Digital typing sounds on code reveal
- Bass hit on each stat callout

### Transition Out → Scene 4
- `wipe()` 20 frames, from bottom, revealing the dark background of next scene

---

## Scene 4 · Derived Status & Auto Propagation (40s-55s · 300f)

### Visuals
- Background: Dark with subtle `PulseRings` — expanding cyan rings at low opacity emanating from center
- Center: A task node in the middle, surrounded by its items (criteria, deliverables, need_fix) in orbit
- **Stage 1** (0-80f, "Derived Status"):
  - Task node shows status label, which changes reactively (using Octie design tokens):
    - All items unchecked → shows `ready` in `#ff9f1c` amber with `rgba(255,159,28,0.1)` BG
    - One criterion checked → label animates to `in_progress` in `#00d4ff` cyan with `rgba(0,212,255,0.15)` BG
    - All items checked → label animates to `in_review` in `#a78bfa` violet with `rgba(167,139,250,0.15)` BG
  - Items are icons with checkbox rings; checking them fills the ring via SVG `stroke-dashoffset` animation
- **Stage 2** (80-200f, "Auto Propagation"):
  - Graph expands to show 3 connected nodes in a chain: Parent → Current → Child
  - Parent node gets checked (turns from orange to green), triggering:
    - A visible "pulse" wave travels along the edge from Parent→Current (cyan glow traveling along the SVG path)
    - Current node's status auto-updates from `blocked` to `ready`
    - Same pulse continues from Current→Child
  - Edge lines glow brighter during propagation

### Animation
- Status label: `useCurrentFrame()` checks conditions, animates text color via `interpolateColors()`
- Ring completion: SVG `stroke-dashoffset` animation, `Math.min(progress, 1) * circumference`
- Propagation pulse: A bright cyan circle travels along the edge path at `frame * 3` px/frame from parent→child
- Edge glow: `interpolate(pulseProgress, [0,0.5,1], ['rgba(79,195,247,0.2)', 'rgba(79,195,247,0.9)', 'rgba(79,195,247,0.2)'])`
- Orbiting items: CSS rotate via `frame * 0.5` deg per frame, each at different radii

### Sound Direction (post)
- Satisfying "click" on each criterion check
- Rising synth arp during propagation sequence
- Resolution chord when cascade completes

### Transition Out → Scene 5
- `flip()` 25 frames, 3D flip transition

---

## Scene 5 · Atomic Task Validation (55s-65s · 200f)

### Visuals
- Background: Dark with `MatrixRain` — cascading green/cyan characters at very low opacity (code aesthetic)
- Center: A task creation form UI mockup:
  - An input field labeled "Task Title" — a cursor blinks, then types character-by-character:
    - First attempt: "Fix stuff" → field border turns RED, validation error icon ❌ appears, text shakes with `Math.sin(frame * 0.5) * 3`
    - Second attempt: "Implement JWT authentication endpoint" → field border turns GREEN, ✓ checkmark appears
  - Below: Validation rule tags appear one by one:
    - "100+ action verbs checked ✓"
    - "Vague patterns rejected ✗"  (flashes red briefly)
    - "Quantitative criteria required"
    - "Unicode-aware (multilingual)"
    - "Max 10 criteria per task"
  - Each rule tag is a frosted pill, colored green (pass) or red (reject)

### Animation
- Typing: `Typewriter` component, 1 char every 2 frames
- Field border: `interpolateColors()` based on validation state — red→green transition over 15f
- Shake animation: `Math.sin(frame * 0.5) * 3` applied to `translateX`, amplitude decreases over frames
- Tags: Staggered spring entrance from below, 10f delay each
- X/Checkmark: Spring scale 0→1 with overshoot

### Sound Direction (post)
- Keyboard typing sounds
- Error "buzz" on invalid input
- Satisfying "ding" on valid input

### Transition Out → Scene 6
- `slide()` 20 frames, direction `from-left`

---

## Scene 6 · Graph Operations (65s-80s · 300f)

### Visuals
- Background: Dark `#0d1117` (`--surface-base`) with subtle `GlowOrb` slowly drifting in background
- This scene uses a **split-vertical layout** — each operation gets a row:
  - Row 1 (0-60f): **cutNode** — A→B→C shown, then B dissolves as A→C reconnects. A glowing cyan line shows the new direct edge.
  - Row 2 (60-130f): **mergeTasks** — Source and Target nodes with their contents. Source fades and slides into Target (merge animation). Target grows slightly (scale 1→1.05→1) as it absorbs the source's criteria/deliverables. Connected edges reroute to Target.
  - Row 3 (130-200f): **cascadeDelete** — A chain of 4 nodes. Bottom node is deleted → next bottom is deleted → chains upward. Each deletion: node shrinks to 0 with a subtle particle burst.

### Animation
- cutNode: B fades out (opacity 1→0 over 15f), new edge draws via `evolvePath()` from A→C
- mergeTasks: Source node `transformOrigin: 'center'`, fades + scales down into target. Target pulses (scale 1→1.05→1) with a cyan glow ring expanding outward
- cascadeDelete: Iterative — at 130f first node dies, 150f next, 170f next. Each: scale 1→0 + opacity 1→0 + small cyan particle burst (6 particles scatter outward with spring physics)
- Operation labels: Appear at left of each row as the operation starts, using `SplitText`

### Sound Direction (post)
- Mechanical "click" for cut
- "Swoosh+merge" for merge
- Cascading descending tones for cascade delete

### Transition Out → Scene 7
- `wipe()` 20 frames, from left

---

## Scene 7 · Immutable Snapshot History (80s-90s · 200f)

### Visuals
- Background: Dark `#161b22` (`--surface-raised`) with a subtle timeline-inspired horizontal line spanning the width
- **Stage 1** (0-70f): A visual depiction of the snapshot system:
  - Central vertical line representing time (top=newest, bottom=oldest)
  - 8 circular snapshot markers along the timeline, each with a miniature document icon inside
  - The latest 3 snapshots have a subtle glow, older ones are dimmer
  - A "SAVE" action triggers: a new snapshot marker appears at top, pushing others down. The bottom-most one fades out (retention pruning visualization)
- **Stage 2** (70-150f): A "Restore" demo:
  - The timeline scrolls up, a specific snapshot is selected (scale 1→1.3, glow intensifies)
  - A glass panel shows the snapshot metadata:
    ```
    Snapshot: a1b2c3d4
    Tasks: 47  |  Edges: 62
    Health: ✓ No cycles
    Command: octie update
    ```
  - The snapshot "expands" — a ghost of the restored graph fades in behind the metadata

### Animation
- Timeline markers: Spring scale in sequentially, newest first, 3f stagger
- SAVE action: New marker slides down from top with `{ damping: 12, stiffness: 100 }`
- Pruning: Bottom marker fades (opacity 1→0) and slides down, then removed
- Selection glow: `Math.sin(frame * 0.1) * 0.3 + 0.7` for pulsing effect on selected snapshot
- Metadata panel: Springs in from right with slight rotation, `{ damping: 15, stiffness: 80 }`

### Sound Direction (post)
- Camera shutter "click" on each snapshot creation
- Subtle reversed reverb on restore

### Transition Out → Scene 8
- `fade()` 18 frames

---

## Scene 8 · Inverted Index + Full-Text Search (90s-100s · 200f)

### Visuals
- Background: Dark `#0d1117` (`--surface-base`)
- **Stage 1** (0-80f, "Index Building"):
  - Center left: A task card appears with title, description, notes text
  - From the text, "tokens" fly out — individual words extracted, each as a glowing cyan pill
  - Tokens fly to the right and lock into an inverted index visualization:
    - A map-like structure: `{ token → [taskId1, taskId2, ...] }`
    - Tokens connect to task ID bubbles via thin animated lines
  - Visual shows: "authentication" → [task-003, task-007, task-012]
- **Stage 2** (80-160f, "Search"):
  - A search bar appears at top, cursor blinks, types "auth" character by character
  - As each character is typed, matching tokens on the right pulse with cyan glow
  - Search completes: 3 matching task IDs highlighted, their connected lines grow brighter
  - A results counter springs in: "3 tasks found in 0.8ms" with a speed indicator

### Animation
- Token extraction: Words fly from text with staggered spring, `{ damping: 12, stiffness: 80 }`, each with slight random rotation
- Index lines: `evolvePath()` from token to task ID bubble
- Search typing: Typewriter effect, 1 char every 3 frames
- Token highlighting: Matching tokens scale 1→1.2 + glow intensifies via `boxShadow` spread animation
- Results counter: Spring from 0→3 number animation, 8ms speed badge with green pulse

### Sound Direction (post)
- Pop sounds as tokens are extracted
- Typing sounds on search input
- Ping sound on search completion

### Transition Out → Scene 9
- `clockWipe()` 20 frames

---

## Scene 9 · Loose Subproject Handoff (100s-110s · 200f)

### Visuals
- Background: Dark `#0d1117` (`--surface-base`) with `GridBackground` at very low opacity
- **Stage 1** (0-90f):
  - A parent Octie project is shown on the left — a graph with 5 nodes
  - A "Handoff" node is highlighted at the bottom
  - From the handoff node, a dashed connector line (NOT a solid edge) extends right to a **separate** project visualization
  - The child project appears on the right with its own independent graph
  - Key visual distinction: the parent graph has solid edges (strong coupling), the handoff link uses **animated dashed lines** (loose coupling)
- **Stage 2** (90-160f):
  - A glass panel displays the handoff note content, typing in:
    ```
    --- OCTIE SUBTASK HANDOFF ---
    Subproject Path: .octie/subprojects/...
    This is a loose contextual reference only.
    Do not add cross-project graph edges.
    ```
  - Icons illustrate: ❌ no cross-project edges, ❌ no sub_items links, ✅ notes-only reference
  - Text animation: "Loose coupling is a feature, not a limitation" appears via `CharacterReveal`

### Animation
- Child project: Fades in from opacity 0, with nodes springing in from center outward
- Dashed line: Animated SVG `<line>` with `stroke-dasharray="8,8"` and `stroke-dashoffset` animated via `frame * 2` for flowing dashed effect
- Handoff note: Typewriter effect, line by line
- Rule icons: Spring in from right with `{ damping: 14, stiffness: 90 }`
- Loose coupling text: `CharacterReveal` with slow stagger (5f per char), slow ease
- Parent graph: Subtle pulse on handoff node

### Sound Direction (post)
- Soft piano chords (reflective, elegant)
- Subtle chime on each rule icon appearance
- Final note resonates as scene ends

### Transition Out → Scene 10
- `flip()` 25 frames, 3D perspective flip

---

## Scene 10 · Closing / CTA (110s-120s · 200f)

### Visuals
- Background: Dark `#0d1117` (`--surface-base`) with all particle effects at full intensity — stars, subtle aurora glow, distant pulse rings — full celebration aesthetic
- **Stage 1** (0-60f):
  - The Octie logo re-appears center, larger this time, with a slow rotation
  - Surrounding the logo: 8 feature icon-pills orbit in a circle:
    - DAG Graph · Status Propagation · Atomic Validation · Graph Ops · Snapshots · Full-Text Search · Handoff · CLI+Web
  - Each pill pulses with its own glow
  - Tagline appears via `SplitText` above: "Your tasks. Your graph. Your way."
- **Stage 2** (60-140f):
  - Pills and orbit fade out
  - CTA text: "Get Started · github.com/your-org/octie" — appears via `CharacterReveal`, large centered text
  - Below: "npm install -g octie-cli && octie init my-project" — code snippet with monospace font, cyan highlight
  - A subtle gradient glow radiates from behind the CTA text
- **Stage 3** (140-200f):
  - Elements hold position with subtle breathing animation
  - Watermark "OCTIE" fades in at bottom with low opacity + slow drift
  - Final 30f: slow fade to black

### Animation
- Logo rotation: `frame * 0.3` degrees of Y-axis rotation via CSS `rotateY()`
- Orbiting pills: CSS `transform: rotate(${i * 45}deg) translateX(200px)`, counter-rotated to stay upright
- Pill glow: Individual `boxShadow` pulse with `Math.sin(frame * 0.04 + i * 0.5) * 0.4 + 0.6`
- Tagline: `SplitText` with spring stagger `{ damping: 14, stiffness: 80 }`
- CTA: `CharacterReveal` with slow stagger (4f/char), gentle scale + opacity
- Code block: Fades in with slight bottom-to-top drift, monospace cyan text
- Final fade: All elements opacity 1→0 over last 30f, particles fade last

### Sound Direction (post)
- Full orchestral crescendo builds to climax
- Drop on "Your way." tagline
- Fade out music over last 5 seconds
- Subtle reverb tail

---

## Scene Timing & Transition Map

```
Scene 01: Opening      0s-10s   [300f]  ──fade(18f)──▶
Scene 02: Overview     10s-25s  [300f]  ──slide(20f)──▶
Scene 03: Graph Engine 25s-40s  [300f]  ──wipe(20f)───▶
Scene 04: Status       40s-55s  [300f]  ──flip(25f)───▶
Scene 05: Validation   55s-65s  [200f]  ──slide(20f)──▶
Scene 06: Graph Ops    65s-80s  [300f]  ──wipe(20f)───▶
Scene 07: Snapshots    80s-90s  [200f]  ──fade(18f)───▶
Scene 08: Search       90s-100s [200f]  ──clockWipe(20f)▶
Scene 09: Handoff     100s-110s [200f]  ──flip(25f)───▶
Scene 10: Closing     110s-120s [200f]  ──▶ END
```

Total: 3575 frames (~119s) including transition overlaps

---

## Reusable Components Needed

### Already exist in creativly.ai template:
- `CharacterReveal` — letter-by-letter text reveal
- `SplitText` — word-split entrance animation
- `Typewriter` — character-by-character typing
- `AuroraBackground` — animated aurora effect
- `GridBackground` — animated grid lines
- `ParticleField` — floating particle system
- `MatrixRain` — code rain effect
- `PulseRings` — expanding ring pulses
- `GlowOrb` — floating glow sphere
- `FlowNode` — graph node component (adapt for task nodes)
- `FlowEdge` — graph edge component
- `BrowserWindow` — browser mockup

### Need to create for Octie video:

| Component | Purpose | Scenes |
|-----------|---------|--------|
| `DAGGraph` | Graph visualization with nodes + edges | S2, S3, S4 |
| `AnimatedEdge` | SVG edge with `evolvePath` draw animation + pulse | S3, S4, S6 |
| `TaskNodeVis` | Task node with status glow + item orbit | S4, S6 |
| `ValidationForm` | Task creation form with validation states | S5 |
| `SnapshotTimeline` | Timeline with snapshot markers | S7 |
| `InvertedIndex` | Token → ID mapping visualization | S8 |
| `SearchBar` | Animated search input with results | S8 |
| `SplitProjectView` | Parent/child project side-by-side | S9 |
| `OrbitingPills` | Circular orbiting feature tags | S10 |
| `GlassCard` | Frosted-glass info panel (reusable) | S3, S7, S9 |

---

## Assets to Prepare

| Asset | Type | Specs | Source |
|-------|------|-------|--------|
| Octie logo | SVG | Hexagon/nodes icon, 200×200 | Design / screenshot of web UI |
| Octie wordmark | SVG | "OCTIE" text, horizontal | Generated in code |
| Screenshots: CLI demo | PNG | Terminal with `octie create` output | Capture from Octie CLI |
| Screenshots: Web UI | PNG | Graph view + kanban | Screenshot from browser |
| Background particle seeds | Code | Seeded random arrays | Generated in constants |
| Favicon | SVG | Octie icon, 32×32 | From web-ui/public/ |

---

## Key Design Decisions

1. **No feature is text-only** — every feature description is paired with a visual animation (code reveals, graph animations, status changes). This follows the creativly.ai approach of "show, don't tell."

2. **Graph as core visual motif** — nodes, edges, and their animations form the recurring visual language. This gives the video a cohesive identity while varying content.

3. **Validation scene as comic relief** — the "Fix stuff → rejected" moment adds a touch of personality. It demonstrates the tool's rigor while being relatable to developers.

4. **Handoff scene as philosophical close** — intentionally placed near the end, this scene communicates the project's design maturity (knowing what NOT to build) before the CTA.

5. **Progression from tech → value** — early scenes show technical capabilities (graph, validation), late scenes show design philosophy (loose coupling, snapshot safety), closing on the human value (your tasks, your way).
