import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Task, TaskStatus } from '../types';

/**
 * Get the status color for styling
 */
function getStatusColor(status: TaskStatus | string): string {
  switch (status) {
    case 'ready':
      return 'var(--status-pending)';
    case 'in_progress':
      return 'var(--status-in-progress)';
    case 'in_review':
      return 'var(--accent-violet)';
    case 'completed':
      return 'var(--status-completed)';
    case 'blocked':
      return 'var(--status-blocked)';
    default:
      return 'var(--border-default)';
  }
}

/**
 * Get the glow color (with opacity) for box-shadow
 */
function getStatusGlowColor(status: TaskStatus | string): string {
  switch (status) {
    case 'ready':
      return 'rgba(255, 159, 28, 0.4)';
    case 'in_progress':
      return 'rgba(0, 212, 255, 0.4)';
    case 'in_review':
      return 'rgba(167, 139, 250, 0.4)';
    case 'completed':
      return 'rgba(16, 185, 129, 0.4)';
    case 'blocked':
      return 'rgba(244, 63, 94, 0.4)';
    default:
      return 'rgba(110, 118, 129, 0.2)';
  }
}

function TaskNode({ data, selected }: NodeProps) {
  const task = data as Task;
  const statusColor = getStatusColor(task.status);
  const glowColor = getStatusGlowColor(task.status);

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 min-w-[200px] max-w-[300px] ${
        selected ? 'shadow-lg' : 'shadow-md'
      }`}
      style={{
        background: 'var(--surface-elevated)',
        borderColor: statusColor,
        boxShadow: selected
          ? `0 0 15px ${glowColor}, 0 0 30px ${glowColor}`
          : `0 0 8px ${glowColor}`,
      }}
    >
      {/* Target Handle - connects FROM other nodes TO this node */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
        style={{ background: 'var(--accent-cyan)' }}
      />

      <div className="flex items-center justify-between mb-2">
        <h3
          className="font-semibold text-sm truncate flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {task.title}
        </h3>
        <span
          className={`ml-2 px-1.5 py-0.5 rounded text-xs flex-shrink-0`}
          style={{
            background: task.priority === 'top'
              ? 'var(--accent-red)'
              : task.priority === 'second'
                ? 'var(--accent-yellow)'
                : 'var(--surface-base)',
            color: task.priority === 'later' ? 'var(--text-muted)' : 'white',
          }}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p
          className="text-xs line-clamp-2 mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {task.description}
        </p>
      )}

      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="capitalize">{task.status.replace('_', ' ')}</span>
        <span>
          {task.success_criteria?.filter((c) => c.completed).length || 0}/
          {task.success_criteria?.length || 0}
        </span>
      </div>

      {/* Source Handle - connects FROM this node TO other nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
        style={{ background: 'var(--accent-cyan)' }}
      />
    </div>
  );
}

export default memo(TaskNode);
