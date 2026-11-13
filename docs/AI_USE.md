# Use of AI in SolMate

Space Apps asks every team to name each AI tool it used, explain the prompts and the reasoning behind them, say what data the AI worked on, and show where the team's own work went. This page does that.

## The rule we kept

**No AI model produces a number in SolMate.** Every score, indicator, ranking and validation result comes from deterministic code in `analysis/src/solmate/compute/` (Python) and its TypeScript mirror `frontend/src/science/`, applied to NASA data. Golden tests keep the two in step. The only fitted model is the "Learned" weight preset: a non-negative logistic regression from scikit-learn, trained and checked by cross-validation in `pipeline/validate_v2.py`. That is ordinary statistics, not generative AI, and there is no deep learning anywhere in the project ([ADR 0006](adr/0006-deterministic-compute-learned-weights-no-dl.md)).

## How we worked

The idea and every decision about it are the team's. AI tools helped us research, write code, review code and prepare the videos.

| Step | Tool and model | Why we used it | What the team did |
|---|---|---|---|
| 1. Research | **Perplexity** with the **GPT 6.1 Sol** model | To read quickly across NASA pages, papers and past Space Apps projects on Earth analogs | Chose the questions, checked every source it found, and kept only what a NASA product or a published paper confirms |
| 2. Gap analysis | The team, using the research from step 1 | To find what existing analog catalogues and tools do not do: score any place on Earth, use many kinds of NASA data, and say where an analog breaks down | Defined SolMate: the targets, the dimensions, the scoring method and the validation plan |
| 3. Build | **Claude Opus 5.5** in **Claude Code** (Anthropic) | To write the science pipeline, the web app, the API, the tests, the CI/CD and the docs within the time of a hackathon | Set the goals and the rules, gave every task, checked every change on a local development server, and approved each production release |
| 4. Decisions while coding | **Jev** (TypeSafe System One) | To answer narrow, typed questions with a probability instead of free text, so a decision can be checked and repeated | Wrote the questions and the answer options, and decided what to do with each answer |
| 5. Code review | **GPT 6 Astra** | To get a second, independent review of code written by a different model | Read each finding and decided whether to fix it; Claude Opus 5.5 then made the fixes |
| 6. Videos | **Claude Opus 5.5**, with Playwright and HyperFrames; **Whisper** for caption timing; **Cartesia** and **ElevenLabs** for some voice lines | To draft the scripts and shot lists, to write the code that renders each frame of the videos, and to voice some lines | Wrote the script, recorded the voice-over in our own voices, chose the story and the shots, edited in Adobe Premiere Pro and After Effects, and approved each cut |

### Skills and tools inside Claude Code

Claude Code can load *skills*: packs of written instructions and checklists that guide Claude Opus 5.5 through one kind of task. They are not separate AI models. We name them because they shaped the work.

| Skill or tool | What it did in SolMate |
|---|---|
| **Firecrawl** (search and page reading) | Found and read sources for research: NASA's candidate landing regions, NASA SWIM ice maps for Arcadia Planitia, LP DAAC access to ASTER GDEM, NASA POWER, the MODIS to VIIRS transition, related projects and past winners. Every value we use is read from the NASA product or the cited paper itself |
| **Impeccable** (design skill) | Design direction and checks for the web pages, including the Learn page for students |
| **Design critique** and **accessibility review** | Checked layout, contrast, keyboard use and screen-reader labels |
| **Teardown** (3D simulator skill) | Guided the design of the Twin Drive rover view. No code or sound from its kit is in this repository |
| **PDF** skill | Read the Space Apps Participants Guide and our build notes so the submission follows them |
| **Code review** and **security review** | Reviewed each change before merge, alongside the automated security checks in CI |
| **Claude in Chrome** and the Claude desktop browser | Opened the local development server and the live site to test pages on desktop and phone sizes |

### Video tools

Our videos are built as code: Claude Opus 5.5 writes the scenes, and these tools render them. The team then edits them in Adobe Premiere Pro and After Effects. Three AI models are in this list: Whisper finds when each word is spoken, so the captions appear on time, and Cartesia and ElevenLabs voice some lines (see *Voices* below). The caption text is our own script.

| Tool | What it does |
|---|---|
| **Playwright** (Microsoft, Apache-2.0) | Drives a headless Chromium browser that renders each video frame from code, and opens pages for screen captures |
| **HyperFrames** | Builds video scenes from HTML and renders them to MP4 |
| **FFmpeg** | Cuts and joins clips, mixes the voice, music and sound effects, and encodes the final MP4 |
| **Whisper** (OpenAI, MIT) | Speech recognition that times each caption to the recorded voice-over |
| **Cartesia** | AI text-to-speech with voice cloning, used for some voice lines |
| **ElevenLabs** | AI text-to-speech with voice cloning (Instant Voice Clone, `eleven_v4` model), used for some voice lines |
| **CodeFlow** (aeflowtools) | Turns the HTML scenes into editable After Effects layers and keyframes |
| **Adobe Premiere Pro** | Video editing: cuts, pacing, voice and music |
| **Adobe After Effects** | Motion graphics and finishing touches on the animated scenes |

#### Voices

Most of the voice-over is the team's own voices, recorded by the five of us. Some lines are AI voice clones made with **Cartesia** and **ElevenLabs**. Each line is captioned and carries the name tag of the team member whose voice it is.

#### Images and sound

Every image in the videos comes from NASA data, our own app, code-drawn graphics or openly licensed map data that we credit on screen. Anything conceptual is labelled on screen. We use no AI-generated faces, images or stock footage. The music is CC0 (Freesound). The sound effects come from the HyperFrames sound library or are synthesised in code; none are AI-generated.

Ordinary software tools without AI (Python, React, GitHub Actions, gitleaks, CodeQL and others) are listed in the project's references and `NOTICE`.

## Prompts and the reasoning behind them

**Perplexity (GPT 6.1 Sol), research.** In our own words, we asked it:

- what the 2026 challenge asks for;
- what existing work on Earth analogs already does, and where the gaps are;
- which NASA datasets fit the challenge.

*Why:* we needed a fast map of existing work before choosing what to build. We followed every answer back to its source, and SolMate uses only values read from a NASA product or a published paper, never from the chat answer.

**Claude Opus 5.5, build.** We gave short instructions in chat, and Claude Code turned them into code, tests and pull requests. Standing rules we gave at the start, which applied to every task (lightly edited for spelling):

> "We need to use NASA datasets, mandatory."

> "Code security is a must, and every commit should be meaningful."

> "Before production, can I see it on the dev server? Without my approval, don't deploy to production."

Typical task prompts:

> "On mobile Chrome on a Galaxy S24 Ultra it looks like this. The overlap must be fixed." (with a screenshot)

> "On PC the Moon is on the left, but on mobile Mars is on the left. Can you check this?"

*Why:* each prompt describes a goal or a problem the team saw, not the code to write. The rules prompts made sure NASA data, security and review before release applied to all the work.

**Jev (TypeSafe), decisions and evidence checks.** We asked Jev one multiple-choice question at a time and acted only on confident answers. The clearest example is `analysis/claims_check.py`. For each context claim shown next to a site of the October prototype, it asks:

> "How does `source_excerpt` relate to `claim`? Judge only from the excerpt, not from outside knowledge."
>
> Options: *supports*, *contradicts*, *says nothing*.

*Why:* we only showed a claim if Jev answered "supports" with confidence 0.8 or more; everything else went to a person. Results are in `frontend/public/data/claims.v1.json` (11 Oct 2026, model `jev-1.13.0`). Jev never touched a score. It has **not** been run on the v2 target values in `targets.yaml`; those were checked against their cited sources and are listed with their citation, method and uncertainty on the Data page.

**GPT 6 Astra, review.** We gave it the code and asked it to review the code and tell us whether there were any security issues.

*Why:* a model that did not write the code is more likely to spot its mistakes, and security was one of our standing rules. The team read each finding; the ones we accepted went back to Claude Opus 5.5 as fix tasks.

## What data the AI worked on

- **Claude Opus 5.5:** this repository's code and docs, the public NASA dataset documentation, and the live site. All are public.
- **GPT 6 Astra:** this repository's code, which is public.
- **Perplexity:** public web pages and papers.
- **Jev:** short excerpts from the cited papers and NASA pages, and the claims shown on the site.
- **Cartesia and ElevenLabs:** short recordings of our own voices, used to make the voice clones, and the script lines they read.
- Apart from those voice samples of team members, no personal data or user data was sent to any AI service.

## Where our own work is

- The idea: one score, built from NASA data, for how well any place on Earth matches a Moon or Mars target, plus an honest list of where the match breaks down.
- Choosing the targets, the datasets, the scoring method and the validation design.
- Deciding what to publish, including the weak results.
- Testing every change on a local development server and on our own phones before it went live.
- Presenting the work: the videos, the project page and the judging.

## Keys

The TypeSafe key lives only in a developer's local environment (`TYPESAFE_API_KEY`). It is never committed, logged or shipped to the website.
