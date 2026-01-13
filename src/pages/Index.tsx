import { useState } from 'react';
import { Mic2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { TranscriptionSettings, TranscriptionSettingsData } from '@/components/TranscriptionSettings';
import { TranscriptionResult } from '@/components/TranscriptionResult';
import { LoadingState } from '@/components/LoadingState';
import { useTranscription } from '@/hooks/useTranscription';
import { useToast } from '@/hooks/use-toast';

interface TranscriptionData {
  transcript: string;
  diarizedSegments: { speaker: number; text: string }[] | null;
  metadata: {
    processingTime?: string;
    detectedLanguage?: string;
    confidence?: number;
    model?: string;
    fileName?: string;
    fileSize?: number;
  };
}

export default function Index() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<TranscriptionSettingsData>({
    language: 'en',
    smartFormat: true,
    punctuate: true,
    model: 'nova-2',
    diarize: false,
  });
  const [result, setResult] = useState<TranscriptionData | null>(null);
  
  const { transcribe, isLoading, error } = useTranscription();
  const { toast } = useToast();

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    try {
      const transcriptionResult = await transcribe(selectedFile, settings);
      setResult(transcriptionResult);
      toast({
        title: "Transcription complete!",
        description: "Your audio has been successfully transcribed.",
      });
    } catch (err) {
      toast({
        title: "Transcription failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setResult(null);
  };

  const handleFileClear = () => {
    setSelectedFile(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen gradient-surface">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-bg shadow-soft">
              <Mic2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audio Transcriber</h1>
              <p className="text-xs text-muted-foreground">Powered by Deepgram</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Hero Section */}
          <div className="text-center mb-8 md:mb-12 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Convert Audio to Text
            </h2>
            <p className="text-muted-foreground text-lg">
              Upload your audio file and get accurate transcriptions in seconds
            </p>
          </div>

          {/* Main Card */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 shadow-soft animate-scale-in">
            {isLoading ? (
              <LoadingState fileName={selectedFile?.name || 'audio'} />
            ) : result ? (
              <TranscriptionResult
                transcript={result.transcript}
                diarizedSegments={result.diarizedSegments}
                metadata={result.metadata}
                onClear={handleClear}
              />
            ) : (
              <div className="space-y-6">
                {/* File Upload */}
                <FileUpload
                  onFileSelect={setSelectedFile}
                  selectedFile={selectedFile}
                  onClear={handleFileClear}
                  isDisabled={isLoading}
                />

                {/* Settings */}
                <TranscriptionSettings
                  settings={settings}
                  onChange={setSettings}
                  isDisabled={isLoading || !selectedFile}
                />

                {/* Transcribe Button */}
                {selectedFile && (
                  <Button
                    onClick={handleTranscribe}
                    disabled={isLoading}
                    size="lg"
                    className="w-full gradient-bg hover:opacity-90 transition-opacity gap-2 h-12 text-base font-semibold shadow-glow"
                  >
                    <Sparkles className="h-5 w-5" />
                    Transcribe Audio
                  </Button>
                )}

                {/* Error Display */}
                {error && !isLoading && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive animate-fade-in">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              Supports WAV, MP3, M4A, AAC, OGG, and AMR formats up to 50MB
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
