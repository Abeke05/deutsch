import { createClient } from '@metagptx/web-sdk';

const client = createClient();

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface SpeakingPhrase {
  german: string;
  translation_ru: string;
  translation_kz: string;
  pronunciation_tips: string;
  level: CEFRLevel;
}

export interface PronunciationFeedback {
  score: number; // 0-100
  heard_text: string; // what AI transcribed
  target_text: string;
  similarity_percent: number;
  verdict: string; // short verdict e.g. "Отлично!", "Хорошо", "Нужно потренироваться"
  feedback_ru: string; // detailed feedback in Russian
  feedback_kz: string; // detailed feedback in Kazakh
  problem_words: string[]; // list of German words that were off
  tips: string;
}

// ---------- Generate a practice phrase ----------

const TOPIC_POOL = [
  'путешествия', 'еда и рестораны', 'работа и карьера', 'дом и быт',
  'хобби и свободное время', 'спорт', 'погода и природа', 'покупки',
  'семья и друзья', 'транспорт', 'здоровье', 'технологии',
  'кино и музыка', 'эмоции и чувства', 'учёба', 'выходные и праздники',
  'мечты и планы', 'книги и чтение', 'животные', 'город и места',
];

function randomTopic(): string {
  return TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
}

export async function generateSpeakingPhrase(
  level: CEFRLevel,
  topic?: string,
  recentPhrases: string[] = [],
): Promise<SpeakingPhrase> {
  const effectiveTopic = topic && topic.trim() ? topic : randomTopic();
  const excludeNote = recentPhrases.length > 0
    ? `\n\nWICHTIG: Diese Phrasen wurden kürzlich gegeben — erzeuge etwas DEUTLICH ANDERES (anderer Wortschatz, andere Struktur, andere Länge): ${recentPhrases.slice(-8).map((p) => `"${p}"`).join(', ')}.`
    : '';
  const levelGuide: Record<CEFRLevel, string> = {
    A1: 'Очень простые фразы: приветствия, представление себя, числа, простые существительные. 3-6 слов. Только Präsens. Используй слова из базового словаря.',
    A2: 'Короткие повседневные фразы о семье, работе, покупках, еде. 5-9 слов. Präsens и простой Perfekt. Базовая лексика.',
    B1: 'Фразы средней сложности: рассказ о событиях, мнения, планы, описания. 8-14 слов. Präsens, Perfekt, Präteritum. Могут быть модальные глаголы и простые придаточные.',
    B2: 'Развёрнутые фразы с подчинёнными предложениями, условиями, причинами. 12-18 слов. Разные времена, пассив, Konjunktiv II в простых случаях. Абстрактные темы.',
    C1: 'Сложные фразы с продвинутой грамматикой: Konjunktiv I/II, Passiv, сложные придаточные, идиомы. 15-22 слова. Академическая или профессиональная лексика.',
    C2: 'Очень сложные, богатые фразы с редкими идиомами, сложным синтаксисом, литературной лексикой. 18-28 слов. Нюансированные конструкции уровня носителя.',
  };

  const systemPrompt = `Du bist ein professioneller Deutschlehrer. Deine Aufgabe: EINE deutsche Übungsphrase für den Sprecher zu generieren, auf einem bestimmten CEFR-Niveau. Gib GENAU ein JSON-Objekt zurück — ohne Markdown, ohne Kommentare.

Ziel-Niveau: ${level}
Niveau-Leitfaden: ${levelGuide[level]}
Thema (bevorzugt, aber flexibel): ${effectiveTopic}${excludeNote}

ANFORDERUNGEN:
1. "german": eine einzelne deutsche Phrase oder ein Satz, 100% grammatisch korrekt, entspricht genau dem Niveau ${level}. KEINE Anführungszeichen, KEINE Markdown-Zeichen. Einfach der reine Satz.
2. "translation_ru": естественный перевод на русский язык.
3. "translation_kz": табиғи қазақ тіліне аударма. Қазақ тілінде жаз, аудармай қалдырма.
4. "pronunciation_tips": КОРОТКИЕ советы по произношению на РУССКОМ языке (2-4 предложения). Укажи: сложные звуки (ö, ü, ä, ch, r, sch, st-, sp-), ударение, интонацию, буквы, которые часто ошибочно читают. Пиши конкретно про слова из этой фразы.
5. "level": "${level}"

JSON-FORMAT (nur JSON, nichts anderes):
{
  "german": "...",
  "translation_ru": "...",
  "translation_kz": "...",
  "pronunciation_tips": "...",
  "level": "${level}"
}`;

  const response = await client.ai.gentxt({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Сгенерируй одну НОВУЮ, свежую тренировочную фразу уровня ${level} по теме: ${effectiveTopic}. Она должна отличаться от предыдущих.` },
    ],
    model: 'gpt-5.4',
    stream: false,
  });

  const content: string = (response as any).data?.content || (response as any).content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI не вернул корректный JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]) as SpeakingPhrase;
  return {
    german: (parsed.german || '').trim(),
    translation_ru: (parsed.translation_ru || '').trim(),
    translation_kz: (parsed.translation_kz || '').trim(),
    pronunciation_tips: (parsed.pronunciation_tips || '').trim(),
    level,
  };
}

// ---------- Score pronunciation ----------

// Normalize text for comparison
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

export function computeSimilarity(target: string, heard: string): number {
  const a = normalizeForCompare(target);
  const b = normalizeForCompare(heard);
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const sim = Math.max(0, 1 - dist / maxLen);
  return Math.round(sim * 100);
}

// Convert Blob to base64 data URI
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(audioDataUri: string): Promise<string> {
  const response = await client.apiCall.invoke({
    url: '/api/v1/aihub/transcribe',
    method: 'POST',
    data: {
      audio: audioDataUri,
      model: 'scribe_v2',
    },
    options: {
      timeout: 120_000,
    },
  } as any);
  const text = (response as any).data?.text || (response as any).text || '';
  return String(text).trim();
}

export async function scorePronunciation(
  target: string,
  heard: string,
  level: CEFRLevel,
): Promise<PronunciationFeedback> {
  const similarity = computeSimilarity(target, heard);

  // If user said nothing, short-circuit
  if (!heard || heard.length < 2) {
    return {
      score: 0,
      heard_text: heard || '(тишина)',
      target_text: target,
      similarity_percent: 0,
      verdict: 'Не услышал 😔',
      feedback_ru:
        'Не удалось распознать голос. Убедитесь, что микрофон включён, говорите громче и ближе к микрофону, затем попробуйте ещё раз.',
      feedback_kz:
        'Дауыс танылмады. Микрофон қосулы екеніне көз жеткізіп, қаттырақ және жақынырақ сөйлеңіз, содан соң қайта көріңіз.',
      problem_words: [],
      tips: 'Проверьте разрешения микрофона в браузере.',
    };
  }

  // Ask AI for detailed pronunciation feedback
  const systemPrompt = `Du bist ein geduldiger Deutschlehrer, der russisch- und kasachischsprachigen Lernenden hilft, deutsche Aussprache zu verbessern. Der Lernende ist auf CEFR-Niveau ${level}.

Du bekommst:
- "target": den SOLL-Satz, den der Lerner sagen sollte (richtiges Deutsch).
- "heard": die ASR-Transkription dessen, was der Lerner tatsächlich gesagt hat. Die ASR ist nicht perfekt — selbst gut ausgesprochene Wörter können falsch transkribiert werden. Betrachte Abweichungen als HINWEIS auf mögliche Aussprachefehler, nicht als absolute Wahrheit.
- "similarity_percent": automatisch berechnete Levenshtein-Ähnlichkeit (0-100).

Gib GENAU ein JSON-Objekt zurück — ohne Markdown, ohne Kommentare drumherum.

BEWERTUNGSLOGIK:
- "score": eine Zahl von 0 bis 100. Orientiere dich grob an similarity_percent, passe aber nach linguistischer Einschätzung an:
  - 90-100: sehr gut / fast perfekt
  - 75-89: gut, nur kleine Fehler
  - 55-74: verständlich, aber mehrere Aussprachefehler
  - 30-54: viele Fehler, schwer verständlich
  - 0-29: kaum erkennbar
- "verdict": ein kurzer emoji-unterstützter Satz auf Russisch, z.B. "Отлично! 🎉", "Хорошо 👍", "Неплохо, но можно лучше", "Нужно потренироваться", "Попробуйте ещё раз".
- "feedback_ru": 2-4 предложения на русском — конкретно, что получилось, где ошибки, какие звуки тренировать (ö, ü, ä, ch, r, sch, конечные согласные и т.д.). Пиши поддерживающим тоном.
- "feedback_kz": 2-4 сөйлем қазақ тілінде, сол мазмұн бойынша. Міндетті түрде қазақша жаз, орысша немесе немісше қалдырма.
- "problem_words": массив немецких слов из target, которые звучали неправильно или были пропущены (0-4 слова). Если всё хорошо — пустой массив.
- "tips": 1-2 предложения на русском с конкретным советом по произношению (что именно делать языком/губами).

Antworte NUR mit dem JSON-Objekt:
{
  "score": 0-100,
  "verdict": "...",
  "feedback_ru": "...",
  "feedback_kz": "...",
  "problem_words": [...],
  "tips": "..."
}`;

  const userPayload = JSON.stringify({
    target,
    heard,
    similarity_percent: similarity,
    level,
  });

  try {
    const response = await client.ai.gentxt({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
      model: 'gpt-5.4',
      stream: false,
    });

    const content: string = (response as any).data?.content || (response as any).content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]);

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || similarity)));
    return {
      score,
      heard_text: heard,
      target_text: target,
      similarity_percent: similarity,
      verdict: parsed.verdict || (score >= 80 ? 'Хорошо! 👍' : 'Попробуйте ещё раз'),
      feedback_ru: parsed.feedback_ru || '',
      feedback_kz: parsed.feedback_kz || '',
      problem_words: Array.isArray(parsed.problem_words) ? parsed.problem_words.slice(0, 6) : [],
      tips: parsed.tips || '',
    };
  } catch {
    // Fallback: use similarity-only scoring
    const score = similarity;
    const verdict =
      score >= 85 ? 'Отлично! 🎉' : score >= 70 ? 'Хорошо 👍' : score >= 50 ? 'Неплохо, но можно лучше' : 'Нужно потренироваться';
    return {
      score,
      heard_text: heard,
      target_text: target,
      similarity_percent: similarity,
      verdict,
      feedback_ru: `Совпадение с эталонной фразой: ${similarity}%. Послушайте эталонное произношение и повторите снова.`,
      feedback_kz: `Эталонды сөйлеммен сәйкестігі: ${similarity}%. Дұрыс дыбысталуын тыңдап, қайта қайталап көріңіз.`,
      problem_words: [],
      tips: 'Послушайте образец несколько раз и повторяйте медленно.',
    };
  }
}