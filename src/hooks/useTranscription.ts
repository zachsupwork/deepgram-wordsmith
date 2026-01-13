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

  const transcribe = async (
    file: File,
    settings: TranscriptionSettingsData
  ): Promise<TranscriptionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('settings', JSON.stringify(settings));

      // Get the Supabase URL for the edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Backend configuration error. Please check your setup.');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed. Please try again.');
      }

      if (!data.success) {
        throw new Error(data.error || 'Transcription failed. Please try again.');
      }

      return {
        transcript: data.transcript || '',
        diarizedSegments: data.diarizedSegments || null,
        metadata: data.metadata || {},
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      throw err;
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
