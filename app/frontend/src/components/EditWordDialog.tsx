import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import { analyzeGermanWord } from '@/lib/aiAnalyzer';
import type { VocabularyWord } from './WordCard';

const client = createClient();

interface EditWordDialogProps {
  word: VocabularyWord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const PARTS_OF_SPEECH = [
  'Nomen',
  'Verb',
  'Adjektiv',
  'Adverb',
  'Pronomen',
  'Präposition',
  'Konjunktion',
  'Artikel',
  'Numerale',
  'Interjektion',
];

const GENDERS = [
  { value: '__none__', label: '— нет —' },
  { value: 'der', label: 'der (мужской)' },
  { value: 'die', label: 'die (женский)' },
  { value: 'das', label: 'das (средний)' },
];

export default function EditWordDialog({
  word,
  open,
  onOpenChange,
  onUpdated,
}: EditWordDialogProps) {
  const [germanWord, setGermanWord] = useState(word.german_word);
  const [pluralForm, setPluralForm] = useState(word.plural_form || '');
  const [partOfSpeech, setPartOfSpeech] = useState(word.part_of_speech || '');
  const [gender, setGender] = useState(word.gender || '');
  const [russianTranslation, setRussianTranslation] = useState(word.russian_translation || '');
  const [kazakhTranslation, setKazakhTranslation] = useState(word.kazakh_translation || '');
  const [exampleSentence, setExampleSentence] = useState(word.example_sentence || '');
  const [category, setCategory] = useState(word.category || '');
  const [subcategories, setSubcategories] = useState(word.subcategories || '');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Reset form fields whenever a different word is loaded
  useEffect(() => {
    setGermanWord(word.german_word);
    setPluralForm(word.plural_form || '');
    setPartOfSpeech(word.part_of_speech || '');
    setGender(word.gender || '');
    setRussianTranslation(word.russian_translation || '');
    setKazakhTranslation(word.kazakh_translation || '');
    setExampleSentence(word.example_sentence || '');
    setCategory(word.category || '');
    setSubcategories(word.subcategories || '');
  }, [word]);

  const handleRegenerate = async () => {
    const trimmed = germanWord.trim();
    if (!trimmed) {
      toast.error('Введите немецкое слово');
      return;
    }
    setRegenerating(true);
    try {
      toast.info('AI заново анализирует слово...', { duration: 2000 });
      const analysis = await analyzeGermanWord(trimmed);
      setGermanWord(analysis.german_word);
      setPluralForm(analysis.plural_form);
      setPartOfSpeech(analysis.part_of_speech);
      setGender(analysis.gender);
      setRussianTranslation(analysis.russian_translation);
      setKazakhTranslation(analysis.kazakh_translation);
      setExampleSentence(analysis.example_sentence);
      setCategory(analysis.category || '');
      setSubcategories(analysis.subcategories || '');
      toast.success('Данные обновлены из AI. Проверьте и сохраните.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось заново проанализировать слово');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!germanWord.trim()) {
      toast.error('Немецкое слово не может быть пустым');
      return;
    }
    setSaving(true);
    try {
      await client.entities.vocabulary_words.update({
        id: String(word.id),
        data: {
          german_word: germanWord.trim(),
          plural_form: pluralForm.trim(),
          part_of_speech: partOfSpeech.trim(),
          gender: gender.trim(),
          russian_translation: russianTranslation.trim(),
          kazakh_translation: kazakhTranslation.trim(),
          example_sentence: exampleSentence.trim(),
          category: category.trim(),
          subcategories: subcategories.trim(),
        },
      });
      toast.success('Слово обновлено');
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать слово</DialogTitle>
          <DialogDescription>
            Исправьте перевод или любые данные. Можно также заново запросить анализ у AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="german_word">Немецкое слово</Label>
              <Input
                id="german_word"
                value={germanWord}
                onChange={(e) => setGermanWord(e.target.value)}
                placeholder="der Hund"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plural_form">Мн.ч. / формы</Label>
              <Input
                id="plural_form"
                value={pluralForm}
                onChange={(e) => setPluralForm(e.target.value)}
                placeholder="die Hunde"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="part_of_speech">Часть речи</Label>
              <Select value={partOfSpeech || '__none__'} onValueChange={(v) => setPartOfSpeech(v === '__none__' ? '' : v)}>
                <SelectTrigger id="part_of_speech">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— нет —</SelectItem>
                  {PARTS_OF_SPEECH.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Род (только для Nomen)</Label>
              <Select
                value={gender || '__none__'}
                onValueChange={(v) => setGender(v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="russian_translation">🇷🇺 Перевод на русский</Label>
            <Input
              id="russian_translation"
              value={russianTranslation}
              onChange={(e) => setRussianTranslation(e.target.value)}
              placeholder="собака"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kazakh_translation">🇰🇿 Перевод на казахский</Label>
            <Input
              id="kazakh_translation"
              value={kazakhTranslation}
              onChange={(e) => setKazakhTranslation(e.target.value)}
              placeholder="ит"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">📂 Категория</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Техника, Еда, Животные..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subcategories"># Подкатегории</Label>
              <Input
                id="subcategories"
                value={subcategories}
                onChange={(e) => setSubcategories(e.target.value)}
                placeholder="через запятую: Домашние, Млекопитающие"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="example_sentence">Примеры (каждый с новой строки)</Label>
            <Textarea
              id="example_sentence"
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              placeholder="Der Hund bellt laut.&#10;Ich habe einen Hund."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating || saving}
            className="w-full sm:w-auto"
          >
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Анализ...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Заново через AI
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || regenerating}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}