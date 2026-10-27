# Encore: Devpost submission text

**Tagline (max ~60 chars):** The songs, films and shows that still bring them back.

**Elevator pitch (max 200 chars):** A care-team agent for dementia care that uses Qloo's taste graph to find the music, films and TV from a person's own youth and culture, and learns from how they respond.

---

## Inspiration

When someone lives with dementia, a song from their youth can still reach them. Care homes know this; US nursing homes must even offer activities that match each resident's interests. But the playlists they reach for are generic: an Indian grandmother in a New Jersey care home gets Sinatra. Large language models don't fix that on their own: they reach for the same canon for everyone.

## What it does

Encore is a care-team agent. A family describes their relative in their own words (no names); Encore's agent extracts their birth year, places and favorites, resolves each favorite in Qloo and asks the family to confirm it. Then it builds a **Memory Box** of music, films and TV from that person's youth (about ages 10 to 30), learns from **one-tap reactions** during sessions, writes a private **Visit Kit** for family in English, Hindi or Spanish, and plans **group setlists** so every resident in a room gets songs that are theirs.

**The idea in one sentence:** most recommenders hunt for something new; Encore deliberately hunts for familiarity, because in dementia care recognition matters more than discovery.

## Technological implementation: how Encore uses Qloo

- **Qloo through the official harness only:** `qloo mcp` for the agent's tools and workflows; `qloo api insights --params` for raw Insights parameters. All six result statuses are handled (and "ok with zero results" is treated as empty, which we saw happen).
- **Youth window:** films and TV use `filter.release_year.min/max` for ages 10–30. Without it, 0 of 75 film picks came from the person's youth; with it, 75 of 75.
- **Era re-rank:** artists are re-ranked with Qloo's own `start_year`, so a 1940-born resident gets Kishore Kumar and Asha Bhosle, not 1990s singers.
- **Evidence on every card:** `feature.explainability` shows which favorite led to each pick; Qloo's `notable_songs` gives real song titles.
- **Learning loop:** "lit up" pins a pick and adds it as a Qloo signal; "distressed" is sent as `filter.exclude.entities`, and Encore offers Qloo's tags (`qloo_entity_tags`) for similar themes to avoid, asking first.
- **Grounded starters:** conversation starters must cite a real Qloo tag or they're replaced.
- **The agent:** a tool-using agent (Groq `gpt-oss-120b`) over Qloo's MCP tools, grounded in the Memory Box, with location and age signals stripped in code (see below why). Every Qloo step is shown in the app.
- **What we learned about Qloo:** for people from minority backgrounds, location and age signals erase culture. Favorites + "seniors" + a New Jersey location turned a Mumbai-born persona's list into Rita Wilson, Deepak Chopra and Charo. Encore's design is built around that finding.
- **Engineering:** TypeScript server and React app, SQLite cache and request log, 67 unit tests, CI, Docker image with the harness pinned.

## Design

- Two doors on the landing page: **try it on someone you love**, or a **90-second guided tour**.
- Every illustration is original and drawn in code (no album art, posters or stills, which the rules forbid): a keepsake-box hero that follows the pointer, postage stamps for each resident's hometown, and a **generated keepsake for every pick**: a record sleeve, film frame or TV in the style of its decade, seeded by the item so it never changes.
- The core idea is something you can play with: drag a birth year and watch which decades light up as that person's youth.
- Interactive throughout: records slide out of their sleeves, "Lit up" bursts into sparkles, the group setlist lights up one resident's songs, numbers count up and charts grow. All motion stops under the reduced-motion setting.
- Tablet-first staff screens with large one-tap reaction buttons; large type for older family members; warm, non-clinical copy.
- WCAG AA: zero axe-core violations across every screen at phone, tablet and desktop widths in light and dark mode; respects reduced-motion, reduced-transparency and increased-contrast settings.
- Every state is designed: empty, error, partial and "lower confidence" (for example, TV picks inferred from music are labelled as such).
- "What Qloo sees" and "How Encore decided" panels on every plan.

## Potential impact

- More than 7 million Americans live with Alzheimer's, with more than 12 million unpaid caregivers (Alzheimer's Association, 2026). There are 14,742 US nursing homes and about 32,000 assisted-living communities.
- Nursing homes must provide activities matched to each resident (CMS F679), and gather preferences from family when residents can't say (MDS Section F).
- The evidence on personalized music is honestly mixed: an observational study linked a program to less antipsychotic use, but randomized trials (METRIcAL) found no effect on agitation. Encore makes no clinical claims; it makes the personalization that staff and families already want fast and culturally right.
- **Tested on real people:** we gave each system three of a *Desert Island Discs* guest's lifetime records and hid the rest (46 guests, 25 born outside the UK). Across everyone, a plain AI model found more hidden favorites (33% vs Encore's 22%), and we say so. For guests born outside the UK, Encore found a hidden favorite 1.6 times as often (32% vs 20%) and twice as many of them (19% vs 9%); 96% of its picks came from the person's youth, against 71% for Qloo used naively.
- **Who pays:** care homes, per resident per month; Visit Kits stay free for families and bring Encore to new homes.

## Quality of the idea

- The familiarity-first inversion and the reminiscence window (ages 10–30). Checked on real people's lifetime favorites, 40% of their chosen artists started out when they were 10–29 and 42% before they were 10, so the data doesn't show a clean youth peak; we report it and treat widening the window as next work.
- Built around how care actually works: family interviews (MDS Section F), group sessions, and never quizzing a person ("Tell me about…", not "Do you remember…?").
- Privacy by design: no names anywhere, reactions never leave Encore, Visit Kit links expire and can be revoked, and Qloo only ever sees confirmed IDs and a range of years.

## Challenges

- Qloo's age and location signals pulled results toward local mainstream taste, so the candidate pool had to come from favorites only.
- Names collide ("Rafi" exactly matches a different artist), so every match is confirmed by the family.
- The model sometimes emitted malformed tool calls; the agent retries, then answers from what it already has.

## What's next

Testing with caregivers and activity staff, widening the youth window downwards (our data suggests many lifetime favorites started before age 10), and care-home records integration under proper data agreements.

## Testing instructions

1. Open the live site. Click **Start the tour** and press **Next** through five stops (about 90 seconds).
2. Or **Start**: describe a relative in your own words (no names), click **Fill in the form for me**, confirm the matches, and build their Memory Box.
3. On any Memory Box, tap a reaction (try **Lit up**, then **Distressed** on a film), open **How Encore decided**, and try **Ask Encore**.
4. **Visit Kit** tab: make one in Hindi and open the link on your phone.
5. **Demo care home** → **See the group setlist**, then pick a resident to light up their songs; and **How we tested it** for the evaluation.
6. On the landing page, drag the **birth year** slider to see the youth window move.

No login is needed. Demo residents are fictional, and each visitor gets a private copy.

## Built with

TypeScript, Node.js, Fastify, React, Vite, SQLite, Qloo (MCP harness and Insights API), Groq (`gpt-oss-120b`), Docker, Railway.
