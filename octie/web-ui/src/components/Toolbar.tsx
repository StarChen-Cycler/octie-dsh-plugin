/**
 * Toolbar - View controls and actions
 * Design: Terminal Noir - Dark cyberpunk aesthetic
 */

interface ToolbarProps {
  view: 'list' | 'graph' | 'kanban';
  onViewChange: (view: 'list' | 'graph' | 'kanban') => void;
  onRefresh: () => void;
  loading?: boolean;
  onExportPNG?: () => void;
  onExportSVG?: () => void;
}

function Toolbar({
  view,
  onViewChange,
  onRefresh,
  loading,
  onExportPNG,
  onExportSVG,
}: ToolbarProps) {
  return (
    <div
      className="px-4 py-3"
      style={{
        background: 'var(--surface-abyss)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Left - View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {/* List view hidden - Kanban replaces it */}
            {/* <button
              type="button"
              onClick={() => onViewChange('list')}
              className="flex items-center gap-2 px-3 py-2 text-sm transition-all duration-200"
              style={{
                background: view === 'list'
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(167, 139, 250, 0.15))'
                  : 'var(--surface-raised)',
                color: view === 'list' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                borderRight: '1px solid var(--border-default)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              List
              <kbd
                className="text-[10px] px-1 rounded"
                style={{
                  background: view === 'list' ? 'var(--surface-elevated)' : 'var(--surface-base)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                L
              </kbd>
            </button> */}
            <button
              type="button"
              onClick={() => onViewChange('kanban')}
              className="flex items-center gap-2 px-3 py-2 text-sm transition-all duration-200"
              style={{
                background: view === 'kanban'
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(167, 139, 250, 0.15))'
                  : 'var(--surface-raised)',
                color: view === 'kanban' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                borderRight: '1px solid var(--border-default)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="10" y="3" width="5" height="18" rx="1" />
                <rect x="17" y="3" width="5" height="14" rx="1" />
              </svg>
              Kanban
              <kbd
                className="text-[10px] px-1 rounded"
                style={{
                  background: view === 'kanban' ? 'var(--surface-elevated)' : 'var(--surface-base)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('graph')}
              className="flex items-center gap-2 px-3 py-2 text-sm transition-all duration-200"
              style={{
                background: view === 'graph'
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(167, 139, 250, 0.15))'
                  : 'var(--surface-raised)',
                color: view === 'graph' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="5" cy="6" r="3" />
                <circle cx="19" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="7" y1="8" x2="10" y2="16" />
                <line x1="17" y1="8" x2="14" y2="16" />
              </svg>
              Graph
              <kbd
                className="text-[10px] px-1 rounded"
                style={{
                  background: view === 'graph' ? 'var(--surface-elevated)' : 'var(--surface-base)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                G
              </kbd>
            </button>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Export Buttons (only in graph view) */}
          {view === 'graph' && (
            <>
              <button
                type="button"
                onClick={onExportPNG}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
                title="Export as PNG"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                PNG
              </button>
              <button
                type="button"
                onClick={onExportSVG}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
                title="Export as SVG"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                SVG
              </button>
            </>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
            style={{
              background: 'var(--accent-cyan)',
              border: 'none',
              color: 'white',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            title="Refresh (Ctrl+R)"
            disabled={loading}
          >
            {loading ? (
              <div
                className="w-4 h-4 rounded-full animate-spin"
                style={{
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
