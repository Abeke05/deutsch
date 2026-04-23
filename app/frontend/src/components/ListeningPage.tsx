import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Headphones,
  Loader2,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  Lightbulb,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import { generateListeningPassage, checkRussianAnswer, type CEFRLevel, type ListeningPassage } from '@/lib/quizGenerator';
import { recordActivity } from '@/lib/progressStore';

const client = createClient();

const LEVELS: { value: CEFRLevel; label: string; color: string }[] = [
  { value: 'A1', label: 'A1', color: 'from-green-400 to-emerald-500' },
  { value: 'A2', label: 'A2', color: 'from-emerald-400 to-teal-500' },
  { value: 'B1', label: 'B1', color: 'from-blue-400 to-indigo-500' },
  { value: 'B2', label: 'B2', color: 'from-indigo-500 to-violet-500' },
  { value: 'C1', label: 'C1', color: 'from-violet-500 to-purple-600' },
  { value: 'C2', label: 'C2', color: 'from-purple-600 to-fuchsia-600' },
];

interface Props {
  userId?: string;
}

export default function ListeningPage({ userId }: Props) {
  const effectiveUserId = userId || 'anonymous';
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [topic, setTopic] = useState('');
  const [passage, setPassage] = useState<ListeningPassage | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [hintsVisible, setHintsVisible] = useState<boolean[]>([]);
  const [results, setResults] = useState<boolean[] | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const generateAudio = async (text: string) => {
    setAudioLoading(true);
    try {
      const resp: any = await client.ai.genaudio(
        { text, model: 'eleven_v3', gender: 'female' },
        { timeout: 90_000 },
      );
      const url = resp?.data?.url;
      if (url) setAudioUrl(url);
      else toast.error('Не удалось сгенерировать аудио');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Ошибка генерации аудио');
    } finally {
      setAudioLoading(false);
    }
  };

  const startNew = useCallback(async () => {
    setLoading(true);
    setPassage(null);
    setAudioUrl('');
    setAnswers([]);
    setHintsVisible([]);
    setResults(null);
    setShowTranscript(false);
    try {
      toast.info('AI готовит текст для аудирования...', { duration: 2000 });
      const p = await generateListeningPassage(level, topic.trim() || undefined);
      if (!p.questions.length) throw new Error('Нет вопросов');
      setPassage(p);
      setAnswers(new Array(p.questions.length).fill(''));
      setHintsVisible(new Array(p.questions.length).fill(false));
      await generateAudio(p.german_text);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось сгенерировать задание');
    } finally {
      setLoading(false);
    }
  }, [level, topic]);

  const togglePlay = () => {
    if (!audioUrl) return;
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
    }
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => toast.error('Не удалось воспроизвести'));
  };

  const submitAll = () => {
    if (!passage) return;
    if (answers.some((a) => !a.trim())) {
      toast.error('Ответьте на все вопросы');
      return;
    }
    const res = passage.questions.map((q, i) => checkRussianAnswer(answers[i], q.answer_ru).correct);
    setResults(res);
    const correct = res.filter(Boolean).length;
    recordActivity(effectiveUserId, 'listening', correct, passage.questions.length);
    if (correct === passage.questions.length) {
      toast.success('Все ответы верны! 🎉');
    } else {
      toast.info(`Правильных ответов: ${correct} из ${passage.questions.length}`);
    }
  };

  // ---------- Setup / no passage yet ----------
  if (!passage) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Headphones className="w-7 h-7 text-amber-600" />
            Аудирование
          </h2>
          <p className="text-slate-600">
            AI озвучит текст на выбранном уровне, а вы ответите на вопросы.
          </p>
        </div>

        <Card className="p-5 bg-white">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
            Уровень (CEFR)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {LEVELS.map((lv) => (
              <button
                key={lv.value}
                type="button"
                onClick={() => setLevel(lv.value)}
                disabled={loading}
                className={`p-3 rounded-xl border-2 transition-all text-center disabled:opacity-60 ${
                  level === lv.value
                    ? `bg-gradient-to-br ${lv.color} text-white border-transparent shadow-md`
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-lg font-bold">{lv.label}</div>
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
            Тема (необязательно)
          </label>
          <Input
            type="text"
            placeholder="Например: поход в магазин, отпуск..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            className="mb-4"
          />

          <Button
            type="button"
            onClick={startNew}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Генерируем...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Начать аудирование
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  // ---------- Exercise view ----------
  const correctCount = results ? results.filter(Boolean).length : 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge className={`bg-gradient-to-r ${LEVELS.find((l) => l.value === level)?.color} text-white border-0`}>
            {level}
          </Badge>
          <Badge className="bg-amber-100 text-amber-800 border-0">
            <Headphones className="w-3 h-3 mr-1" />
            Аудирование
          </Badge>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={startNew}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Новый текст
        </Button>
      </div>

      {/* Audio player */}
      <Card className="p-5 bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-200 shadow-lg">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Послушайте текст
          </p>
          <div className="flex items-center justify-center py-4">
            <Button
              type="button"
              onClick={togglePlay}
              disabled={audioLoading || !audioUrl}
              className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
            >
              {audioLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : playing ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-500">
            Слушайте столько раз, сколько нужно. Аудио генерируется один раз.
          </p>
        </div>
      </Card>

      {/* Questions */}
      <Card className="p-5 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Вопросы</h3>
        <div className="space-y-4">
          {passage.questions.map((q, i) => {
            const isCorrect = results ? results[i] : null;
            return (
              <div
                key={i}
                className={`p-3 rounded-lg border-2 ${
                  isCorrect === true
                    ? 'bg-emerald-50 border-emerald-300'
                    : isCorrect === false
                      ? 'bg-rose-50 border-rose-300'
                      : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-medium mb-2">{q.question_ru}</p>
                    <Input
                      type="text"
                      placeholder="Ваш ответ по-русски..."
                      value={answers[i]}
                      onChange={(e) => {
                        if (results) return;
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        });
                      }}
                      disabled={!!results}
                      className="mb-2"
                    />
                    {!results && q.hint_ru && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setHintsVisible((prev) => {
                            const next = [...prev];
                            next[i] = !next[i];
                            return next;
                          });
                        }}
                        className="text-amber-700 hover:bg-amber-100 h-7 px-2 text-xs"
                      >
                        <Lightbulb className="w-3 h-3 mr-1" />
                        {hintsVisible[i] ? 'Скрыть подсказку' : 'Подсказка'}
                      </Button>
                    )}
                    {hintsVisible[i] && q.hint_ru && (
                      <div className="mt-1 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900">
                        💡 {q.hint_ru}
                      </div>
                    )}
                    {results && (
                      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="text-xs text-slate-600">Правильный ответ:</span>
                        <span className="text-sm font-semibold text-slate-900">{q.answer_ru}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!results ? (
          <Button
            type="button"
            onClick={submitAll}
            className="w-full h-11 mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Проверить ответы
          </Button>
        ) : (
          <div className="mt-4 space-y-2">
            <Card className="p-3 bg-slate-50 border-slate-200 text-center">
              <Trophy className="w-5 h-5 text-amber-600 inline-block mr-1" />
              <span className="font-semibold text-slate-900">
                {correctCount} из {passage.questions.length} правильно
              </span>
            </Card>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTranscript((v) => !v)}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                {showTranscript ? 'Скрыть текст' : 'Показать текст'}
              </Button>
              <Button
                type="button"
                onClick={startNew}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Новый текст
              </Button>
            </div>
          </div>
        )}
      </Card>

      {showTranscript && (
        <Card className="p-5 bg-white">
          <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Немецкий текст
          </h4>
          <p className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap">{passage.german_text}</p>
          <div className="h-px bg-slate-200 my-3" />
          <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Перевод
          </h4>
          <p className="text-slate-700 text-sm italic leading-relaxed whitespace-pre-wrap">
            {passage.translation_ru}
          </p>
        </Card>
      )}
    </div>
  );
}