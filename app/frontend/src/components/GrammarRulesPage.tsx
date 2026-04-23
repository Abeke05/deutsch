import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@metagptx/web-sdk';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ScrollText, Sparkles, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { analyzeGrammarRule } from '@/lib/grammarAnalyzer';
import GrammarRuleCard, { GrammarRule } from './GrammarRuleCard';

const client = createClient();

// Quick-pick rules to suggest to the user
const SUGGESTED_RULES = [
  'Akkusativ',
  'Dativ',
  'Genitiv',
  'Perfekt',
  'Präteritum',
  'Modalverben',
  'Trennbare Verben',
  'Bestimmter Artikel',
  'Nebensatz mit weil',
  'Nebensatz mit dass',
  'Passiv',
  'Konjunktiv II',
  'Adjektivdeklination',
  'Reflexive Verben',
];

export default function GrammarRulesPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<GrammarRule[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [draft, setDraft] = useState<GrammarRule | null>(null); // unsaved AI result
  const [savingDraft, setSavingDraft] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchSaved, setSearchSaved] = useState('');
  const draftRef = useRef<HTMLDivElement | null>(null);

  const loadRules = useCallback(async () => {
    setListLoading(true);
    try {
      const resp = await client.entities.grammar_rules.query({
        sort: '-created_at',
        limit: 500,
      });
      const items = (resp as any).data?.items || [];
      setRules(items);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const handleExplain = async (input?: string) => {
    const text = (input ?? query).trim();
    if (!text) {
      toast.error('Введите название правила');
      return;
    }

    // Check if already saved
    const existing = rules.find(
      (r) => normalize(r.rule_name) === normalize(text),
    );
    if (existing) {
      toast.success(`Правило "${existing.rule_name}" уже сохранено — показываю`);
      setDraft(null);
      setQuery(text);
      // Scroll to the saved card
      setTimeout(() => {
        const el = document.getElementById(`rule-${existing.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }

    setLoading(true);
    setDraft(null);
    try {
      toast.info('AI готовит объяснение...', { duration: 2000 });
      const analysis = await analyzeGrammarRule(text);

      // Post-check against canonical name
      const existing2 = rules.find(
        (r) => normalize(r.rule_name) === normalize(analysis.rule_name),
      );
      if (existing2) {
        toast.success(`Правило "${existing2.rule_name}" уже сохранено — показываю`);
        setTimeout(() => {
          const el = document.getElementById(`rule-${existing2.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return;
      }

      // Show as unsaved draft at the top
      setDraft({
        id: -1,
        rule_name: analysis.rule_name,
        explanation_ru: analysis.explanation_ru,
        explanation_kz: analysis.explanation_kz,
        examples: analysis.examples,
        category: analysis.category,
      });
      setQuery(analysis.rule_name);
      setTimeout(() => {
        draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось получить объяснение');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    setSavingDraft(true);
    try {
      await client.entities.grammar_rules.create({
        data: {
          rule_name: draft.rule_name,
          explanation_ru: draft.explanation_ru,
          explanation_kz: draft.explanation_kz,
          examples: draft.examples,
          category: draft.category || '',
        },
      });
      toast.success(`Правило "${draft.rule_name}" сохранено`);
      setDraft(null);
      setQuery('');
      loadRules();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось сохранить правило');
    } finally {
      setSavingDraft(false);
    }
  };

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rules.forEach((r) => {
      if (r.category) counts.set(r.category, (counts.get(r.category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cat]) => cat);
  }, [rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterCategory && r.category !== filterCategory) return false;
      if (searchSaved) {
        const q = searchSaved.toLowerCase();
        const haystack = `${r.rule_name} ${r.category || ''} ${r.explanation_ru}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rules, filterCategory, searchSaved]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExplain();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <ScrollText className="w-7 h-7 text-indigo-600" />
          Грамматика немецкого
        </h2>
        <p className="text-slate-600">
          Введите название правила — AI объяснит его на <strong>русском</strong> и <strong>казахском</strong> языках с примерами на немецком.
        </p>
      </div>

      {/* Ask form */}
      <Card className="p-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-indigo-200 shadow-lg">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Напр.: Akkusativ, Perfekt, Modalverben, придаточное с weil..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="pl-10 h-12 text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Объясняю...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Объяснить
              </>
            )}
          </Button>
        </form>

        {/* Quick suggestions */}
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">💡 Популярные темы:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_RULES.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery(r);
                  handleExplain(r);
                }}
                disabled={loading}
                className="h-7 text-xs bg-white/60 hover:bg-white"
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Draft (unsaved AI result) */}
      {draft && (
        <div ref={draftRef} className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                AI-объяснение (не сохранено)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft(null)}
                disabled={savingDraft}
              >
                Скрыть
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить в мои правила
                  </>
                )}
              </Button>
            </div>
          </div>
          <GrammarRuleCard rule={draft} onDeleted={() => setDraft(null)} highlight />
        </div>
      )}

      {/* Saved rules list */}
      {rules.length > 0 && (
        <Card className="p-5 bg-white space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Поиск по сохранённым правилам..."
              value={searchSaved}
              onChange={(e) => setSearchSaved(e.target.value)}
              className="pl-10"
            />
          </div>
          {categoryOptions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">📚 Категория</label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={filterCategory === '' ? 'default' : 'outline'}
                  onClick={() => setFilterCategory('')}
                  className="h-8 text-xs"
                >
                  Все
                </Button>
                {categoryOptions.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={filterCategory === cat ? 'default' : 'outline'}
                    onClick={() => setFilterCategory(cat)}
                    className="h-8 text-xs"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Мои правила{' '}
            <span className="text-slate-500 font-normal">
              ({filteredRules.length}
              {filteredRules.length !== rules.length ? ` из ${rules.length}` : ''})
            </span>
          </h3>
        </div>

        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredRules.length === 0 ? (
          <Card className="p-12 text-center bg-white border-dashed">
            <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {rules.length === 0
                ? 'Пока нет сохранённых правил. Спросите AI о любом правиле выше — и сохраните его сюда!'
                : 'Ничего не найдено по заданным фильтрам.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRules.map((rule) => (
              <div key={rule.id} id={`rule-${rule.id}`}>
                <GrammarRuleCard rule={rule} onDeleted={loadRules} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}