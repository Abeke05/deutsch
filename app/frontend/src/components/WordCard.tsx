import { lazy, memo, Suspense, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import PronounceButton from './PronounceButton';

const EditWordDialog = lazy(() => import('./EditWordDialog'));

const client = createClient();

export interface VocabularyWord {
  id: number;
  german_word: string;
  plural_form: string;
  part_of_speech: string;
  gender: string;
  russian_translation: string;
  kazakh_translation: string;
  example_sentence: string;
  category?: string;
  subcategories?: string;
}

// Parse plural_form for verbs/adjectives, return array of {label, value}
function parseForms(pluralForm: string, partOfSpeech: string): Array<{ label: string; value: string }> {
  if (!pluralForm) return [];
  const trimmed = pluralForm.trim();

  if (partOfSpeech === 'Verb') {
    // Split by ' | ' or ',' — prefer pipe (new format)
    const parts = trimmed.includes('|')
      ? trimmed.split('|').map((s) => s.trim()).filter(Boolean)
      : trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    const labels = ['Präsens (3. Pers.)', 'Präteritum (3. Pers.)', 'Partizip II'];
    return parts.slice(0, 3).map((value, i) => ({
      label: labels[i] || `Форма ${i + 1}`,
      value,
    }));
  }

  if (partOfSpeech === 'Adjektiv') {
    const parts = trimmed.includes('|')
      ? trimmed.split('|').map((s) => s.trim()).filter(Boolean)
      : trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    const labels = ['Komparativ', 'Superlativ'];
    return parts.slice(0, 2).map((value, i) => ({
      label: labels[i] || `Форма ${i + 1}`,
      value,
    }));
  }

  if (partOfSpeech === 'Nomen') {
    return [{ label: 'Plural (мн.ч.)', value: trimmed }];
  }

  return [{ label: 'Форма', value: trimmed }];
}

interface WordCardProps {
  word: VocabularyWord;
  onDeleted: () => void;
  onUpdated?: () => void;
}

// Colors: male=blue, female=red, neuter=yellow
const genderStyles: Record<string, {
  cardBg: string;
  cardBorder: string;
  wordText: string;
  articleBg: string;
  articleText: string;
  label: string;
}> = {
  der: {
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-300',
    wordText: 'text-blue-700',
    articleBg: 'bg-blue-600',
    articleText: 'text-white',
    label: 'der · мужской род',
  },
  die: {
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-300',
    wordText: 'text-red-700',
    articleBg: 'bg-red-600',
    articleText: 'text-white',
    label: 'die · женский род',
  },
  das: {
    cardBg: 'bg-yellow-50',
    cardBorder: 'border-yellow-400',
    wordText: 'text-yellow-800',
    articleBg: 'bg-yellow-500',
    articleText: 'text-white',
    label: 'das · средний род',
  },
};

function stripArticle(word: string): { article: string; core: string } {
  const match = word.match(/^(der|die|das)\s+(.+)$/i);
  if (match) {
    return { article: match[1].toLowerCase(), core: match[2] };
  }
  return { article: '', core: word };
}

function WordCardInner({ word, onDeleted, onUpdated }: WordCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const genderKey = word.gender?.toLowerCase() as 'der' | 'die' | 'das' | undefined;
  const style = genderKey && genderStyles[genderKey];

  const { article: singularArticle, core: singularCore } = stripArticle(word.german_word);
  const displayArticle = singularArticle || genderKey || '';

  const examples = (word.example_sentence || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleDelete = async () => {
    try {
      await client.entities.vocabulary_words.delete({ id: String(word.id) });
      toast.success('Слово удалено');
      onDeleted();
    } catch {
      toast.error('Не удалось удалить слово');
    }
  };

  return (
    <Card
      className={`p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        style ? `${style.cardBg} ${style.cardBorder} border-2` : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {word.part_of_speech && (
              <Badge variant="secondary" className="text-xs font-medium">
                {word.part_of_speech}
              </Badge>
            )}
            {style && (
              <Badge className={`text-xs ${style.articleBg} ${style.articleText} hover:${style.articleBg}`}>
                {style.label}
              </Badge>
            )}
            {word.category && (
              <Badge variant="outline" className="text-xs font-medium bg-white/70 border-slate-300 text-slate-700">
                📂 {word.category}
              </Badge>
            )}
            {word.subcategories &&
              word.subcategories
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 4)
                .map((sub, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] font-medium bg-indigo-50/70 border-indigo-200 text-indigo-700"
                  >
                    # {sub}
                  </Badge>
                ))}
          </div>

          {/* Singular form */}
          <div className="flex items-baseline gap-2 flex-wrap">
            {displayArticle && style && (
              <span className={`text-lg font-semibold ${style.wordText}`}>
                {displayArticle}
              </span>
            )}
            <h3 className={`text-2xl font-bold break-words ${style ? style.wordText : 'text-slate-900'}`}>
              {singularCore}
            </h3>
            <PronounceButton text={word.german_word} />
            <span className="text-xs text-slate-500 ml-1">(ед.ч.)</span>
          </div>

          {/* Forms with labels (plural / verb forms / comparison) */}
          {word.plural_form && (
            <div className="mt-2 space-y-1">
              {parseForms(word.plural_form, word.part_of_speech).map((form, idx) => (
                <div key={idx} className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {form.label}
                  </span>
                  <span className={`text-base font-medium ${style ? style.wordText : 'text-slate-700'} opacity-90`}>
                    {form.value}
                  </span>
                  <PronounceButton text={form.value} className="h-6 w-6" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            className="text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
            title="Редактировать"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-sm mt-4 pt-3 border-t border-slate-200/70">
        {word.russian_translation && (
          <div className="flex gap-2">
            <span className="text-slate-500 font-medium w-20 shrink-0">🇷🇺 RU:</span>
            <span className="text-slate-800 font-medium">{word.russian_translation}</span>
          </div>
        )}
        {word.kazakh_translation && (
          <div className="flex gap-2">
            <span className="text-slate-500 font-medium w-20 shrink-0">🇰🇿 KZ:</span>
            <span className="text-slate-800 font-medium">{word.kazakh_translation}</span>
          </div>
        )}
      </div>

      {examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/70">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Примеры</p>
          <ul className="space-y-1.5">
            {examples.map((ex, idx) => (
              <li key={idx} className="text-slate-700 italic text-sm flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span className="flex-1">{ex}</span>
                <PronounceButton text={ex} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 h-6 w-6 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {editOpen && (
        <Suspense fallback={null}>
          <EditWordDialog
            word={word}
            open={editOpen}
            onOpenChange={setEditOpen}
            onUpdated={() => {
              if (onUpdated) onUpdated();
            }}
          />
        </Suspense>
      )}
    </Card>
  );
}

const WordCard = memo(WordCardInner, (prev, next) => {
  // Re-render only if word data or callbacks change
  const w1 = prev.word;
  const w2 = next.word;
  return (
    w1.id === w2.id &&
    w1.german_word === w2.german_word &&
    w1.plural_form === w2.plural_form &&
    w1.part_of_speech === w2.part_of_speech &&
    w1.gender === w2.gender &&
    w1.russian_translation === w2.russian_translation &&
    w1.kazakh_translation === w2.kazakh_translation &&
    w1.example_sentence === w2.example_sentence &&
    w1.category === w2.category &&
    w1.subcategories === w2.subcategories &&
    prev.onDeleted === next.onDeleted &&
    prev.onUpdated === next.onUpdated
  );
});

export default WordCard;