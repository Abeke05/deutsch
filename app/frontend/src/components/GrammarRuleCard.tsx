import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import PronounceButton from './PronounceButton';

const client = createClient();

export interface GrammarRule {
  id: number;
  rule_name: string;
  explanation_ru: string;
  explanation_kz: string;
  examples: string;
  category?: string;
}

interface GrammarRuleCardProps {
  rule: GrammarRule;
  onDeleted: () => void;
  highlight?: boolean;
}

function splitExample(line: string): { german: string; translation: string } {
  // Match pattern "German text. (translation)" at the end
  const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { german: match[1].trim(), translation: match[2].trim() };
  }
  return { german: line.trim(), translation: '' };
}

function GrammarRuleCardInner({ rule, onDeleted, highlight }: GrammarRuleCardProps) {
  const examples = (rule.examples || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleDelete = async () => {
    try {
      await client.entities.grammar_rules.delete({ id: String(rule.id) });
      toast.success('Правило удалено');
      onDeleted();
    } catch {
      toast.error('Не удалось удалить правило');
    }
  };

  return (
    <Card
      className={`p-5 transition-all duration-200 hover:shadow-lg ${
        highlight
          ? 'bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-indigo-300 shadow-md'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {rule.category && (
              <Badge variant="outline" className="text-xs bg-white/70 border-indigo-200 text-indigo-700">
                📚 {rule.category}
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
              {rule.rule_name}
            </h3>
            <PronounceButton text={rule.rule_name} />
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors shrink-0"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {rule.explanation_ru && (
        <div className="mt-3 pt-3 border-t border-slate-200/70">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            🇷🇺 Объяснение (русский)
          </p>
          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">
            {rule.explanation_ru}
          </p>
        </div>
      )}

      {rule.explanation_kz && (
        <div className="mt-3 pt-3 border-t border-slate-200/70">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            🇰🇿 Түсіндірме (қазақша)
          </p>
          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">
            {rule.explanation_kz}
          </p>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/70">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            📝 Beispiele (немецкие примеры)
          </p>
          <ul className="space-y-2">
            {examples.map((ex, idx) => {
              const { german, translation } = splitExample(ex);
              return (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-slate-400 text-sm mt-1">•</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-slate-900 font-medium text-sm italic">{german}</span>
                      <PronounceButton
                        text={german}
                        className="h-6 w-6 shrink-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100"
                      />
                    </div>
                    {translation && (
                      <p className="text-xs text-slate-500 mt-0.5">— {translation}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

const GrammarRuleCard = memo(GrammarRuleCardInner, (prev, next) => {
  const r1 = prev.rule;
  const r2 = next.rule;
  return (
    r1.id === r2.id &&
    r1.rule_name === r2.rule_name &&
    r1.explanation_ru === r2.explanation_ru &&
    r1.explanation_kz === r2.explanation_kz &&
    r1.examples === r2.examples &&
    r1.category === r2.category &&
    prev.highlight === next.highlight &&
    prev.onDeleted === next.onDeleted
  );
});

export default GrammarRuleCard;