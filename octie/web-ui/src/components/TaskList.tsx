/**
 * Task List - List of tasks with selection
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import type { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onTaskClick: (taskId: string) => void;
  loading?: boolean;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  completed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-completed)' },
  in_progress: { bg: 'rgba(0, 212, 255, 0.15)', color: 'var(--status-in-progress)' },
  in_review: { bg: 'rgba(167, 139, 250, 0.15)', color: 'var(--accent-violet)' },
  ready: { bg: 'rgba(0, 212, 255, 0.1)', color: 'var(--accent-cyan)' },
  blocked: { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--status-blocked)' },
};

const priorityColors: Record<string, { bg: string; color: string }> = {
  top: { bg: 'var(--priority-top-glow)', color: 'var(--priority-top)' },
  second: { bg: 'var(--priority-second-glow)', color: 'var(--priority-second)' },
  later: { bg: 'var(--priority-later-glow)', color: 'var(--priority-later)' },
};

function TaskList({ tasks, selectedTaskId, onTaskClick, loading }: TaskListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="w-6 h-6 rounded-full animate-spin"
          style={{
            border: '2px solid var(--border-default)',
            borderTopColor: 'var(--accent-cyan)',
          }}
        />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <div
          className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--surface-elevated)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isSelected = selectedTaskId === task.id;
        const statusStyle = statusColors[task.status] || statusColors.ready;
        const priorityStyle = priorityColors[task.priority] || priorityColors.later;

        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task.id)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 focus-ring"
            style={{
              background: isSelected
                ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(167, 139, 250, 0.08))'
                : 'transparent',
              border: isSelected
                ? '1px solid var(--accent-cyan)'
                : '1px solid transparent',
              boxShadow: isSelected ? 'var(--glow-cyan)' : 'none',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Short ID */}
                  <span
                    className="text-[10px] tabular-nums flex-shrink-0"
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {task.id.slice(0, 8)}
                  </span>
                  <h3
                    className="text-sm font-medium truncate"
                    style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
                  >
                    {task.title}
                  </h3>
                </div>
                {task.description && (
                  <p
                    className="text-xs mt-1 line-clamp-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {task.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {/* Status badge */}
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide whitespace-nowrap"
                  style={{
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {task.status.replace('_', ' ')}
                </span>
                {/* Priority badge */}
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide whitespace-nowrap"
                  style={{
                    background: priorityStyle.bg,
                    color: priorityStyle.color,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {task.priority}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default TaskList;
