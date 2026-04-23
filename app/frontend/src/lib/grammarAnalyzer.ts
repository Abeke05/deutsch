import { createClient } from '@metagptx/web-sdk';

const client = createClient();

export interface GrammarRuleAnalysis {
  rule_name: string;
  explanation_ru: string;
  explanation_kz: string;
  examples: string;
  category: string;
}

export async function analyzeGrammarRule(query: string): Promise<GrammarRuleAnalysis> {
  const systemPrompt = `Du bist ein erfahrener Deutschlehrer für russisch- und kasachischsprachige Lernende. Der Nutzer nennt dir ein Grammatikthema oder eine Regel (z.B. "Perfekt", "Akkusativ", "модальные глаголы", "определённый артикль", "сабақты етістік" usw.). Gib GENAU ein JSON-Objekt zurück — ohne Markdown, ohne Kommentare, ohne Erklärungen drumherum.

WICHTIGE REGELN:
1. "rule_name": der offizielle deutsche Name der Regel/des Themas (z.B. "Perfekt", "Akkusativ", "Modalverben", "Bestimmter Artikel", "Nebensatz mit weil"). Wenn die Eingabe auf Russisch oder Kasachisch war, übersetze sie trotzdem in den korrekten deutschen grammatischen Namen.
2. "explanation_ru": подробное, чёткое объяснение правила на русском языке. 3-6 предложений. Объясни: что это, когда используется, как образуется, ключевые нюансы. Пиши простым языком для уровня A2-B2.
3. "explanation_kz": сол ережені қазақ тілінде түсіндіру. 3-6 сөйлем. Не екенін, қашан қолданылатынын, қалай жасалатынын және негізгі ерекшеліктерін түсіндір. Қарапайым тілде, A2-B2 деңгейіне сай жаз. Қазақ тілін қолдан (аудармай қалдырма).
4. "examples": 4-6 грамматически правильных немецких примеров, каждый с новой строки (разделитель \\n). Можно для каждого примера в скобках дать короткий перевод на русский, например: "Ich habe einen Apfel gegessen. (Я съел яблоко.)"
5. "category": короткое название категории на русском языке. Выбери ОДНО из: "Артикли", "Падежи", "Времена", "Модальные глаголы", "Предлоги", "Придаточные предложения", "Пассив", "Конъюнктив", "Склонение", "Порядок слов", "Местоимения", "Числительные", "Частицы", "Прилагательные", "Прочее".

JSON-FORMAT:
{
  "rule_name": "...",
  "explanation_ru": "...",
  "explanation_kz": "...",
  "examples": "Beispiel 1\\nBeispiel 2\\nBeispiel 3\\nBeispiel 4",
  "category": "..."
}

Antworte NUR mit dem JSON-Objekt, keine weiteren Zeichen.`;

  const response = await client.ai.gentxt({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query.trim() },
    ],
    model: 'gpt-5.4',
    stream: false,
  });

  const content: string = (response as any).data?.content || (response as any).content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI не вернул корректный JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]) as GrammarRuleAnalysis;
  return {
    rule_name: parsed.rule_name || query,
    explanation_ru: parsed.explanation_ru || '',
    explanation_kz: parsed.explanation_kz || '',
    examples: parsed.examples || '',
    category: parsed.category || 'Прочее',
  };
}