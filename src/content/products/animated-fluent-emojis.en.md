---
key: animated-fluent-emojis
lang: en
draft: false
name: "Animated Fluent Emojis"
value: "Microsoft’s animated Fluent emojis as one component: one import, one tag, for
  React, Vue, Svelte, Astro or plain HTML."
description: "Animated Fluent emojis as one component for React, Vue, Svelte, Astro or
  plain HTML. Pre-1.0 and actively maintained."
state: live
kind: product
version: "v0.8.0"
year: "2024"
url: https://animated-fluent-emojis.andryore.dev
changelog: https://animated-fluent-emojis.andryore.dev/changelog
links:
  npm: "https://www.npmjs.com/package/animated-fluent-emojis"
  source: "https://github.com/AndryOre/animated-fluent-emojis"
stats:
  - icon: "tag"
    value: "v0.8.0"
    label: "Version · pre-1.0"
    date: "2026-10-06"
  - icon: "sparkles"
    value: "3,310"
    label: "Animated files, skin tones included"
  - icon: "palette"
    value: "6"
    label: "Skin tones"
  - icon: "scale"
    value: "MIT"
    label: "Code; the artwork is Microsoft’s"
proof:
  - label: "Version"
    value: "v0.8.0 (pre-1.0)"
    date: "2026-10-06"
platforms:
  - icon: "react"
    label: "React"
  - icon: "vue"
    label: "Vue"
  - icon: "svelte"
    label: "Svelte"
  - icon: "astro"
    label: "Astro"
  - icon: "box"
    label: "Web component"
platformNote: "Angular, Solid and Preact use the web component."
importsFrom: []
exportFormats: []
importFormats: []
cards:
  - icon: "play"
    title: "Plays on load"
    body: "Or on hover and on focus. You choose the trigger."
  - icon: "accessibility"
    title: "Respects reduced motion"
    body: "Rests on a still frame instead of looping."
  - icon: "layout-template"
    title: "Holds its space"
    body: "The layout never shifts while an emoji loads."
callout:
  icon: "zap"
  title: "About 5 kB for the React bundle"
  body: "A size budget, not a measurement. Sprite sheets load from a CDN you can
    mirror."
skinTones: true
sprites:
  - src: "../../assets/products/sprites/fire.png"
    alt: "Animated fire emoji"
    frames: 48
    fps: 24
  - src: "../../assets/products/sprites/party-popper.png"
    alt: "Animated party popper emoji"
    frames: 61
    fps: 24
  - src: "../../assets/products/sprites/sparkles.png"
    alt: "Sparkles emoji"
    frames: 1
    fps: 24
  - src: "../../assets/products/sprites/hundred-points.png"
    alt: "Animated hundred points emoji"
    frames: 48
    fps: 24
website:
  src: "../../assets/products/afe/website.png"
  alt: "Capture of the Animated Fluent Emojis gallery"
  host: "animated-fluent-emojis.andryore.dev"
gallery: []
stack:
  - "TypeScript"
  - "React"
  - "Astro + Starlight"
image:
  src: "../../assets/products/afe-og.png"
  alt: "Animated Fluent Emojis social preview card"
  placeholder: false
---

I had already found animated emojis in other projects, but the files were heavy,
the sets were incomplete or out of date, and their sites were painfully slow
when all I needed was one emoji. So I built it myself.

I started with the library and then used it for the gallery site. One import and
one tag work in React, Vue, Svelte, Astro or plain HTML, respect reduced motion
and hold their space while loading, so the page never shifts.

It is pre-1.0 and actively maintained.
