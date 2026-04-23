import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export interface FilterState {
  search: string;
  partOfSpeech: string;
  gender: string;
  category: string;
}

interface WordFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  partOfSpeechOptions: string[];
  categoryOptions: string[];
}

export default function WordFilters({ filters, onChange, partOfSpeechOptions, categoryOptions }: WordFiltersProps) {
  const genderOptions = [
    { value: '', label: 'Все' },
    { value: 'der', label: 'der (м.)' },
    { value: 'die', label: 'die (ж.)' },
    { value: 'das', label: 'das (ср.)' },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Поиск по словам или переводам..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Часть речи</label>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={filters.partOfSpeech === '' ? 'default' : 'outline'}
              onClick={() => onChange({ ...filters, partOfSpeech: '' })}
              className="h-8 text-xs"
            >
              Все
            </Button>
            {partOfSpeechOptions.map((pos) => (
              <Button
                key={pos}
                type="button"
                size="sm"
                variant={filters.partOfSpeech === pos ? 'default' : 'outline'}
                onClick={() => onChange({ ...filters, partOfSpeech: pos })}
                className="h-8 text-xs"
              >
                {pos}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Род (для существительных)</label>
          <div className="flex flex-wrap gap-1.5">
            {genderOptions.map((g) => (
              <Button
                key={g.value}
                type="button"
                size="sm"
                variant={filters.gender === g.value ? 'default' : 'outline'}
                onClick={() => onChange({ ...filters, gender: g.value })}
                className="h-8 text-xs"
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {categoryOptions.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">📂 Категория</label>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={filters.category === '' ? 'default' : 'outline'}
              onClick={() => onChange({ ...filters, category: '' })}
              className="h-8 text-xs"
            >
              Все
            </Button>
            {categoryOptions.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={filters.category === cat ? 'default' : 'outline'}
                onClick={() => onChange({ ...filters, category: cat })}
                className="h-8 text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}