/**
 * Filter Panel - Task filtering controls
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import type { TaskStatus, TaskPriority } from '../types';

interface FilterPanelProps {
  selectedStatus: TaskStatus | 'all';
  selectedPriority: TaskPriority | 'all';
  searchQuery: string;
  onStatusChange: (status: TaskStatus | 'all') => void;
  onPriorityChange: (priority: TaskPriority | 'all') => void;
  onSearchChange: (query: string) => void;
  compact?: boolean;
}

function FilterPanel({
  selectedStatus,
  selectedPriority,
  searchQuery,
  onStatusChange,
  onPriorityChange,
  onSearchChange,
  compact = false,
}: FilterPanelProps) {
  const statuses: (TaskStatus | 'all')[] = ['all', 'ready', 'in_progress', 'in_review', 'completed', 'blocked'];
  const priorities: (TaskPriority | 'all')[] = ['all', 'top', 'second', 'later'];

  // Compact mode: horizontal layout with smaller controls
  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg flex-1 min-w-[160px] max-w-[240px]"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          <svg
            className="flex-shrink-0"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search-compact"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent border-none outline-none text-xs"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus | 'all')}
            className="px-2.5 py-1.5 text-xs rounded-lg focus-ring appearance-none cursor-pointer pr-6"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Status' : status.replace('_', ' ').slice(0, 10)}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Priority Filter */}
        <div className="relative">
          <select
            value={selectedPriority}
            onChange={(e) => onPriorityChange(e.target.value as TaskPriority | 'all')}
            className="px-2.5 py-1.5 text-xs rounded-lg focus-ring appearance-none cursor-pointer pr-6"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'all' ? 'All Priority' : priority}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Clear Filters */}
        {(selectedStatus !== 'all' || selectedPriority !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              onStatusChange('all');
              onPriorityChange('all');
              onSearchChange('');
            }}
            className="px-2 py-1.5 text-xs rounded-lg transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <label
          htmlFor="search"
          className="block text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Search
          <span
            className="ml-2 normal-case"
            style={{ color: 'var(--text-tertiary)' }}
          >
            (Ctrl+K)
          </span>
        </label>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          <svg
            className="flex-shrink-0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <label
          htmlFor="status"
          className="block text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Status
        </label>
        <div className="relative">
          <select
            id="status"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus | 'all')}
            className="w-full px-3 py-2 text-sm rounded-lg focus-ring appearance-none cursor-pointer pr-8"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Priority Filter */}
      <div>
        <label
          htmlFor="priority"
          className="block text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Priority
        </label>
        <div className="relative">
          <select
            id="priority"
            value={selectedPriority}
            onChange={(e) => onPriorityChange(e.target.value as TaskPriority | 'all')}
            className="w-full px-3 py-2 text-sm rounded-lg focus-ring appearance-none cursor-pointer pr-8"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'all' ? 'All Priorities' : priority}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Clear Filters */}
      {(selectedStatus !== 'all' || selectedPriority !== 'all' || searchQuery) && (
        <button
          onClick={() => {
            onStatusChange('all');
            onPriorityChange('all');
            onSearchChange('');
          }}
          className="w-full px-3 py-2 text-xs uppercase tracking-wide rounded-lg transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-default)',
            color: 'var(--text-muted)',
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

export default FilterPanel;
