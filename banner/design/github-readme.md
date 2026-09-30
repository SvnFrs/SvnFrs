# GitHub README

The profile README (repo `SvnFrs/SvnFrs`) is the same night map, rebuilt from what GitHub lets you control: images, code fences and plain Markdown. GitHub sets its own fonts and colours around you, so the system leans on three things that survive: outlined SVGs (the banner renders identically everywhere), fenced code blocks (GitHub renders them monospace, with box-drawing characters for map symbols) and `<picture>` pairs that swap Night and Paper with the viewer's GitHub theme.

## Rules

- Commit the `Readme` assets into the profile repo under `assets/` and reference them relatively. Always ship both themes in a `<picture>`: `banner-*`, `divider-*`, `end-*`.
- Headings are map sheets: `### 02 · CURRENTLY BUILDING`. The number is the sheet number; the rest is uppercase.
- Facts go in a fenced `text` block laid out like a legend, with a symbol per row (`━━` route, `□` block, `≈` contour, `■` point), all single-width characters so the columns hold. Never a wall of badges: one stack line replaces twenty shields.
- One animated element at most (the contribution snake, if you keep it). Retire the Pepe GIF: the annotation is the joke now.
- Only the token colours below. Stat cards get `border_radius=0`. The 國泰 signature appears once, in the banner.
- Copy stays in the voice: credentials and numbers, one parenthetical annotation per section.
- Contact goes right under the lead, before any section: email and LinkedIn, one line. GitHub cannot copy on click, so the email is a plain `mailto:` link there.

## Template

````markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-night.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/banner-paper.svg">
  <img alt="Tyler — full-stack & cloud engineer · @SvnFrs" src="./assets/banner-night.svg" width="100%">
</picture>

**Full-stack & cloud engineer.** Technical co-founder at NewlySight. Monolith demolition at FPT Software.
*(code by brain, not by hand)*

**[thaidvq.work@gmail.com](mailto:thaidvq.work@gmail.com)** · [LinkedIn ↗](https://www.linkedin.com/in/thaidoanmiddle) · [tyler-void.dev ↗](https://tyler-void.dev)

### 01 · WHAT I ACTUALLY DO

```text
LEGEND                                            1:25 000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■   Zero-to-one     NewlySight, computer-vision PoC
━━  Demolition      a 10-year .NET monolith, FPT Software
□   Pipelines       100k+ rows/day into Snowflake
≈   Terrain         Proxmox on bare metal, Arch (btw)
━━  Method          spec-driven development + BMAD agents
□   Stack           .NET · Go · TypeScript · Python · Next.js
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/divider-night.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/divider-paper.svg">
  <img alt="" src="./assets/divider-night.svg" width="100%">
</picture>

### 02 · CURRENTLY BUILDING

| Folio | Project | Survey |
| --- | --- | --- |
| `I` | [**eco-mcp**](https://github.com/SvnFrs/eco-mcp) | Token-efficient MCP server. ~97% fewer tokens on real tasks. |
| `II` | [**commit-art**](https://github.com/SvnFrs/commit-art) | Paints art onto the contribution graph. History back to 1970. |

### 03 · THE RECORD

```text
■   1st place       FPTU Kattis Coding Contest
■   Outstanding     Student, ×2
■   Certified       Claude Code · Microsoft GHC-300
```

### 04 · THE NUMBERS

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="STATS_NIGHT_URL">
  <source media="(prefers-color-scheme: light)" srcset="STATS_PAPER_URL">
  <img alt="GitHub stats for @SvnFrs" src="STATS_NIGHT_URL">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/end-night.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/end-paper.svg">
  <img alt="End of sheet 01." src="./assets/end-night.svg" width="100%">
</picture>
````

Check the facts against the current README before publishing; they were taken from it on 2026-09-29. The two repo links are guesses at their URLs.

## Card colours

Replace `STATS_NIGHT_URL` / `STATS_PAPER_URL` with these. The public card instances are rate-limited (github-readme-stats says so itself); generating the SVGs with their GitHub Actions workflow and committing them is the reliable route, with the same parameters.

**github-readme-stats** (`https://github-readme-stats.vercel.app/api?username=SvnFrs&show_icons=true&` + ):

| Theme | Parameters |
| --- | --- |
| Night | `bg_color=080d11&title_color=dbe4ed&text_color=a1acb7&icon_color=74c7ec&ring_color=74c7ec&border_color=68717a&border_radius=0` |
| Paper | `bg_color=eae6dd&title_color=1b1715&text_color=4d4a43&icon_color=005d7c&ring_color=005d7c&border_color=7a756b&border_radius=0` |

**Streak stats** (`https://streak-stats.demolab.com/?user=SvnFrs&` + ). The fire stays `accent`: vermilion is kept for errors, not decoration.

| Theme | Parameters |
| --- | --- |
| Night | `background=080d11&border=68717a&stroke=272f35&ring=74c7ec&fire=74c7ec&currStreakNum=dbe4ed&sideNums=dbe4ed&currStreakLabel=74c7ec&sideLabels=a1acb7&dates=7f8992&border_radius=0` |
| Paper | `background=eae6dd&border=7a756b&stroke=ccc7bc&ring=005d7c&fire=005d7c&currStreakNum=1b1715&sideNums=1b1715&currStreakLabel=005d7c&sideLabels=4d4a43&dates=5e5a52&border_radius=0` |

**Activity graph** (`https://github-readme-activity-graph.vercel.app/graph?username=SvnFrs&` + ):

| Theme | Parameters |
| --- | --- |
| Night | `bg_color=080d11&color=a1acb7&line=74c7ec&point=dbe4ed&area=true&area_color=74c7ec&hide_border=true&radius=0` |
| Paper | `bg_color=eae6dd&color=4d4a43&line=005d7c&point=1b1715&area=true&area_color=005d7c&hide_border=true&radius=0` |

**Contribution snake** (Platane/snk action `outputs`):

```text
dist/snake-night.svg?color_snake=#74c7ec&color_dots=#10161b,#263d47,#3e687a,#5996b2,#74c7ec
dist/snake-paper.svg?color_snake=#005d7c&color_dots=#ddd9cf,#a2bbc7,#749bae,#457c95,#005d7c
```

## If you want badges anyway

Flat, square, token colours, one row: `https://img.shields.io/badge/.NET-1a2128?style=flat-square&logo=dotnet&logoColor=74c7ec` (Night) and `…/badge/.NET-d7d2c7?style=flat-square&logo=dotnet&logoColor=005d7c` (Paper), in a `<picture>` pair like everything else. They read as Tags: `slab` body, `accent` mark.
