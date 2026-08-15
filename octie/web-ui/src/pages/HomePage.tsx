/**
 * Home Page - Landing page with project selection
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import { useEffect } from 'react';
import { useProjectStore, type RegistryProject } from '../store/projectStore';

interface ProjectCardProps {
  project: RegistryProject;
  onClick: () => void;
  index: number;
}

function ProjectCard({ project, onClick, index }: ProjectCardProps) {
  const statusColor = project.exists ? 'var(--accent-emerald)' : 'var(--accent-amber)';
  const statusGlow = project.exists
    ? '0 0 8px rgba(16, 185, 129, 0.4)'
    : '0 0 8px rgba(255, 159, 28, 0.4)';

  return (
    <button
      onClick={onClick}
      disabled={!project.exists}
      className={`
        interactive-card gradient-border
        w-full text-left p-5 rounded-xl
        bg-[var(--surface-raised)] border border-[var(--border-default)]
        animate-fade-in-up opacity-0
        focus-ring
        ${!project.exists ? 'opacity-60' : ''}
      `}
      style={{ animationDelay: `${index * 80 + 200}ms`, animationFillMode: 'forwards' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Project avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
            style={{
              background: `linear-gradient(135deg, var(--surface-elevated), var(--surface-floating))`,
              border: '1px solid var(--border-default)',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3
              className="font-semibold text-base"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {project.name}
            </h3>
            {!project.exists && (
              <span
                className="badge"
                style={{
                  background: 'rgba(255, 159, 28, 0.15)',
                  color: 'var(--accent-amber)',
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                }}
              >
                MISSING
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: statusColor, boxShadow: statusGlow }}
        />
      </div>

      {/* Path */}
      <div
        className="flex items-center gap-2 mb-4 text-xs"
        style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="truncate" title={project.path}>
          {project.path}
        </span>
      </div>

      {/* Stats row */}
      <div
        className="flex items-center gap-4 text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="tabular-nums" style={{ color: 'var(--accent-cyan)' }}>
            {project.taskCount}
          </span>
          <span>tasks</span>
        </div>

        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>
            {new Date(project.lastUpdated || project.lastAccessed).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function HomePage() {
  const { projects, loading, fetchProjects, setCurrentProject } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (project: RegistryProject) => {
    if (!project.exists) return;
    setCurrentProject(project.path);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'var(--surface-base)' }}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 grid-pattern opacity-50"
        style={{ pointerEvents: 'none' }}
      />

      {/* Gradient orbs */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--accent-cyan) 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] opacity-15"
        style={{
          background: 'radial-gradient(circle, var(--accent-violet) 0%, transparent 70%)',
          transform: 'translate(-30%, 30%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Hero section */}
        <header className="text-center mb-16 animate-fade-in-up">
          {/* Logo/Brand */}
          <div className="inline-flex items-center gap-3 mb-6">
            <img
              src="/Octie-Logo.png"
              alt="Octie"
              className="h-14 w-14 rounded-xl"
              style={{ filter: 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.3))' }}
            />
            <h1
              className="text-3xl font-bold gradient-text"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              octie
            </h1>
          </div>

          {/* Tagline */}
          <p
            className="text-lg max-w-xl mx-auto mb-4"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
          >
            Graph-based task management for complex projects.
            <br />
            <span style={{ color: 'var(--text-tertiary)' }}>
              Visualize dependencies. Track progress. Ship faster.
            </span>
          </p>

          {/* Quick stats */}
          <div
            className="inline-flex items-center gap-6 px-5 py-2.5 rounded-full"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Projects:</span>
              <span
                className="tabular-nums font-semibold"
                style={{ color: 'var(--accent-cyan)' }}
              >
                {projects.length}
              </span>
            </div>
            <div
              style={{ width: '1px', height: '16px', background: 'var(--border-default)' }}
            />
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Total tasks:</span>
              <span
                className="tabular-nums font-semibold"
                style={{ color: 'var(--accent-amber)' }}
              >
                {projects.reduce((sum, p) => sum + p.taskCount, 0)}
              </span>
            </div>
          </div>
        </header>

        {/* Quick start section */}
        <section className="mb-12 animate-fade-in-up opacity-0" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-elevated)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Quick Start
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '01', text: 'Select a project from the list or sidebar' },
                { step: '02', text: 'Browse tasks in list or graph view' },
                { step: '03', text: 'Filter by status, priority, or search' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-lg"
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-muted)',
                  }}
                >
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{
                      color: 'var(--accent-cyan)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.step}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Projects section */}
        <section className="animate-fade-in-up opacity-0" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-raised)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Projects
              </h2>
            </div>
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                background: 'var(--surface-raised)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {projects.length} registered
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{
                  border: '2px solid var(--border-default)',
                  borderTopColor: 'var(--accent-cyan)',
                }}
              />
            </div>
          ) : projects.length === 0 ? (
            <div
              className="text-center py-16 rounded-xl"
              style={{
                background: 'var(--surface-raised)',
                border: '1px dashed var(--border-default)',
              }}
            >
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface-elevated)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </div>
              <h3
                className="text-base font-medium mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                No projects yet
              </h3>
              <p
                className="text-sm mb-5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Initialize a project to get started with Octie
              </p>
              <code
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>$</span>
                octie init
              </code>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.path}
                  project={project}
                  onClick={() => handleProjectClick(project)}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>

        {/* Keyboard shortcuts hint */}
        <footer
          className="mt-12 text-center animate-fade-in-up opacity-0"
          style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
        >
          <div
            className="inline-flex items-center gap-4 px-4 py-2 rounded-full text-xs"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              <kbd
                className="px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--surface-elevated)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                [
              </kbd>{' '}
              toggle sidebar
            </span>
            <span>
              <kbd
                className="px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--surface-elevated)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                T
              </kbd>{' '}
              toggle theme
            </span>
            <span>
              <kbd
                className="px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--surface-elevated)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Ctrl+K
              </kbd>{' '}
              search
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
