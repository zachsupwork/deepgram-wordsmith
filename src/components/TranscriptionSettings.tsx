import { Settings, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TranscriptionSettingsData {
  language: string;
  smartFormat: boolean;
  punctuate: boolean;
  model: string;
  diarize: boolean;
}

interface TranscriptionSettingsProps {
  settings: TranscriptionSettingsData;
  onChange: (settings: TranscriptionSettingsData) => void;
  isDisabled?: boolean;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
];

const MODELS = [
  { value: 'nova-2', label: 'Nova 2 (Recommended)' },
  { value: 'nova', label: 'Nova' },
  { value: 'enhanced', label: 'Enhanced' },
  { value: 'base', label: 'Base' },
];

export function TranscriptionSettings({ settings, onChange, isDisabled }: TranscriptionSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof TranscriptionSettingsData>(
    key: K,
    value: TranscriptionSettingsData[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger 
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors",
          "hover:bg-muted/50",
          isDisabled && "opacity-50 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Transcription Settings</span>
        </div>
        <ChevronDown className={cn(
          "h-5 w-5 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="animate-accordion-down">
        <div className="mt-3 rounded-lg border border-border bg-card p-4 md:p-6 space-y-6">
          {/* Language & Model Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language" className="text-sm font-medium">
                Language
              </Label>
              <Select
                value={settings.language}
                onValueChange={(value) => updateSetting('language', value)}
                disabled={isDisabled}
              >
                <SelectTrigger id="language" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="model" className="text-sm font-medium">
                Model
              </Label>
              <Select
                value={settings.model}
                onValueChange={(value) => updateSetting('model', value)}
                disabled={isDisabled}
              >
                <SelectTrigger id="model" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Toggle Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="smartFormat" className="text-sm font-medium cursor-pointer">
                  Smart Formatting
                </Label>
                <p className="text-xs text-muted-foreground">
                  Format numbers, dates, and currency automatically
                </p>
              </div>
              <Switch
                id="smartFormat"
                checked={settings.smartFormat}
                onCheckedChange={(checked) => updateSetting('smartFormat', checked)}
                disabled={isDisabled}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="punctuate" className="text-sm font-medium cursor-pointer">
                  Punctuation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add punctuation and capitalization
                </p>
              </div>
              <Switch
                id="punctuate"
                checked={settings.punctuate}
                onCheckedChange={(checked) => updateSetting('punctuate', checked)}
                disabled={isDisabled}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="diarize" className="text-sm font-medium cursor-pointer">
                  Speaker Diarization
                </Label>
                <p className="text-xs text-muted-foreground">
                  Identify different speakers in the audio
                </p>
              </div>
              <Switch
                id="diarize"
                checked={settings.diarize}
                onCheckedChange={(checked) => updateSetting('diarize', checked)}
                disabled={isDisabled}
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
