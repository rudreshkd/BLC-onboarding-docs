# Project Configuration

## Gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours` — Office hours skill
- `/plan-ceo-review` — Plan CEO review
- `/plan-eng-review` — Plan engineering review
- `/plan-design-review` — Plan design review
- `/design-consultation` — Design consultation
- `/design-shotgun` — Design shotgun
- `/design-html` — Design HTML
- `/review` — Review skill
- `/ship` — Ship skill
- `/land-and-deploy` — Land and deploy
- `/canary` — Canary deployment
- `/benchmark` — Benchmark
- `/browse` — Web browsing (primary tool for all web access)
- `/connect-chrome` — Connect Chrome
- `/qa` — QA testing
- `/qa-only` — QA only
- `/design-review` — Design review
- `/setup-browser-cookies` — Setup browser cookies
- `/setup-deploy` — Setup deploy
- `/setup-gbrain` — Setup gbrain
- `/retro` — Retrospective
- `/investigate` — Investigate
- `/document-release` — Document release
- `/document-generate` — Document generate
- `/codex` — Codex
- `/cso` — CSO
- `/autoplan` — Autoplan
- `/plan-devex-review` — Plan devex review
- `/devex-review` — Devex review
- `/careful` — Careful
- `/freeze` — Freeze
- `/guard` — Guard
- `/unfreeze` — Unfreeze
- `/gstack-upgrade` — Gstack upgrade
- `/learn` — Learn

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
