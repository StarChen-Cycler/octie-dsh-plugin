/**
 * Task Detail - Detailed task view
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

import type { Task } from '../types';

interface TaskDetailProps {
  task: Task | null;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  completed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-completed)' },
  in_progress: { bg: 'rgba(0, 212, 255, 0.15)', color: 'var(--status-in-progress)' },
  in_review: { bg: 'rgba(167, 139, 250, 0.15)', color: 'var(--accent-violet)' },
  ready: { bg: 'rgba(255, 159, 28, 0.1)', color: 'var(--accent-amber)' },
  blocked: { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--status-blocked)' },
};

const priorityColors: Record<string, { bg: string; color: string }> = {
  top: { bg: 'var(--priority-top-glow)', color: 'var(--priority-top)' },
  second: { bg: 'var(--priority-second-glow)', color: 'var(--priority-second)' },
  later: { bg: 'var(--priority-later-glow)', color: 'var(--priority-later)' },
};

function TaskDetail({ task }: TaskDetailProps) {
  if (!task) {
    return (
      <div className="text-center py-8">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--surface-elevated)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Select a task to view details
        </p>
      </div>
    );
  }

  const statusStyle = statusColors[task.status] || statusColors.ready;
  const priorityStyle = priorityColors[task.priority] || priorityColors.later;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {/* Task ID */}
        <div
          className="text-[10px] tabular-nums mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {task.id}
        </div>

        {/* Title */}
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {task.title}
        </h2>

        {/* Status & Priority badges */}
        <div className="flex items-center gap-2 mt-3">
          <span
            className="px-2 py-1 rounded-md text-xs uppercase tracking-wide"
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {task.status.replace('_', ' ')}
          </span>
          <span
            className="px-2 py-1 rounded-md text-xs uppercase tracking-wide"
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

      {/* Description */}
      {task.description && (
        <div>
          <SectionTitle>Description</SectionTitle>
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {task.description}
          </p>
        </div>
      )}

      {/* Success Criteria */}
      {task.success_criteria.length > 0 && (
        <div>
          <SectionTitle>
            Success Criteria
            <span style={{ color: 'var(--accent-cyan)' }}>
              {' '}
              ({task.success_criteria.filter((c) => c.completed).length}/{task.success_criteria.length})
            </span>
          </SectionTitle>
          <ul className="space-y-2">
            {task.success_criteria.map((criterion) => (
              <li
                key={criterion.id}
                className="flex items-start gap-3 text-sm"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: criterion.completed
                      ? 'var(--status-completed)'
                      : 'var(--surface-elevated)',
                    border: criterion.completed
                      ? 'none'
                      : '1px solid var(--border-default)',
                  }}
                >
                  {criterion.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span
                  className={criterion.completed ? 'line-through' : ''}
                  style={{ color: criterion.completed ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                >
                  {criterion.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deliverables */}
      {task.deliverables.length > 0 && (
        <div>
          <SectionTitle>
            Deliverables
            <span style={{ color: 'var(--accent-amber)' }}>
              {' '}
              ({task.deliverables.filter((d) => d.completed).length}/{task.deliverables.length})
            </span>
          </SectionTitle>
          <ul className="space-y-2">
            {task.deliverables.map((deliverable) => (
              <li
                key={deliverable.id}
                className="flex items-start gap-3 text-sm"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: deliverable.completed
                      ? 'var(--status-completed)'
                      : 'var(--surface-elevated)',
                    border: deliverable.completed
                      ? 'none'
                      : '1px solid var(--border-default)',
                  }}
                >
                  {deliverable.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={deliverable.completed ? 'line-through' : ''}
                    style={{ color: deliverable.completed ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                  >
                    {deliverable.text}
                  </span>
                  {deliverable.file_path && (
                    <code
                      className="block mt-1 text-xs px-2 py-1 rounded"
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {deliverable.file_path}
                    </code>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Need Fix */}
      {task.need_fix && task.need_fix.length > 0 && (
        <div>
          <SectionTitle>
            Need Fix
            <span style={{ color: 'var(--status-blocked)' }}>
              {' '}
              ({task.need_fix.filter((f) => f.completed).length}/{task.need_fix.length})
            </span>
          </SectionTitle>
          <ul className="space-y-2">
            {task.need_fix.map((fix) => (
              <li
                key={fix.id}
                className="flex items-start gap-3 text-sm"
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: fix.completed
                      ? 'var(--status-completed)'
                      : 'rgba(244, 63, 94, 0.3)',
                    border: fix.completed
                      ? 'none'
                      : '1px solid rgba(244, 63, 94, 0.5)',
                  }}
                >
                  {fix.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={fix.completed ? 'line-through' : ''}
                    style={{ color: fix.completed ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                  >
                    {fix.text}
                  </span>
                  {fix.file_path && (
                    <code
                      className="block mt-1 text-xs px-2 py-1 rounded"
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {fix.file_path}
                    </code>
                  )}
                  {fix.source && (
                    <span
                      className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded uppercase"
                      style={{
                        background: 'rgba(244, 63, 94, 0.1)',
                        color: 'var(--status-blocked)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {fix.source}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Files */}
      {task.related_files && task.related_files.length > 0 && (
        <div>
          <SectionTitle>Related Files</SectionTitle>
          <ul className="space-y-1">
            {task.related_files.map((file, idx) => (
              <li key={idx}>
                <code
                  className="text-xs px-2 py-1 rounded inline-block"
                  style={{
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {file}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {task.blockers && task.blockers.length > 0 && (
        <div>
          <SectionTitle>
            Blocked By
            <span style={{ color: 'var(--status-blocked)' }}>
              {' '}({task.blockers.length})
            </span>
          </SectionTitle>
          <ul className="space-y-1">
            {task.blockers.map((blockerId, idx) => (
              <li key={idx}>
                <code
                  className="text-xs px-2 py-1 rounded inline-block"
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    color: 'var(--status-blocked)',
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                  }}
                >
                  {blockerId}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dependencies */}
      {task.dependencies && (
        <div>
          <SectionTitle>Dependencies</SectionTitle>
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              borderLeft: '3px solid var(--accent-amber)',
            }}
          >
            {task.dependencies}
          </div>
        </div>
      )}

      {/* C7 Verified */}
      {task.c7_verified && task.c7_verified.length > 0 && (
        <div>
          <SectionTitle>
            C7 Verified
            <span style={{ color: 'var(--accent-cyan)' }}>
              {' '}({task.c7_verified.length})
            </span>
          </SectionTitle>
          <ul className="space-y-1">
            {task.c7_verified.map((lib, idx) => (
              <li key={idx}>
                <code
                  className="text-xs px-2 py-1 rounded inline-block"
                  style={{
                    background: 'rgba(0, 212, 255, 0.1)',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                  }}
                >
                  {lib}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {task.notes && (
        <div>
          <SectionTitle>Notes</SectionTitle>
          <div
            className="p-3 rounded-lg text-sm whitespace-pre-wrap"
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              borderLeft: '3px solid var(--accent-violet)',
            }}
          >
            {task.notes}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div
        className="pt-4"
        style={{ borderTop: '1px solid var(--border-muted)' }}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Created:</span>
            <div
              className="mt-0.5"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              {new Date(task.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Updated:</span>
            <div
              className="mt-0.5"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              {new Date(task.updated_at).toLocaleString()}
            </div>
          </div>
          {task.completed_at && (
            <div className="col-span-2">
              <span style={{ color: 'var(--text-muted)' }}>Completed:</span>
              <div
                className="mt-0.5"
                style={{ color: 'var(--status-completed)', fontFamily: 'var(--font-mono)' }}
              >
                {new Date(task.completed_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-medium uppercase tracking-wide mb-2"
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </h3>
  );
}

export default TaskDetail;
