## Inspiration

When someone lives with dementia, a song from their youth can still reach them. Musical memory is relatively spared in Alzheimer's ([Jacobsen et al., 2015](https://www.sciencenews.org/article/alzheimers-spares-brains-music-regions)), and US nursing homes must offer activities that match each resident's interests ([CMS F679](https://ltc.health.mo.gov/wp-content/uploads/sites/18/2024/06/1.-Activities-for-Special-Populations-2.pdf)), gathering them from family when the resident can't say ([MDS Section F](https://www.maine.gov/future/sites/maine.gov.dhhs/files/documents/dlc/training/f/f.html)).

But the playlists they reach for are generic. An Indian grandmother in a New Jersey care home gets Sinatra. A plain AI model doesn't fix that: it reaches for the same famous canon for everyone. And when we gave Qloo her age and where she lives now, her culture disappeared too: Rita Wilson, Deepak Chopra and Charo.

**The idea in one sentence:** most recommenders hunt for something new; Encore deliberately hunts for familiarity, because in dementia care recognition matters more than discovery.

## What it does

Encore is a care-team agent. A family describes their relative in their own words, with no names. Encore's agent extracts their birth year, places and favorites, resolves each favorite in Qloo and asks the family to confirm it. Then it:

- builds a **Memory Box** of music, films and TV from that person's youth (about ages 10 to 30), placed on a timeline of their life;
- shows, on every card, **Qloo's evidence** kept apart from **Encore's reading**, with a "Why this?" breakdown;
- learns from **one-tap reactions** during sessions: "Lit up" pins a pick and teaches Qloo more; "Distressed" removes it for good and offers to avoid similar themes, asking first;
- writes a private **Family Visit Kit** in English, Hindi or Spanish: three songs, a film and conversation starters, each grounded in a real Qloo tag;
- plans a **group setlist** for a visiting musician so every resident in the room gets at least two songs that are theirs;
- answers questions through **Ask Encore**, a tool-using agent over Qloo's MCP tools, with every step shown.

## What makes Encore Qloo-powered

Without Qloo, Encore is just another model guessing names. Every pick, year and piece of evidence comes from Qloo:

| Job in Encore | Qloo |
|---|---|
| Turn a family's words into real entities | `qloo_describe` with resolve-and-confirm, including "did you mean…?" candidates |
| Find what people with the same tastes love, across music, film and TV | Insights with the person's own favorites as signals |
| Keep films and TV inside their youth | `filter.release_year.min/max` (without it, 0 of 75 film picks came from the person's youth; with it, 75 of 75) |
| Put an artist's era first | Qloo's own `start_year`, used to re-rank |
| Explain every pick | `feature.explainability` (which favorite led to it) and `notable_songs` |
| Learn and avoid | Reactions become signals; distress becomes `filter.exclude.entities`; similar themes come from `qloo_entity_tags` |
| Ground conversation starters | Each starter must cite a real Qloo tag, or it is replaced |

What we learned about Qloo along the way: for people from minority backgrounds, location and age signals pull results toward local mainstream taste. So Encore builds the candidate pool only from a person's own favorites, and uses the years to order it.

## How we built it

- **Qloo through the official harness only:** `qloo mcp` for the agent's tools and workflows, and `qloo api insights --params` for raw Insights parameters, all on the backend. All six result statuses are handled in code and in the UI (`ok`, `empty`, `needs_input`, `partial`, `degraded`, `error`, with bounded retries only when `retryable` is true), and "ok with zero results" is treated as empty.
- **Our own algorithms:** a youth window from the birth year, an era re-rank with Qloo's career years, a Beta-Bernoulli learning loop that favors known favorites over novelty (distress is a hard exclusion; "no response" is neutral), and a greedy max-coverage setlist that uses each person's own ranking because raw scores can't be compared between people.
- **The agent:** Groq `gpt-oss-120b` over Qloo's MCP tools, grounded in the person's Memory Box, with location and age signals stripped in code.
- **Engineering:** TypeScript and Fastify server, React app, SQLite cache and request log (every Qloo answer cached; demo residents prewarmed), rate limiting, 67 unit tests, GitHub Actions CI, and a Docker image with the harness pinned.

## Design

- Two doors on the landing page: **try it on someone you love**, or a **90-second guided tour**.
- Every illustration is original and drawn in code (no album art, posters or stills): a keepsake box that follows the pointer, a postage stamp for each resident's hometown, and a generated keepsake for every pick, a record sleeve, film frame or TV in the style of its decade.
- The core idea is something you can play with: drag a birth year and watch which decades light up as that person's youth.
- Interactive throughout: records slide out of their sleeves, "Lit up" bursts into sparkles, the group setlist lights up one resident's songs, numbers count up and charts grow. All motion stops under the reduced-motion setting.
- Tablet-first staff screens with large one-tap reactions, large type for older family members, warm and non-clinical copy.
- WCAG AA: zero axe-core violations across every screen at phone, tablet and desktop widths, in light and dark mode. Empty, error, partial and "lower confidence" states are all designed.
- "What Qloo sees" and "How Encore decided" panels on every plan, built from the real request log.

## Potential impact

- More than 7 million Americans live with Alzheimer's, with more than 12 million unpaid caregivers ([Alzheimer's Association, 2026](https://www.alz.org/getmedia/3b8467f1-973a-42ca-869b-61a6b195e9fd/2026-Facts-and-Figures-Statesheets-Ohio-1.pdf)). There are 14,742 US nursing homes ([KFF](https://www.kff.org/medicaid/a-look-at-nursing-facility-characteristics/)) and about 32,000 assisted-living communities ([A Place for Mom, citing NCHS](https://aplaceformom.com/senior-living-data/assisted-living-statistics)).
- The evidence on personalized music is honestly mixed. An observational study linked a program to less antipsychotic use ([Brown University, 2017](https://www.brown.edu/news/2017-05-10/music)), but a randomized trial, METRIcAL, found no effect on agitation ([ClinicalTrials.gov](https://clinicaltrials.gov/study/NCT04850807), [PMC11690236](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11690236/)). Encore makes no clinical claims: it supports engagement and person-centered activities, and makes the personalization staff and families already want fast and culturally right.
- **Tested on real people:** we gave each system three of a *Desert Island Discs* guest's lifetime records and hid the rest (46 guests, 25 born outside the UK; [dataset](https://doi.org/10.17613/2gg4-hw68)). Across everyone, a plain AI model found more hidden favorites (33% vs Encore's 22%), and we say so. For guests born outside the UK, Encore found a hidden favorite 1.6 times as often (32% vs 20%) and twice as many of them (19% vs 9%), and 96% of its picks came from the person's youth, against 71% for Qloo used naively.
- **Measured speed:** a new person's full Memory Box (36 picks) in about 5.6 seconds; about 7 ms once cached.
- **Who pays:** care homes, per resident per month. Visit Kits stay free for families and bring Encore to new homes.

## Quality of the idea

- The familiarity-first inversion plus the reminiscence window (ages 10–30). We checked it on real people's lifetime favorites: 40% of their chosen artists started out when they were 10–29 and 42% before they were 10, so the data doesn't show a clean youth peak. We report that, and widening the window downwards is our next step.
- Built around how care actually works: family interviews (MDS Section F), group sessions, and never quizzing a person ("Tell me about…", not "Do you remember…?").
- Privacy by design: no names anywhere, reactions never leave Encore, Visit Kit links expire and can be revoked, and Qloo only ever sees confirmed IDs and a range of years.

## Challenges

- Qloo's age and location signals pulled results toward local mainstream taste, so the candidate pool had to come from favorites only.
- Names collide ("Rafi" exactly matches a different artist), so every match is confirmed by the family.
- The model sometimes emitted malformed tool calls; the agent retries, then answers from what it already has.
- Hosting: Qloo's harness runs as a local stdio process, so serverless platforms were out. Encore runs as a long-lived Docker container, with precompressed assets and caching so it stays fast on a small free instance.

## What we learned

That the most useful thing a taste graph can do in care isn't discovery, it's recognition. And that honest evaluation matters: on famous British music a plain AI model wins, and the gap Encore closes is for exactly the people generic playlists leave out.

## What's next

Testing with caregivers and activity staff, widening the youth window downwards, and care-home records integration under proper data agreements.

## Testing instructions

1. Open the live demo. Click **Start the tour** and press **Next** through five stops (about 90 seconds).
2. Or click **Start**: describe a relative in your own words (no names), click **Fill in the form for me**, confirm the matches, and build their Memory Box.
3. On any Memory Box, tap a reaction (try **Lit up**, then **Distressed** on a film), open **How Encore decided**, and try **Ask Encore**.
4. **Visit Kit** tab: make one in Hindi and open the link on your phone.
5. **Demo care home** → **See the group setlist**, then pick a resident to light up their songs; and **How we tested it** for the evaluation.
6. On the landing page, drag the **birth year** slider to see the youth window move.

No login is needed. Demo residents are fictional, and each visitor gets a private copy.
