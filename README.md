# PM Quiz Sprint

A mobile-first quiz app for practicing product management, AI PM, tech basics, and UX/UI. Designed for short daily sessions with spaced repetition learning.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth**: Firebase Authentication (Google sign-in)
- **Database**: Cloud Firestore
- **AI**: OpenAI API (server-side only, batch question generation)
- **Hosting**: Vercel
- **Validation**: Zod

## Quick Start

### Prerequisites

- Node.js 18+
- Firebase project with Firestore and Auth enabled
- OpenAI API key
- Vercel account (for deployment)

### Setup

1. **Clone and install**:
   ```bash
   git clone <repo-url> pm-quiz-sprint
   cd pm-quiz-sprint
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Fill in all values in .env.local
   ```

3. **Firebase setup**:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Google sign-in in Authentication → Sign-in method
   - Create a Firestore database
   - Generate a service account key (Project Settings → Service Accounts)
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`
   - Deploy indexes: `firebase deploy --only firestore:indexes`

4. **Run locally**:
   ```bash
   npm run dev
   ```

5. **Seed questions** (first time):
   - Log in with your admin Google account
   - Go to `/admin`
   - Click "Generate 50 Questions" to create your first batch

### Deploy to Vercel

```bash
vercel deploy
```

Set all environment variables in Vercel project settings.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design details.

## Firestore Schema

See [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) for data model documentation.

## Project Structure

```
src/
├── app/                     # Next.js App Router
│   ├── page.tsx             # Home screen
│   ├── login/               # Google sign-in
│   ├── quiz/[sessionId]/    # Active quiz
│   ├── results/[sessionId]/ # Quiz results
│   ├── stats/               # Learning stats
│   ├── admin/               # Question pool management
│   └── api/                 # Server-side API routes
│       ├── generate-batch/  # OpenAI question generation
│       ├── build-quiz/      # Quiz session builder
│       ├── submit-answer/   # Answer submission + spaced rep
│       └── refresh-pool/    # Pool health check
├── components/              # React components
│   ├── auth/                # Auth provider
│   ├── layout/              # Navigation
│   └── ui/                  # Reusable UI primitives
├── hooks/                   # Custom hooks
├── lib/                     # Core logic
│   ├── firebase/            # Client + Admin SDK config
│   ├── openai/              # Generation client + prompts
│   ├── quiz/                # Selection algorithm + spaced rep
│   └── validation/          # Zod schemas
└── types/                   # TypeScript interfaces
```

## Quiz Modes

- **Quick 5**: 5 mixed questions, ideal for a 2-minute session
- **Standard 10**: 10 questions with full category distribution
- **Weak Spots**: 10 questions prioritizing previously incorrect answers

## Key Design Decisions

- **Cache-first**: Questions are pre-generated and stored in Firestore. No OpenAI calls during quizzes.
- **Spaced repetition**: SM-2 variant tracks ease factor, interval, and streak per question per user.
- **Deduplication**: Questions are fingerprinted via normalized text hash to prevent duplicates across batches.
- **Security**: OpenAI API key never leaves the server. All generation happens in API routes.

## V2 Roadmap

See [TODO_V2.md](./TODO_V2.md) for planned improvements.
