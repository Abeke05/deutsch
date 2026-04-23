import { createClient } from '@metagptx/web-sdk';

const client = createClient();

export interface WordAnalysis {
  german_word: string;
  plural_form: string;
  part_of_speech: string;
  gender: string;
  russian_translation: string;
  kazakh_translation: string;
  example_sentence: string;
  category: string;
  subcategories: string;
}

export async function analyzeGermanWord(word: string): Promise<WordAnalysis> {
  const systemPrompt = `Du bist ein hochqualifizierter Experte für die deutsche Sprache, russische und kasachische Übersetzungen. Ein Nutzer gibt dir ein deutsches Wort (ggf. mit Tippfehlern oder in falscher Form). Analysiere es sorgfältig und gib GENAU ein JSON-Objekt zurück — ohne Markdown, ohne Kommentare, ohne Erklärungen.

WICHTIGE REGELN:
1. Korrigiere Tippfehler und bringe das Wort in die Grundform (Substantive: Nominativ Singular; Verben: Infinitiv; Adjektive: Grundform).
2. Übersetzungen müssen PRÄZISE, natürlich und im häufigsten/gebräuchlichsten Sinn sein. Verwende keine veralteten oder seltenen Bedeutungen.
3. Für russische Übersetzung: verwende die gängigste Bedeutung. Wenn das Wort mehrere Bedeutungen hat, gib 1-3 Hauptbedeutungen durch Komma getrennt an.
4. Für kasachische Übersetzung: verwende moderne kasachische Sprache (nicht russische Lehnwörter, sondern echtes Kasachisch, wenn möglich). Gib die gängigste Bedeutung.
5. Beispielsätze müssen grammatikalisch korrekt und natürlich sein (Niveau A2-B1).
6. Bei Substantiven: IMMER mit Artikel der/die/das am Anfang, erster Buchstabe des Nomens groß.
7. Ordne das Wort IMMER einer semantischen Hauptkategorie zu (auf Russisch, kurz, 1-2 Wörter). Beispiele: "Техника", "Мебель", "Животные", "Еда", "Одежда", "Природа", "Транспорт", "Люди и семья", "Профессии", "Тело и здоровье", "Дом и быт", "Время и календарь", "Чувства и эмоции", "Действия", "Качества", "Места", "Учёба и работа", "Искусство и культура", "Абстрактные понятия", "Числа и количество", "Прочее".
8. Zusätzlich gib 1-4 Unterkategorien (подкатегории) auf Russisch an — konkretere Tags, die das Wort genauer beschreiben. Z.B. для "der Hund" — category: "Животные", subcategories: "Домашние животные, Млекопитающие". Для "der Laptop" — category: "Техника", subcategories: "Компьютеры, Электроника, Офис". Для "lecker" — category: "Качества", subcategories: "Еда, Вкус, Положительные". Gib die подкатегории в ОДНОЙ СТРОКЕ через запятую.

JSON-FORMAT:
{
  "german_word": "Grundform; Substantive mit Artikel (z.B. 'der Hund'); Verben im Infinitiv; Adjektive in Grundform",
  "plural_form": "Substantive: Pluralform mit 'die'. Verben: 'Präsens 3.Pers. | Präteritum 3.Pers. | Partizip II'. Adjektive: 'Komparativ | Superlativ'. Sonst leerer String",
  "part_of_speech": "Nomen | Verb | Adjektiv | Adverb | Pronomen | Präposition | Konjunktion | Artikel | Numerale | Interjektion",
  "gender": "der | die | das (nur bei Substantiven), sonst leerer String",
  "russian_translation": "Точный перевод на русский (1-3 значения через запятую)",
  "kazakh_translation": "Дәл қазақ тіліне аударма",
  "example_sentence": "Zwei kurze deutsche Beispielsätze, getrennt durch \\n",
  "category": "Основная категория на русском",
  "subcategories": "1-4 подкатегории на русском, через запятую"
}

Antworte NUR mit dem JSON-Objekt.`;

  const response = await client.ai.gentxt({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: word.trim() },
    ],
    model: 'gpt-5.4',
    stream: false,
  });

  const content: string = (response as any).data?.content || (response as any).content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI не вернул корректный JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]) as WordAnalysis;
  return {
    german_word: parsed.german_word || word,
    plural_form: parsed.plural_form || '',
    part_of_speech: parsed.part_of_speech || '',
    gender: parsed.gender || '',
    russian_translation: parsed.russian_translation || '',
    kazakh_translation: parsed.kazakh_translation || '',
    example_sentence: parsed.example_sentence || '',
    category: parsed.category || 'Прочее',
    subcategories: parsed.subcategories || '',
  };
}