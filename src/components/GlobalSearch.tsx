import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, CheckSquare, X, ArrowDown, ArrowUp } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { searchContent, type SearchResult, initSearchDB } from '../lib/searchService';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote: (date: string, noteId?: string) => void;
  onOpenChecklistItem: (date: string, checklistId: string) => void;
}

export function GlobalSearch({ isOpen, onClose, onOpenNote, onOpenChecklistItem }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { setSelectedDate, setActiveTab } = useAppStore();

  // Initialize search database
  useEffect(() => {
    const initSearch = async () => {
      try {
        await initSearchDB();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize search:', err);
        setError('Failed to initialize search. Some features may be limited.');
        setIsInitialized(true); // Still allow usage with fallback
      }
    };
    
    initSearch();
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setError(null);
    }
  }, [isOpen]);

  // Debounced search function
  const performSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSelectedIndex(0);
      setIsLoading(false);
      return;
    }

    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsLoading(true);
      setError(null);
      
      const searchResults = await searchContent(searchQuery, 50);
      
      if (!abortController.signal.aborted) {
        setResults(searchResults);
        setSelectedIndex(0);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('Search error:', err);
        setError('Search temporarily unavailable. Please try again.');
        setResults([]);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, 300);

  // Handle query change
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    performSearch(value);
  }, [performSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'PageDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 10, results.length - 1));
          break;
        case 'PageUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 10, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, results]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    const resultDate = new Date(result.date + 'T00:00:00');
    if (result.type === 'note') {
      setSelectedDate(resultDate);
      setActiveTab('notebook');
      onOpenNote(result.date, result.noteId);
    } else if (result.type === 'checklist') {
      setSelectedDate(resultDate);
      setActiveTab('notebook');
      onOpenChecklistItem(result.date, result.checklistId!);
    }
    onClose();
  }, [setSelectedDate, setActiveTab, onOpenNote, onOpenChecklistItem, onClose]);

  const highlightText = (text: string, highlights: { start: number; end: number }[]) => {
    if (!highlights || highlights.length === 0) {
      return <span>{text}</span>;
    }

    const parts = [];
    let lastIndex = 0;

    highlights.forEach(({ start, end }) => {
      // Add text before highlight
      if (start > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, start)}
          </span>
        );
      }
      
      // Add highlighted text
      parts.push(
        <span key={`highlight-${start}`} className="bg-yellow-200 dark:bg-yellow-700 font-semibold">
          {text.slice(start, end)}
        </span>
      );
      
      lastIndex = end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getSnippet = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]">
      <div className="bg-background border rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[60vh] flex flex-col">
        {/* Search Input */}
        <div className="flex items-center p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search notes and checklist items..."
            className="border-0 focus-visible:ring-0 text-lg"
            disabled={!isInitialized}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-auto" ref={resultsRef}>
          {!isInitialized && (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Initializing search...
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <div className="text-destructive mb-2">{error}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  if (query) {
                    performSearch(query);
                  }
                }}
              >
                Try Again
              </Button>
            </div>
          )}

          {isInitialized && !error && (
            <>
              {isLoading && (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  Searching...
                </div>
              )}

              {!isLoading && query && results.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No results found</h3>
                  <p className="text-sm">
                    Try different keywords or check your spelling.
                  </p>
                </div>
              )}

              {!isLoading && !query && (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Search your notes</h3>
                  <p className="text-sm">
                    Start typing to find notes and checklist items.
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {/* Group results by type */}
                  {['note', 'checklist'].map(type => {
                    const typeResults = results.filter(r => r.type === type);
                    if (typeResults.length === 0) return null;

                    return (
                      <div key={type}>
                        <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/50">
                          {type === 'note' ? (
                            <>
                              <FileText className="h-3 w-3 inline mr-1" />
                              Notes ({typeResults.length})
                            </>
                          ) : (
                            <>
                              <CheckSquare className="h-3 w-3 inline mr-1" />
                              Checklist Items ({typeResults.length})
                            </>
                          )}
                        </div>
                        {typeResults.map((result) => {
                          const globalIndex = results.indexOf(result);
                          return (
                            <div
                              key={result.id}
                              className={`px-4 py-3 cursor-pointer border-b hover:bg-muted/50 transition-colors ${
                                selectedIndex === globalIndex ? 'bg-accent' : ''
                              }`}
                              onClick={() => handleSelectResult(result)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {highlightText(getSnippet(result.content), result.highlights)}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatDate(result.date)}
                                  </div>
                                </div>
                                <div className="ml-2 flex items-center text-muted-foreground">
                                  {result.type === 'note' ? (
                                    <FileText className="h-4 w-4" />
                                  ) : (
                                    <CheckSquare className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {results.length >= 50 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center border-t">
                      Showing first 50 results. Refine your search for more specific results.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with keyboard shortcuts */}
        {isInitialized && !error && (
          <div className="px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <ArrowUp className="h-3 w-3 mr-1" />
                <ArrowDown className="h-3 w-3 mr-1" />
                Navigate
              </span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
            {results.length > 0 && (
              <span>
                {selectedIndex + 1} of {results.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}