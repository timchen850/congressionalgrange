# Grange AI

Grange AI helps small nonprofits and community groups find grants and write proposals,
even if they don't have a grant writer.

## Features

- **Profile** - a short survey about your organization
- **Find Grants** - searches Grants.gov and gives each grant a match score (no AI, just keyword and state matching)
- **Readiness** - a checklist of documents funders ask for, an IRS 501(c)(3) check, SAM.gov reminders, and a tool that reads a funder's call for proposals and tells you if you should apply
- **Write Proposal** - creates a first draft using your profile, a second AI pass fixes the voice, and a reviewer AI scores the draft and fixes the weakest parts
- **Deadlines** - keeps track of due dates and exports them to your calendar
- **Assistant** - a chatbot that answers grant questions

## Folders

```
index.html        page shell: navbar and script tags
pages/            the html for each screen (login, dashboard, discover, ...)
css/              base.css (colors, layout), components.css (cards, buttons, forms), pages.css (screen styles)
js/core/          supabase connection, page switching, small helpers
js/pages/         the code for each screen
assets/           logo and app icons
supabase/         database tables (schema.sql) and edge functions
grantbench/       tests for the AI, see grantbench/README.md
```

The screens are loaded with fetch, so open the site through a local server, not by double clicking index.html.

## Running it

Website:

```
python3 -m http.server 3456
```

Then open http://localhost:3456

## Setup

1. Make a free project at supabase.com and run `supabase/schema.sql` in the SQL editor.
2. Put your project URL and anon key in `config.js` (Project Settings > API).
3. Add these secrets under Edge Functions > Secrets:
   `GEMINI_API_KEY`, `GROQ_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `PRICE_STARTER_MONTHLY`, `PRICE_STARTER_YEARLY`, `PRICE_PRO_MONTHLY`, `PRICE_PRO_YEARLY`
4. Deploy the functions: `supabase functions deploy`
5. In the repo settings, set Pages to deploy from GitHub Actions. Every push to main updates the site.

## How the AI is tested

`grantbench/` has 37 test cases with known answers. It checks the funder reader and the
draft scorer, and fails the build if quality drops. See `grantbench/README.md`.

## AI disclosure

We built Grange with Claude Code (Anthropic) as an AI coding partner. It helped write and
refactor a lot of this code. We decided what to build, reviewed the changes, and tested the app.
