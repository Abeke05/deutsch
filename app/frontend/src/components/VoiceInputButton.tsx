import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@metagptx/web-sdk';

const client = createClient();

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function VoiceInputButton({ onTranscribed, disabled }: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        try {
          setProcessing(true);
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
          if (blob.size === 0) {
            toast.error('Запись пуста, попробуйте снова');
            return;
          }
          const dataUri = await blobToDataUri(blob);
          toast.info('Распознаю речь...', { duration: 2000 });
          const resp: any = await client.apiCall.invoke({
            url: '/api/v1/aihub/transcribe',
            method: 'POST',
            data: {
              audio: dataUri,
              model: 'scribe_v2',
            },
          });
          const text = resp?.data?.text?.trim() || '';
          if (!text) {
            toast.error('Не удалось распознать речь');
            return;
          }
          onTranscribed(text);
          toast.success('Речь распознана');
        } catch (err: any) {
          console.error(err);
          toast.error(err?.message || 'Ошибка распознавания');
        } finally {
          setProcessing(false);
          // Release mic
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      };

      mr.start();
      setRecording(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleClick = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isBusy = processing;

  return (
    <Button
      type="button"
      size="icon"
      variant={recording ? 'destructive' : 'outline'}
      onClick={handleClick}
      disabled={disabled || isBusy}
      className={`h-12 w-12 shrink-0 ${recording ? 'animate-pulse' : ''}`}
      title={recording ? 'Остановить запись' : 'Голосовой ввод'}
    >
      {isBusy ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : recording ? (
        <Square className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </Button>
  );
}