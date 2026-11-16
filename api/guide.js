// Vercel serverless function: POST /api/guide
// GeoAssistant, the voice assistant for the main GeoSonix page. The browser sends what the user said plus the live state of the app;
// Claude answers in short, speakable sentences and can ask the page to do things (switch layer, go somewhere, change the date).
// Needs ANTHROPIC_API_KEY in the Vercel project settings (never in code). Optional: ANTHROPIC_MODEL (default claude-haiku-5-5).

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const SYSTEM = `You are GeoAssistant, the voice assistant inside "GeoSonix", a web app that lets blind and low-vision people (and anyone) explore NASA Earth satellite data by sound. Your replies are spoken aloud, so keep them VERY SHORT: ONE sentence of under 20 words. Add a second short sentence only if the answer truly needs it, and never go over 35 words in total, even if asked for detail (the user can ask a follow-up). Do not restate the user's location, layer or date unless they asked for it. No lists, no markdown, no emoji.

How the app works:
- The user walks a map of the whole world with the arrow keys or W A S D (Shift = faster; on touch, drag on the map). They always face north.
- A soft pulse plays from Null Island (0 degrees north, 0 east), where the equator meets the prime meridian. It pans left or right to show which side home is on and gets quieter with distance.
- One instrument per map layer plays the data under them, louder and brighter where the data is stronger. Layers: 1 Rain (violin, NASA GPM IMERG), 2 Land heat (cello, MODIS), 3 Plants (flute, MODIS vegetation), 4 Ocean heat (clarinet, GHRSST sea temperature), 5 Wind (breeze, MERRA-2 monthly average wind speed), 6 Earth Orchestra (all layers at once). Number keys switch layers.
- Keys: H = hear where I am and what is playing; O = hear how far home (Null Island) is and which compass direction; L = which layer; V = flat map or 3D terrain; M = mute; T = go back to 2006 (the same day 20 years earlier); comma and period = one day back or forward (Shift for a week, up to 30 days back); 7, 8, 9, 0 = sample sounds from light to extreme; N = voice; I = replay intro; B = vibration; G = GeoAssistant (you). NASA publishes daily frames, so there are no forecasts and nothing is live to the hour.
- Satellites cannot see through clouds for some layers, so gaps are silent.

Rules:
- Ground every statement about the data in the "context" you are given. Never invent a value. General science is fine, but say it is general knowledge.
- To do something for the user, call a tool and say what you did in under 8 words, like "Taking you to Cairo." Never read out coordinates or numbers you used for a tool. To go to a place, call go_to_place with accurate coordinates (lat north positive, lon east positive).
- If asked how to move or use the app, explain simply using the keys above.
- If you cannot do something, say so plainly and suggest the closest thing the app can do.`;

const TOOLS = [
  {
    name: 'switch_layer',
    description: 'Switch the map layer. "all" is the Earth Orchestra (every layer at once).',
    input_schema: { type: 'object', properties: { layer: { type: 'string', enum: ['rain', 'heat', 'plants', 'ocean', 'wind', 'all'] } }, required: ['layer'] },
  },
  {
    name: 'go_to_place',
    description: 'Move the user to a place on the map.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short spoken name of the place' },
        lat: { type: 'number', description: 'Latitude, -90..90 (north positive)' },
        lon: { type: 'number', description: 'Longitude, -180..180 (east positive)' },
      },
      required: ['name', 'lat', 'lon'],
    },
  },
  {
    name: 'go_home',
    description: 'Move the user to Null Island (0, 0), where the pulse plays from.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'change_date',
    description: 'Step the data back (negative) or forward (positive) in days. The newest day is the most recent; at most 30 days back.',
    input_schema: { type: 'object', properties: { steps: { type: 'integer' } }, required: ['steps'] },
  },
  {
    name: 'set_then_and_now',
    description: 'Go back to 2006 (hear the same day 20 years earlier) when on is true; return to today when false.',
    input_schema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
  },
  {
    name: 'set_view',
    description: 'Show the 3D terrain or the flat map.',
    input_schema: { type: 'object', properties: { mode: { type: 'string', enum: ['3d', 'flat'] } }, required: ['mode'] },
  },
  {
    name: 'set_muted',
    description: 'Mute or unmute the app sound.',
    input_schema: { type: 'object', properties: { muted: { type: 'boolean' } }, required: ['muted'] },
  },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const from = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (from && host && !from.includes(host)) return res.status(403).json({ error: 'not allowed' });   // only our own pages
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const message = String(body.message || '').slice(0, 400);
  if (!message.trim()) return res.status(400).json({ error: 'empty message' });
  const context = JSON.stringify(body.context || {}).slice(0, 3000);

  const messages = [];                                   // a few earlier turns so follow-ups work
  for (const h of Array.isArray(body.history) ? body.history.slice(-6) : []) {
    const role = h && h.role === 'assistant' ? 'assistant' : 'user';
    const text = String((h && h.text) || '').slice(0, 300);
    if (!text) continue;
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += '\n' + text;
    else messages.push({ role, content: text });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const turn = `Context (live app state, JSON): ${context}\n\nUser said: ${message}`;
  if (messages.length && messages[messages.length - 1].role === 'user') messages[messages.length - 1].content += '\n\n' + turn;
  else messages.push({ role: 'user', content: turn });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, thinking: { type: 'disabled' }, system: SYSTEM, tools: TOOLS, messages }),   // no hidden thinking: it used up the whole budget and left no answer
    });
    if (!r.ok) return res.status(502).json({ error: 'Claude API error', status: r.status });
    const j = await r.json();
    const content = Array.isArray(j.content) ? j.content : [];
    let reply = content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    // never speak half a sentence: if the answer was cut off, end it at the last full stop
    if (j.stop_reason === 'max_tokens') { const end = Math.max(reply.lastIndexOf('. '), reply.lastIndexOf('? '), reply.lastIndexOf('! ')); if (end > 0) reply = reply.slice(0, end + 1); }
    const actions = content.filter(b => b.type === 'tool_use').map(b => ({ tool: b.name, input: b.input }));
    return res.status(200).json({ reply, actions, stop: j.stop_reason, blocks: content.map(b => b.type), out_tokens: j.usage && j.usage.output_tokens });
  } catch (e) {
    return res.status(500).json({ error: 'guide failed' });
  }
};
