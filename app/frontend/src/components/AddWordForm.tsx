import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { analyzeGermanWord } from '@/lib/aiAnalyzer';
import { createClient } from '@metagptx/web-sdk';
import VoiceInputButton from './VoiceInputButton';

const client = createClient();

interface AddWordFormProps {
  onWordAdded: () => void;
}

export default function AddWordForm({ onWordAdded }: AddWordFormProps) {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed) {
      toast.error('Введите немецкое слово');
      return;
    }

    setLoading(true);
    try {
      // Helper: normalize a German word for comparison — remove articles, lowercase, trim punctuation/spaces
      const normalizeWord = (w: string): string => {
        if (!w) return '';
        let s = w.trim().toLowerCase();
        // Remove leading article der/die/das/ein/eine
        s = s.replace(/^(der|die|das|ein|eine|einen|einem|einer)\s+/i, '');
        // Remove punctuation
        s = s.replace(/[.,;!?()"']/g, '').trim();
        return s;
      };

      // Load existing words once
      const existingResp = await client.entities.vocabulary_words.query({
        limit: 1000,
      });
      const existingItems = (existingResp as any).data?.items || [];
      const normalizedInput = normalizeWord(trimmed);

      // Pre-check: if user's input already matches an existing word, skip AI call
      const preDuplicate = existingItems.find(
        (w: any) => normalizeWord(w.german_word || '') === normalizedInput,
      );
      if (preDuplicate) {
        toast.error(`Слово "${preDuplicate.german_word}" уже есть в вашем словаре`);
        setLoading(false);
        return;
      }

      toast.info('Анализирую слово...', { duration: 2000 });
      const analysis = await analyzeGermanWord(trimmed);

      // Post-check: after AI normalization, check again (e.g. user typed "hunde", AI returned "der Hund")
      const normalizedAI = normalizeWord(analysis.german_word);
      const duplicate = existingItems.find(
        (w: any) => normalizeWord(w.german_word || '') === normalizedAI,
      );

      if (duplicate) {
        toast.error(`Слово "${duplicate.german_word}" уже есть в вашем словаре`);
        setLoading(false);
        return;
      }

      await client.entities.vocabulary_words.create({
        data: {
          german_word: analysis.german_word,
          plural_form: analysis.plural_form,
          part_of_speech: analysis.part_of_speech,
          gender: analysis.gender,
          russian_translation: analysis.russian_translation,
          kazakh_translation: analysis.kazakh_translation,
          example_sentence: analysis.example_sentence,
          category: analysis.category,
          subcategories: analysis.subcategories,
        },
      });

      toast.success(`Слово "${analysis.german_word}" добавлено`);
      setWord('');
      onWordAdded();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось добавить слово');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-lg">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Введите или продиктуйте немецкое слово..."
            value={word}
            onChange={(e) => setWord(e.target.value)}
            disabled={loading}
            className="pl-10 h-12 text-base"
          />
        </div>
        <VoiceInputButton
          onTranscribed={(text) => setWord(text)}
          disabled={loading}
        />
        <Button type="submit" disabled={loading} className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white transition-all">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Анализ...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </>
          )}
        </Button>
      </form>
      <p className="text-xs text-slate-500 mt-3">
        🎤 Используйте микрофон для голосового ввода. AI автоматически определит часть речи, род и переведёт слово на русский и казахский.
      </p>
    </Card>
  );
}