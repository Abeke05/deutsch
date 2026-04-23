import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Mic, MicOff, Play, RefreshCw, Sparkles, Volume2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import PronounceButton from './PronounceButton';
import {
  generateSpeakingPhrase,
  scorePronunciation,
  transcribeAudio,
  blobToDataUri,
  type CEFRLevel,
  type SpeakingPhrase,
  type PronunciationFeedback,
} from '@/lib/speakingPractice';

const LEVELS: { value: CEFRLevel; label: string; color: string; description: string }[] = [
  { value: 'A1', label: 'A1', color: 'from-green-400 to-emerald-500', description: 'Начинающий' },
  { value: 'A2', label: 'A2', color: 'from-emerald-400 to-teal-500', description: 'Элементарный' },
  { value: 'B1', label: 'B1', color: 'from-blue-400 to-indigo-500', description: 'Средний' },
  { value: 'B2', label: 'B2', color: 'from-indigo-500 to-violet-500', description: 'Выше среднего' },
  { value: 'C1', label: 'C1', color: 'from-violet-500 to-purple-600', description: 'Продвинутый' },
  { value: 'C2', label: 'C2', color: 'from-purple-600 to-fuchsia-600', description: 'В совершенстве' },
];

const MIN_RECORDING_MS = 800;

export default function SpeakingPracticePage() {
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [topic, setTopic] = useState('');
  const [phrase, setPhrase] = useState<SpeakingPhrase | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [attemptHistory, setAttemptHistory] = useState<number[]>([]);
  const [recentPhrases, setRecentPhrases] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordedUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, []);

  const handleGeneratePhrase = useCallback(async (targetLevel: CEFRLevel, targetTopic?: string) => {
    setLoadingPhrase(true);
    setFeedback(null);
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedUrl(null);
    try {
      toast.info('AI готовит новую фразу...', { duration: 1500 });
      const p = await generateSpeakingPhrase(targetLevel, targetTopic, recentPhrases);
      setPhrase(p);
      setAttemptHistory([]);
      setRecentPhrases((prev) => [...prev.slice(-15), p.german]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось сгенерировать фразу');
    } finally {
      setLoadingPhrase(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate first phrase on mount
  useEffect(() => {
    if (!phrase && !loadingPhrase) {
      handleGeneratePhrase('A1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLevelChange = (newLevel: CEFRLevel) => {
    setLevel(newLevel);
    handleGeneratePhrase(newLevel, topic.trim() || undefined);
  };

  const handleNewPhrase = () => {
    handleGeneratePhrase(level, topic.trim() || undefined);
  };

  const startRecording = async () => {
    if (!phrase) return;
    try {
      setFeedback(null);
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
        setRecordedUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      // Pick a supported mime type
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      let mimeType = '';
      for (const c of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) {
          mimeType = c;
          break;
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const duration = Date.now() - recordingStartRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

        // Stop tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        if (duration < MIN_RECORDING_MS || blob.size < 500) {
          toast.error('Слишком короткая запись. Попробуйте ещё раз.');
          return;
        }

        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedUrl(url);
        await processRecording(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processRecording = async (blob: Blob) => {
    if (!phrase) return;
    setProcessing(true);
    try {
      toast.info('Анализирую произношение...', { duration: 2000 });
      const dataUri = await blobToDataUri(blob);
      const heard = await transcribeAudio(dataUri);
      const result = await scorePronunciation(phrase.german, heard, phrase.level);
      setFeedback(result);
      setAttemptHistory((prev) => [...prev, result.score]);

      if (result.score >= 85) {
        toast.success(`Отличный результат: ${result.score} / 100`);
      } else if (result.score >= 60) {
        toast.success(`Результат: ${result.score} / 100`);
      } else {
        toast.info(`Результат: ${result.score} / 100 — попробуйте ещё раз`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось проанализировать запись');
    } finally {
      setProcessing(false);
    }
  };

  const bestScore = attemptHistory.length > 0 ? Math.max(...attemptHistory) : null;

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  const scoreBg = (score: number) => {
    if (score >= 85) return 'from-emerald-500 to-green-500';
    if (score >= 70) return 'from-blue-500 to-indigo-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-red-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Mic className="w-7 h-7 text-rose-600" />
          Практика произношения
        </h2>
        <p className="text-slate-600">
          Выберите уровень от <strong>A1 до C2</strong>, послушайте правильное произношение, запишите свой голос — и AI оценит вашу речь и подскажет, что улучшить.
        </p>
      </div>

      {/* Level selector */}
      <Card className="p-5 bg-white">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
              Уровень (CEFR)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {LEVELS.map((lv) => (
                <button
                  key={lv.value}
                  type="button"
                  onClick={() => handleLevelChange(lv.value)}
                  disabled={loadingPhrase || isRecording || processing}
                  className={`relative p-3 rounded-xl border-2 transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed ${
                    level === lv.value
                      ? `bg-gradient-to-br ${lv.color} text-white border-transparent shadow-md scale-105`
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:shadow-sm'
                  }`}
                >
                  <div className="text-lg font-bold">{lv.label}</div>
                  <div className={`text-[10px] mt-0.5 ${level === lv.value ? 'text-white/90' : 'text-slate-500'}`}>
                    {lv.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
              Тема (необязательно)
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Например: путешествия, еда, работа..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loadingPhrase || isRecording || processing}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleNewPhrase}
                disabled={loadingPhrase || isRecording || processing}
                variant="outline"
                className="shrink-0"
              >
                {loadingPhrase ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Загрузка
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Новая фраза
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Practice card */}
      {loadingPhrase && !phrase ? (
        <Card className="p-12 text-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500">AI готовит тренировочную фразу...</p>
        </Card>
      ) : phrase ? (
        <Card className="p-6 bg-gradient-to-br from-rose-50 via-white to-amber-50 border-rose-200 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge className={`bg-gradient-to-r ${LEVELS.find((l) => l.value === phrase.level)?.color} text-white border-0`}>
              {phrase.level} · {LEVELS.find((l) => l.value === phrase.level)?.description}
            </Badge>
            {bestScore !== null && (
              <Badge variant="outline" className="bg-white/70 border-slate-300 text-slate-700">
                🏆 Лучший: {bestScore}/100
              </Badge>
            )}
          </div>

          {/* Target phrase */}
          <div className="flex items-start gap-3 flex-wrap mb-4">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug flex-1 min-w-0">
              {phrase.german}
            </h3>
            <PronounceButton
              text={phrase.german}
              className="h-11 w-11 bg-white/80 hover:bg-white shadow-sm shrink-0"
            />
          </div>

          {/* Translations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-white/70 rounded-lg p-3 border border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">🇷🇺 Русский</p>
              <p className="text-slate-800 text-sm">{phrase.translation_ru}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">🇰🇿 Қазақша</p>
              <p className="text-slate-800 text-sm">{phrase.translation_kz}</p>
            </div>
          </div>

          {/* Tips */}
          {phrase.pronunciation_tips && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Советы по произношению
              </p>
              <p className="text-sm text-amber-900">{phrase.pronunciation_tips}</p>
            </div>
          )}

          {/* Action: listen + record */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm px-4 h-14">
              <Volume2 className="w-5 h-5 text-slate-600 shrink-0" />
              <span className="text-sm font-medium text-slate-700 flex-1">Послушать эталон</span>
              <PronounceButton
                text={phrase.german}
                className="!h-10 !w-10 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700"
              />
            </div>
            <div className="flex-1">
              {isRecording ? (
                <Button
                  type="button"
                  onClick={stopRecording}
                  className="h-14 w-full bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-xl shadow-md animate-pulse"
                >
                  <MicOff className="w-5 h-5 mr-2" />
                  Остановить запись
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={startRecording}
                  disabled={processing || loadingPhrase}
                  className="h-14 w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl shadow-md disabled:opacity-60"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Анализирую...
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      Записать свой голос
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {isRecording && (
            <p className="text-center text-xs text-rose-600 mt-3 animate-pulse">
              🔴 Говорите чётко в микрофон... Нажмите «Остановить», когда закончите.
            </p>
          )}

          {recordedUrl && !isRecording && (
            <div className="mt-4 pt-4 border-t border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Play className="w-3 h-3" />
                Ваша запись
              </p>
              <audio controls src={recordedUrl} className="w-full h-10" />
            </div>
          )}
        </Card>
      ) : null}

      {/* Feedback */}
      {feedback && phrase && (
        <Card className="p-6 bg-white shadow-md">
          <div className="flex items-start gap-4 flex-wrap mb-4">
            <div
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${scoreBg(feedback.score)} flex flex-col items-center justify-center text-white shadow-md shrink-0`}
            >
              <div className="text-3xl font-bold leading-none">{feedback.score}</div>
              <div className="text-xs opacity-90 mt-1">/ 100</div>
            </div>

            <div className="flex-1 min-w-0">
              <div className={`text-xl font-bold mb-1 ${scoreColor(feedback.score)}`}>{feedback.verdict}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span>Совпадение с эталоном:</span>
                <span className="font-semibold text-slate-700">{feedback.similarity_percent}%</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-500">Эталон: </span>
                    <span className="text-slate-800 italic">{feedback.target_text}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {feedback.score >= 70 ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-500">Услышано: </span>
                    <span className="text-slate-800 italic">{feedback.heard_text}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {feedback.problem_words.length > 0 && (
            <div className="mb-4 pt-4 border-t border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Поработайте над этими словами:
              </p>
              <div className="flex flex-wrap gap-2">
                {feedback.problem_words.map((w, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-1.5 text-sm font-medium"
                  >
                    <span>{w}</span>
                    <PronounceButton
                      text={w}
                      className="h-6 w-6 !bg-transparent hover:!bg-rose-100 text-rose-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {feedback.feedback_ru && (
            <div className="mb-3 pt-3 border-t border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">🇷🇺 Разбор</p>
              <p className="text-slate-800 text-sm leading-relaxed">{feedback.feedback_ru}</p>
            </div>
          )}

          {feedback.feedback_kz && (
            <div className="mb-3 pt-3 border-t border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">🇰🇿 Талдау</p>
              <p className="text-slate-800 text-sm leading-relaxed">{feedback.feedback_kz}</p>
            </div>
          )}

          {feedback.tips && (
            <div className="pt-3 border-t border-slate-200/70 bg-amber-50/70 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Совет
              </p>
              <p className="text-sm text-amber-900">{feedback.tips}</p>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              onClick={() => setFeedback(null)}
              variant="outline"
              className="flex-1"
              disabled={isRecording || processing}
            >
              <Mic className="w-4 h-4 mr-2" />
              Попробовать ещё раз
            </Button>
            <Button
              type="button"
              onClick={handleNewPhrase}
              disabled={loadingPhrase || isRecording || processing}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Следующая фраза
            </Button>
          </div>
        </Card>
      )}

      {attemptHistory.length > 1 && (
        <Card className="p-4 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            История попыток этой фразы
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {attemptHistory.map((s, idx) => (
              <div
                key={idx}
                className={`text-xs font-semibold px-2 py-1 rounded-md ${
                  s >= 85
                    ? 'bg-emerald-100 text-emerald-700'
                    : s >= 70
                      ? 'bg-blue-100 text-blue-700'
                      : s >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                }`}
              >
                #{idx + 1}: {s}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}