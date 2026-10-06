# Day-one spike — results (Oct 6, 2026)

**Verdict: GO for Encore, with four design changes (below).**

Setup: harness `@qloo/qloo-harness` 0.1.26, `qloo exec` workflows (same envelope as MCP) plus `qloo api insights --params` for raw parameters. Five **fictional** personas born 1938–1948, 3 seed favorites each. Qloo saw only entity IDs, the phrase "seniors" (→ `55_and_older`), and a city. About 57 Qloo calls in total, all cached in `spike/out/cache/` (gitignored; recorded Qloo responses are not committed). Baseline: `openai/gpt-oss-120b` on Groq, temperature 0, given the **same intake** (birth year, hometown, favorites).

Scripts: [`spike/run-spike.mjs`](../spike/run-spike.mjs), [`spike/mcp-list-tools.mjs`](../spike/mcp-list-tools.mjs).

| Persona | Born | Grew up | Seeds |
|---|---|---|---|
| P1 | 1942 | Memphis, TN | Patsy Cline, Jim Reeves, *The Sound of Music* |
| P2 | 1945 | Detroit, MI | The Supremes, Marvin Gaye, *In the Heat of the Night* |
| P3 | 1940 | Mumbai, India | Lata Mangeshkar, Mohammed Rafi, *Mughal-e-Azam* |
| P4 | 1948 | San Antonio, TX | Vicente Fernández, Javier Solís, *Bonanza* (TV) |
| P5 | 1938 | Dublin, Ireland | The Clancy Brothers, Bing Crosby, *The Quiet Man* |

## Results by check

### 1. Is a release-year filter exposed? — YES
`qloo api insights --params '{"filter.release_year.min":…, "filter.release_year.max":…}'` works through the harness. Results carry `properties.release_year`. `qloo_recommend` itself has **no** year or age-bracket field.

### 2. Real and era-appropriate? — Films: only with the year filter. Artists: culturally right, era drifts.
| Persona | Films, `qloo_recommend` (no year filter) in window | Films, year-filtered insights in window |
|---|---|---|
| P1 | 0/15 | 15/15 |
| P2 | 0/15 | 15/15 |
| P3 | 0/15 | 15/15 |
| P4 | 0/15 | 15/15 |
| P5 | 0/15 | 15/15 |

- Without the filter, every list is 2018–2023 films (*Downton Abbey*, *Knives Out*). **The reminiscence window is mandatory, not a nice-to-have.**
- With the filter, picks are culturally specific: P3 gets *Aradhana*, *Sahib Bibi Aur Ghulam*, *Teesri Kasam*; P5 (*The Quiet Man*) gets John Ford's *Donovan's Reef*, *Rio Grande*; P2 gets *Lady Sings the Blues*.
- Weak spots: *Guess Who's Coming to Dinner* appears for all 5 personas (a popularity pull). P4's film list is the weakest (some Greek titles, no Mexican cinema).
- Artists (no year filter exists): P2 excellent (Aretha Franklin, Sam Cooke, Otis Redding). P4 culturally right but late (Los Bukis, Jenni Rivera). P1 drifts into 1990s country (Garth Brooks, Trisha Yearwood). P3 seeds-only: Kishore Kumar, Asha Bhosle, Manna Dey, Mukesh, Hemant Kumar, plus some 1990s singers.

### 3. Does hometown change results? — YES
P1's seeds with Memphis vs Detroit: Jaccard overlap **0.25**. Detroit adds Bob Seger, Dionne Warwick, The Monkees.

### 4. Usable regional signal from `qloo_where_popular`? — YES, needs mapping
Returns geohash cells with `affinity` and `popularity`. Patsy Cline's strongest cells are rural West Texas; Lata Mangeshkar's include the New Jersey (`dr5q`) and Dallas areas. We must map our hometown to a geohash locally to read its cell.

### 5. Age skew from `qloo_audience_demographics`? — YES, clean separation
| Artist | `55_and_older` | Artist | `55_and_older` |
|---|---|---|---|
| Patsy Cline | +0.32 | Taylor Swift | −0.49 |
| The Supremes | +0.71 | Bad Bunny | −0.48 |
| Frank Sinatra | +0.39 | Billie Eilish | −0.48 |

This is a usable **generational-fit** feature.

### 6. Measurable difference from a plain AI model? — YES, but mixed
| Metric (n = 5 synthetic personas) | Qloo | Plain AI model |
|---|---|---|
| Mean artist-list overlap across personas (excl. P3) | 0.024 | 0.210 |
| Mean film-list overlap across personas | 0.046 | 0.135 |
| Films in window | 75/75 (verified `release_year`) | 67/75 (model-stated years, unverified) |

- The model repeats a canon: *West Side Story* for 4 of 5 people; *Casablanca* (1942), *Gone with the Wind* (1939), *Star Wars* (1977) fall outside windows. A Patsy Cline fan gets the Beatles, Stones and Dylan; a Vicente Fernández fan gets Elvis, the Beatles and Sinatra.
- **Where the model wins:** for P3 its artist list (Kishore Kumar, Asha Bhosle, Mukesh, Geeta Dutt, Talat Mahmood) is era-correct and arguably better than Qloo's. For famous canons, the model is strong.
- **Caveats:** distinctness is not accuracy. Hidden-favorite hit rate and validity are not measured yet; that comes in the full evaluation. n = 5 synthetic personas.

## Critical findings → design changes

1. **Location and age signals can erase a person's culture.** P3's seeds + "seniors" + Edison, NJ returned Rita Wilson, Deepak Chopra, Charo. P3 + "Mumbai, India" returned 0 results. Seeds alone returned the right singers. → **Build the candidate pool from the person's own favorites; use hometown and generational fit only to re-rank it.** Test `signal.location.weight` as an ablation in the full evaluation. This is the "agents are culturally blind" story, shown with real data.
2. **The year window is mandatory for films/TV.** Use `qloo api insights --params` with `filter.release_year.*`. TV-specific year filters (`filter.latest_known_year`, `filter.finale_year`) are still untested.
3. **Artists need an era signal.** Use career-active years (MusicBrainz/Wikidata) and/or the 55+ skew from `qloo_audience_demographics`.
4. **`status: "ok"` with `result_count: 0` happens.** Treat it as `empty` in code and UI.

## Harness facts learned
- Default base URL is production; set `qloo config set base-url https://hackathon.api.qloo.com` (required locally and on the server).
- `demographic` must be a phrase the harness parses: "seniors" / "elderly" / "retirees" → `55_and_older`. "adults 55 and older" → `needs_input`.
- **Demographic signals require `signal_location`**, otherwise `needs_input`.
- `qloo_describe` returns `match` (`exact`…) and up to 4 `alternatives`: ready-made data for the "Patsy Cline the singer?" screen. All 15 seeds, including Hindi- and Spanish-language ones, resolved `exact`.
- `qloo_rank`: "Scores from separate calls are not comparable." → The group coverage algorithm must use per-resident normalized ranks, not raw scores.
- `qloo exec <op>` has no per-operation `--help`; input schemas come from MCP `tools/list` (see `spike/mcp-list-tools.mjs`).

## Still to test
- TV year filters; `qloo_compare_audiences` and `qloo_entity_tags` output shape; explainability fields in insights responses.
- Quota, rate limit and key expiry (ask on Discord).
