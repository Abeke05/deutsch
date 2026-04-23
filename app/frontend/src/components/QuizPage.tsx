import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
  Eye,
  EyeOff,
  Volume2,
  Shuffle,
  Languages,
  Headphones,
  BookMarked,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import PronounceButton from './PronounceButton';
import {
  generateQuizWords,
  generateScrambleSentences,
  generateConjugationTasks,
  checkAnswer,
  checkRussianAnswer,
  checkScramble,
  shuffleArray,
  QUIZ_SIZES,
  type CEFRLevel,
  type QuizWord,
  type ScrambleSentence,
  type ConjugationTask,
} from '@/lib/quizGenerator';
import { recordActivity, addToSRS } from '@/lib/progressStore';

const client = createClient();

const LEVELS: { value: CEFRLevel; label: string; color: string; description: string }[] = [
  { value: 'A1', label: 'A1', color: 'from-green-400 to-emerald-500', description: 'Начинающий' },
  { value: 'A2', label: 'A2', color: 'from-emerald-400 to-teal-500', description: 'Элементарный' },
  { value: 'B1', label: 'B1', color: 'from-blue-400 to-indigo-500', description: 'Средний' },
  { value: 'B2', label: 'B2', color: 'from-indigo-500 to-violet-500', description: 'Выше среднего' },
  { value: 'C1', label: 'C1', color: 'from-violet-500 to-purple-600', description: 'Продвинутый' },
  { value: 'C2', label: 'C2', color: 'from-purple-600 to-fuchsia-600', description: 'В совершенстве' },
];

type QuizMode = 'ru_de' | 'de_ru' | 'dictation' | 'scramble' | 'conjugation';
type QuizStage = 'setup' | 'playing' | 'finished';

const MODES: Array<{
  value: QuizMode;
  icon: any;
  title: string;
  description: string;
  color: string;
}> = [
  {
    value: 'ru_de',
    icon: Languages,
    title: 'RU → DE',
    description: 'Русское → немецкое слово',
    color: 'from-violet-500 to-fuchsia-500',
  },
  {
    value: 'de_ru',
    icon: BookMarked,
    title: 'DE → RU',
    description: 'Немецкое → русское слово',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    value: 'dictation',
    icon: Headphones,
    title: 'Диктант',
    description: 'AI произносит — вы пишете',
    color: 'from-amber-500 to-orange-500',
  },
  {
    value: 'scramble',
    icon: Shuffle,
    title: 'Порядок слов',
    description: 'Соберите предложение',
    color: 'from-rose-500 to-pink-500',
  },
  {
    value: 'conjugation',
    icon: Brain,
    title: 'Спряжение',
    description: 'Формы глаголов',
    color: 'from-emerald-500 to-teal-500',
  },
];

interface QuizAttempt {
  promptLabel: string;
  targetAnswer: string;
  userAnswer: string;
  correct: boolean;
  extraInfo?: string;
}

interface Question {
  type: QuizMode;
  word?: QuizWord;
  scramble?: ScrambleSentence;
  conjugation?: ConjugationTask;
}

interface Props {
  userId?: string;
}

export default function QuizPage({ userId }: Props) {
  const effectiveUserId = userId || 'anonymous';
  const [stage, setStage] = useState<QuizStage>('setup');
  const [mode, setMode] = useState<QuizMode>('ru_de');
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Answer-related state
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [showPlural, setShowPlural] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string; revealed: string } | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [sessionSeen, setSessionSeen] = useState<string[]>([]);
  const [savedToSRS, setSavedToSRS] = useState<Set<number>>(new Set());

  // Dictation audio state
  const [dictationAudioUrl, setDictationAudioUrl] = useState<string>('');
  const [loadingDictation, setLoadingDictation] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Scramble state — selected token order
  const [shuffledTokens, setShuffledTokens] = useState<Array<{ token: string; origIdx: number }>>([]);
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);

  // Conjugation state — one answer per form
  const [conjAnswers, setConjAnswers] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = questions[currentIdx];

  useEffect(() => {
    if (stage === 'playing' && !feedback && mode !== 'scramble' && mode !== 'conjugation') {
      inputRef.current?.focus();
    }
  }, [currentIdx, stage, feedback, mode]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startQuiz = useCallback(async () => {
    setLoading(true);
    try {
      let newQuestions: Question[] = [];
      if (mode === 'ru_de' || mode === 'de_ru' || mode === 'dictation') {
        toast.info(`AI готовит ${QUIZ_SIZES[level]} слов уровня ${level}...`, { duration: 2000 });
        const words = await generateQuizWords(level, topic.trim() || undefined, sessionSeen);
        newQuestions = words.map((w) => ({ type: mode, word: w }));
        setSessionSeen((prev) => [...prev, ...words.map((w) => w.german_word)]);
      } else if (mode === 'scramble') {
        toast.info(`AI готовит предложения уровня ${level}...`, { duration: 2000 });
        const sentences = await generateScrambleSentences(level, topic.trim() || undefined, 6);
        newQuestions = sentences.map((s) => ({ type: mode, scramble: s }));
      } else if (mode === 'conjugation') {
        toast.info(`AI готовит глаголы уровня ${level}...`, { duration: 2000 });
        const tasks = await generateConjugationTasks(level, 5);
        newQuestions = tasks.map((t) => ({ type: mode, conjugation: t }));
      }

      if (newQuestions.length === 0) {
        throw new Error('Не удалось сгенерировать задания');
      }
      setQuestions(newQuestions);
      setCurrentIdx(0);
      resetQuestionState();
      setAttempts([]);
      setSavedToSRS(new Set());
      setStage('playing');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось начать квиз');
    } finally {
      setLoading(false);
    }
  }, [mode, level, topic, sessionSeen]);

  const resetQuestionState = () => {
    setAnswer('');
    setShowHint(false);
    setShowExample(false);
    setShowPlural(false);
    setFeedback(null);
    setDictationAudioUrl('');
    setShuffledTokens([]);
    setSelectedOrder([]);
    setConjAnswers([]);
  };

  // When a new question loads in scramble mode, shuffle tokens
  useEffect(() => {
    if (stage !== 'playing' || !currentQuestion || feedback) return;
    if (currentQuestion.type === 'scramble' && currentQuestion.scramble) {
      const tokens = currentQuestion.scramble.tokens.map((t, i) => ({ token: t, origIdx: i }));
      setShuffledTokens(shuffleArray(tokens));
      setSelectedOrder([]);
    } else if (currentQuestion.type === 'conjugation' && currentQuestion.conjugation) {
      setConjAnswers(new Array(currentQuestion.conjugation.forms.length).fill(''));
    } else if (currentQuestion.type === 'dictation' && currentQuestion.word) {
      // Auto-generate audio for dictation
      generateDictationAudio(currentQuestion.word.german_word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, stage]);

  const generateDictationAudio = async (text: string) => {
    setLoadingDictation(true);
    try {
      const resp: any = await client.ai.genaudio(
        { text, model: 'eleven_v3', gender: 'female' },
        { timeout: 60_000 },
      );
      const url = resp?.data?.url;
      if (url) {
        setDictationAudioUrl(url);
        // Auto-play once
        setTimeout(() => playDictation(url), 300);
      } else {
        toast.error('Не удалось сгенерировать аудио');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Ошибка генерации аудио');
    } finally {
      setLoadingDictation(false);
    }
  };

  const playDictation = (url?: string) => {
    const u = url || dictationAudioUrl;
    if (!u) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(u);
    audioRef.current = audio;
    audio.play().catch(() => toast.error('Не удалось воспроизвести'));
  };

  const recordToActivity = (type: 'quiz_ru_de' | 'quiz_de_ru' | 'dictation' | 'scramble' | 'conjugation', correct: number, total: number) => {
    try {
      recordActivity(effectiveUserId, type, correct, total);
    } catch {
      // ignore
    }
  };

  // ---------- Submit handlers ----------

  const submitVocabAnswer = (reverse: boolean) => {
    if (!currentQuestion?.word || feedback) return;
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error('Введите ответ или нажмите "Показать ответ"');
      return;
    }
    const word = currentQuestion.word;
    const target = reverse ? word.russian_translation : word.german_word;
    const result = reverse ? checkRussianAnswer(trimmed, target) : checkAnswer(trimmed, target);
    const attempt: QuizAttempt = {
      promptLabel: reverse ? word.german_word : word.russian_translation,
      targetAnswer: target,
      userAnswer: trimmed,
      correct: result.correct,
      extraInfo: reverse ? '' : word.russian_translation,
    };
    setAttempts((prev) => [...prev, attempt]);
    setFeedback({
      correct: result.correct,
      message: result.correct
        ? result.nearMiss
          ? 'Правильно! (была опечатка)'
          : 'Правильно! 🎉'
        : result.nearMiss
          ? 'Почти! Посмотрите правильный ответ.'
          : 'Неверно.',
      revealed: target,
    });
  };

  const submitDictation = () => {
    if (!currentQuestion?.word || feedback) return;
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error('Введите услышанное слово');
      return;
    }
    const word = currentQuestion.word;
    const result = checkAnswer(trimmed, word.german_word);
    setAttempts((prev) => [
      ...prev,
      {
        promptLabel: '🔊 Аудио',
        targetAnswer: word.german_word,
        userAnswer: trimmed,
        correct: result.correct,
        extraInfo: word.russian_translation,
      },
    ]);
    setFeedback({
      correct: result.correct,
      message: result.correct ? (result.nearMiss ? 'Правильно! (опечатка)' : 'Правильно! 🎉') : 'Неверно.',
      revealed: word.german_word,
    });
  };

  const submitScramble = () => {
    if (!currentQuestion?.scramble || feedback) return;
    if (selectedOrder.length !== shuffledTokens.length) {
      toast.error('Соберите всё предложение');
      return;
    }
    const userTokens = selectedOrder.map((idx) => shuffledTokens[idx].token);
    const correct = checkScramble(userTokens, currentQuestion.scramble.german);
    setAttempts((prev) => [
      ...prev,
      {
        promptLabel: currentQuestion.scramble!.translation_ru,
        targetAnswer: currentQuestion.scramble!.german,
        userAnswer: userTokens.join(' '),
        correct,
      },
    ]);
    setFeedback({
      correct,
      message: correct ? 'Верный порядок! 🎉' : 'Неверный порядок.',
      revealed: currentQuestion.scramble.german,
    });
  };

  const submitConjugation = () => {
    if (!currentQuestion?.conjugation || feedback) return;
    const task = currentQuestion.conjugation;
    if (conjAnswers.some((a) => !a.trim())) {
      toast.error('Заполните все формы');
      return;
    }
    let correctCount = 0;
    const perFormResults: string[] = [];
    task.forms.forEach((f, i) => {
      const r = checkAnswer(conjAnswers[i], f.answer);
      if (r.correct) correctCount++;
      perFormResults.push(`${f.label}: ${r.correct ? '✓' : '✗'} (${f.answer})`);
    });
    const allCorrect = correctCount === task.forms.length;
    setAttempts((prev) => [
      ...prev,
      {
        promptLabel: `${task.infinitive} (${task.russian_translation})`,
        targetAnswer: task.forms.map((f) => `${f.label}: ${f.answer}`).join('; '),
        userAnswer: task.forms.map((f, i) => `${f.label}: ${conjAnswers[i]}`).join('; '),
        correct: allCorrect,
        extraInfo: `${correctCount}/${task.forms.length} правильно`,
      },
    ]);
    setFeedback({
      correct: allCorrect,
      message: allCorrect
        ? 'Все формы верны! 🎉'
        : `${correctCount} из ${task.forms.length} правильно.`,
      revealed: perFormResults.join('\n'),
    });
  };

  const revealAnswer = () => {
    if (!currentQuestion || feedback) return;
    let target = '';
    let prompt = '';
    if (currentQuestion.word) {
      target = mode === 'de_ru' ? currentQuestion.word.russian_translation : currentQuestion.word.german_word;
      prompt = mode === 'de_ru' ? currentQuestion.word.german_word : currentQuestion.word.russian_translation;
    } else if (currentQuestion.scramble) {
      target = currentQuestion.scramble.german;
      prompt = currentQuestion.scramble.translation_ru;
    } else if (currentQuestion.conjugation) {
      target = currentQuestion.conjugation.forms.map((f) => `${f.label}: ${f.answer}`).join('; ');
      prompt = `${currentQuestion.conjugation.infinitive} (${currentQuestion.conjugation.russian_translation})`;
    }
    setAttempts((prev) => [
      ...prev,
      { promptLabel: prompt, targetAnswer: target, userAnswer: '(пропущено)', correct: false },
    ]);
    setFeedback({ correct: false, message: 'Ответ показан.', revealed: target });
  };

  const nextQuestion = () => {
    if (currentIdx >= questions.length - 1) {
      // Record final activity
      const correctCount = attempts.filter((a) => a.correct).length;
      const activityType =
        mode === 'ru_de'
          ? 'quiz_ru_de'
          : mode === 'de_ru'
            ? 'quiz_de_ru'
            : mode === 'dictation'
              ? 'dictation'
              : mode === 'scramble'
                ? 'scramble'
                : 'conjugation';
      recordToActivity(activityType as any, correctCount, attempts.length);
      setStage('finished');
      return;
    }
    setCurrentIdx((prev) => prev + 1);
    resetQuestionState();
  };

  const restart = () => {
    setStage('setup');
    setQuestions([]);
    setAttempts([]);
    setCurrentIdx(0);
    resetQuestionState();
  };

  const handleAddToSRS = () => {
    if (!currentQuestion?.word) return;
    const w = currentQuestion.word;
    addToSRS(effectiveUserId, {
      german_word: w.german_word,
      russian_translation: w.russian_translation,
      kazakh_translation: w.kazakh_translation,
      part_of_speech: w.part_of_speech,
      plural_form: w.plural_form,
      gender: w.gender,
      example_sentence: w.example_sentence.replace(/_{2,}/g, w.german_word.replace(/^(der|die|das)\s+/i, '')),
    });
    setSavedToSRS((prev) => new Set(prev).add(currentIdx));
    toast.success(`"${w.german_word}" добавлено в карточки`);
  };

  const correctCount = useMemo(() => attempts.filter((a) => a.correct).length, [attempts]);

  // ---------- Setup stage ----------
  if (stage === 'setup') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Brain className="w-7 h-7 text-violet-600" />
            Квиз и тренировки
          </h2>
          <p className="text-slate-600">
            Выберите режим тренировки, уровень <strong>A1–C2</strong> и тему (опционально).
          </p>
        </div>

        <Card className="p-5 bg-white">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 block">
            Режим
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  disabled={loading}
                  className={`p-3 rounded-xl border-2 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed ${
                    mode === m.value
                      ? `bg-gradient-to-br ${m.color} text-white border-transparent shadow-md`
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-semibold text-sm">{m.title}</span>
                  </div>
                  <p className={`text-xs ${mode === m.value ? 'text-white/90' : 'text-slate-500'}`}>
                    {m.description}
                  </p>
                </button>
              );
            })}
          </div>

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
                className={`p-3 rounded-xl border-2 transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed ${
                  level === lv.value
                    ? `bg-gradient-to-br ${lv.color} text-white border-transparent shadow-md scale-105`
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-lg font-bold">{lv.label}</div>
                <div className={`text-[10px] mt-0.5 ${level === lv.value ? 'text-white/90' : 'text-slate-500'}`}>
                  {lv.description}
                </div>
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
            Тема (необязательно)
          </label>
          <Input
            type="text"
            placeholder="Например: путешествия, еда, работа..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            className="mb-4"
          />

          <Button
            type="button"
            onClick={startQuiz}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white rounded-xl shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Генерируем...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Начать тренировку
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  // ---------- Finished stage ----------
  if (stage === 'finished') {
    const total = attempts.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const verdict =
      pct >= 90 ? 'Превосходно! 🏆' : pct >= 75 ? 'Отлично! 🎉' : pct >= 50 ? 'Хорошо, продолжайте! 💪' : 'Попробуйте ещё раз 📚';

    return (
      <div className="space-y-6">
        <Card className="p-6 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-violet-200 shadow-lg">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto shadow-md">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{verdict}</h2>
            <p className="text-slate-600">
              <strong className="text-violet-700">{correctCount}</strong> из <strong>{total}</strong> ({pct}%)
            </p>
          </div>
        </Card>

        <Card className="p-5 bg-white">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Разбор</h3>
          <div className="space-y-3">
            {attempts.map((a, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  a.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  {a.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-0.5">{a.promptLabel}</div>
                    <div className="font-semibold text-slate-900 break-words">{a.targetAnswer}</div>
                    {!a.correct && (
                      <div className="text-xs text-slate-600 mt-1">
                        Ваш ответ: <span className="italic text-rose-700">{a.userAnswer}</span>
                      </div>
                    )}
                    {a.extraInfo && (
                      <div className="text-xs text-slate-500 mt-1">{a.extraInfo}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={restart} variant="outline" className="flex-1 h-12">
            <RefreshCw className="w-4 h-4 mr-2" />
            Сменить режим
          </Button>
          <Button
            type="button"
            onClick={() => {
              setStage('setup');
              setTimeout(() => startQuiz(), 50);
            }}
            className="flex-1 h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ещё раунд
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Playing stage ----------
  if (!currentQuestion) return null;

  const progress = ((currentIdx + (feedback ? 1 : 0)) / questions.length) * 100;
  const isLast = currentIdx >= questions.length - 1;
  const currentModeConfig = MODES.find((m) => m.value === mode)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`bg-gradient-to-r ${currentModeConfig.color} text-white border-0`}>
            {currentModeConfig.title}
          </Badge>
          <Badge className={`bg-gradient-to-r ${LEVELS.find((l) => l.value === level)?.color} text-white border-0`}>
            {level}
          </Badge>
          <span className="text-sm text-slate-600">
            {currentIdx + 1}/{questions.length}
          </span>
        </div>
        <div className="text-sm text-slate-600">
          ✓ {correctCount}/{attempts.length}
        </div>
      </div>

      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* RU → DE vocab quiz */}
      {mode === 'ru_de' && currentQuestion.word && (
        <VocabQuestion
          word={currentQuestion.word}
          answer={answer}
          setAnswer={setAnswer}
          showHint={showHint}
          setShowHint={setShowHint}
          showExample={showExample}
          setShowExample={setShowExample}
          showPlural={showPlural}
          setShowPlural={setShowPlural}
          feedback={feedback}
          onSubmit={() => submitVocabAnswer(false)}
          onReveal={revealAnswer}
          onNext={nextQuestion}
          isLast={isLast}
          inputRef={inputRef}
          reverse={false}
          onAddToSRS={handleAddToSRS}
          savedToSRS={savedToSRS.has(currentIdx)}
        />
      )}

      {/* DE → RU reverse quiz */}
      {mode === 'de_ru' && currentQuestion.word && (
        <VocabQuestion
          word={currentQuestion.word}
          answer={answer}
          setAnswer={setAnswer}
          showHint={showHint}
          setShowHint={setShowHint}
          showExample={showExample}
          setShowExample={setShowExample}
          showPlural={showPlural}
          setShowPlural={setShowPlural}
          feedback={feedback}
          onSubmit={() => submitVocabAnswer(true)}
          onReveal={revealAnswer}
          onNext={nextQuestion}
          isLast={isLast}
          inputRef={inputRef}
          reverse={true}
          onAddToSRS={handleAddToSRS}
          savedToSRS={savedToSRS.has(currentIdx)}
        />
      )}

      {/* Dictation */}
      {mode === 'dictation' && currentQuestion.word && (
        <Card className="p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-200 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
                Послушайте и напишите слово по-немецки
              </p>
              <div className="flex items-center justify-center py-4">
                <Button
                  type="button"
                  onClick={() => playDictation()}
                  disabled={loadingDictation || !dictationAudioUrl}
                  className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                >
                  {loadingDictation ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Volume2 className="w-8 h-8" />
                  )}
                </Button>
              </div>
              <p className="text-center text-xs text-slate-500">
                Нажмите, чтобы послушать ещё раз
              </p>
            </div>

            {!feedback ? (
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Запишите услышанное..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitDictation();
                    }
                  }}
                  className="h-12 text-lg"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={submitDictation}
                    className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Проверить
                  </Button>
                  <Button type="button" variant="outline" onClick={revealAnswer} className="h-11">
                    <EyeOff className="w-4 h-4 mr-2" />
                    Показать
                  </Button>
                </div>
              </div>
            ) : (
              <FeedbackBlock
                feedback={feedback}
                extra={
                  currentQuestion.word && (
                    <div className="text-sm text-slate-700 mt-2">
                      🇷🇺 {currentQuestion.word.russian_translation} · 🇰🇿{' '}
                      {currentQuestion.word.kazakh_translation}
                    </div>
                  )
                }
                isLast={isLast}
                onNext={nextQuestion}
              />
            )}
          </div>
        </Card>
      )}

      {/* Scramble */}
      {mode === 'scramble' && currentQuestion.scramble && (
        <Card className="p-6 bg-gradient-to-br from-rose-50 via-white to-pink-50 border-rose-200 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                Составьте немецкое предложение
              </p>
              <p className="text-lg text-slate-900 font-medium">
                «{currentQuestion.scramble.translation_ru}»
              </p>
            </div>

            {/* Selected tokens */}
            <div className="min-h-[60px] p-3 bg-white rounded-lg border-2 border-dashed border-rose-200 flex flex-wrap gap-2 items-start">
              {selectedOrder.length === 0 && (
                <span className="text-slate-400 text-sm">Кликайте на слова внизу →</span>
              )}
              {selectedOrder.map((tokenIdx, i) => (
                <button
                  key={`sel-${i}`}
                  type="button"
                  onClick={() => {
                    if (feedback) return;
                    setSelectedOrder((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  disabled={!!feedback}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-sm font-medium border border-rose-300 disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {shuffledTokens[tokenIdx].token}
                </button>
              ))}
            </div>

            {/* Available tokens */}
            <div className="flex flex-wrap gap-2">
              {shuffledTokens.map((t, idx) => {
                const used = selectedOrder.includes(idx);
                return (
                  <button
                    key={`av-${idx}`}
                    type="button"
                    onClick={() => {
                      if (feedback || used) return;
                      setSelectedOrder((prev) => [...prev, idx]);
                    }}
                    disabled={used || !!feedback}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      used
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-rose-400 hover:bg-rose-50'
                    }`}
                  >
                    {t.token}
                  </button>
                );
              })}
            </div>

            {!feedback ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => setSelectedOrder([])}
                  variant="outline"
                  className="sm:w-auto"
                  disabled={selectedOrder.length === 0}
                >
                  Очистить
                </Button>
                <Button
                  type="button"
                  onClick={submitScramble}
                  className="flex-1 h-11 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Проверить
                </Button>
                <Button type="button" variant="outline" onClick={revealAnswer} className="h-11">
                  <EyeOff className="w-4 h-4 mr-2" />
                  Показать
                </Button>
              </div>
            ) : (
              <FeedbackBlock
                feedback={feedback}
                extra={
                  <div className="flex items-center gap-2 mt-2">
                    <PronounceButton text={currentQuestion.scramble!.german} className="h-7 w-7" />
                    <span className="text-sm text-slate-600 italic">
                      {currentQuestion.scramble!.translation_ru}
                    </span>
                  </div>
                }
                isLast={isLast}
                onNext={nextQuestion}
              />
            )}
          </div>
        </Card>
      )}

      {/* Conjugation */}
      {mode === 'conjugation' && currentQuestion.conjugation && (
        <Card className="p-6 bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-200 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                Проспрягайте глагол
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-2xl font-bold text-slate-900">{currentQuestion.conjugation.infinitive}</h3>
                <PronounceButton text={currentQuestion.conjugation.infinitive} />
                <span className="text-slate-600">—</span>
                <span className="text-slate-700">{currentQuestion.conjugation.russian_translation}</span>
              </div>
            </div>

            <div className="space-y-2">
              {currentQuestion.conjugation.forms.map((f, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded min-w-[140px]">
                    {f.label}
                  </span>
                  <Input
                    type="text"
                    value={conjAnswers[i] || ''}
                    onChange={(e) => {
                      if (feedback) return;
                      setConjAnswers((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === currentQuestion.conjugation!.forms.length - 1) {
                        e.preventDefault();
                        submitConjugation();
                      }
                    }}
                    disabled={!!feedback}
                    placeholder="Введите форму"
                    className={`flex-1 min-w-[120px] ${
                      feedback
                        ? checkAnswer(conjAnswers[i] || '', f.answer).correct
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-rose-400 bg-rose-50'
                        : ''
                    }`}
                  />
                  {feedback && (
                    <span
                      className={`text-sm font-medium ${
                        checkAnswer(conjAnswers[i] || '', f.answer).correct
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      → {f.answer}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {!feedback ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  type="button"
                  onClick={submitConjugation}
                  className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Проверить
                </Button>
                <Button type="button" variant="outline" onClick={revealAnswer} className="h-11">
                  <EyeOff className="w-4 h-4 mr-2" />
                  Показать все
                </Button>
              </div>
            ) : (
              <FeedbackBlock feedback={feedback} isLast={isLast} onNext={nextQuestion} />
            )}
          </div>
        </Card>
      )}

      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Завершить досрочно? Прогресс будет сохранён.')) {
              const correctC = attempts.filter((a) => a.correct).length;
              const activityType =
                mode === 'ru_de'
                  ? 'quiz_ru_de'
                  : mode === 'de_ru'
                    ? 'quiz_de_ru'
                    : mode === 'dictation'
                      ? 'dictation'
                      : mode === 'scramble'
                        ? 'scramble'
                        : 'conjugation';
              recordToActivity(activityType as any, correctC, attempts.length);
              setStage('finished');
            }
          }}
          className="text-slate-500"
        >
          Завершить досрочно
        </Button>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

interface VocabQuestionProps {
  word: QuizWord;
  answer: string;
  setAnswer: (v: string) => void;
  showHint: boolean;
  setShowHint: (fn: (v: boolean) => boolean) => void;
  showExample: boolean;
  setShowExample: (fn: (v: boolean) => boolean) => void;
  showPlural: boolean;
  setShowPlural: (fn: (v: boolean) => boolean) => void;
  feedback: { correct: boolean; message: string; revealed: string } | null;
  onSubmit: () => void;
  onReveal: () => void;
  onNext: () => void;
  isLast: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  reverse: boolean;
  onAddToSRS: () => void;
  savedToSRS: boolean;
}

function VocabQuestion({
  word,
  answer,
  setAnswer,
  showHint,
  setShowHint,
  showExample,
  setShowExample,
  showPlural,
  setShowPlural,
  feedback,
  onSubmit,
  onReveal,
  onNext,
  isLast,
  inputRef,
  reverse,
  onAddToSRS,
  savedToSRS,
}: VocabQuestionProps) {
  return (
    <Card
      className={`p-6 ${
        reverse
          ? 'bg-gradient-to-br from-blue-50 via-white to-cyan-50 border-blue-200'
          : 'bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-violet-200'
      } shadow-lg`}
    >
      <div className="space-y-4">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
              reverse ? 'text-blue-700' : 'text-violet-700'
            }`}
          >
            {reverse ? 'Переведите на русский' : 'Как будет по-немецки?'}
          </p>
          {reverse ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">{word.german_word}</h3>
              <PronounceButton text={word.german_word} />
              {word.category && (
                <Badge variant="outline" className="bg-white/70 border-slate-300 text-slate-700 text-xs">
                  📂 {word.category}
                </Badge>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                  {word.russian_translation}
                </h3>
                {word.category && (
                  <Badge variant="outline" className="bg-white/70 border-slate-300 text-slate-700 text-xs">
                    📂 {word.category}
                  </Badge>
                )}
              </div>
              <p className="text-slate-600 mt-1">🇰🇿 {word.kazakh_translation}</p>
            </>
          )}
          {word.part_of_speech && (
            <Badge variant="secondary" className="mt-2 text-xs">
              {word.part_of_speech}
              {word.gender ? ` · ${word.gender}` : ''}
            </Badge>
          )}
        </div>

        {!feedback && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowHint((v) => !v)}
              className="bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              <Lightbulb className="w-4 h-4 mr-1.5" />
              {showHint ? 'Скрыть подсказку' : 'Подсказка'}
            </Button>
            {word.example_sentence && !reverse && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowExample((v) => !v)}
                className="bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                {showExample ? 'Скрыть пример' : 'Пример'}
              </Button>
            )}
          </div>
        )}

        {showHint && word.hint && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Подсказка
            </p>
            <p className="text-amber-900 text-sm">{word.hint}</p>
          </div>
        )}

        {showExample && word.example_sentence && !reverse && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
              Пример с пропуском
            </p>
            <p className="text-blue-900 text-sm italic">{word.example_sentence}</p>
          </div>
        )}

        {!feedback ? (
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder={reverse ? 'Введите русский перевод...' : 'Введите немецкое слово...'}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              className="h-12 text-lg"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500">
              💡 {reverse
                ? 'Принимается любое из значений, разделённых запятой.'
                : 'Артикль можно не писать. Маленькие опечатки допустимы.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                onClick={onSubmit}
                className={`flex-1 h-11 text-white ${
                  reverse
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Проверить
              </Button>
              <Button type="button" variant="outline" onClick={onReveal} className="h-11">
                <EyeOff className="w-4 h-4 mr-2" />
                Показать ответ
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-lg p-4 border-2 ${
              feedback.correct ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
            }`}
          >
            <div className="flex items-start gap-2 mb-3">
              {feedback.correct ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${feedback.correct ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {feedback.message}
                </p>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs text-slate-600">Правильный ответ:</span>
                  <span className="text-xl font-bold text-slate-900">{feedback.revealed}</span>
                  {!reverse && <PronounceButton text={word.german_word} />}
                </div>
                {reverse && (
                  <p className="text-sm text-slate-600 mt-1">🇰🇿 {word.kazakh_translation}</p>
                )}
                {word.plural_form && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPlural((v) => !v)}
                      className="text-xs"
                    >
                      {showPlural ? 'Скрыть формы' : 'Показать формы'}
                    </Button>
                    {showPlural && (
                      <div className="mt-2 bg-white/60 rounded-md p-2 border border-slate-200">
                        <span className="text-sm text-slate-700">{word.plural_form}</span>
                      </div>
                    )}
                  </div>
                )}
                {word.example_sentence && (
                  <p className="mt-3 text-sm text-slate-700 italic">
                    📝 {word.example_sentence.replace(/_{2,}/g, word.german_word.replace(/^(der|die|das)\s+/i, ''))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onAddToSRS}
                disabled={savedToSRS}
                className="sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {savedToSRS ? 'В карточках ✓' : 'В карточки'}
              </Button>
              <Button
                type="button"
                onClick={onNext}
                className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white"
              >
                {isLast ? (
                  <>
                    <Trophy className="w-4 h-4 mr-2" />
                    Показать результаты
                  </>
                ) : (
                  <>
                    Следующий
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function FeedbackBlock({
  feedback,
  extra,
  isLast,
  onNext,
}: {
  feedback: { correct: boolean; message: string; revealed: string };
  extra?: React.ReactNode;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <div
      className={`rounded-lg p-4 border-2 ${
        feedback.correct ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
      }`}
    >
      <div className="flex items-start gap-2 mb-3">
        {feedback.correct ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${feedback.correct ? 'text-emerald-800' : 'text-rose-800'}`}>
            {feedback.message}
          </p>
          {feedback.revealed && (
            <div className="mt-2">
              <span className="text-xs text-slate-600 block">Правильный ответ:</span>
              <span className="text-lg font-bold text-slate-900 whitespace-pre-line">
                {feedback.revealed}
              </span>
            </div>
          )}
          {extra}
        </div>
      </div>
      <Button
        type="button"
        onClick={onNext}
        className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white"
      >
        {isLast ? (
          <>
            <Trophy className="w-4 h-4 mr-2" />
            Результаты
          </>
        ) : (
          <>
            Следующий
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}