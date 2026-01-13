import { useCallback, useState, useRef } from 'react';
import { Upload, File, X, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  isDisabled?: boolean;
}

const ACCEPTED_TYPES = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.amr'];
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function FileUpload({ onFileSelect, selectedFile, onClear, isDisabled }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(extension)) {
      return `Unsupported file type. Please upload: ${ACCEPTED_TYPES.join(', ')}`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    
    // Create audio URL for preview
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    
    onFileSelect(file);
  }, [validateFile, onFileSelect, audioUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClear = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear();
  }, [audioUrl, onClear]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (selectedFile) {
    return (
      <div className="animate-fade-in rounded-xl border-2 border-primary/20 bg-card p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Music2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{selectedFile.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={isDisabled}
                className="shrink-0 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {audioUrl && (
              <audio 
                controls 
                className="w-full mt-4 h-10 rounded-lg"
                src={audioUrl}
              >
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 md:p-12 transition-all duration-300 cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragOver 
            ? "border-primary bg-primary/10 scale-[1.02]" 
            : "border-muted-foreground/25 bg-muted/30",
          error && "border-destructive/50 bg-destructive/5"
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center text-center">
          <div className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-all",
            isDragOver 
              ? "bg-primary/20 text-primary scale-110" 
              : "bg-muted text-muted-foreground"
          )}>
            <Upload className="h-8 w-8" />
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {isDragOver ? "Drop your audio file" : "Upload audio file"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop or click to browse
          </p>
          
          <Button variant="outline" size="sm" className="gap-2">
            <File className="h-4 w-4" />
            Browse files
          </Button>
          
          <div className="mt-6 pt-4 border-t border-border/50 w-full">
            <p className="text-xs text-muted-foreground">
              Supported: <span className="font-medium">WAV, MP3, M4A, AAC, OGG, AMR</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max size: <span className="font-medium">{MAX_SIZE_MB}MB</span>
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-destructive animate-fade-in px-1">
          {error}
        </p>
      )}
    </div>
  );
}
