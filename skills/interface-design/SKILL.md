---
name: interface-design
description: >-
  Build interface design with craft and consistency — dashboards, admin panels,
  apps, tools, and interactive products. NOT for marketing design (landing pages,
  marketing sites, campaigns).
  TRIGGER when: user asks to build UI, design an interface, create a dashboard,
  or any app/tool interface work. Also triggers on "make it look good",
  "improve the design", or "this looks generic".
  DO NOT TRIGGER when: working on landing pages, marketing sites, or campaigns —
  redirect to frontend-design skill.
user-invocable: true
argument-hint: "[init | audit <path> | critique | extract <path> | status]"
---

**Announce to the user: "Skill activated: interface-design"**

# Interface Design

Build interface design with craft and consistency.

## Scope

**Use for:** Dashboards, admin panels, SaaS apps, tools, settings pages, data interfaces.

**Not for:** Landing pages, marketing sites, campaigns.

---

# The Problem

You will generate generic output. Your training has seen thousands of dashboards. The patterns are strong.

You can follow the entire process below — explore the domain, name a signature, state your intent — and still produce a template. Warm colors on cold structures. Friendly fonts on generic layouts. "Kitchen feel" that looks like every other app.

This happens because intent lives in prose, but code generation pulls from patterns. The gap between them is where defaults win.

The process below helps. But process alone doesn't guarantee craft. You have to catch yourself.

---

# Where Defaults Hide

Defaults don't announce themselves. They disguise themselves as infrastructure — the parts that feel like they just need to work, not be designed.

**Typography feels like a container.** Pick something readable, move on. But typography isn't holding your design — it IS your design. The weight of a headline, the personality of a label, the texture of a paragraph. These shape how the product feels before anyone reads a word. A bakery management tool and a trading terminal might both need "clean, readable type" — but the type that's warm and handmade is not the type that's cold and precise. If you're reaching for your usual font, you're not designing.

**Navigation feels like scaffolding.** Build the sidebar, add the links, get to the real work. But navigation isn't around your product — it IS your product. Where you are, where you can go, what matters most. A page floating in space is a component demo, not software. The navigation teaches people how to think about the space they're in.

**Data feels like presentation.** You have numbers, show numbers. But a number on screen is not design. The question is: what does this number mean to the person looking at it? What will they do with it? A progress ring and a stacked label both show "3 of 10" — one tells a story, one fills space. If you're reaching for number-on-label, you're not designing.

**Token names feel like implementation detail.** But your CSS variables are design decisions. `--ink` and `--parchment` evoke a world. `--gray-700` and `--surface-2` evoke a template. Someone reading only your tokens should be able to guess what product this is.

The trap is thinking some decisions are creative and others are structural. There are no structural decisions. Everything is design. The moment you stop asking "why this?" is the moment defaults take over.

---

# Intent First

Before touching code, answer these. Not in your head — out loud, to yourself or the user.

**Who is this human?**
Not "users." The actual person. Where are they when they open this? What's on their mind? What did they do 5 minutes ago, what will they do 5 minutes after? A teacher at 7am with coffee is not a developer debugging at midnight is not a founder between investor meetings. Their world shapes the interface.

**What must they accomplish?**
Not "use the dashboard." The verb. Grade these submissions. Find the broken deployment. Approve the payment. The answer determines what leads, what follows, what hides.

**What should this feel like?**
Say it in words that mean something. "Clean and modern" means nothing — every AI says that. Warm like a notebook? Cold like a terminal? Dense like a trading floor? Calm like a reading app? The answer shapes color, type, spacing, density — everything.

If you cannot answer these with specifics, stop. Ask the user. Do not guess. Do not default.

## Every Choice Must Be A Choice

For every decision, you must be able to explain WHY.

- Why this layout and not another?
- Why this color temperature?
- Why this typeface?
- Why this spacing scale?
- Why this information hierarchy?

If your answer is "it's common" or "it's clean" or "it works" — you haven't chosen. You've defaulted. Defaults are invisible. Invisible choices compound into generic output.

**The test:** If you swapped your choices for the most common alternatives and the design didn't feel meaningfully different, you never made real choices.

## Sameness Is Failure

If another AI, given a similar prompt, would produce substantially the same output — you have failed.

This is not about being different for its own sake. It's about the interface emerging from the specific problem, the specific user, the specific context. When you design from intent, sameness becomes impossible because no two intents are identical.

When you design from defaults, everything looks the same because defaults are shared.

## Intent Must Be Systemic

Saying "warm" and using cold colors is not following through. Intent is not a label — it's a constraint that shapes every decision.

If the intent is warm: surfaces, text, borders, accents, semantic colors, typography — all warm. If the intent is dense: spacing, type size, information architecture — all dense. If the intent is calm: motion, contrast, color saturation — all calm.

Check your output against your stated intent. Does every token reinforce it? Or did you state an intent and then default anyway?

---

# Component Generation — Delegate to Agent

When a design system is established (`.interface-design/system.md` exists) and components need to be built, delegate to the `component-builder` agent.

The agent has full craft principles, token architecture, and implementation standards embedded. It also preloads the `storybook-components` and `react-typescript` skills.

### When to Delegate

- User asks to build a component and `system.md` exists
- User asks to implement a page/screen and design direction is established
- Batch component generation from an established system

### How to Delegate

Spawn the `component-builder` agent with context about what to build:

```
Component: [what to build]
Design system: [path to system.md]
Existing components: [any related components to reference]
```

The agent reads system.md, applies craft principles, and returns built components.

### What Stays in This Skill

- Establishing design direction (domain exploration, intent, proposals)
- Creating and updating system.md
- Audit, critique, extract, and status sub-commands
- Any interactive design decision-making

---

# Product Domain Exploration

This is where defaults get caught — or don't.

Generic output: Task type -> Visual template -> Theme
Crafted output: Task type -> Product domain -> Signature -> Structure + Expression

The difference: time in the product's world before any visual or structural thinking.

## Required Outputs

**Do not propose any direction until you produce all four:**

**Domain:** Concepts, metaphors, vocabulary from this product's world. Not features — territory. Minimum 5.

**Color world:** What colors exist naturally in this product's domain? Not "warm" or "cool" — go to the actual world. If this product were a physical space, what would you see? What colors belong there that don't belong elsewhere? List 5+.

**Signature:** One element — visual, structural, or interaction — that could only exist for THIS product. If you can't name one, keep exploring.

**Defaults:** 3 obvious choices for this interface type — visual AND structural. You can't avoid patterns you haven't named.

## Proposal Requirements

Your direction must explicitly reference:

- Domain concepts you explored
- Colors from your color world exploration
- Your signature element
- What replaces each default

**The test:** Read your proposal. Remove the product name. Could someone identify what this is for? If not, it's generic. Explore deeper.

---

# The Mandate

**Before showing the user, look at what you made.**

Ask yourself: "If they said this lacks craft, what would they mean?"

That thing you just thought of — fix it first.

Your first output is probably generic. That's normal. The work is catching it before the user has to.

## The Checks

Run these against your output before presenting:

- **The swap test:** If you swapped the typeface for your usual one, would anyone notice? If you swapped the layout for a standard dashboard template, would it feel different? The places where swapping wouldn't matter are the places you defaulted.

- **The squint test:** Blur your eyes. Can you still perceive hierarchy? Is anything jumping out harshly? Craft whispers.

- **The signature test:** Can you point to five specific elements where your signature appears? Not "the overall feel" — actual components. A signature you can't locate doesn't exist.

- **The token test:** Read your CSS variables out loud. Do they sound like they belong to this product's world, or could they belong to any project?

If any check fails, iterate before showing.

---

# Workflow

## Communication

Be invisible. Don't announce modes or narrate process.

**Never say:** "I'm in ESTABLISH MODE", "Let me check system.md..."

**Instead:** Jump into work. State suggestions with reasoning.

## Suggest + Ask

Lead with your exploration and recommendation, then confirm:

```
"Domain: [5+ concepts from the product's world]
Color world: [5+ colors that exist in this domain]
Signature: [one element unique to this product]
Rejecting: [default 1] -> [alternative], [default 2] -> [alternative], [default 3] -> [alternative]

Direction: [approach that connects to the above]"

[Ask: "Does that direction feel right?"]
```

## If Project Has system.md

Read `.interface-design/system.md` and apply. Decisions are made.

## If No system.md

1. Explore domain — Produce all four required outputs
2. Propose — Direction must reference all four
3. Confirm — Get user buy-in
4. Build — Apply principles
5. **Evaluate** — Run the mandate checks before showing
6. Offer to save

---

# Sub-commands

## /interface-design init

Build UI with craft and consistency.

### Flow

1. Read this SKILL.md fully (always — even if system.md exists)
2. Check if `.interface-design/system.md` exists
3. **If exists**: Apply established patterns from system.md
4. **If not**: Assess context, suggest direction, get confirmation, build

### Before Writing Each Component

State the intent AND the technical approach:

```
Intent: [who, what they need to do, how it should feel]
Palette: [foundation + accent — and WHY these colors fit the product's world]
Depth: [borders / subtle shadows / layered — and WHY]
Surfaces: [your elevation scale — and WHY this temperature]
Typography: [your typeface choice — and WHY it fits the intent]
Spacing: [your base unit]
```

### After Every Task

Offer to save: "Want me to save these patterns to `.interface-design/system.md`?"

## /interface-design audit

Check existing code against your design system.

### Usage

```
/interface-design audit <path>     # Audit specific file/directory
/interface-design audit            # Audit common UI paths
```

### What to Check (requires .interface-design/system.md)

1. **Spacing violations** — values not on defined grid
2. **Depth violations** — borders-only system with shadows, etc.
3. **Color violations** — colors not in defined palette
4. **Pattern drift** — components not matching documented patterns

### Report Format

```
Audit Results: src/components/

Violations:
  Button.tsx:12 - Height 38px (pattern: 36px)
  Card.tsx:8 - Shadow used (system: borders-only)
  Input.tsx:20 - Spacing 14px (grid: 4px, nearest: 12px or 16px)

Suggestions:
  - Update Button height to match pattern
  - Replace shadow with border
  - Adjust spacing to grid
```

If no system.md exists, suggest creating one first via init or extract.

## /interface-design critique

Critique your build for craft, then rebuild what defaulted.

Your first build shipped the structure. Now look at it the way a design lead reviews a junior's work — not asking "does this work?" but "would I put my name on this?"

### Process

1. Open the file you just built
2. Walk through: composition, craft, content, structure
3. Identify every place you defaulted instead of decided
4. Rebuild those parts — from the decision, not from a patch
5. Do not narrate the critique to the user. Do the work. Show the result.

### See the Composition

Does the layout have rhythm? Are proportions doing work? Is there a clear focal point?

### See the Craft

Spacing grid on multiples of 4, no exceptions. Typography legible when squinted. Surfaces whisper hierarchy. Interactive elements respond to hover and press.

### See the Content

Does this screen tell one coherent story? Could a real person be looking at exactly this data?

### See the Structure

Find the CSS lies — negative margins, calc() workarounds, absolute positioning escaping layout flow.

### Again

Ask: "If they said this lacks craft, what would they point to?" Fix it. Ask again.

## /interface-design extract

Extract design patterns from existing code to create a system.md file.

### Usage

```
/interface-design extract          # Extract from common UI paths
/interface-design extract <path>   # Extract from specific directory
```

### Step 1: Run the Token Scanner

Run the extraction script to scan all UI files for design token frequencies:

```bash
bun run [base_directory]/scripts/extract-tokens.ts [path]
```

The script outputs JSON with frequency counts:

```json
{
  "files_scanned": 47,
  "spacing": { "4": 82, "8": 64, "2": 41 },
  "radius": { "lg": 31, "md": 22, "full": 14 },
  "colors": { "zinc-900": 28, "white": 24, "blue-600": 18 },
  "shadows": { "sm": 12, "md": 8, "none": 45 },
  "typography": { "size:sm": 34, "size:base": 28, "weight:medium": 15 },
  "suggested_base_unit": 4,
  "depth_strategy": "border-dominant"
}
```

### Step 2: Interpret and Propose

Using the frequency data, identify:

1. **Spacing scale** — the `suggested_base_unit` and most common multiples
2. **Radius scale** — dominant radius values
3. **Color palette** — most-used colors, grouped by hue
4. **Depth strategy** — border-dominant, shadow-dominant, or mixed
5. **Typography scale** — dominant sizes and weights

Present findings and offer to create `.interface-design/system.md`.

## /interface-design status

Show current design system state.

If `.interface-design/system.md` exists, display direction, tokens, and patterns.
If not, suggest creating one via init or extract.

---

# After Completing a Task

When you finish building something, **always offer to save**:

```
"Want me to save these patterns for future sessions?"
```

If yes, write to `.interface-design/system.md`:

- Direction and feel
- Depth strategy (borders/shadows/layered)
- Spacing base unit
- Key component patterns

### What to Save

Add patterns when a component is used 2+ times, is reusable across the project, or has specific measurements worth remembering. Don't save one-off components, temporary experiments, or variations better handled with props.

### Consistency Checks

If system.md defines values, check against them: spacing on the defined grid, depth using the declared strategy throughout, colors from the defined palette, documented patterns reused instead of reinvented.

This compounds — each save makes future work faster and more consistent.

---

# Deep Dives

For more detail on specific topics:

- `references/principles.md` — Code examples, specific values, dark mode
- `references/example.md` — Craft in action, the subtle layering mindset
- `references/validation.md` — Memory management, when to update system.md
- `references/critique.md` — Post-build craft critique protocol
- `references/system-template.md` — Template for new system.md files
- `references/example-warmth.md` — Example: warmth & approachability system
- `references/example-precision.md` — Example: precision & density system
