import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import './App.css'
import { useTaskStore } from './store/taskStore'
import { useProjectStore } from './store/projectStore'
import { useTheme } from './contexts/ThemeContext'
import Toolbar from './components/Toolbar'
// import TaskList from './components/TaskList' // Hidden - Kanban replaces list view
import TaskDetail from './components/TaskDetail'
import FilterPanel from './components/FilterPanel'
import StatusBar from './components/StatusBar'
import GraphView from './components/GraphView'
import KanbanBoard from './components/KanbanBoard'
import Sidebar from './components/ProjectSidebar'
import Header from './components/AppHeader'
import HomePage from './pages/HomePage'
import type { TaskStatus, TaskPriority } from './types'

function App() {
  const { theme, toggleTheme } = useTheme()
  const graphViewRef = useRef<{
    exportAsPNG: () => void;
    exportAsSVG: () => void;
  } | null>(null)

  const {
    tasks,
    loading,
    error,
    selectedTaskId,
    graphData,
    projectStats,
    fetchTasks,
    fetchGraph,
    fetchStats,
    setQueryOptions,
    setSelectedTask,
    setCurrentProjectPath,
    clearError,
  } = useTaskStore()

  const {
    currentProjectPath,
    sidebarOpen,
    getProjectFromUrl,
    setCurrentProject,
    toggleSidebar,
    fetchProjects,
  } = useProjectStore()

  const [view, setView] = useState<'list' | 'graph' | 'kanban'>('kanban')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce search input - update filter after 500ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Client-side filtering of tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(task => task.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      result = result.filter(task => task.priority === filterPriority);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.notes?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tasks, filterStatus, filterPriority, searchQuery]);

  // Initialize project from URL on mount or auto-select first available
  const projectFromUrl = useMemo(() => getProjectFromUrl(), [getProjectFromUrl]);
  const projects = useProjectStore((s) => s.projects);

  useEffect(() => {
    const projectFromUrl = getProjectFromUrl()
    if (projectFromUrl) {
      setCurrentProject(projectFromUrl)
    }
    // Fetch project list on initial load
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select first project when none specified (no URL param, projects loaded)
  useEffect(() => {
    if (!currentProjectPath && !projectFromUrl && projects.length > 0) {
      setCurrentProject(projects[0].path)
    }
  }, [currentProjectPath, projectFromUrl, projects, setCurrentProject])

  // Sync project path to task store when it changes
  useEffect(() => {
    setCurrentProjectPath(currentProjectPath)
  }, [currentProjectPath, setCurrentProjectPath])

  // Fetch data when project changes (passes ?project= automatically via buildUrl)
  useEffect(() => {
    if (currentProjectPath) {
      fetchTasks()
      fetchGraph()
      fetchStats()
    }
  }, [currentProjectPath, fetchTasks, fetchGraph, fetchStats])

  // SSE auto-refresh — listen for file change events from server
  useEffect(() => {
    if (!currentProjectPath) return;

    const es = new EventSource('/api/events');

    es.addEventListener('refresh', () => {
      fetchTasks();
      fetchGraph();
      fetchStats();
    });

    return () => es.close();
  }, [currentProjectPath, fetchTasks, fetchGraph, fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchProjects()
    fetchTasks()
    fetchGraph()
    fetchStats()
  }, [fetchProjects, fetchTasks, fetchGraph, fetchStats])

  const handleStatusChange = useCallback((status: TaskStatus | 'all') => {
    setFilterStatus(status)
    setQueryOptions(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }))
  }, [setQueryOptions])

  const handlePriorityChange = useCallback((priority: TaskPriority | 'all') => {
    setFilterPriority(priority)
    setQueryOptions(prev => ({
      ...prev,
      priority: priority === 'all' ? undefined : priority,
    }))
  }, [setQueryOptions])

  const handleSearchChange = useCallback((query: string) => {
    setSearchInput(query)
    setQueryOptions(prev => ({
      ...prev,
      search: query || undefined,
    }))
  }, [setQueryOptions])

  // Clear filters when switching to graph view - graph shows all tasks
  const handleViewChange = useCallback((newView: 'list' | 'graph' | 'kanban') => {
    if (newView === 'graph') {
      // Clear filters when switching to graph view
      setFilterStatus('all')
      setFilterPriority('all')
      setSearchInput('')
      setSearchQuery('')
      setQueryOptions({})
    }
    // Kanban view uses filters like list view
    setView(newView)
  }, [setQueryOptions])

  const handleExportPNG = useCallback(() => {
    graphViewRef.current?.exportAsPNG()
  }, [])

  const handleExportSVG = useCallback(() => {
    graphViewRef.current?.exportAsSVG()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        handleRefresh()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.getElementById('search')
        searchInput?.focus()
      }

      // List view hidden - 'L' shortcut removed
      // if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
      //   handleViewChange('list')
      // }

      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        handleViewChange('graph')
      }

      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        handleViewChange('kanban')
      }

      if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
        toggleTheme()
      }

      if (e.key === 'Escape') {
        setSelectedTask(null)
      }

      if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
        toggleSidebar()
      }

      // Arrow key navigation for kanban view
      if (view === 'kanban' && tasks.length > 0) {
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault()
          const currentIndex = selectedTaskId ? tasks.findIndex(t => t.id === selectedTaskId) : -1
          const nextIndex = Math.min(currentIndex + 1, tasks.length - 1)
          setSelectedTask(tasks[nextIndex]?.id || null)
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const currentIndex = selectedTaskId ? tasks.findIndex(t => t.id === selectedTaskId) : 0
          const prevIndex = Math.max(currentIndex - 1, 0)
          setSelectedTask(tasks[prevIndex]?.id || null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, tasks, selectedTaskId, handleRefresh, toggleTheme, setSelectedTask, toggleSidebar, handleViewChange])

  // Show home page if no project selected
  const showHomePage = !currentProjectPath

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--surface-base)' }}
    >
      {/* Header */}
      <Header onMenuClick={toggleSidebar} />

      {/* Main layout with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

        {/* Main content */}
        {showHomePage ? (
          <main className="flex-1 overflow-y-auto">
            <HomePage />
          </main>
        ) : (
          <>
            {/* Error Display */}
            {error && (
              <div
                className="m-4 p-4 rounded-xl"
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid var(--accent-rose)',
                }}
              >
                <div className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-rose)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--accent-rose)' }}>
                      Error: {error}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Make sure the Octie CLI server is running:{' '}
                      <code
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          background: 'var(--surface-elevated)',
                          color: 'var(--accent-cyan)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        octie serve
                      </code>
                    </p>
                    <button
                      onClick={clearError}
                      className="mt-3 px-3 py-1.5 text-xs rounded-lg transition-colors"
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-default)',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Toolbar */}
              <Toolbar
                view={view}
                onViewChange={handleViewChange}
                onRefresh={handleRefresh}
                loading={loading}
                onExportPNG={handleExportPNG}
                onExportSVG={handleExportSVG}
              />

              {/* Status Bar - below toolbar, above content */}
              <StatusBar stats={projectStats} />

              {/* Content Area - Three-column layout */}
              <div className="flex-1 flex overflow-hidden min-w-0 min-h-0">
                {/* LIST VIEW HIDDEN - Kanban replaces list view */}
                {/*
                {view === 'list' && (
                  <aside
                    className="w-80 flex-shrink-0 overflow-y-auto hidden md:flex md:flex-col"
                    style={{
                      background: 'var(--surface-abyss)',
                      borderRight: '1px solid var(--border-default)',
                    }}
                  >
                    <div
                      className="p-4 flex-shrink-0"
                      style={{ borderBottom: '1px solid var(--border-muted)' }}
                    >
                      <h2
                        className="text-xs font-medium uppercase tracking-wide mb-3"
                        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        Filters
                      </h2>
                      <FilterPanel
                        selectedStatus={filterStatus}
                        selectedPriority={filterPriority}
                        searchQuery={searchInput}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onSearchChange={handleSearchChange}
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <div className="p-4">
                        <h2
                          className="text-xs font-medium uppercase tracking-wide mb-3 flex items-center gap-2"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          Tasks
                          <span
                            className="tabular-nums"
                            style={{ color: 'var(--accent-cyan)' }}
                          >
                            {filteredTasks.length}
                            {filteredTasks.length !== tasks.length && (
                              <span style={{ color: 'var(--text-muted)' }}>/{tasks.length}</span>
                            )}
                          </span>
                        </h2>
                        <TaskList
                          tasks={filteredTasks}
                          selectedTaskId={selectedTaskId}
                          onTaskClick={setSelectedTask}
                          loading={loading}
                        />
                      </div>
                    </div>
                  </aside>
                )}
                */}

                {/* Center Content - Graph View or Empty State */}
                {view === 'graph' && (
                  <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                    <GraphView
                      ref={graphViewRef}
                      graphData={graphData}
                      onNodeClick={setSelectedTask}
                      colorMode={theme}
                    />
                  </div>
                )}

                {/* Center Content - Kanban View */}
                {view === 'kanban' && (
                  <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                    {/* Compact filter bar for kanban */}
                    <div
                      className="px-3 py-2 flex-shrink-0 min-w-0 overflow-hidden"
                      style={{
                        background: 'var(--surface-abyss)',
                        borderBottom: '1px solid var(--border-default)',
                      }}
                    >
                      <FilterPanel
                        selectedStatus={filterStatus}
                        selectedPriority={filterPriority}
                        searchQuery={searchInput}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onSearchChange={handleSearchChange}
                        compact={true}
                      />
                    </div>
                    {/* Kanban board */}
                    <div className="flex-1 min-h-0">
                      <KanbanBoard
                        tasks={filteredTasks}
                        selectedTaskId={selectedTaskId}
                        onTaskClick={setSelectedTask}
                      />
                    </div>
                  </div>
                )}

                {/* Right Panel - Task Detail */}
                <aside
                  className={`
                    w-[400px] flex-shrink-0 overflow-hidden hidden md:flex md:flex-col
                    ${selectedTaskId ? 'fixed inset-0 z-50 md:relative md:z-auto md:flex' : ''}
                  `}
                  style={{
                    background: 'var(--surface-abyss)',
                    borderLeft: '1px solid var(--border-default)',
                  }}
                >
                  {/* Mobile close button */}
                  {selectedTaskId && (
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="md:hidden absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg z-10"
                      style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                  <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    <TaskDetail
                      task={tasks.find(t => t.id === selectedTaskId) || null}
                    />
                  </div>
                </aside>
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  )
}

export default App
