import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BookOpen,
  LogIn,
  Sparkles,
  Languages,
  Tag,
  BookMarked,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface AuthLandingProps {
  onLogin: () => void;
}

const features = [
  {
    icon: Sparkles,
    title: 'AI-анализ слов',
    description:
      'Введите немецкое слово — AI сам определит род, часть речи и множественное число.',
  },
  {
    icon: Languages,
    title: 'Два перевода',
    description: 'Автоматический перевод каждого слова на русский и казахский языки.',
  },
  {
    icon: Tag,
    title: 'Цветовые метки родов',
    description: 'Der (синий), die (красный), das (жёлтый) — роды заметны с первого взгляда.',
  },
  {
    icon: BookMarked,
    title: 'Личный словарь',
    description: 'Ваш список слов сохраняется в облаке и доступен с любого устройства.',
  },
];

export default function AuthLanding({ onLogin }: AuthLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Deutsch & Kasachisch</h1>
              <p className="text-xs text-slate-500">AI-словарь немецкого</p>
            </div>
          </div>

          <Button
            onClick={onLogin}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Войти
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/70 text-blue-700 text-xs font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Powered by AI
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-5">
            Умный словарь
            <br />
            немецкого языка
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed max-w-xl mx-auto mb-8">
            Добавляйте немецкие слова — AI автоматически определит их род, часть речи и
            переведёт на русский и казахский. Ваш личный словарик всегда под рукой.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={onLogin}
              size="lg"
              className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white shadow-md w-full sm:w-auto"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Войти и начать
            </Button>
            <Button
              onClick={onLogin}
              size="lg"
              variant="outline"
              className="h-12 px-6 !bg-transparent !hover:bg-transparent border-slate-300 text-slate-900 hover:border-slate-900 w-full sm:w-auto"
            >
              Зарегистрироваться
            </Button>
          </div>

          <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Безопасный вход через Atoms Cloud
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
          {features.map((f) => (
            <Card
              key={f.title}
              className="p-5 bg-white/70 backdrop-blur-sm border-slate-200/70 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3 shadow-sm">
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5 text-sm">{f.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{f.description}</p>
            </Card>
          ))}
        </div>

        {/* Example preview */}
        <div className="mt-16 max-w-2xl mx-auto">
          <p className="text-center text-xs uppercase tracking-wider text-slate-500 font-medium mb-4">
            Как это выглядит
          </p>
          <Card className="p-6 bg-white shadow-md border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700">
                    die
                  </span>
                  <span className="text-xs text-slate-500">Nomen (существительное)</span>
                </div>
                <h4 className="text-2xl font-bold text-slate-900">die Katze</h4>
                <p className="text-sm text-slate-500 mt-0.5">Pl.: die Katzen</p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-16">Русский:</span>
                <span className="text-slate-900 font-medium">кошка</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-16">Қазақша:</span>
                <span className="text-slate-900 font-medium">мысық</span>
              </div>
            </div>
          </Card>
        </div>

        <footer className="text-center text-xs text-slate-400 pt-16">
          Deutsch & Kasachisch · AI-powered dictionary
        </footer>
      </main>
    </div>
  );
}