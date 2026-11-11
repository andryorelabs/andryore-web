---
key: snug
lang: en
draft: false
name: "Snug"
value: "Back up and move your bookmarks between browsers, exactly as you left them."
description: "A browser extension to export, import and back up your bookmarks. Everything
  stays on your device."
state: live
kind: product
version: "v2.2.0"
year: "2024"
url: https://snug.andryore.dev
changelog: https://snug.andryore.dev/changelog
links:
  chromeWebStore: "https://chromewebstore.google.com/detail/gdhpeilfkeeajillmcncaelnppiakjhn"
  source: "https://github.com/AndryOre/snug"
stats:
  - icon: "tag"
    value: "v2.2.0"
    label: "Version"
    date: "2026-10-10"
  - icon: "users"
    value: "5,000"
    label: "Users · Chrome Web Store"
    date: "2026-10-05"
  - icon: "star"
    value: "4.8"
    label: "From 20 ratings"
  - icon: "languages"
    value: "10"
    label: "Languages"
proof:
  - label: "Version"
    value: "v2.2.0"
    date: "2026-10-10"
  - label: "Users on Chrome Web Store"
    value: "5,000"
    date: "2026-10-05"
platforms:
  - icon: "chrome"
    label: "Chrome"
    href: "https://chromewebstore.google.com/detail/gdhpeilfkeeajillmcncaelnppiakjhn"
  - icon: "edge"
    label: "Edge"
    href: "https://microsoftedge.microsoft.com/addons/detail/efknehclgcncocgochoibgiiagklcnho"
  - icon: "brave"
    label: "Brave"
  - icon: "opera"
    label: "Opera"
platformNote: "Brave and Opera install from the Chrome Web Store listing. No Firefox or
  Safari build."
importsFrom:
  - icon: "firefox"
    label: "Firefox"
  - icon: "safari"
    label: "Safari"
exportFormats:
  - icon: "file-code"
    label: "HTML"
  - icon: "file-json"
    label: "JSON"
  - icon: "file-spreadsheet"
    label: "CSV"
  - icon: "file-text"
    label: "Markdown"
  - icon: "file-code"
    label: "OPML"
  - icon: "file-code"
    label: "XBEL"
importFormats:
  - icon: "file-code"
    label: "HTML"
  - icon: "file-json"
    label: "JSON"
  - icon: "file-spreadsheet"
    label: "CSV"
  - icon: "file-code"
    label: "XBEL"
  - icon: "hard-drive"
    label: "Chrome profile file"
  - icon: "file-down"
    label: "Safari export"
cards:
  - icon: "eye"
    title: "Preview first"
    body: "Every import is itemized. Pick bookmarks or folders before anything
      changes."
  - icon: "undo-2"
    title: "Undo a replace"
    body: "A safety snapshot is saved first, and the latest five are kept."
  - icon: "history"
    title: "Backs up by itself"
    body: "Hourly to weekly, to Downloads or a folder you choose. Off by default."
callout:
  icon: "shield-check"
  title: "No network calls"
  body: "Everything stays on your device. No account, open source under MIT."
skinTones: false
website:
  src: "../../assets/products/snug/website.png"
  alt: "Capture of the Snug website"
  host: "snug.andryore.dev"
gallery:
  - src: "../../assets/products/snug/01-export.png"
    alt: "Snug export screen"
  - src: "../../assets/products/snug/02-import.png"
    alt: "Snug import screen with a preview of what will change"
  - src: "../../assets/products/snug/03-auto-export.png"
    alt: "Snug automatic backup settings"
stack:
  - "WXT"
  - "React"
  - "TypeScript"
  - "Tailwind CSS"
image:
  src: "../../assets/products/snug-og.png"
  alt: "Snug social preview card"
  placeholder: false
---

I needed my bookmarks as JSON so an AI could classify them. The extensions I
found for it were bad, so I built one for myself and it grew from there.

Today Snug exports to six formats, previews every import, can undo a replace and
backs up on a schedule. Everything stays on your device, and the code is open
source.

It has limits. It does not sync between devices, and I see it as the first piece
of something larger around bookmarks.
