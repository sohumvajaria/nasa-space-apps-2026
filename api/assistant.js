// Vercel serverless function: POST /api/assistant
// The browser sends what the user said plus where they are on the map; Claude answers in short,
// speakable sentences and can use "tools" to move the user, pick smart targets, or change settings.
// The browser carries out those tool calls (see runAiAction in src/navigator.js).
//
// Setup: in the Vercel dashboard, Project -> Settings -> Environment Variables, add
//   ANTHROPIC_API_KEY = your key from console.anthropic.com   (never put it in the code or in git)
// Optional: ANTHROPIC_MODEL (defaults to claude-haiku-5-5, which is fast and cheap).
// Set a monthly spend limit in the Anthropic console: this endpoint is public once deployed.
// This file adds a best-effort per-visitor and global rate limit, but a spend limit is the real safeguard.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const SYSTEM = `You are the voice guide inside "Earth Jukebox", a web app that lets blind and low-vision people explore NASA Earth data by sound.
The user moves a cursor over a world map with arrow keys. The equator and prime meridian are the axes; (0, 0) is home.
The map can show six data layers: the EIC ocean temperature year (March 2007 to February 2008), and daily NASA layers for rain, land heat, plants, ocean temperature today, and haze.
A steady tone's pitch is the data value where they are (higher = warmer water, heavier rain, hotter ground, denser plants or thicker haze).
A metronome ticks faster as they get closer to their target and comes from the target's direction.

Rules:
- Everything you write is read aloud. Use at most 3 short sentences (under 60 words). No markdown, lists, emoji or symbols like ° (say "degrees").
- Ground statements about the data in the "context" values you are given. Never invent data values. General science explanations are fine; say so when something is general knowledge rather than from this data.
- To move the user, call go_to_place with accurate coordinates (lat: + north / - south, lon: + east / - west). Use mode "guide" (metronome guides them) unless they say jump, teleport or "put me there".
- For "warmest", "coldest", "biggest change", "heaviest rain" or the strongest value of whatever layer is showing (kind "peak"), call find_smart_target.
- To switch the data layer, call change_setting with key "dataset" and one of: sst, rain, heat, plants, ocean, air.
- To change how the app sounds or behaves, call change_setting with a key from settings_schema and a valid value. Toggles take true/false; ranges take a number within min..max (0-1 ranges are fractions: 40 percent = 0.4).
- When you call a tool, also say briefly what you did.`;

const TOOLS = [
  {
    name: 'go_to_place',
    description: 'Set a navigation target on the map (or jump there).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short spoken name of the place' },
        lat: { type: 'number', description: 'Latitude, -90..90 (north positive)' },
        lon: { type: 'number', description: 'Longitude, -180..180 (east positive)' },
        mode: { type: 'string', enum: ['guide', 'jump'] },
      },
      required: ['name', 'lat', 'lon'],
    },
  },
  {
    name: 'find_smart_target',
    description: 'Find a spot from the data itself and set it as the target.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['warmest', 'coldest', 'biggest_change', 'heaviest_rain', 'peak', 'home'] },
        mode: { type: 'string', enum: ['guide', 'jump'] },
      },
      required: ['kind'],
    },
  },
  {
    name: 'change_setting',
    description: 'Change one app setting. Use keys from context.settings_schema.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: ['string', 'number', 'boolean'] },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'change_date',
    description: 'Step the data forward (positive) or backward (negative) in time.',
    input_schema: { type: 'object', properties: { steps: { type: 'integer' } }, required: ['steps'] },
  },
];

// Best-effort rate limiting. Serverless instances are short-lived, so this only slows down casual abuse;
// the Anthropic console spend limit is what actually caps cost.
const PER_VISITOR = 12, GLOBAL = 120, WINDOW_MS = 60 * 1000;
const hits = new Map();
let globalHits = [];
function tooMany(ip) {
  const now = Date.now();
  globalHits = globalHits.filter(t => now - t < WINDOW_MS);
  const mine = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL || mine.length >= PER_VISITOR) { hits.set(ip, mine); return true; }
  mine.push(now); globalHits.push(now); hits.set(ip, mine);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'unknown').split(',')[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many requests, try again in a minute' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const message = String(body.message || '').slice(0, 500);
  if (!message.trim()) return res.status(400).json({ error: 'empty message' });
  const context = JSON.stringify(body.context || {}).slice(0, 6000);

  // a few earlier turns so follow-ups like "what about further south?" work
  const messages = [];
  for (const h of Array.isArray(body.history) ? body.history.slice(-6) : []) {
    const role = h && h.role === 'assistant' ? 'assistant' : 'user';
    const text = String((h && h.text) || '').slice(0, 400);
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
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, tools: TOOLS, messages }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return res.status(502).json({ error: 'Claude API error', status: r.status, detail });
    }
    const j = await r.json();
    const content = Array.isArray(j.content) ? j.content : [];
    const reply = content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    const actions = content.filter(b => b.type === 'tool_use').map(b => ({ tool: b.name, input: b.input }));
    return res.status(200).json({ reply, actions });
  } catch (e) {
    return res.status(500).json({ error: 'assistant failed', detail: String(e).slice(0, 200) });
  }
};
