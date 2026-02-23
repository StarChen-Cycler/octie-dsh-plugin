/**
 * KanbanBoard - Kanban view with responsive collapse
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 *
 * Responsive behavior:
 * - Large (>=1280px): Full kanban cards with all details
 * - Medium (768-1279px): Compact cards showing title + status
 * - Small (<768px): Minimal columns showing only counts (collapsed)
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Task, TaskStatus } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onTaskClick: (taskId: string) => void;
}

// Status column configuration
const STATUS_COLUMNS: { status: TaskStatus; label: string; icon: React.ReactNode }[] = [
  {
    status: 'ready',
    label: 'Ready',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      </svg>
    ),
  },
  {
    status: 'in_review',
    label: 'In Review',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    status: 'blocked',
    label: 'Blocked',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
];

// Status colors matching the project theme
const statusColors: Record<TaskStatus, { bg: string; color: string; glow: string; border: string }> = {
  ready: {
    bg: 'rgba(255, 159, 28, 0.1)',
    color: 'var(--accent-amber)',
    glow: '0 0 20px rgba(255, 159, 28, 0.2)',
    border: 'rgba(255, 159, 28, 0.25)',
  },
  in_progress: {
    bg: 'rgba(0, 212, 255, 0.12)',
    color: 'var(--status-in-progress)',
    glow: '0 0 20px rgba(0, 212, 255, 0.3)',
    border: 'rgba(0, 212, 255, 0.3)',
  },
  in_review: {
    bg: 'rgba(167, 139, 250, 0.12)',
    color: 'var(--accent-violet)',
    glow: '0 0 20px rgba(167, 139, 250, 0.3)',
    border: 'rgba(167, 139, 250, 0.3)',
  },
  completed: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: 'var(--status-completed)',
    glow: '0 0 20px rgba(16, 185, 129, 0.3)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  blocked: {
    bg: 'rgba(244, 63, 94, 0.12)',
    color: 'var(--status-blocked)',
    glow: '0 0 20px rgba(244, 63, 94, 0.3)',
    border: 'rgba(244, 63, 94, 0.3)',
  },
};

// Priority indicator colors
const priorityIndicator: Record<string, string> = {
  top: 'var(--priority-top)',
  second: 'var(--priority-second)',
  later: 'var(--priority-later)',
};

// Hook for viewport width detection
function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

// Kanban card component
interface KanbanCardProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
}

function KanbanCard({ task, isSelected, onClick }: KanbanCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg transition-all duration-200 mb-2"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(167, 139, 250, 0.08))'
          : 'var(--surface-raised)',
        border: isSelected
          ? '1px solid var(--accent-cyan)'
          : '1px solid var(--border-default)',
        boxShadow: isSelected ? 'var(--glow-cyan)' : 'none',
      }}
    >
      {/* Header with ID and priority */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] tabular-nums"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {task.id.slice(0, 8)}
        </span>
        <div
          className="px-1.5 py-0.5 rounded text-[10px] uppercase"
          style={{
            background: `${priorityIndicator[task.priority]}20`,
            color: priorityIndicator[task.priority],
            fontFamily: 'var(--font-mono)',
          }}
        >
          {task.priority}
        </div>
      </div>

      {/* Title */}
      <h4
        className="text-sm font-medium mb-1.5 line-clamp-2"
        style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
      >
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p
          className="text-xs mb-2 line-clamp-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {task.description}
        </p>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {task.success_criteria.length > 0 && (
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {task.success_criteria.filter(c => c.completed).length}/{task.success_criteria.length}
            </span>
          </div>
        )}
        {task.blockers.length > 0 && (
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[10px]" style={{ color: 'var(--accent-rose)' }}>
              {task.blockers.length}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// Collapsed column view for small screens
interface CollapsedColumnProps {
  status: TaskStatus;
  label: string;
  icon: React.ReactNode;
  count: number;
  onClick: () => void;
  isActive: boolean;
}

function CollapsedColumn({ status, label, icon, count, onClick, isActive }: CollapsedColumnProps) {
  const colors = statusColors[status];

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 min-w-[60px]"
      style={{
        background: isActive ? colors.bg : 'var(--surface-raised)',
        border: isActive ? `2px solid ${colors.border}` : '1px solid var(--border-default)',
        boxShadow: isActive ? colors.glow : 'none',
      }}
    >
      <div style={{ color: isActive ? colors.color : 'var(--text-muted)' }}>
        {icon}
      </div>
      <span
        className="text-xl font-bold mt-1 tabular-nums"
        style={{ color: isActive ? colors.color : 'var(--text-primary)' }}
      >
        {count}
      </span>
      <span
        className="text-[10px] uppercase tracking-wide mt-0.5"
        style={{ color: isActive ? colors.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </span>
    </button>
  );
}

function KanbanBoard({ tasks, selectedTaskId, onTaskClick }: KanbanBoardProps) {
  const viewportWidth = useViewportWidth();
  const [expandedStatus, setExpandedStatus] = useState<TaskStatus | null>(null);

  // Responsive breakpoint: collapsed view for small screens
  const isCollapsed = viewportWidth < 768;

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      ready: [],
      in_progress: [],
      in_review: [],
      completed: [],
      blocked: [],
    };

    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  // Collapsed view: show only counts in compact buttons
  if (isCollapsed) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          {STATUS_COLUMNS.map(({ status, label, icon }) => (
            <CollapsedColumn
              key={status}
              status={status}
              label={label}
              icon={icon}
              count={tasksByStatus[status].length}
              onClick={() => setExpandedStatus(expandedStatus === status ? null : status)}
              isActive={expandedStatus === status}
            />
          ))}
        </div>

        {/* Expanded column detail */}
        {expandedStatus && (
          <div
            className="rounded-xl p-3 mt-4"
            style={{
              background: 'var(--surface-abyss)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-sm font-medium flex items-center gap-2"
                style={{ color: statusColors[expandedStatus].color }}
              >
                {STATUS_COLUMNS.find(c => c.status === expandedStatus)?.icon}
                {STATUS_COLUMNS.find(c => c.status === expandedStatus)?.label}
              </h3>
              <button
                onClick={() => setExpandedStatus(null)}
                className="p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {tasksByStatus[expandedStatus].length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No tasks
                </p>
              ) : (
                tasksByStatus[expandedStatus].map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => onTaskClick(task.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Total summary */}
        <div
          className="mt-4 p-3 rounded-lg text-center"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total:{' '}
            <span className="font-medium" style={{ color: 'var(--accent-cyan)' }}>
              {tasks.length}
            </span>{' '}
            tasks
          </span>
        </div>
      </div>
    );
  }

  // Full kanban view (compact or full cards)
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 p-4 h-full min-w-max">
        {STATUS_COLUMNS.map(({ status, label, icon }) => {
          const colors = statusColors[status];
          const columnTasks = tasksByStatus[status];

          return (
            <div
              key={status}
              className="flex flex-col w-64 flex-shrink-0"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                style={{
                  background: colors.bg,
                  borderBottom: `2px solid ${colors.border}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: colors.color }}>{icon}</span>
                  <h3
                    className="text-sm font-medium"
                    style={{ color: colors.color, fontFamily: 'var(--font-mono)' }}
                  >
                    {label}
                  </h3>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium tabular-nums"
                  style={{
                    background: colors.border,
                    color: colors.color,
                  }}
                >
                  {columnTasks.length}
                </span>
              </div>

              {/* Column content */}
              <div
                className="flex-1 overflow-y-auto p-2 rounded-b-lg"
                style={{
                  background: 'var(--surface-abyss)',
                  border: '1px solid var(--border-default)',
                  borderTop: 'none',
                }}
              >
                {columnTasks.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-8 text-center"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-2 opacity-50">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                    <p className="text-xs">No tasks</p>
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onClick={() => onTaskClick(task.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanBoard;
