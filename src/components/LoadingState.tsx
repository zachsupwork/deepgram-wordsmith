import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  fileName: string;
}

export function LoadingState({ fileName }: LoadingStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center py-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
      
      <h3 className="mt-6 text-lg font-semibold text-foreground">
        Transcribing audio...
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Processing <span className="font-medium">{fileName}</span>
      </p>
      
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <span>This may take a moment for longer files</span>
      </div>
    </div>
  );
}
