---
name: cquiz
description: A bright classroom conversation with a precise instructor console.
colors:
  ink: "#172b4d"
  muted: "#52627a"
  surface: "#ffffff"
  ground: "#f2f5f9"
  blue: "#234d91"
  blue-deep: "#173b75"
  blue-soft: "#e9f0fb"
  accent: "#bd4a00"
  accent-deep: "#963b00"
  accent-soft: "#fff0e5"
  line: "#c3ccda"
  success: "#166044"
  success-soft: "#e9f6ef"
  error: "#a32637"
  error-soft: "#fff0f2"
  focus: "#0055bb"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "36px"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "32px"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  pill: "9999px"
  small: "4px"
  control: "8px"
  surface: "16px"
spacing:
  tiny: "4px"
  compact: "8px"
  control: "12px"
  group: "16px"
  section: "24px"
  panel: "32px"
  room: "40px"
  generous: "48px"
  stage: "64px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "48px"
  button-turn:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    height: "48px"

---

# Design System: cquiz

## Overview

**Creative North Star: "The Conversation Floor"**

The Conversation Floor keeps attention on the person contributing and the question being explored. White surfaces, deep blue text, and orange turn controls create a bright classroom interface. The instructor console uses compact navigation and readable evidence rather than theatrical game-show decoration.

**Key Characteristics:**

- One primary student task at a time.
- Flat tonal surfaces and clear interaction states.
- A compact desktop console with mobile reflow.

## Colors

### Primary

Deep classroom blue supplies administrative actions, links, selected ratings, and navigation states. Burnt orange identifies the active speaking opportunity and completion control; its pale companion marks the selected speaker.

### Neutral

White is the student surface and instructor panel ground. The cool gray-blue workspace separates instructor regions. Deep navy carries primary text, muted blue-gray supports secondary text, and cool borders define fields and data rows.

Semantic green and red pair with success and failure copy. Bright blue marks keyboard focus.

**The Floor Rule.** Orange identifies active contribution; blue identifies administrative actions.

## Typography

**Display Font:** Self-hosted Manrope, sans-serif fallback.
**Body Font:** Self-hosted Manrope, sans-serif fallback.

Display type appears in entry screens. Desktop page headings use the headline role; mobile questions use the title role. Body copy is regular; controls and labels are semibold. Secondary metadata uses the smaller 12px and 14px source steps. Balanced headings use tracking of -0.025em; brand lettering uses -0.04em. Timers and numerical assessments use tabular figures.

**The Single Voice Rule.** Use self-hosted Manrope for every type role; scale and weight establish hierarchy.

## Layout

Students use a single column with a maximum width of 640px and 24px side padding. The fixed footer respects safe-area insets; the page reserves bottom space for it. Entry forms have a maximum width of 460px.

The desktop instructor shell has a 224px sidebar, top exam selector, and workspace capped at 1760px. Setup pairs the main workspace with a 320px configuration column, expanding to 360px at 1440px. At 960px the sidebar becomes an 80px icon rail and setup stacks; at 640px navigation moves to the top. The 1190px breakpoint simplifies imports and supporting form grids. Spacing follows the extracted scale, with tighter control groups and larger separation between tasks. Tables preserve their readable columns inside a labeled scroll region.

## Elevation & Depth

The interface uses flat tonal layers without decorative shadows or glass. White panels separate from the cool workspace by spacing. Pale orange identifies an active turn; pale blue marks selection and regrouping. Focus outlines are interaction feedback, not elevation.

**The Flat Surface Rule.** Use tonal surfaces and spacing for depth; the shipped interface has no decorative shadows.

## Shapes

Panels use the surface radius; controls and transcripts use the control radius. Status strips use the smaller radius. Pills are reserved for compact badges, and speaker avatars use circles. Inputs and data rows use thin borders. Standard buttons and rating choices have a 48px minimum height; compact mobile instructor navigation uses 44px targets.

## Components

### Buttons

Primary blue actions use white semibold text. Orange actions identify the speaker's contribution. Secondary controls use white surfaces and cool borders; ghost actions use blue text. Hover deepens filled controls or applies a pale surface. Active buttons move down one pixel. Disabled buttons have reduced opacity and a disabled cursor.

### Inputs / Fields

Fields have white surfaces, cool borders, control-radius corners, and 12px padding. Labels precede inputs; guidance and errors follow them. Keyboard focus uses a three-pixel blue outline with a three-pixel offset. Errors use red copy that explains the recovery.

### Navigation

Instructor navigation pairs Phosphor icons with labels on desktop and uses icons at narrow widths. Active navigation uses pale blue with deep blue text. All items retain accessible names when labels disappear.

### Chips / Containers

Badges provide short neutral or semantic statuses with pill corners. Panels use white, pale blue, or pale orange surfaces and consistent internal spacing. No nested decorative card vocabulary is needed.

### Rating Scale

Five radio choices belong to a fieldset with a statement legend and visible disagreement/agreement anchors. Selected choices use blue with white text. Each choice retains a visible focus state and a minimum height of 48px.

### Transcript / Distribution

Live text is read-only and visually separated in a cool surface with an orange border while listening. Submission has an explicit action boundary. Score histograms label ranges in points and counts in students; empty ranges have no bar.

State feedback uses a 180ms transition with the source easing; reduced-motion settings remove transitions and animation. Loading, empty, error, disabled, and successful states use plain text and the same palette.

## Do's and Don'ts

### Do:

- Do keep the current question and speaker visually primary.
- Do pair semantic colors with explicit status text.
- Do preserve visible keyboard focus and native radio semantics.
- Do identify synthetic rehearsal evidence explicitly.
- Do label histogram score ranges and student counts.

### Don't:

- Don't expose rankings or answer rubrics on student screens.
- Don't replace meaningful headings with topic or destination eyebrows.
- Don't add decorative entrance animation or game-show noise.
- Don't render a nonzero bar for an empty score bin.
