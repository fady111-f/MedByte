# SVD RAM Defender — MedByte OS Lab

> **Adaptive Low-Rank Memory Compression Framework for Operating Systems**

An interactive research companion and minigame that visualizes how Singular Value Decomposition (SVD) can be integrated into OS memory management to intelligently compress RAM pages under pressure.

## 🔗 Live Demo

Open `index.html` directly in any modern browser — no build step required.

## 🧠 What It Does

The system samples memory pages, reshapes them into matrices, and applies truncated SVD. Pages that are **low-rank (structured)** are compressed for significant memory savings. Pages that are **high-entropy (random/noisy)** are stored raw to avoid costly reconstruction errors.

### Key Metrics
| Scenario | Storage Saving |
|---|---|
| 64×64 page at rank 8 | **75%** savings |
| Aggressive compression | up to **87.5%** reduction |

## 🎮 SVD RAM Defender — The Game

Act as the OS memory manager:
- **← Arrow / Compress button** → Apply SVD compression (great for structured pages)
- **→ Arrow / Store Raw button** → Store page as-is (safe for random pages)
- Build **combo streaks** for bonus points!
- Keep RAM below 100% as memory pressure climbs

## 📐 SVD Visualizer

Interactive slider to explore how rank `k` affects reconstruction quality and compression ratio in real-time.

## 📁 Project Structure

```
TCCD/
├── index.html        # Main page
├── styles.css        # Design system & layout
├── app.js            # Game logic, SVD visualizer, charts
└── assets/
    └── MedByte_Report.pdf   # Full research paper
```

## 🛠 Tech Stack

- **Vanilla HTML/CSS/JS** — zero dependencies
- **Canvas API** — matrix rain, game engine, charts
- **SVD** implemented from scratch via power iteration

## 📄 Research Paper

Download the full PDF from the site or see `assets/MedByte_Report.pdf`.

---

Built by **MedByte OS Lab** · For educational and research purposes.
