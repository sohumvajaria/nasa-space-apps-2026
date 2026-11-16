// Vercel serverless function: GET /api/tts?text=...  ->  streamed audio/mpeg
// Turns the app's short announcements into speech with a calm, natural neural voice.
//
// The audio is STREAMED: the first bytes reach the browser while the rest is still being generated, and the page
// starts playing as soon as it has enough, so the voice starts quickly. Each phrase is also cached by Vercel's CDN
// and the browser, so a phrase is only generated once.
//
// Setup (add ONE key in Vercel: Project -> Settings -> Environment Variables, then redeploy):
//   ELEVENLABS_API_KEY   from elevenlabs.io (profile -> API keys). Uses the "Flash v2.5" model: very natural and
//                        about 75 ms to first audio, the best mix of quality and speed.
//     optional ELEVENLABS_VOICE_ID  a calm voice from the ElevenLabs voice library
//     optional ELEVENLABS_MODEL     default "eleven_flash_v2_5"; "eleven_turbo_v2_5" sounds a little richer, a bit slower
//   OPENAI_API_KEY       from platform.openai.com/api-keys. Uses gpt-4o-mini-tts: steerable, calm, a little slower to start.
//     optional OPENAI_TTS_VOICE  (default "shimmer"; also try "sage", "coral", "nova")
//   If both keys are set, ElevenLabs is used. Set TTS_PROVIDER=openai to prefer OpenAI instead.
// Without a key this answers 503 and the page uses the browser's own voice instead.
// GET /api/tts?probe=1 answers 204 if a voice is set up and 503 if not (free; the page asks once on load).
// Never put a key in the code or in git.

const { Readable } = require('stream');

const INSTRUCTIONS =
  'Voice: a soft, soothing, close-up ASMR narrator. Tone: calm, warm and reassuring. ' +
  'Delivery: gentle and slow with a relaxed, slightly breathy quality and natural pauses, almost a whisper ' +
  'but always clear and easy to understand. Never loud, never rushed, never dramatic.';

function pickProvider() {
  const want = (process.env.TTS_PROVIDER || '').toLowerCase();
  if (want === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (want === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

const VOICES = ['shimmer', 'onyx', 'sage'];   // the three styles listeners can choose (OpenAI): warm, deep, calm

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const provider = pickProvider();
  const q = req.query || {};
  if (q.probe) return provider ? res.status(204).end() : res.status(503).json({ error: 'No voice API key is set on the server' });

  const text = String(q.text || '').trim().slice(0, 400);
  if (!text) return res.status(400).json({ error: 'no text' });

  // only our own pages may use this (it costs money per request)
  const from = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (from && host && !from.includes(host)) return res.status(403).json({ error: 'not allowed' });
  if (!provider) return res.status(503).json({ error: 'No voice API key is set on the server' });

  try {
    let r;
    if (provider === 'elevenlabs') {
      const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5',
          voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: false },   // steady and calm
        }),
      });
    } else {
      r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
          voice: VOICES.includes(q.voice) ? q.voice : (process.env.OPENAI_TTS_VOICE || 'shimmer'),
          input: text, instructions: INSTRUCTIONS, response_format: 'mp3',
        }),
      });
    }
    if (!r.ok || !r.body) return res.status(502).json({ error: 'voice service error', status: r.status, detail: (await r.text()).slice(0, 300) });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    const stream = Readable.fromWeb(r.body);
    stream.on('error', () => res.end());       // if the voice service drops mid-way, end cleanly instead of hanging
    stream.pipe(res);                          // forward the audio as it arrives
  } catch (e) {
    if (!res.headersSent) return res.status(500).json({ error: 'voice failed', detail: String(e).slice(0, 200) });
    res.end();
  }
};
