import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TranscriptionSettingsData } from '@/components/TranscriptionSettings';

interface DiarizedSegment {
  speaker: number;
  text: string;
}

interface TranscriptionMetadata {
  processingTime?: string;
  detectedLanguage?: string;
  confidence?: number;
  model?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
}

interface TranscriptionResult {
  transcript: string;
  diarizedSegments: DiarizedSegment[] | null;
  metadata: TranscriptionMetadata;
}

interface UseTranscriptionReturn {
  transcribe: (file: File, settings: TranscriptionSettingsData) => Promise<TranscriptionResult>;
  isLoading: boolean;
  error: string | null;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeResponse = (data: unknown) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return { error: data };
      }
    }

    return data;
  };

  const transcribe = async (
    file: File,
    settings: TranscriptionSettingsData
  ): Promise<TranscriptionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transcribe', {
        headers: {
          'x-file-name': file.name,
          'x-file-size': file.size.toString(),
          'x-audio-settings': JSON.stringify(settings),
        },
        body: file,
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Transcription failed. Please try again.');
      }

      const payload = normalizeResponse(data) as {
        success?: boolean;
        error?: string;
        transcript?: string;
        diarizedSegments?: DiarizedSegment[] | null;
        metadata?: TranscriptionMetadata;
      } | null;

      if (!payload) {
        throw new Error('Empty response from transcription service.');
      }

      if (!payload.success) {
        throw new Error(payload.error || 'Transcription failed. Please try again.');
      }

      return {
        transcript: payload.transcript || '',
        diarizedSegments: payload.diarizedSegments || null,
        metadata: payload.metadata || {},
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    transcribe,
    isLoading,
    error,
  };
}
