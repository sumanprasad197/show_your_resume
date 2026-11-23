Show Your Resume
An AI-powered resume analyzer with a strict ATS match engine. Upload a resume, paste a job description, and see exactly how a recruiter's applicant-tracking system would score it — with a deterministic, explainable number instead of a black-box guess.
Live demo: https://showyourresume.vercel.app/

Why this exists
Most resume checkers give you a score from a single AI call — which means the same resume can score differently every time, and the number can't be explained or trusted.
This project splits the work:
·	AI does what AI is good at — reading messy documents (resumes, job descriptions, even scanned PDFs) and extracting structured data.
·	Code does what code is good at — matching skills and computing the score with a fixed, weighted formula.
Result: the same resume and job description always produce the same score, and every point can be traced to a category.

Features
·	Deterministic ATS scoring — weighted across four pillars:
o	Technical Skills Match — 45%
o	Experience & Seniority Fit — 25%
o	Education & Certifications — 15%
o	ATS Formatting & Readability — 15%
·	Structured AI extraction — resumes and job descriptions are parsed into strict JSON before any comparison happens
·	Noise filtering — company names, cities, salaries and legal boilerplate are excluded from "missing keyword" results
·	Matched & missing keyword analysis with category-wise breakdown
·	Recruiter-style suggestions — AI-written, with a deterministic fallback so results always return
·	Scanned PDF support (OCR) — image-only PDFs are read with Gemini's multimodal input
·	Exportable score card — download your results as a branded image
·	Glassmorphism UI with dark / light themes and a sticky frosted header
·	Resilient by design — per-call timeouts, model fallback, graceful error messages, and no silent failures

How it works
Resume PDF ──► client-side text extraction (pdf.js)
                        │
                        ├─ no text layer? ──► OCR fallback (Gemini, scanned PDF)
                        ▼
              ┌─────────────────────────┐
              │ Stage 1 · AI Extraction │  resume → structured JSON
              │                         │  job description → structured JSON
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Stage 2 · Matching      │  pure code, no AI
              │                         │  fuzzy skill matching, experience & education fit
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Stage 3 · Scoring       │  pure code, deterministic
              │                         │  45 / 25 / 15 / 15 weighted formula
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │ Stage 4 · Verdict       │  AI-written suggestions
              │                         │  (deterministic fallback if AI is unavailable)
              └─────────────────────────┘

The score is fully computed in Stage 3 — before the AI verdict call runs. That means a slow or unavailable model can never block or change the result.

Tech stack
Layer	Technology
Frontend	React 19, TypeScript, Vite
Styling	Tailwind CSS v4, custom glassmorphism theme
PDF parsing	pdf.js (client-side text extraction + page rendering)
AI	Google Gemini API (@google/genai) — extraction and OCR
Server (self-host)	Express + Vite middleware
Serverless (Vercel)	api/analyze, api/ocr functions
Deployment	Vercel (live) · Express server option for Render/Railway/any Node host


Getting started locally
# 1. Clone
git clone https://github.com/sumanprasad197/show_your_resume.git
cd show_your_resume

# 2. Install dependencies (bun or npm)
bun install        # or: npm install

# 3. Add your Gemini API key
#    Get one free at https://aistudio.google.com/apikey
echo 'GEMINI_API_KEY=your_key_here' > .env

# 4. Run
bun run dev        # or: npm run dev

Open http://localhost:3000
Available scripts
Command	What it does
bun run dev	Start the dev server (Express + Vite middleware)
bun run build	Production build (Vite frontend + bundled Express server)
bun run start	Run the production build
bun run lint	TypeScript type check (tsc --noEmit)


Deploying
Vercel (recommended)
1.	Import the repository into Vercel
2.	Add an environment variable: GEMINI_API_KEY
3.	Deploy — the api/ folder is picked up as serverless functions
Any Node host (Render, Railway, Fly.io)
1.	Build command: bun run build
2.	Start command: bun run start
3.	Set GEMINI_API_KEY

Project structure
api/
  analyze.ts          # serverless endpoint: resume analysis
  analyzer-core.ts    # extraction → matching → scoring → verdict
  ocr.ts              # scanned PDF OCR endpoint
src/
  App.tsx             # main app, state, theme
  components/         # Header, upload zone, gauge, results, loading
  constants/          # shared labels, category weights, score tiers
  data/               # sample resume & job description
  utils/              # pdf parsing, OCR client, score card export
server.ts             # Express server (dev + self-hosting)
vercel.json           # Vercel routing / function config


Notes on reliability
·	Every Gemini call has a hard timeout, with model fallback and parallel-friendly design
·	If all models are unavailable, the app returns the deterministic score with template suggestions rather than hanging
·	Errors are surfaced with specific causes (quota, capacity, unreadable file) — never silent failures

Author
Suman Prasad Sahoo

GitHub: @sumanprasad197

Built as a portfolio project — deployed, debugged, and hardened in production.
