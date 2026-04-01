import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-audio-settings, x-file-name, x-file-size',
};

const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.amr'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const MIME_MAP: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.amr': 'audio/amr',
};

interface TranscriptionSettings {
  language: string;
  smartFormat: boolean;
  punctuate: boolean;
  model: string;
  diarize: boolean;
}

serve(async (req) => {
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

    // Read metadata from headers (avoids parsing multipart FormData into memory)
    const fileName = req.headers.get('x-file-name') || 'audio.wav';
    const fileSize = parseInt(req.headers.get('x-file-size') || '0', 10);
    const settingsJson = req.headers.get('x-audio-settings') || '{}';

    console.log(`Received file: ${fileName}, size: ${fileSize}`);

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is 500MB. Your file is ${(fileSize / (1024 * 1024)).toFixed(1)}MB.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file extension
    const lastDot = fileName.lastIndexOf('.');
    const extension = lastDot !== -1 ? fileName.slice(lastDot).toLowerCase() : '';
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${extension}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}` }),
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

    try {
      settings = { ...settings, ...JSON.parse(settingsJson) };
    } catch {
      console.warn('Failed to parse settings JSON, using defaults');
    }

    console.log('Transcription settings:', settings);

    // Build Deepgram URL
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

    const mimeType = MIME_MAP[extension] || 'audio/wav';
    const deepgramUrl = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;

    console.log(`Streaming to Deepgram: ${deepgramUrl}, MIME: ${mimeType}`);

    // Stream the request body directly to Deepgram — no buffering in memory
    const dgResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: req.body, // pass through the readable stream directly
    });

    if (!dgResponse.ok) {
      const errorText = await dgResponse.text();
      console.error(`Deepgram API error: ${dgResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Deepgram API error: ${dgResponse.status} - ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await dgResponse.json();
    console.log('Deepgram response received successfully');

    let transcript = '';
    let confidence = 0;
    let diarizedSegments: Array<{ speaker: number; text: string }> | null = null;

    if (data.results?.channels?.[0]?.alternatives?.[0]) {
      const alt = data.results.channels[0].alternatives[0];
      transcript = alt.transcript;
      confidence = alt.confidence;
    }

    if (settings.diarize && data.results?.utterances?.length > 0) {
      diarizedSegments = data.results.utterances.map((u: any) => ({
        speaker: u.speaker,
        text: u.transcript,
      }));
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        diarizedSegments,
        metadata: {
          duration: data.metadata?.duration,
          model: data.metadata?.model_info?.name || settings.model,
          detectedLanguage: data.metadata?.detected_language,
          confidence,
          processingTime: `${processingTime}s`,
          fileName,
          fileSize,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
