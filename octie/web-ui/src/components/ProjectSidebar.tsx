/**
 * Sidebar - Project navigation sidebar
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import { useEffect } from 'react';
import { useProjectStore, type RegistryProject } from '../store/projectStore';
import { useTaskStore } from '../store/taskStore';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ProjectItem({
  project,
  isActive,
  onClick,
  index,
}: {
  project: RegistryProject;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  const priorityColor = project.taskCount > 50
    ? 'var(--accent-rose)'
    : project.taskCount > 20
      ? 'var(--accent-amber)'
      : 'var(--accent-cyan)';

  return (
    <button
      onClick={onClick}
      disabled={!project.exists}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
        focus-ring
        ${!project.exists ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(167, 139, 250, 0.1))'
          : 'transparent',
        border: isActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
        boxShadow: isActive ? 'var(--glow-cyan)' : 'none',
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Project avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))'
              : 'var(--surface-elevated)',
            border: isActive ? 'none' : '1px solid var(--border-default)',
            color: isActive ? 'white' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className="font-medium text-sm truncate"
              style={{
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
              }}
            >
              {project.name}
            </span>
            {!project.exists && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-amber)"
                strokeWidth="2"
                className="flex-shrink-0"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {/* Task count badge with smooth transition */}
            <span
              className="text-xs tabular-nums transition-all duration-300 ease-out"
              style={{
                color: priorityColor,
                fontFamily: 'var(--font-mono)',
                minWidth: '1.5em',
                textAlign: 'center',
              }}
            >
              {project.taskCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              tasks
            </span>

            {/* Folder name */}
            {project.exists && (
              <>
                <span style={{ color: 'var(--border-default)' }}>·</span>
                <span
                  className="text-xs truncate"
                  style={{ color: 'var(--text-muted)' }}
                  title={project.path}
                >
                  {project.path.split(/[\\/]/).pop()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const {
    projects,
    currentProjectPath,
    fetchProjects,
    setCurrentProject,
  } = useProjectStore();

  const { fetchTasks, fetchGraph, fetchStats, setCurrentProjectPath } = useTaskStore();

  // Fetch projects when current project changes or on mount
  // This ensures sidebar task counts stay in sync with main panel
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, currentProjectPath]);

  const handleProjectClick = (project: RegistryProject) => {
    if (!project.exists) return;
    // Update BOTH stores before fetching to prevent race condition
    setCurrentProject(project.path);
    setCurrentProjectPath(project.path);
    fetchTasks();
    fetchGraph();
    fetchStats();
  };

  const handleHomeClick = () => {
    setCurrentProject(null);
    setCurrentProjectPath(null);
  };

  const isHomeActive = !currentProjectPath;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{
            background: 'rgba(5, 5, 8, 0.8)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          h-full flex flex-col overflow-hidden
          fixed z-50 md:static
          transition-[width,min-width,border-color] duration-300 ease-out
        `}
        style={{
          width: isOpen ? '256px' : '0',
          minWidth: isOpen ? '256px' : '0',
          background: 'var(--surface-abyss)',
          borderRight: isOpen ? '1px solid var(--border-default)' : '1px solid transparent',
        }}
      >
        <div className="w-64 h-full flex flex-col">
          {/* Header */}
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-muted)' }}
          >
            <div className="flex items-center gap-2.5">
              <img
                src="/Octie-Logo.png"
                alt="Octie"
                className="h-6 w-6 rounded-md"
              />
              <span
                className="font-semibold text-sm"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                octie
              </span>
            </div>

            {/* Close button for mobile */}
            <button
              onClick={onToggle}
              className="md:hidden w-6 h-6 flex items-center justify-center rounded"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Home button */}
          <div className="p-2">
            <button
              onClick={handleHomeClick}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 focus-ring"
              style={{
                background: isHomeActive
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(167, 139, 250, 0.1))'
                  : 'transparent',
                border: isHomeActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                boxShadow: isHomeActive ? 'var(--glow-cyan)' : 'none',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: isHomeActive
                    ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))'
                    : 'var(--surface-elevated)',
                  border: isHomeActive ? 'none' : '1px solid var(--border-default)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isHomeActive ? 'white' : 'var(--text-secondary)'}
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span
                className="font-medium text-sm"
                style={{ color: isHomeActive ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
              >
                Home
              </span>
            </button>
          </div>

          {/* Section divider */}
          <div
            className="mx-3 my-2 flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <div className="flex-1" style={{ height: '1px', background: 'var(--border-muted)' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
              Projects
            </span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--border-muted)' }} />
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto p-2">
            {projects.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div
                  className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--surface-elevated)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  No projects registered
                </p>
                <code
                  className="text-[10px] px-2 py-1 rounded"
                  style={{
                    background: 'var(--surface-elevated)',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  octie init
                </code>
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project, index) => (
                  <ProjectItem
                    key={project.path}
                    project={project}
                    isActive={currentProjectPath === project.path}
                    onClick={() => handleProjectClick(project)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="p-3"
            style={{ borderTop: '1px solid var(--border-muted)' }}
          >
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
              <div
                className="flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: 'var(--accent-emerald)',
                    boxShadow: '0 0 4px rgba(16, 185, 129, 0.4)',
                  }}
                />
                <span>Online</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
