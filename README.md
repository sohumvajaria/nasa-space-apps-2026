# GeoSonix

**Walk across the whole planet by ear, and hear what NASA's satellites see.**

GeoSonix turns real NASA Earth data into sound you can move through. You steer around a map of the world with the arrow keys, and wherever you stand, an instrument plays what the satellites measured there: rain, heat, vegetation, ocean temperature, wind. The stronger the data, the louder and brighter it plays. It was built for the 2026 NASA International Space Apps Challenge, for the challenge called **The Earth Information Jukebox**.

**Live site:** https://nasa-space-apps-2026-sandy.vercel.app

> Team 3W, Raleigh, NC. Team details are at the bottom of this page.

## Why we made it

Most satellite imagery is a picture, which quietly leaves out anyone who can't see it. That includes the roughly 300 million people worldwide with moderate to severe vision loss, and it also includes everyone listening on a phone in their pocket, or just curious what a hurricane would sound like. Sound is a good fit for this kind of data because it can carry a lot at once: pitch, volume, rhythm, and where a sound seems to come from.

Before we wrote any code we searched forums and accessibility threads to see what blind and low-vision users say they miss in weather and data tools. The things that kept coming up were knowing where you are, hearing wind alongside rain, and having cues that tell you which direction something is in. Those shaped a lot of what's below, and a few of them are still on our list.

## What it does

You start at a spot just off Null Island, the point at 0° N, 0° E where the equator meets the prime meridian, and you can walk anywhere on Earth from there. A soft pulse plays from Null Island and moves between your left and right ears to show which side home is on, getting quieter as you wander away. That way you can always find your way back by ear alone.

On top of the pulse, an instrument plays the data under your feet. There are five layers, each with its own instrument so you can tell them apart without looking:

| Key | Layer | Instrument | NASA data |
|---|---|---|---|
| 1 | Rain | Violin | GPM IMERG precipitation rate |
| 2 | Land heat | Cello | MODIS Terra land surface temperature |
| 3 | Plants | Flute | MODIS Terra vegetation index (NDVI) |
| 4 | Ocean heat | Clarinet | GHRSST MUR sea surface temperature |
| 5 | Wind | Breeze | MERRA-2 surface wind speed (monthly average) |
| 6 | Earth Orchestra | All of them | Every layer at once |

The notes are chosen from A and E, spread across each instrument's natural range, so any combination sounds calm and open instead of messy. Walking across the planet means hearing that chord change: a lone clarinet over the open ocean, then violin, cello and flute together over a hot, green, rainy coast. When the data reaches its most extreme level, the instrument trembles the way an orchestra's strings do when something is wrong.

You can also:

- **Press G and just talk to GeoAssistant.** It listens after a soft beep, answers in a sentence, and listens again, so you never need a mouse or keyboard. Say "how do I move?" to hear the keys. You can also type. Ask things like "take me to Tokyo and switch to ocean heat" or "why is the ocean silent on land heat?", and it can switch layers, move you around and change the date.
- **Press H** to hear where you are and what's playing, for example "Heavy rain. France, Europe."
- **Travel through time.** The date slider (or the comma and period keys) goes back 30 days, and *Go back to 2006* (T) plays the same calendar day 20 years earlier, so you can hear how a place has changed.
- **Switch between a flat map and a 3D terrain view** (V), where the data shapes the land and a beam of light marks home.
- **Watch the sound** in a small wave display with one coloured line per instrument, taller when louder.

## Built for people who can't see the screen

Accessibility isn't a mode in this project; the sound is the interface and the visuals are the extra. Everything works from the keyboard, and the map is announced to screen readers with proper labels. There's a *Voice* setting so screen-reader users can have announcements come only through their own reader, instead of hearing two voices at once. On a first visit, a short narrated intro explains how to listen, and S or Escape skips it. The 3D view smooths itself as you walk, touch screens get a drag-to-steer joystick, and phones can buzz when you cross into a stronger level of data.

We haven't yet tested it with blind or low-vision listeners, and that's the thing we most want to do next. Everything here comes from reading what people have written, not from sitting with them, so we expect to be wrong about some of it.

## How it works

It's a static site with two small serverless functions, so there's no build step.

**Data.** Every layer comes from NASA's [GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) (Global Imagery Browse Services), which serves satellite maps as ordinary images. We request the whole world for the chosen day as one picture, then turn the colours back into numbers by matching each pixel to the layer's published legend. A little smoothing and a per-layer calibration turn those numbers into a 0 to 1 intensity that drives the sound. Because the numbers come from the legend and not from guesswork, "heavy rain" means what NASA's own scale says it means.

**Sound.** Everything is synthesised live with the Web Audio API, with no audio files. The home pulse is placed in 3D with an HRTF panner so it genuinely sounds like it's off to one side. Each instrument is built from oscillators and filters (bowed sawtooth pairs for the strings, a nearly pure tone with breath for the flute, a square-plus-triangle blend for the clarinet's hollow sound), and its volume and brightness follow the data under you.

**Voice.** Spoken announcements come from a neural text-to-speech voice (OpenAI's `gpt-4o-mini-tts`), streamed from a small serverless function so a sentence starts playing before it has finished being made. Phrases people hear often are cached at the edge, which makes them nearly instant, and listeners can pick a warm, deep or calm voice and a speaking speed. If the voice is slow, down or out of credit, the browser's own voice takes over immediately, so nobody waits in silence.

**Graphics.** The hero globe and the 3D terrain use [Three.js](https://threejs.org/). The terrain is fixed to the world and bends away from you on the graphics card as you walk, which keeps it smooth instead of popping when the view re-centres.

**GeoAssistant.** `api/guide.js` sends your question, plus a small snapshot of what the app is doing, to a Claude model (Haiku 5.5 by default). It replies in plain speech and can ask the page to do things through a short list of tools. It needs an API key, but the rest of the app doesn't, and if GeoAssistant is offline the page still teaches you the controls.

## Data and credits

Everything you hear comes from NASA data, accessed through GIBS:

| Resource | What we used it for |
|---|---|
| [GPM IMERG](https://gpm.nasa.gov/data/imerg) `IMERG_Precipitation_Rate` | Rain |
| [MODIS Terra](https://modis.gsfc.nasa.gov/) `MODIS_Terra_Land_Surface_Temp_Day` | Land heat |
| MODIS Terra `MODIS_Terra_NDVI_8Day` | Plants |
| [GHRSST MUR](https://podaac.jpl.nasa.gov/) `GHRSST_L4_MUR_Sea_Surface_Temperature` | Ocean heat |
| [MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/) `MERRA2_Surface_Wind_Speed_Monthly` | Wind |
| `BlueMarble_ShadedRelief_Bathymetry` | The base map under the data |

The data is courtesy of NASA's Earth Science Data Systems and GIBS. The wind layer is a monthly average of wind speed (the newest month NASA publishes), not the wind outside right now, because GIBS doesn't offer live wind or wind direction.

Other pieces: [Three.js](https://threejs.org/) for graphics, OpenAI for the spoken voice, and Claude from Anthropic for GeoAssistant. The narrated intro was voiced with Gemini.

## Honest limits

We'd rather you know what this can't do before you try it.

- **It isn't live.** GIBS publishes daily frames, and some layers update less often than that, so you're hearing yesterday, not this minute. There are no forecasts.
- **Clouds leave gaps.** Satellites can't see through clouds for some layers, and gaps are silent on purpose, so quiet doesn't always mean "nothing there".
- **Wind is a monthly average of speed only.** There's no direction and no today's-gusts.
- **The natural voice needs the server.** If its key is missing, out of credit or the connection is slow, you hear the browser's own voice instead, which varies by device and sounds more robotic.
- **Going back to 2006 compares single days.** Weather plays a part, so it's an impression of change, not a climate trend.

## Run it yourself

The site is plain HTML, CSS and JavaScript in `src/`, so any static server works:

```bash
git clone https://github.com/sohumvajaria/nasa-space-apps-2026.git
cd nasa-space-apps-2026/src
python3 -m http.server 8000
# open http://localhost:8000
```

That gives you everything except GeoAssistant and the natural voice, which are serverless functions in `api/`. To run those too, use the [Vercel CLI](https://vercel.com/docs/cli) from the repo root with `vercel dev`.

To deploy your own copy, import the repo into Vercel (the included `vercel.json` already points at `src/`). For GeoAssistant, add an `ANTHROPIC_API_KEY` environment variable in the project settings and set a small monthly spend limit in the Anthropic console, since the endpoint is public once deployed. An `OPENAI_API_KEY` turns on the natural voice (an `ELEVENLABS_API_KEY` works too); without one, the browser's own voice is used. Never put a key in the code.

## What's in the repo

- `src/` is the app. `index.html` is the main page, `features.html` is the full feature tour, and `intro/` holds the narrated tutorial.
- `api/guide.js` is GeoAssistant, the voice assistant, and `api/tts.js` is the natural voice.
- `tools/` has helper scripts, and `data/` and `docs/` are for datasets and write-ups.

## How we used Super Intelligence (SI)

The idea, the concept and the decisions about what to build were ours. We used SI tools as assistants, and we're listing where.

- **Code and debugging.** Most of the code, including the page, the audio engine, the 3D views and the two serverless functions, was written and debugged with Claude (Anthropic) in Claude Code. A person on the team directed the work and reviewed and tested the results.
- **Text and design.** This README, the features page and the on-screen wording were drafted and edited with Claude, and the visual design was developed with it.
- **Research and data analysis.** Claude helped look up NASA data sources and API pricing, and helped work out how to turn the colours of NASA's map images back into numbers using each layer's published legend.
- **SI inside the product.** The GeoAssistant (G key) uses a Claude model, and the natural spoken voice is OpenAI text-to-speech. Everything the voice says and every assistant answer is SI-generated. The server marks these responses with an `X-SI-Generated` header.
- **Audio and video.** The narration in the intro video was generated with Google Gemini text-to-speech and is SI-generated audio, labelled in the video file's metadata. The intro's visuals were rendered by code (Three.js), not by an image or video generator, so they carry no SI watermark.
- **Not SI.** All map data is NASA's, and the site icon is a NASA photograph. We didn't use or alter any NASA logos, flags or mission identifiers.

## Team

Built by Sohum Vajaria ([@sohumvajaria](https://github.com/sohumvajaria)), [@pranav-ysv](https://github.com/pranav-ysv) and [@sid-darth-vater](https://github.com/sid-darth-vater), with a lot of help from Claude.

- **Team name:** 3W
- **Local event:** Raleigh, NC
- **Demo video:** _to add_

## License

MIT, see [LICENSE](LICENSE).
