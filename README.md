# Grange AI

Grange AI helps small nonprofits and community groups find grants and write proposals,
even if they don't have a grant writer.

## Features

- **Profile** - a short survey about your organization
- **Find Grants** - searches Grants.gov and gives each grant a match score
- **Readiness** - a checklist of documents funders ask for, an IRS 501(c)(3) check, and SAM.gov reminders
- **Write Proposal** - creates a first draft of a proposal using your profile
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
