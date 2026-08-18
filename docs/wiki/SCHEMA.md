# Wiki Schema

This file is the same convention set as `C:\Users\chris\chriswiki\SCHEMA.md`.
**This repo folder only files Conspiracy TCG pages.** The full personal vault stays at chriswiki.

## Domain

Personal knowledge base for **Chris** — a compounding memory system for Hermes Desktop and a workshop for content creation.

Covers:
- Who Chris is (preferences, hardware, workflows)
- Active and planned creative projects (YouTube, novels, middle-grade horror)
- Interests that feed content ideas (conspiracies, black projects, gaming, local AI, horror craft)
- Hermes / local-AI tooling that supports the above
- Idea bank: episode hooks, series angles, title seeds, pipeline notes

Out of scope unless Chris steers it in: general world news, unrelated research rabbit holes, other people's private data.

## Conventions

- File names: lowercase, hyphens, no spaces (e.g., `final-drive-ls.md`)
- Every wiki page starts with YAML frontmatter (see below)
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page)
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md` under the correct section
- Every action must be appended to `log.md`
- **Provenance markers:** On pages that synthesize 3+ sources, append `^[raw/articles/source-file.md]` at the end of paragraphs whose claims come from a specific source
- Prefer short scannable pages; split when a page exceeds ~200 lines
- **Personal facts:** Mark uncertain or inferred items with `confidence: medium` or `low`. Prefer Chris's direct corrections over session archaeology
- **Ideas folder:** Lightweight idea cards live in `ideas/` (type: `idea`). Promote durable ones into `concepts/` or project entity pages when they stick

## Frontmatter

```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary | idea
tags: [from taxonomy below]
sources: []
confidence: high | medium | low
contested: false
---
```

### raw/ Frontmatter

```yaml
---
source_url: https://example.com/article
ingested: YYYY-MM-DD
sha256: <hex digest of body only>
---
```

## Tag Taxonomy

Add new tags here BEFORE using them on pages.

### Person / identity
- person
- preference
- hardware
- workflow

### Projects
- project
- youtube
- writing
- novel
- horror
- gaming
- channel

### Content craft
- content-idea
- script
- pipeline
- thumbnail
- seo
- faceless
- animation
- voiceover

### Domains of interest
- conspiracy
- secret-society
- black-project
- paranormal
- scifi
- gta
- local-ai
- llm
- obsidian

### Meta
- hermes
- memory
- comparison
- timeline
- decision
- status

## Page Thresholds

- **Create a page** when an entity/concept appears in 2+ sources OR is central to one project / one solid decision
- **Add to existing page** when new info touches something already covered
- **DON'T create a page** for passing mentions or one-off chat fluff
- **Split a page** when it exceeds ~200 lines
- **Archive a page** when fully superseded — move to `_archive/`, remove from index
- **Idea cards** can be thinner than full concept pages; promote when status becomes active

## Entity Pages

One page per notable person, project, channel, tool, or piece of hardware. Include:
- Overview
- Key facts / status
- Relationships (`[[wikilinks]]`)
- Open decisions / next actions
- Source references

## Concept Pages

Topics, strategies, pipelines, themes. Include:
- Definition
- Current state of knowledge
- Open questions
- Related pages

## Idea Pages (`ideas/`)

Short cards for content or story seeds:
- Hook (1–2 sentences)
- Angle / format
- Target project (`[[project-page]]`)
- Status: seed | developing | queued | shipped | killed
- Related ideas and research needs

## Comparison Pages

Side-by-side analyses (channels, models, formats, comps for a novel). Prefer tables + verdict.

## Update Policy

When new information conflicts with existing content:
1. Check dates — newer sources generally supersede older ones
2. If genuinely contradictory, note both positions with dates
3. Mark `contradictions: [page-slug]` and/or `contested: true`
4. Flag for Chris in the next lint or handoff

## Hermes Desktop usage

This vault is the long-term memory layer for Hermes on this machine.

1. Orient every session: read `SCHEMA.md`, `index.md`, recent `log.md`
2. Prefer updating wiki pages over dumping facts only into ephemeral chat memory
3. After meaningful project work, file decisions and new facts here
4. For content brainstorms: search `ideas/` + project entities first, then add new idea cards
5. `WIKI_PATH` and `OBSIDIAN_VAULT_PATH` both point at this directory

## Open as Obsidian vault

Open `C:\Users\chris\chriswiki` as a vault. Enable wikilinks. Optional: Dataview for tag queries; attachment folder = `raw/assets/`.
