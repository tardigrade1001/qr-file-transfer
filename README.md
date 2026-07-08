# 📡 qrbeam

**Beam a small file from one screen to another device by QR code — no cable, no USB, no app, no network between the two machines.**

🔗 **Live receiver:** https://getqrbeam.netlify.app

qrbeam moves a file **off an offline / locked-down computer** (no USB slot free, no shared network, can't install anything) by turning it into a stream of QR codes on screen, which any phone or laptop camera reads and reassembles back into the original file.

It was built for a real problem: pulling data exports off an **air-gapped Windows 7 lab instrument** when you forgot the USB stick — but it works for any small file on any machine.

---

## How it works

qrbeam has two halves that never touch each other's network — the only link is a **camera looking at a screen**:

| | | |
|---|---|---|
| **Sender** | `sender/QR-Transfer.html` | A single offline HTML file. Runs on the source machine straight from disk (double-click) — no install, no internet. Reads any file → Base64 → splits it into chunks → shows them as QR codes (one at a time, or an auto-cycling loop). |
| **Receiver** | `receiver/index.html` | A web app (hosted, needs HTTPS for the camera). Open it on a phone/laptop → point the camera at the sender's screen → it catches every page, dedupes, reassembles, and **auto-downloads** the original file with the right name and type. |

Each QR carries a small header — `QRT2|fileId|page|total|filename|data` — so the receiver can order the chunks, skip duplicates it's already seen, know when it has the complete set, and reset cleanly when a new file starts.

```
[ offline PC ]                         [ your phone / laptop ]
  sender.html  ──shows QR pages──►  camera  ──►  receiver (getqrbeam.netlify.app)
                                                      │
                                                      ▼
                                               downloads original file
```

---

## Usage

**On the source machine (offline):**
1. Open `sender/QR-Transfer.html` (just double-click — it works with no internet).
2. **① Open the receiver** — scan the QR at the top with your phone/laptop to open `getqrbeam.netlify.app` there.
3. **② Pick the file** (drag & drop or browse). Up to ~50 KB (best under ~20 KB).
4. **③ Build**, then hit **⛶ Fullscreen** so the QR fills the screen.

**On your phone / laptop:**
5. On the receiver, tap **Start camera** and aim at the sender's screen.
6. Watch the page grid fill in — when every page is captured, the file **downloads automatically**.

> **Laptop trick:** open the receiver on your laptop and point its webcam at the offline PC's screen — the file lands straight in your laptop's Downloads. No phone needed.

---

## Why a hosted receiver?

Browser camera access (`getUserMedia`) requires **HTTPS**, so the receiver has to be served (e.g. Netlify), not opened as a local file. The **sender** stays fully offline — the offline machine never needs internet; only its *screen* is read.

---

## Limits

- **Small files.** QR is a low-bandwidth channel. Great up to ~tens of KB; a 50 KB file becomes ~35–48 QR pages (~1 min of auto-play capture).
- **Binary is fine but inflates.** Non-text files are Base64-encoded (+~33%). Text/CSV/JSON are the sweet spot; images/xlsx/pdf work if small.
- **Not for large or sensitive-at-scale transfers** — it's a convenience escape hatch, not a pipe.

---

## Tech

- Pure HTML/CSS/JavaScript. **Zero build step, zero framework, no external calls** — everything is inlined so both halves work offline.
- QR **encoding**: [`qrcode-generator`](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT).
- QR **decoding**: [`jsQR`](https://github.com/cozmo/jsQR) (Apache-2.0).
- Verified byte-exact round-trip (binary, PNG, and UTF-8 text) via shuffled + duplicated frames.

---

## Repo layout

```
qrbeam/
├── sender/
│   └── QR-Transfer.html   # offline sender — run on the source machine
├── receiver/
│   └── index.html         # hosted receiver — deploy this folder (Netlify, etc.)
├── README.md
└── LICENSE
```

Deploy the **`receiver`** folder to any static host with HTTPS. The receiver URL is set in one line near the top of the sender's script (`RECEIVER_URL`).

---

## License

MIT © Uddipan — see [LICENSE](LICENSE). Bundled libraries retain their own licenses (MIT / Apache-2.0).

<!-- TODO: add screenshots / a demo GIF here (sender screen + phone catching pages) -->
