import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-audio-settings, x-file-name, x-file-size, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
    console.log(`[transcribe:${requestId}] Request received`, {
      contentType: req.headers.get('content-type'),
      contentLength: req.headers.get('content-length'),
      hasApiKey: Boolean(apiKey),
    });

    if (!apiKey) {
      console.error(`[transcribe:${requestId}] DEEPGRAM_API_KEY not configured`);
      return jsonResponse(
        { error: 'Deepgram API key not configured. Please add DEEPGRAM_API_KEY to your backend secrets.', requestId },
        500
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let fileName = req.headers.get('x-file-name') || 'audio.wav';
    let fileSize = parseInt(req.headers.get('x-file-size') || '0', 10);
    let settingsJson = req.headers.get('x-audio-settings') || '{}';
    let requestBody: ReadableStream<Uint8Array> | null = req.body;
    let incomingMimeType = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const uploadedFile = formData.get('file');
      const settingsField = formData.get('settings');

      if (!(uploadedFile instanceof File)) {
        return jsonResponse({ error: 'No audio file uploaded. Expected a file field named "file".', requestId }, 400);
      }

      fileName = uploadedFile.name || fileName;
      fileSize = uploadedFile.size;
      settingsJson = typeof settingsField === 'string' ? settingsField : settingsJson;
      requestBody = uploadedFile.stream();
      incomingMimeType = uploadedFile.type;
    }

    console.log(`[transcribe:${requestId}] Upload metadata`, { fileName, fileSize, contentType, incomingMimeType });

    if (!requestBody) {
      return jsonResponse({ error: 'Request body is empty.', requestId }, 400);
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return jsonResponse(
        { error: `File too large. Maximum size is 500MB. Your file is ${(fileSize / (1024 * 1024)).toFixed(1)}MB.`, requestId },
        400
      );
    }

    // Validate file extension
    const lastDot = fileName.lastIndexOf('.');
    const extension = lastDot !== -1 ? fileName.slice(lastDot).toLowerCase() : '';
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return jsonResponse(
        { error: `Unsupported file type: ${extension}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`, requestId },
        400
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
    } catch (error) {
      console.warn(`[transcribe:${requestId}] Failed to parse settings JSON, using defaults`, error);
    }

    console.log(`[transcribe:${requestId}] Transcription settings`, settings);

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

    const mimeType = incomingMimeType || MIME_MAP[extension] || 'application/octet-stream';
    const deepgramUrl = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;

    console.log(`[transcribe:${requestId}] Forwarding to Deepgram`, {
      deepgramUrl,
      mimeType,
      fileName,
      fileSize,
    });

    // Stream the request body directly to Deepgram — no buffering in memory
    const dgResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: requestBody,
      signal: AbortSignal.timeout(290000),
    });

    console.log(`[transcribe:${requestId}] Deepgram status`, dgResponse.status);

    if (!dgResponse.ok) {
      const errorText = await dgResponse.text();
      console.error(`[transcribe:${requestId}] Deepgram API error`, {
        status: dgResponse.status,
        body: errorText,
      });
      return jsonResponse(
        {
          error: `Deepgram API error: ${dgResponse.status}`,
          details: errorText,
          requestId,
        },
        502
      );
    }

    const responseText = await dgResponse.text();
    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error(`[transcribe:${requestId}] Failed to parse Deepgram response`, {
        error,
        responseText,
      });
      return jsonResponse(
        {
          error: 'Deepgram returned an invalid JSON response.',
          details: responseText,
          requestId,
        },
        502
      );
    }

    console.log(`[transcribe:${requestId}] Deepgram response received successfully`);

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

    console.log(`[transcribe:${requestId}] Transcription completed`, {
      processingTime,
      transcriptLength: transcript.length,
      diarizedSegments: diarizedSegments?.length || 0,
    });

    return jsonResponse({
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
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = error instanceof Error && error.name === 'TimeoutError' ? 504 : 500;
    console.error(`[transcribe:${requestId}] Transcription error`, error);
    return jsonResponse({ error: errorMessage, requestId }, status);
  }
});
