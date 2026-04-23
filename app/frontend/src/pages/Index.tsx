import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@metagptx/web-sdk';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookOpen, Brain, LogOut, Loader2, Mic, ScrollText, User as UserIcon } from 'lucide-react';
import AddWordForm from '@/components/AddWordForm';
import WordCard, { VocabularyWord } from '@/components/WordCard';
import WordFilters, { FilterState } from '@/components/WordFilters';
import AuthLanding from '@/components/AuthLanding';

const GrammarRulesPage = lazy(() => import('@/components/GrammarRulesPage'));
const SpeakingPracticePage = lazy(() => import('@/components/SpeakingPracticePage'));
const QuizPage = lazy(() => import('@/components/QuizPage'));

type TabKey = 'dictionary' | 'grammar' | 'speaking' | 'quiz';

const client = createClient();

export default function Index() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('dictionary');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    partOfSpeech: '',
    gender: '',
    category: '',
  });

  const checkAuth = async () => {
    try {
      const resp = await client.auth.me();
      setUser((resp as any).data || null);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadWords = useCallback(async () => {
    setListLoading(true);
    try {
      const resp = await client.entities.vocabulary_words.query({
        sort: '-created_at',
        limit: 500,
      });
      const items = (resp as any).data?.items || [];
      setWords(items);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Deutsch & Kasachisch';
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadWords();
    }
  }, [user, loadWords]);

  const handleLogin = () => {
    client.auth.toLogin();
  };

  const handleLogout = async () => {
    try {
      await client.auth.logout();
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const partOfSpeechOptions = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => {
      if (w.part_of_speech) set.add(w.part_of_speech);
    });
    return Array.from(set).sort();
  }, [words]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    words.forEach((w) => {
      if (w.category) counts.set(w.category, (counts.get(w.category) || 0) + 1);
    });
    // Sort by count descending, then alphabetically
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cat]) => cat);
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      if (filters.partOfSpeech && w.part_of_speech !== filters.partOfSpeech) return false;
      if (filters.gender && w.gender?.toLowerCase() !== filters.gender) return false;
      if (filters.category && w.category !== filters.category) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${w.german_word} ${w.russian_translation} ${w.kazakh_translation} ${w.category || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [words, filters]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return <AuthLanding onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Deutsch & Kasachisch</h1>
              <p className="text-xs text-slate-500">Словарь с AI-анализом</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-slate-600" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dictionary'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Словарь
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grammar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'grammar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            Грамматика
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('speaking')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'speaking'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-4 h-4" />
            Говорение
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'quiz'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-4 h-4" />
            Квиз
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'dictionary' ? (
          <>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Мой словарь</h2>
              <p className="text-slate-600">
                Введите немецкое слово — AI автоматически определит его род, часть речи и переведёт на русский и казахский.
              </p>
            </div>

            <AddWordForm onWordAdded={loadWords} />

            {words.length > 0 && (
              <Card className="p-5 bg-white">
                <WordFilters
                  filters={filters}
                  onChange={setFilters}
                  partOfSpeechOptions={partOfSpeechOptions}
                  categoryOptions={categoryOptions}
                />
              </Card>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Все слова{' '}
                  <span className="text-slate-500 font-normal">
                    ({filteredWords.length}
                    {filteredWords.length !== words.length ? ` из ${words.length}` : ''})
                  </span>
                </h3>
              </div>

              {listLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : filteredWords.length === 0 ? (
                <Card className="p-12 text-center bg-white border-dashed">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {words.length === 0
                      ? 'Ваш словарь пуст. Добавьте первое слово!'
                      : 'Ничего не найдено по заданным фильтрам.'}
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredWords.map((word) => (
                    <WordCard key={word.id} word={word} onDeleted={loadWords} onUpdated={loadWords} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'grammar' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            }
          >
            <GrammarRulesPage />
          </Suspense>
        ) : activeTab === 'speaking' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            }
          >
            <SpeakingPracticePage />
          </Suspense>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            }
          >
            <QuizPage />
          </Suspense>
        )}

        <footer className="text-center text-xs text-slate-400 pt-8 pb-4">
          Deutsch & Kasachisch · AI-powered dictionary & grammar
        </footer>
      </main>
    </div>
  );
}