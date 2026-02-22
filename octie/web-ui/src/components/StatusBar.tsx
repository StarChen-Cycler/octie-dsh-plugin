/**
 * Status Bar - Project statistics display
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import type { ProjectStats } from '../types';

interface StatusBarProps {
  stats: ProjectStats | null;
  loading?: boolean;
}

function StatusBar({ stats, loading }: StatusBarProps) {
  if (loading) {
    return (
      <div
        className="px-4 py-2 flex items-center gap-2 text-xs"
        style={{
          background: 'var(--surface-abyss)',
          borderTop: '1px solid var(--border-default)',
          color: 'var(--text-muted)',
        }}
      >
        <div
          className="w-3 h-3 rounded-full animate-spin"
          style={{
            border: '2px solid var(--border-default)',
            borderTopColor: 'var(--accent-cyan)',
          }}
        />
        <span>Loading stats...</span>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const { tasks } = stats;

  return (
    <div
      className="px-4 py-2 flex items-center justify-between"
      style={{
        background: 'var(--surface-abyss)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Left side - Status counts */}
      <div className="flex items-center gap-4 text-xs">
        {/* Total tasks */}
        <div className="flex items-center gap-1.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {tasks.total}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>tasks</span>
        </div>

        <div style={{ width: '1px', height: '12px', background: 'var(--border-default)' }} />

        {/* Status breakdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Completed">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--status-completed)', boxShadow: '0 0 4px rgba(16, 185, 129, 0.4)' }}
            />
            <span className="tabular-nums" style={{ color: 'var(--status-completed)', fontFamily: 'var(--font-mono)' }}>
              {tasks.statusCounts.completed}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>done</span>
          </div>
          <div className="flex items-center gap-1" title="In Progress">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--status-in-progress)', boxShadow: '0 0 4px rgba(0, 212, 255, 0.4)' }}
            />
            <span className="tabular-nums" style={{ color: 'var(--status-in-progress)', fontFamily: 'var(--font-mono)' }}>
              {tasks.statusCounts.in_progress}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>prog</span>
          </div>
          <div className="flex items-center gap-1" title="Ready">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--accent-amber)', boxShadow: '0 0 4px rgba(255, 159, 28, 0.4)' }}
            />
            <span className="tabular-nums" style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {tasks.statusCounts.ready}
            </span>
            <span style={{ color: 'var(--accent-amber)', fontSize: '10px' }}>ready</span>
          </div>
          <div className="flex items-center gap-1" title="In Review">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--accent-violet)', boxShadow: '0 0 4px rgba(167, 139, 250, 0.4)' }}
            />
            <span className="tabular-nums" style={{ color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>
              {tasks.statusCounts.in_review}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>revw</span>
          </div>
          <div className="flex items-center gap-1" title="Blocked">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--status-blocked)', boxShadow: '0 0 4px rgba(244, 63, 94, 0.4)' }}
            />
            <span className="tabular-nums" style={{ color: 'var(--status-blocked)', fontFamily: 'var(--font-mono)' }}>
              {tasks.statusCounts.blocked}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>block</span>
          </div>
        </div>
      </div>

      {/* Right side - Priority counts */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--priority-top)', boxShadow: '0 0 4px rgba(244, 63, 94, 0.4)' }}
          />
          <span className="tabular-nums" style={{ color: 'var(--priority-top)', fontFamily: 'var(--font-mono)' }}>
            {tasks.priorityCounts.top}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>top</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--priority-second)', boxShadow: '0 0 4px rgba(255, 159, 28, 0.4)' }}
          />
          <span className="tabular-nums" style={{ color: 'var(--priority-second)', fontFamily: 'var(--font-mono)' }}>
            {tasks.priorityCounts.second}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>second</span>
        </div>

        {tasks.root > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {tasks.root}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>root</span>
          </div>
        )}

        {tasks.orphan > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-amber)"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="tabular-nums" style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {tasks.orphan}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>orphan</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusBar;
