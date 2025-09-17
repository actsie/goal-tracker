import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { MiniCalendar } from './components/MiniCalendar'
import { NotebookEditor } from './components/NotebookEditor'
import { Analytics } from './components/Analytics'
import { GlobalSearch } from './components/GlobalSearch'
import { Settings } from './components/Settings'
import { useAppStore } from './store/useAppStore'
import { useGlobalKeyboard } from './hooks/useGlobalKeyboard'
import { db, initializeDefaults } from './lib/database'
import { rebuildSearchIndex } from './lib/searchService'
import { BookOpen, BarChart3, Search, Settings as SettingsIcon } from 'lucide-react'
import { Button } from './components/ui/button'

function App() {
  const {
    selectedDate,
    selectedGoalId,
    activeTab,
    setSelectedDate,
    setSelectedGoalId,
    setActiveTab,
    setGoals
  } = useAppStore()
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const notebookEditorRef = useRef<{ openNote: (noteId?: string) => void; openChecklistItem: (checklistId: string) => void } | null>(null)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      // Initialize database with defaults
      await initializeDefaults()
      
      // Load goals
      const loadedGoals = await db.goals.orderBy('createdAt').toArray()
      setGoals(loadedGoals)
      
      // Set default goal if available
      if (loadedGoals.length > 0 && !selectedGoalId) {
        setSelectedGoalId(loadedGoals[0].id)
      }
      
      // Initialize search index
      try {
        await rebuildSearchIndex()
      } catch (error) {
        console.warn('Failed to initialize search index:', error)
      }
      
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to initialize app:', error)
    }
  }

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true)
  }, [])

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false)
  }, [])

  const handleOpenNote = useCallback((_date: string, noteId?: string) => {
    if (notebookEditorRef.current) {
      notebookEditorRef.current.openNote(noteId)
    }
  }, [])

  const handleOpenChecklistItem = useCallback((_date: string, checklistId: string) => {
    if (notebookEditorRef.current) {
      notebookEditorRef.current.openChecklistItem(checklistId)
    }
  }, [])

  // Set up global keyboard shortcuts
  useGlobalKeyboard({
    onSearchOpen: handleSearchOpen
  })

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing Goal Tracker...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card flex flex-col">
          {/* Header */}
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold">Goal Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your daily progress
            </p>
          </div>
          
          {/* Calendar */}
          <div className="flex-1 overflow-auto">
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          </div>
          
          {/* Quick actions */}
          <div className="p-4 border-t space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleSearchOpen}
            >
              <Search className="h-4 w-4 mr-2" />
              Search (⌘K)
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'notebook' | 'analytics' | 'settings')} className="h-full flex flex-col">
            {/* Tab navigation */}
            <div className="border-b px-6 py-4">
              <TabsList className="grid w-full grid-cols-3 max-w-lg">
                <TabsTrigger value="notebook" className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Notebook</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center space-x-2">
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="notebook" className="h-full m-0">
                <NotebookEditor
                  ref={notebookEditorRef}
                  selectedDate={selectedDate}
                  goalId={selectedGoalId || undefined}
                />
              </TabsContent>
              
              <TabsContent value="analytics" className="h-full m-0 overflow-auto">
                <Analytics />
              </TabsContent>
              
              <TabsContent value="settings" className="h-full m-0 overflow-auto">
                <Settings />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={handleSearchClose}
        onOpenNote={handleOpenNote}
        onOpenChecklistItem={handleOpenChecklistItem}
      />
    </div>
  )
}

export default App