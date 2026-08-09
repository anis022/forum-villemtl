---
name: design-system
description: The visual system for this borough forum — palette, shape, type, motion and component patterns. Load before writing or changing any UI in this repo (pages, components, Tailwind classes, globals.css), and before adding a new screen, so surfaces stay consistent instead of each one inventing its own look.
---

# Forum CDN-NDG — visual system

The audience is residents of a Montréal borough: wide age range, mostly on
phones, no reason to be patient with a municipal-looking interface. The site
has to feel like somewhere people talk to each other, not like a form.

Read `components/ui/styles.ts` first — it is the source of truth and these
notes explain the reasoning behind it. **Never hardcode a colour or radius in
a component when a token exists.**

## Palette

Anchored on the borough's own teal, because this is a civic site and that
colour is its identity. Everything around it is warmed so the page does not
read as a government portal.

| token | value | use |
| --- | --- | --- |
| ink | `#16241f` | body text — near-black with a green bias, so type sits in the same world as the accent instead of floating in default grey |
| muted | `#5d6b66` | secondary text, biased toward the accent rather than a neutral mid-grey |
| line | `#dde5e1` | borders — soft; the old `#ced4da` was the first thing you noticed on a feed of thirty cards |
| wash | `#f2f6f4` | hero bands, hover fills |
| accent | `#097d6c` | the borough teal; primary actions, links |
| accent soft | `#e2f0ec` | accent backgrounds, answered state |
| rose | `#d94f45` | **backing only** — supporting a neighbour should read warm, and it separates "I did this" from every other teal control |

Semantic colour (status pills) is separate from the accent and never counts as
it. Status carries a **dot as well as a colour**: hue alone is not a signal for
everyone.

## Shape

- Cards `rounded-[16px]`, inputs `rounded-[12px]`, buttons `rounded-[10px]`,
  chips `rounded-full`, list rows `rounded-[14px]`.
- A 4px radius reads as a government form. Generous corners on the *surfaces* —
  cards, panels, fields — are the single cheapest thing that makes this feel
  friendly, and the user asked for them explicitly.
- **Buttons are not pills.** They were, and at button width a fully round one
  reads as marketing rather than as a municipal service; the user called it
  "ugly and not so professional". 10px: tighter than the field above it,
  nowhere near square.
- **Chips still are.** A filter is not a button, and the two shapes are how you
  tell them apart without reading them. That covers the category chips and the
  map/view toggles built in the same family.
- Cards use a hairline border **plus a whisper of shadow**
  (`0_1px_2px_rgba(22,36,31,0.04)`), not a heavy border.
- Every focusable control needs a radius: the focus ring is a `box-shadow`, so
  it traces whatever radius the element has, and anything left at 0 gets a
  hard-cornered rectangle while its neighbours get rounded ones. `globals.css`
  sets a 6px floor in `@layer base`; component utilities still win.
- **The ring only goes as round as the control actually is.** The button radius
  belongs to things drawn as buttons — filled, bordered, or filled on hover.
  Bare text and icon controls (the menu trigger, header search, account and
  sign-out, the profile link) take `BARE_CONTROL` (8px), and plain links keep
  the 6px floor. A ring around a menu item outlines a button that was never
  drawn, which is why those read as too round.

## Small screens

The floor is **320px**, not 360 — and the site is light-only, so no page may
declare a dark `--background`. Every page root is `bg-[#f8faf9] text-[#16241f]`:
cards are white, and a white page makes them vanish.

- The document never scrolls sideways. `html, body` carry `overflow-x: clip`
  (not `hidden`, which would break the sticky masthead) plus
  `overscroll-behavior-x: none`, but that is a backstop — fix the element that
  overflows. The usual culprits: `shrink-0` on a full sentence, a `<select>`
  sized by its longest `<option>`, a flex child missing `min-w-0`, and icon
  rows in the masthead.
- **Measure, don't eyeball.** Load the route in a 320px iframe and compare every
  `getBoundingClientRect().right` against `documentElement.clientWidth`;
  `scrollWidth` reads clean even when content is clipped.
- Category and status hold the **top right of a post at every width** — they are
  how you triage a feed. They stack into a column there on a phone rather than
  moving. What gives instead is the author block: one truncated line, short date.
- The sort and view toggles stay on **one line** at every width. Padding, type
  size and the icons give way; the pair never stacks.
- Touch targets are at least 40px tall, padding included — a 12px label is a
  16px target without it.
- A list beside a map becomes a scroller **only** at `lg`, where it has to match
  the map's height. Stacked on a phone, a nested scroller swallows the drag and
  the page feels stuck.

## Type

Geist Sans, already self-hosted — never link a webfont URL. Carry hierarchy
with size and weight, not extra families.

Feed title 19/27 bold · page title 26–30 bold · body 15–17/22–27 · meta 13/18 ·
pill 12 bold. Use `tabular-nums` wherever counts sit next to each other.

## Motion

Present but quiet. `active:scale-[0.98]` on buttons, colour transitions on
hover, `transition-shadow` on interactive cards. The vote arrow nudges up on
hover so the control previews its own direction.

Panels that appear and disappear must animate **both ways** — drive `display`
through `allow-discrete` + `@starting-style` (see `.menu-panel` and
`.auth-dialog`), never `{open && …}`, which unmounts before an exit animation
can run. Everything animated belongs in the `prefers-reduced-motion` block.

## Component patterns

**Posts lead with the person.** Avatar, name, time, then content, then a row of
actions along the bottom. Never a counter bolted to the left edge.

**Avatars fall back to initials**, coloured from the user id so one person is
always one colour. Almost nobody uploads a photo — the fallback is the default
case and must look deliberate.

**Show the crowd before asking someone to join it.** A face pile beats a
number: "twelve people" is an abstraction, six faces is a neighbourhood.

**Filters with few options are chips, not dropdowns.** Five districts in a
select box hide all five behind a click and give no sense of how many exist.

**A map is paired with a list.** A bare map is a wall of identical pins you can
only poke at; hovering a card lights its pin so the two halves explain each
other. Use the Carto Voyager basemap — default OSM tiles are saturated enough
that coloured pins disappear into the streets.

## Writing

French first, English mirrored, in `utils/i18n.ts`. Name things the way a
resident would: *appuyer un sujet*, not *soumettre un vote*. Controls say what
happens; errors say what to fix. Never translate user-written content.

## What to avoid

Rectangles with square corners, heavy grey borders, mid-grey text on white,
counters detached from their action, dropdowns for two or three choices, and
any surface that reads as a form when it could read as a conversation.
