import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookMarked,
  CheckCircle2,
  Eye,
  Layers,
  Sparkles,
  Trash2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import PronounceButton from './PronounceButton';
import {
  loadProgress,
  getDueCards,
  rateSRSCard,
  getSRSStats,
  removeFromSRS,
  recordActivity,
  type SRSCard,
  type UserProgress,
} from '@/lib/progressStore';

interface Props {
  userId?: string;
}

type Rating = 'again' | 'hard' | 'good' | 'easy';

const BOX_LABELS = ['Новая', 'Изучается', '3 дня', '1 неделя', '2 недели', 'Выучено'];

export default function SRSPage({ userId }: Props) {
  const effectiveUserId = userId || 'anonymous';
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress(effectiveUserId));
  const [session, setSession] = useState<SRSCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    setProgress(loadProgress(effectiveUserId));
  }, [effectiveUserId]);

  const stats = useMemo(() => getSRSStats(progress), [progress]);

  const startReview = () => {
    const due = getDueCards(progress, 20);
    if (due.length === 0) {
      toast.info('Нет карточек для повторения. Попробуйте позже или добавьте новые слова.');
      return;
    }
    setSession(due);
    setCurrentIdx(0);
    setRevealed(false);
    setSessionDone(false);
    setSessionStats({ correct: 0, total: 0 });
  };

  const finishSession = (statsData: { correct: number; total: number }) => {
    if (statsData.total > 0) {
      recordActivity(effectiveUserId, 'srs', statsData.correct, statsData.total);
    }
    setProgress(loadProgress(effectiveUserId));
    setSessionDone(true);
  };

  const handleRating = (rating: Rating) => {
    if (!session[currentIdx]) return;
    const card = session[currentIdx];
    const updated = rateSRSCard(effectiveUserId, card.id, rating);
    setProgress(updated);
    const correctIncrement = rating !== 'again' ? 1 : 0;
    const newStats = {
      correct: sessionStats.correct + correctIncrement,
      total: sessionStats.total + 1,
    };
    setSessionStats(newStats);

    if (currentIdx >= session.length - 1) {
      finishSession(newStats);
      return;
    }
    setCurrentIdx((prev) => prev + 1);
    setRevealed(false);
  };

  const handleDelete = (cardId: string) => {
    if (!confirm('Удалить эту карточку из колоды?')) return;
    const updated = removeFromSRS(effectiveUserId, cardId);
    setProgress(updated);
    // Drop from current session too
    setSession((prev) => prev.filter((c) => c.id !== cardId));
    if (currentIdx >= session.length - 1) {
      setSessionDone(true);
    }
    toast.success('Карточка удалена');
  };

  // ---------- No session: overview ----------
  if (session.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Layers className="w-7 h-7 text-indigo-600" />
            Карточки (SRS)
          </h2>
          <p className="text-slate-600">
            Система интервального повторения. Добавляйте слова из квиза и регулярно повторяйте — карточки будут возвращаться через 10 минут, 1, 3, 7, 14 и 30 дней.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
            <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Всего</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide">К повторению</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.due}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Учим</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.learning}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Выучено</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.mastered}</div>
          </Card>
        </div>

        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Колода</h3>
            <Button
              type="button"
              onClick={startReview}
              disabled={stats.due === 0}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {stats.due > 0 ? `Повторить ${stats.due}` : 'Нет к повторению'}
            </Button>
          </div>

          {progress.srsDeck.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <BookMarked className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="mb-1 font-medium text-slate-700">Колода пуста</p>
              <p className="text-sm">
                Добавляйте слова в карточки в разделе <strong>Квиз</strong> после проверки ответа.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {progress.srsDeck
                .slice()
                .sort((a, b) => a.due - b.due)
                .map((c) => {
                  const isDue = c.due <= Date.now();
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isDue ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Badge
                        className={`text-[10px] ${
                          c.box >= 4
                            ? 'bg-emerald-100 text-emerald-700'
                            : c.box >= 2
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        } border-0 shrink-0`}
                      >
                        {BOX_LABELS[c.box]}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{c.german_word}</span>
                          <span className="text-xs text-slate-500">— {c.russian_translation}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(c.id)}
                        className="h-7 w-7 text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ---------- Session finished ----------
  if (sessionDone) {
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-200 shadow-lg">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mx-auto shadow-md">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Сессия завершена!</h2>
            <p className="text-slate-600">
              Повторено карточек: <strong>{sessionStats.total}</strong>{' '}
              (правильно: <strong className="text-emerald-700">{sessionStats.correct}</strong>)
            </p>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSession([]);
              setSessionDone(false);
            }}
            className="flex-1 h-12"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            К колоде
          </Button>
          <Button
            type="button"
            onClick={startReview}
            className="flex-1 h-12 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ещё повторение
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Active review ----------
  const card = session[currentIdx];
  if (!card) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-100 text-indigo-700 border-0">
            <Layers className="w-3 h-3 mr-1" />
            {BOX_LABELS[card.box]}
          </Badge>
          <span className="text-sm text-slate-600">
            {currentIdx + 1}/{session.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Завершить сессию?')) finishSession(sessionStats);
          }}
        >
          Завершить
        </Button>
      </div>

      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
          style={{ width: `${((currentIdx + (revealed ? 0.5 : 0)) / session.length) * 100}%` }}
        />
      </div>

      <Card className="p-6 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-200 shadow-lg">
        <div className="space-y-4 text-center">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            Вспомните перевод
          </p>
          <div className="flex items-baseline gap-2 justify-center flex-wrap">
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 break-words">
              {card.german_word}
            </h3>
            <PronounceButton text={card.german_word} />
          </div>
          {card.part_of_speech && (
            <Badge variant="secondary" className="text-xs">
              {card.part_of_speech}
              {card.gender ? ` · ${card.gender}` : ''}
            </Badge>
          )}

          {!revealed ? (
            <Button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full h-12 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              Показать перевод
            </Button>
          ) : (
            <div className="space-y-3 text-left">
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="text-slate-500 font-medium w-12 shrink-0">🇷🇺</span>
                    <span className="text-slate-900 font-semibold">{card.russian_translation}</span>
                  </div>
                  {card.kazakh_translation && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 font-medium w-12 shrink-0">🇰🇿</span>
                      <span className="text-slate-800">{card.kazakh_translation}</span>
                    </div>
                  )}
                  {card.plural_form && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 font-medium w-12 shrink-0 text-xs">Форма</span>
                      <span className="text-slate-700 text-sm">{card.plural_form}</span>
                    </div>
                  )}
                  {card.example_sentence && (
                    <p className="text-sm text-slate-600 italic pt-2 border-t border-slate-100">
                      📝 {card.example_sentence}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-700 text-center pt-1">
                Насколько легко вы вспомнили?
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  onClick={() => handleRating('again')}
                  className="bg-rose-500 hover:bg-rose-600 text-white h-12 flex-col gap-0.5 text-xs"
                >
                  <span className="font-semibold">Забыл</span>
                  <span className="text-[10px] opacity-90">10 мин</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => handleRating('hard')}
                  className="bg-amber-500 hover:bg-amber-600 text-white h-12 flex-col gap-0.5 text-xs"
                >
                  <span className="font-semibold">Сложно</span>
                  <span className="text-[10px] opacity-90">
                    {['10 мин', '1 день', '3 дня', '1 нед', '2 нед', '1 мес'][Math.max(0, card.box)]}
                  </span>
                </Button>
                <Button
                  type="button"
                  onClick={() => handleRating('good')}
                  className="bg-blue-500 hover:bg-blue-600 text-white h-12 flex-col gap-0.5 text-xs"
                >
                  <span className="font-semibold">Хорошо</span>
                  <span className="text-[10px] opacity-90">
                    {['1 день', '3 дня', '1 нед', '2 нед', '1 мес', '1 мес'][Math.min(5, card.box + 1)]}
                  </span>
                </Button>
                <Button
                  type="button"
                  onClick={() => handleRating('easy')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 flex-col gap-0.5 text-xs"
                >
                  <span className="font-semibold">Легко</span>
                  <span className="text-[10px] opacity-90">
                    {['3 дня', '1 нед', '2 нед', '1 мес', '1 мес', '1 мес'][Math.min(5, card.box + 2)]}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}