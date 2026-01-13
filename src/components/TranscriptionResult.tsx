import { useState } from 'react';
import { Copy, Download, Trash2, Check, Clock, Languages, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

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
}

interface TranscriptionResultProps {
  transcript: string;
  diarizedSegments: DiarizedSegment[] | null;
  metadata: TranscriptionMetadata;
  onClear: () => void;
}

export function TranscriptionResult({ 
  transcript, 
  diarizedSegments, 
  metadata, 
  onClear 
}: TranscriptionResultProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getDisplayText = (): string => {
    if (diarizedSegments && diarizedSegments.length > 0) {
      return diarizedSegments
        .map((seg) => `Speaker ${seg.speaker + 1}: ${seg.text}`)
        .join('\n\n');
    }
    return transcript;
  };

  const displayText = getDisplayText();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Transcript copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([displayText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = metadata.fileName?.replace(/\.[^/.]+$/, '') || 'transcript';
    a.download = `${baseName}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: "Transcript saved as text file",
    });
  };

  const confidencePercent = metadata.confidence 
    ? (metadata.confidence * 100).toFixed(1) 
    : null;

  return (
    <div className="animate-slide-up space-y-4">
      {/* Metadata Bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        {metadata.processingTime && (
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
            <Clock className="h-3.5 w-3.5" />
            <span>{metadata.processingTime}</span>
          </div>
        )}
        {metadata.detectedLanguage && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-accent">
            <Languages className="h-3.5 w-3.5" />
            <span>{metadata.detectedLanguage.toUpperCase()}</span>
          </div>
        )}
        {confidencePercent && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>{confidencePercent}% confidence</span>
          </div>
        )}
        {metadata.model && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <span className="font-medium">{metadata.model}</span>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="relative">
        <Textarea
          value={displayText}
          readOnly
          className="min-h-[300px] resize-y bg-card text-base leading-relaxed font-normal"
          placeholder="Your transcript will appear here..."
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download .txt
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
