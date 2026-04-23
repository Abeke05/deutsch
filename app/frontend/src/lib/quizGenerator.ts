import { createClient } from '@metagptx/web-sdk';

const client = createClient();

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface QuizWord {
  german_word: string;
  plural_form: string;
  part_of_speech: string;
  gender: string;
  russian_translation: string;
  kazakh_translation: string;
  hint: string;
  example_sentence: string;
  category: string;
}

export interface ScrambleSentence {
  german: string; // full correct sentence
  translation_ru: string;
  tokens: string[]; // tokens shuffled (we'll shuffle client-side)
}

export interface ConjugationTask {
  infinitive: string; // e.g. "laufen"
  russian_translation: string;
  forms: Array<{
    label: string; // e.g. "ich (Präsens)", "du (Perfekt)"
    answer: string; // e.g. "laufe", "bist gelaufen"
  }>;
}

export interface ListeningPassage {
  german_text: string;
  translation_ru: string;
  questions: Array<{
    question_ru: string; // question in Russian
    answer_ru: string; // expected answer in Russian
    hint_ru: string;
  }>;
}

export const QUIZ_SIZES: Record<CEFRLevel, number> = {
  A1: 10,
  A2: 10,
  B1: 10,
  B2: 8,
  C1: 8,
  C2: 6,
};

const LEVEL_GUIDE: Record<CEFRLevel, string> = {
  A1: 'Основные повседневные слова: приветствия, семья, числа, цвета, еда, простые глаголы.',
  A2: 'Повседневная лексика: покупки, транспорт, погода, хобби, работа, путешествия.',
  B1: 'Средний уровень: эмоции, мнения, здоровье, окружающая среда, технологии, культура.',
  B2: 'Выше среднего: абстрактные понятия, политика, экономика, наука, искусство, сложные глаголы.',
  C1: 'Продвинутый: академическая, профессиональная, редкая лексика, идиомы, сложные существительные.',
  C2: 'Уровень носителя: литературная, архаичная, специализированная лексика, редкие идиомы.',
};

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await client.ai.gentxt({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model: 'gpt-5.4',
    stream: false,
  });
  return (response as any).data?.content || (response as any).content || '';
}

function extractJsonArray(content: string): any[] {
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI не вернул JSON массив');
  return JSON.parse(m[0]);
}

function extractJsonObject(content: string): any {
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI не вернул JSON объект');
  return JSON.parse(m[0]);
}

// ---------- Vocabulary quiz ----------

export async function generateQuizWords(
  level: CEFRLevel,
  topic?: string,
  excludeWords: string[] = [],
): Promise<QuizWord[]> {
  const count = QUIZ_SIZES[level];
  const excludeText = excludeWords.length > 0
    ? `\n\nИСКЛЮЧИ эти слова (они уже были): ${excludeWords.slice(0, 30).join(', ')}.`
    : '';

  const systemPrompt = `Du bist ein professioneller Deutschlehrer. Erstelle genau ${count} deutsche Vokabelwörter für einen Quiz auf Niveau ${level}.

Niveau-Beschreibung: ${LEVEL_GUIDE[level]}
${topic ? `Thema: ${topic}` : 'Thema: frei gemischt (разнообразные темы)'}${excludeText}

ANFORDERUNGEN für jedes Wort:
1. "german_word": Substantive mit Artikel der/die/das (z.B. "der Hund"). Verben im Infinitiv ("laufen"). Adjektive в Grundform ("schön").
2. "plural_form":
   - Для Nomen: множественное число с "die".
   - Для Verb: "Präsens 3.Pers. | Präteritum 3.Pers. | Partizip II" через " | ".
   - Для Adjektiv: "Komparativ | Superlativ".
   - Иначе: пустая строка.
3. "part_of_speech": Nomen | Verb | Adjektiv | Adverb | Pronomen | Präposition | Konjunktion | Artikel | Numerale | Interjektion
4. "gender": "der" | "die" | "das" (только для Nomen). Иначе пустая строка.
5. "russian_translation": точный перевод (1-2 значения).
6. "kazakh_translation": қазақ тілінде аударма.
7. "hint": короткая подсказка на русском, НЕ раскрывающая само немецкое слово или прямой перевод. 5-15 слов.
8. "example_sentence": одно немецкое предложение с пропуском "___" вместо целевого слова.
9. "category": короткая категория на русском.

РАЗНООБРАЗИЕ: минимум 5 разных категорий, слова не повторяются.

Ответ — ТОЛЬКО JSON-массив, без Markdown:
[{"german_word":"...","plural_form":"...","part_of_speech":"...","gender":"...","russian_translation":"...","kazakh_translation":"...","hint":"...","example_sentence":"...","category":"..."}]`;

  const content = await callAI(
    systemPrompt,
    `Сгенерируй ${count} разнообразных слов уровня ${level}${topic ? ` на тему "${topic}"` : ''}.`,
  );
  const parsed = extractJsonArray(content) as QuizWord[];
  return parsed
    .filter((w) => w && w.german_word)
    .map((w) => ({
      german_word: (w.german_word || '').trim(),
      plural_form: (w.plural_form || '').trim(),
      part_of_speech: (w.part_of_speech || '').trim(),
      gender: (w.gender || '').trim().toLowerCase(),
      russian_translation: (w.russian_translation || '').trim(),
      kazakh_translation: (w.kazakh_translation || '').trim(),
      hint: (w.hint || '').trim(),
      example_sentence: (w.example_sentence || '').trim(),
      category: (w.category || 'Прочее').trim(),
    }));
}

// ---------- Sentence scramble ----------

export async function generateScrambleSentences(
  level: CEFRLevel,
  topic?: string,
  count = 6,
): Promise<ScrambleSentence[]> {
  const systemPrompt = `Erstelle genau ${count} deutsche Übungssätze zum Thema Wortstellung (Satzbau) auf Niveau ${level}.
Niveau: ${LEVEL_GUIDE[level]}
${topic ? `Thema: ${topic}` : ''}

Регулирование длины:
- A1: 3-5 слов
- A2: 4-7 слов
- B1: 6-10 слов
- B2: 8-12 слов
- C1: 10-14 слов
- C2: 12-16 слов

Каждое предложение должно быть ГРАММАТИЧЕСКИ КОРРЕКТНЫМ, с правильным порядком слов (V2, рамочная конструкция для Perfekt/модальных, TeKaMoLo).
Избегай односложных ответов и восклицаний.

Верни ТОЛЬКО JSON-массив:
[{"german":"Полное корректное предложение.","translation_ru":"Перевод на русский"}]`;

  const content = await callAI(systemPrompt, `Сгенерируй ${count} предложений уровня ${level}.`);
  const parsed = extractJsonArray(content) as Array<{ german: string; translation_ru: string }>;
  return parsed
    .filter((s) => s && s.german)
    .map((s) => {
      const cleaned = s.german.trim();
      // Tokenize by whitespace; keep trailing punctuation as part of last token
      const tokens = cleaned.split(/\s+/).filter(Boolean);
      return {
        german: cleaned,
        translation_ru: (s.translation_ru || '').trim(),
        tokens,
      };
    });
}

// ---------- Verb conjugation ----------

export async function generateConjugationTasks(
  level: CEFRLevel,
  count = 5,
): Promise<ConjugationTask[]> {
  const systemPrompt = `Erstelle genau ${count} Übungsaufgaben zur deutschen Verbkonjugation auf Niveau ${level}.
Niveau: ${LEVEL_GUIDE[level]}

Для каждого глагола дай:
- "infinitive": инфинитив (без "zu"), например "laufen".
- "russian_translation": русский перевод.
- "forms": массив из 4-5 форм для заполнения. Каждая форма имеет "label" (на русском, описание: местоимение + время/форма) и "answer" (правильная форма глагола).

Формы варьируй: включай Präsens (ich, du, er/sie/es, wir, ihr, sie), Präteritum (ich, er/sie/es), Perfekt (ich habe/bin + Partizip II), иногда Konjunktiv II для уровня B2+.

Для A1-A2: преимущественно Präsens.
Для B1: Präsens + Perfekt + Präteritum.
Для B2+: добавь Konjunktiv II, Passiv.

Примеры label:
- "ich (Präsens)" → "laufe"
- "er (Perfekt)" → "ist gelaufen"
- "wir (Präteritum)" → "liefen"

Ответ — ТОЛЬКО JSON-массив:
[{"infinitive":"...","russian_translation":"...","forms":[{"label":"...","answer":"..."}, ...]}]`;

  const content = await callAI(systemPrompt, `Сгенерируй ${count} глаголов уровня ${level}.`);
  const parsed = extractJsonArray(content) as ConjugationTask[];
  return parsed
    .filter((t) => t && t.infinitive && Array.isArray(t.forms))
    .map((t) => ({
      infinitive: t.infinitive.trim(),
      russian_translation: (t.russian_translation || '').trim(),
      forms: (t.forms || [])
        .filter((f) => f && f.label && f.answer)
        .map((f) => ({ label: f.label.trim(), answer: f.answer.trim() })),
    }));
}

// ---------- Listening passage ----------

export async function generateListeningPassage(
  level: CEFRLevel,
  topic?: string,
): Promise<ListeningPassage> {
  const lengthGuide: Record<CEFRLevel, string> = {
    A1: '2-3 очень простых предложения, ~20-30 слов',
    A2: '3-4 простых предложения, ~30-50 слов',
    B1: '4-6 предложений, ~60-90 слов',
    B2: '6-8 предложений, ~90-130 слов',
    C1: '7-10 предложений, ~120-180 слов',
    C2: '8-12 предложений, ~150-220 слов',
  };

  const systemPrompt = `Erstelle einen kurzen deutschen Hörverständnistext auf Niveau ${level}.
Niveau: ${LEVEL_GUIDE[level]}
Länge: ${lengthGuide[level]}.
${topic ? `Thema: ${topic}` : 'Thema: frei wählen — повседневная ситуация, история, описание.'}

Текст должен:
- Быть грамматически безупречным и соответствовать уровню.
- Содержать конкретные факты (имена, числа, места, действия), чтобы по ним можно было задать вопросы.
- Звучать естественно при произношении вслух.

Составь 3 вопроса на русском языке по содержанию текста. Вопросы — на понимание фактов. Ответы — короткие (1-5 слов), проверяемые точно.

Верни ТОЛЬКО JSON-объект:
{
  "german_text": "Полный немецкий текст.",
  "translation_ru": "Полный перевод на русский",
  "questions": [
    {"question_ru": "Вопрос на русском?", "answer_ru": "короткий ответ", "hint_ru": "короткая подсказка"}
  ]
}`;

  const content = await callAI(systemPrompt, `Сгенерируй текст для аудирования уровня ${level}${topic ? ` на тему "${topic}"` : ''}.`);
  const parsed = extractJsonObject(content) as ListeningPassage;
  return {
    german_text: (parsed.german_text || '').trim(),
    translation_ru: (parsed.translation_ru || '').trim(),
    questions: (parsed.questions || [])
      .filter((q) => q && q.question_ru && q.answer_ru)
      .map((q) => ({
        question_ru: q.question_ru.trim(),
        answer_ru: q.answer_ru.trim(),
        hint_ru: (q.hint_ru || '').trim(),
      })),
  };
}

// ---------- Answer checking ----------

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(der|die|das|ein|eine|einen|einem|einer)\s+/i, '')
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRu(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

export interface AnswerCheck {
  correct: boolean;
  nearMiss: boolean;
  similarity: number;
}

export function checkAnswer(user: string, target: string): AnswerCheck {
  const a = normalizeAnswer(user);
  const b = normalizeAnswer(target);
  if (!a) return { correct: false, nearMiss: false, similarity: 0 };
  if (a === b) return { correct: true, nearMiss: false, similarity: 1 };
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return { correct: false, nearMiss: false, similarity: 0 };
  const dist = levenshtein(a, b);
  const sim = 1 - dist / maxLen;
  const allowed = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
  if (dist <= allowed && sim >= 0.7) return { correct: true, nearMiss: true, similarity: sim };
  return { correct: false, nearMiss: sim >= 0.5, similarity: sim };
}

// For Russian answers (reverse quiz, listening) — more permissive, allow multiple synonyms
export function checkRussianAnswer(user: string, target: string): AnswerCheck {
  const u = normalizeRu(user);
  const targets = target
    .split(/[,;/]/)
    .map((t) => normalizeRu(t))
    .filter(Boolean);
  if (!u) return { correct: false, nearMiss: false, similarity: 0 };
  let best: AnswerCheck = { correct: false, nearMiss: false, similarity: 0 };
  for (const t of targets) {
    if (u === t) return { correct: true, nearMiss: false, similarity: 1 };
    // Also accept if user answer contains the target as a substring word
    const userTokens = u.split(' ');
    if (userTokens.includes(t) || u.includes(t)) {
      return { correct: true, nearMiss: false, similarity: 0.95 };
    }
    const maxLen = Math.max(u.length, t.length);
    if (maxLen === 0) continue;
    const dist = levenshtein(u, t);
    const sim = 1 - dist / maxLen;
    const allowed = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
    if (dist <= allowed && sim >= 0.7) {
      return { correct: true, nearMiss: true, similarity: sim };
    }
    if (sim > best.similarity) {
      best = { correct: false, nearMiss: sim >= 0.5, similarity: sim };
    }
  }
  return best;
}

// Scramble check: compare token sequences (case- & punct-insensitive)
export function checkScramble(userTokens: string[], targetSentence: string): boolean {
  const targetTokens = targetSentence
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.,;!?"']/g, '').toLowerCase());
  const userNormalized = userTokens.map((t) => t.replace(/[.,;!?"']/g, '').toLowerCase());
  if (userNormalized.length !== targetTokens.length) return false;
  return userNormalized.every((t, i) => t === targetTokens[i]);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  // Ensure it's actually shuffled (not same as original)
  if (result.length > 1 && result.every((v, i) => v === arr[i])) {
    [result[0], result[1]] = [result[1], result[0]];
  }
  return result;
}