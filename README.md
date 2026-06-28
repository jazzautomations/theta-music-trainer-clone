# Theta Music Trainer — Clone

Reverse-proxy clone of [trainer.thetamusic.com](https://trainer.thetamusic.com) — 113 ear training and music theory games.

## How it works

Next.js middleware proxies ALL requests to `trainer.thetamusic.com` and injects a cleanup script into HTML responses that:
- Removes login/signup modals
- Removes paywall/subscribe/upgrade prompts
- Auto-clicks "Play as guest" / "Skip" / "Continue" buttons
- Auto-dismisses cookie banners

No login required. All 113 games work.

## Games

Visit `/en/content/music-training-games` for the full list. Categories:
- **Pitch** — Two Tones, Three Tones, More Tones, Vocal Match, etc
- **Melody** — Melodic Drops, Melodic Dictation, Parrot Phrases, etc
- **Rhythm** — Flash Rhythms, Rhythm Puzzles, Rhythm Reader, etc
- **Harmony** — Chord Drops, Chord Locks, Chord Progressions, etc
- **Sound** — EQ Match, Channel Match, Band Match, etc
- **Intervals** — Harmonic Intervals, Melodic Intervals, etc
- **Tonality** — Tonic Finder, Tonal Recall, etc

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000/en/content/music-training-games`.

## Deploy on Vercel

1. Import this repo on vercel.com/new
2. Deploy — no config needed

## Disclaimer

Theta Music Trainer is a product of Theta Music Technologies, Inc. This is an educational reverse-engineering exercise. All credit goes to the original creators.
