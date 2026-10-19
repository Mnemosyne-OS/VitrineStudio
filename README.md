<div align="center">

<img src="https://raw.githubusercontent.com/Mnemosyne-OS/Mnemosyne-Neural-OS/main/assets/banner-mnemosyne-os.png" width="100%" alt="Mnemosyne OS — Your memory. Your machine. Your rules." />

🌐 [**mnemosyne-os.io**](https://mnemosyne-os.io) — the product&ensp;·&ensp;[**mnemosyne-os.com**](https://mnemosyne-os.com) — for organizations&ensp;·&ensp;📖 [**docs.mnemosyne-os.io**](https://docs.mnemosyne-os.io) — the documentation

</div>

# Vitrine Studio

Stage your own pieces in rooms generated for you, in three beats: the place,
the piece, the life around it. For any craftsperson.

**Needs a Mnemosyne OS license** and Mnemosyne OS 1.8.1 or later: the pictures, the clips, the website, the hosting and the USB copies go through doors the host only has from that version. Pictures and clips are paid in credits.

## Install

In Mnemosyne OS, open **MnemoHub**, choose the install-from-a-link door and paste
`https://github.com/Mnemosyne-OS/VitrineStudio`. The built app is in `dist/`, nothing is
compiled on your machine.

## Your files

- Pieces are the SAME files as MnemoCRM's products (`products/<id>.json`).
- Scenes live in `scenes/<id>.json`, settings in `studio/settings.json`.
- What the three beats mean for a trade is data (`src/model/profiles.ts`).
- The home film is `studio/film.json`, the website's settings `studio/site.json`, what was spent
  `studio/costs.json` (append only, never written when unreadable).

## Where things are

- `src/App.tsx` picks the screen; the state and the gestures live in one hook per subject
  (`src/hooks/`: `useStudio` reads the folder, then `useCosts`, `usePieces`, `useScenes`,
  `useFilm`, `useSite`).
- `src/data/` talks to the host (`host.ts`, every call with a deadline) and to files
  (`folderStore.ts`, `photos.ts`, `webp.ts`, `bytes.ts`).
- `src/site/` builds the website: `buildSite.ts` (data and export), `template.html` (the page),
  `preview.ts` (the same export, in memory), `logo.ts` and `vectorize.ts`.

## Check

```
npx vitest run
npx tsc --noEmit -p tsconfig.eslint.json
npx eslint src --max-warnings 0
```

## Develop

Port 5236. In a Mnemosyne workspace: **MnemoHub → My dev apps → link this folder**.

## Where Mnemosyne OS lives

This cartridge runs inside **Mnemosyne OS**, the sovereign, local-first memory operating system published by XPACEGEMS LLC. Its official addresses:

- Product site: <https://mnemosyne-os.io>
- Organizations: <https://mnemosyne-os.com>
- Documentation: <https://docs.mnemosyne-os.io>
- Host source: <https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS>
- Packages: the npm scope `@mnemosyne_os`

---

<sub>**[Mnemosyne OS](https://mnemosyne-os.io)** — the sovereign, local-first memory OS this cartridge runs in.
Get it at [mnemosyne-os.io/download](https://mnemosyne-os.io/download), install cartridges from the built-in MnemoHub store, or [build your own](https://mnemosyne-os.io/dev).</sub>
