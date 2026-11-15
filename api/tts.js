// Vercel serverless function: GET /api/tts?text=...  ->  audio/mpeg
// Turns the app's short announcements into speech with a calm, soft, human-sounding voice.
//
// Setup (pick ONE provider; add the key in Vercel: Project -> Settings -> Environment Variables, then redeploy):
//   OPENAI_API_KEY      from platform.openai.com/api-keys (recommended: steerable "ASMR" delivery, very cheap)
//     optional OPENAI_TTS_VOICE   (default "shimmer"; also try "sage", "coral", "nova")
//   ELEVENLABS_API_KEY  from elevenlabs.io (profile -> API keys); used only if no OpenAI key is set
//     optional ELEVENLABS_VOICE_ID (a calm voice from the ElevenLabs voice library)
// Without a key this answers 503 and the page uses the browser's own voice instead.
// Never put a key in the code or in git. Successful answers are cached by Vercel's CDN, so each phrase is made once.

const INSTRUCTIONS =
  'Voice: a soft, soothing, close-up ASMR narrator. Tone: calm, warm and reassuring. ' +
  'Delivery: gentle and slow with a relaxed, slightly breathy quality and natural pauses, almost a whisper ' +
  'but always clear and easy to understand. Never loud, never rushed, never dramatic.';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const text = String((req.query && req.query.text) || '').trim().slice(0, 400);
  if (!text) return res.status(400).json({ error: 'no text' });

  // only our own pages may use this (it costs money per request)
  const from = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (from && host && !from.includes(host)) return res.status(403).json({ error: 'not allowed' });

  try {
    let r;
    if (process.env.OPENAI_API_KEY) {
      r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
          voice: process.env.OPENAI_TTS_VOICE || 'shimmer',
          input: text, instructions: INSTRUCTIONS, response_format: 'mp3',
        }),
      });
    } else if (process.env.ELEVENLABS_API_KEY) {
      const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
          voice_settings: { stability: 0.75, similarity_boost: 0.75, style: 0.1 },   // steady and calm
        }),
      });
    } else {
      return res.status(503).json({ error: 'No voice API key is set on the server' });
    }
    if (!r.ok) return res.status(502).json({ error: 'voice service error', status: r.status, detail: (await r.text()).slice(0, 300) });
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    return res.status(200).send(audio);
  } catch (e) {
    return res.status(500).json({ error: 'voice failed', detail: String(e).slice(0, 200) });
  }
};
