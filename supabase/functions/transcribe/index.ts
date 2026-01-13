import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/amr',
  'audio/x-amr',
];

const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.amr'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface TranscriptionSettings {
  language: string;
  smartFormat: boolean;
  punctuate: boolean;
  model: string;
  diarize: boolean;
}

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker: number;
}

interface DeepgramResponse {
  results?: {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
  metadata?: {
    duration: number;
    model_info?: {
      name: string;
    };
    detected_language?: string;
  };
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

function getMimeTypeFromExtension(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.amr': 'audio/amr',
  };
  return mimeMap[ext] || 'audio/wav';
}

async function transcribeWithDeepgram(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  settings: TranscriptionSettings,
  apiKey: string
): Promise<{ transcript: string; diarizedSegments: Array<{ speaker: number; text: string }> | null; metadata: Record<string, unknown> }> {
  const queryParams = new URLSearchParams({
    model: settings.model,
    language: settings.language,
    punctuate: settings.punctuate.toString(),
    smart_format: settings.smartFormat.toString(),
  });

  if (settings.diarize) {
    queryParams.append('diarize', 'true');
    queryParams.append('utterances', 'true');
  }

  const url = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;
  
  console.log(`Sending request to Deepgram: ${url}`);
  console.log(`Audio size: ${audioBuffer.byteLength} bytes, MIME type: ${mimeType}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Deepgram API error: ${response.status} - ${errorText}`);
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const data: DeepgramResponse = await response.json();
  console.log('Deepgram response received');

  let transcript = '';
  let confidence = 0;
  let diarizedSegments: Array<{ speaker: number; text: string }> | null = null;

  if (data.results?.channels?.[0]?.alternatives?.[0]) {
    const alt = data.results.channels[0].alternatives[0];
    transcript = alt.transcript;
    confidence = alt.confidence;
  }

  // Handle diarization
  if (settings.diarize && data.results?.utterances && data.results.utterances.length > 0) {
    diarizedSegments = data.results.utterances.map((utterance) => ({
      speaker: utterance.speaker,
      text: utterance.transcript,
    }));
  }

  const metadata = {
    duration: data.metadata?.duration,
    model: data.metadata?.model_info?.name || settings.model,
    detectedLanguage: data.metadata?.detected_language,
    confidence,
  };

  return { transcript, diarizedSegments, metadata };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();

  try {
    const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!apiKey) {
      console.error('DEEPGRAM_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Deepgram API key not configured. Please add DEEPGRAM_API_KEY to your backend secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const settingsJson = formData.get('settings');

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided. Please upload an audio file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file extension
    const extension = getFileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return new Response(
        JSON.stringify({ 
          error: `Unsupported file type: ${extension}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse settings
    let settings: TranscriptionSettings = {
      language: 'en',
      smartFormat: true,
      punctuate: true,
      model: 'nova-2',
      diarize: false,
    };

    if (settingsJson && typeof settingsJson === 'string') {
      try {
        settings = { ...settings, ...JSON.parse(settingsJson) };
      } catch {
        console.warn('Failed to parse settings JSON, using defaults');
      }
    }

    console.log('Transcription settings:', settings);

    // Read file buffer
    const audioBuffer = await file.arrayBuffer();
    
    // Determine MIME type
    let mimeType = file.type;
    if (!mimeType || !SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
      mimeType = getMimeTypeFromExtension(extension);
    }

    // AMR files note: Deepgram supports AMR natively, so no conversion needed
    if (extension === '.amr') {
      console.log('Processing AMR file - Deepgram supports AMR natively');
      mimeType = 'audio/amr';
    }

    // Transcribe
    const result = await transcribeWithDeepgram(audioBuffer, mimeType, settings, apiKey);
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return new Response(
      JSON.stringify({
        success: true,
        transcript: result.transcript,
        diarizedSegments: result.diarizedSegments,
        metadata: {
          ...result.metadata,
          processingTime: `${processingTime}s`,
          fileName: file.name,
          fileSize: file.size,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
