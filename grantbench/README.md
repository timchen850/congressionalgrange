# GrantBench

GrantBench is how we test the AI parts of Grange. It runs 37 cases where we already
know the right answer and checks the AI against them. If a gate is missed, the build fails.

It tests three functions: `parse-rfp` (reads the funder's call for proposals) and
`judge-proposal` (scores a draft against the rubric).

| Kind of case | What it checks | Gate |
|---|---|---|
| `rubric_extraction` | Did we tell a stated rubric from an inferred one, and copy the points exactly? | source 0.85, weights 0.75 |
| `eligibility_verdict` | go / caution / stop matches the right answer | 0.70, and 0 go/stop flips |
| `judge_quality` | Judge's score lands in the range we expect (calibration) | 0.70 |
| `judge_discrimination` | A strong draft beats a weak draft by enough | 0.80 |
| `robustness` | Prompt injection fails, empty or tiny input is rejected | 1.0 |

## Running it

Deploy the functions first, because it tests the live ones. Then make a test account in
your Supabase project (use throwaway info, it only holds junk data):

```
GRANTBENCH_EMAIL=test@example.com GRANTBENCH_PASSWORD=yourpassword node grantbench/run.mjs
```

Add `--type judge_quality` to run just one kind of case.

Exit codes: `0` all gates passed, `1` a gate failed, `2` could not tell. The free AI
providers have a limit per minute, so it waits between calls. If more than 30% of cases
get no answer, the run is "inconclusive" instead of failed, because that is the provider's
problem and not a bug in our code.

## Where the cases came from

`dataset.json` has the cases. An AI wrote most of them, then a second AI checked each
one and we dropped any where it disagreed. The discrimination and robustness cases
were written by hand. Right now the "right answers" are AI-checked, not human-graded.
