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
---

# Design System: cquiz

## Overview

Creative north star: the conversation floor. Orange signals the opportunity to speak; navy and white keep everything else legible. Both surfaces operate, rather than persuade. The user approved this visual direction and delegated implementation details.

## Colors

White surfaces on a cool classroom ground. Deep blue ink and blue administrative actions. Burnt orange is reserved for active student contribution. Semantic green/error red always accompanies explicit text. Focus uses a visible blue outline. Source primitives are the custom properties at the top of src/styles.css.

## Typography

Self-hosted Manrope, one family. Fixed role-specific scale; no fluid dashboard display sizes. Tabular numbers for timing and scores. No decorative monospace, italics, all-caps labels or heading gradients. Body prose remains concise; question typography is the student's primary visual element.

## Layout

Student composition is a single column, maximum 640px, with 24px phone padding and safe-area footer. Instructor composition is a desktop sidebar, top exam selector and workspace. Setup has a secondary right configuration panel; live mode uses variable table groups; results use a scrollable labeled data region. At 960px sidebar collapses; at 640px it becomes a compact top navigation. At 320px the page does not overflow horizontally.

## Elevation & Depth

Flat tonal layers. No decorative shadows or glass. Selected response and field borders carry interaction state. Surfaces are separated by spacing rather than repeated nested boxes.

## Shapes

16px panel surfaces, 8px controls and transcript, 4px micro surfaces. Pills only for small status badges. Touch controls at least 48px, rating items at least 48px. Branded microphone mark is an icon, not illustrative filler.

## Components

Primary action is unique per task state. Peer scales use fieldsets, legends, five radio values and anchored disagreement/agreement labels. Speech text is readonly and live; recording/stop/error cues are explicit. Instructor controls include loading, disabled, success and failure states. Motion is feedback only, 180ms with custom cubic easing, disabled for reduced motion.

## Do's and Don'ts

Do preserve question focus, private ratings, readable data and clear connection failures. Do separate rehearsal evidence from real assessment. Do not expose rankings or rubrics to students, animate page entry, add game-show noise, or infer virtual conferencing from individual phone support.

Design workflow: frontend-design for subject-specific direction; landing-page-design for token discipline; Impeccable Operate/craft floor for task focus; design-better for hierarchy, forms, targets, reflow and states; React performance guidance for stable handlers and subscriptions; Web Interface Guidelines for final audit. The Impeccable engine launcher was unavailable; its direct references were read. Image-derived design-system and scroll-craft are not applicable to this image-free exam UI.
