import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';
import { getPronunciation, setPronunciation } from '@/lib/pronunciationCache';

const client = createClient();

interface PronounceButtonProps {
  text: string;
  className?: string;
}

export default function PronounceButton({ text, className }: PronounceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async (url: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        toast.error('Не удалось воспроизвести аудио');
      };
      setPlaying(true);
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlaying(false);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Toggle stop if already playing
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Check cache first
    const cached = getPronunciation(trimmed);
    if (cached) {
      await play(cached);
      return;
    }

    setLoading(true);
    try {
      const resp: any = await client.ai.genaudio(
        {
          text: trimmed,
          model: 'eleven_v3',
          gender: 'female',
        },
        { timeout: 60_000 },
      );
      const url = resp?.data?.url;
      if (!url) {
        toast.error('Не удалось сгенерировать произношение');
        return;
      }
      setPronunciation(trimmed, url);
      await play(url);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Ошибка генерации аудио');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleClick}
      disabled={loading}
      className={className || 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-100'}
      title="Произношение"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : playing ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </Button>
  );
}