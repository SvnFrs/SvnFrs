# Neo Noir banner

Renders `banner-*`, `divider-*` and `end-*` (Night and Paper each) for the @SvnFrs profile README: the Neo Noir map sheet, with its contour lines surveyed from the last 365 days of contributions.

```sh
bun install
bun render.mjs                                   # uses data/contrib.json
GITHUB_TOKEN=... bun render.mjs --user SvnFrs    # fetches the year first, then renders
bun render.mjs --still                           # no grain flicker
```

Output goes to `out/` (`--out` to change it).

## What it reads

- `design/tokens.json`: copied from the Neo Noir design system. Colours, strokes, grain opacity and timing all come from here, so change a token and render again.
- `design/fonts-ttf/`: TTF copies of the design system's variable fonts (`fonts.py` makes them from `design/fonts/`). Every word is drawn as a `<path>`, because raw.githubusercontent.com serves SVGs with `default-src 'none'` and a font cannot load there.
- `design/marks.json`: the 國泰 signature outlines (Yuji Syuku), the dry brush stroke, the city blocks and route, and the legend's contour symbol.
- `data/contrib.json`: one entry per day, `{date, level, count}`. With `--user` and a token it comes from the GraphQL `contributionCalendar` with real counts; the committed copy was surveyed that way on 2026-09-30. The daily workflow re-surveys it in CI and does not commit it back.

## What it draws

- The terrain: each day's activity is a hill at its place in GitHub's grid (a week per column, Sunday on top), smoothed, plus a little seeded noise so empty stretches still read as ground. Fourteen contour intervals, every fifth an index line.
- A spot height (▲ with the date) on the busiest day, but only when that day lands on open ground; otherwise it is left out.
- "SURVEYED <last day>" in the sheet refs, and a legend row saying what the contours are.
- `divider-*.svg` (1200×48): the banner's scale bar, then the dry brush trailing to x=1180. Closes each README section.
- `end-*.svg` (1200×56): the thick-and-thin neatline, then END OF SHEET 01 and the coordinates. Closes the last section.
- The divider and end sheets are transparent (they sit on GitHub's own page colour), with no grain and nothing moving. Night uses the night tokens, Paper the paper tokens.
- One moving thing: film grain, five frames per 420 ms. `prefers-reduced-motion` stops it when the file is opened directly, but Chromium ignores that inside an `<img>`; use `--still` to be certain.

Font licences are in `design/licenses/` (SIL OFL 1.1).
