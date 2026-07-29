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

- Cards `rounded-[16px]`, inputs `rounded-[12px]`, buttons and chips
  `rounded-full`, list rows `rounded-[14px]`.
- A 4px radius reads as a government form. Generous corners are the single
  cheapest thing that makes this feel friendly — the user asked for them
  explicitly.
- Cards use a hairline border **plus a whisper of shadow**
  (`0_1px_2px_rgba(22,36,31,0.04)`), not a heavy border.
- Every focusable control needs a radius: the focus ring is a `box-shadow`, so
  it traces whatever radius the element has, and anything left at 0 gets a
  hard-cornered rectangle while its neighbours get rounded ones. `globals.css`
  sets a 10px floor in `@layer base`; component utilities still win.

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
