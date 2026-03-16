# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AdaptTrust** — an HCI experiment comparing four types of autonomous vehicle explanations to measure passenger trust calibration. Team: Meet Jain & Yash Phalle (CS 6170, Northeastern). Target venue: CHI 2026.

Explanation conditions: (1) No explanation, (2) Template-based, (3) LLM-Descriptive (GPT-4V factual), (4) LLM-Teleological (GPT-4V goal-oriented).

Metrics: Jian Trust Scale (12-item), Comprehension accuracy, Mental Model Quality (0–4, Cohen's κ > 0.70), NASA-TLX cognitive load.

## Environment Setup

The project uses a conda environment (`carla-xav`, Python 3.10) with CARLA 0.9.15 installed separately at `~/carla/`.

**Restore exact environment (preferred):**
```bash
conda env create -f carla-xav-environment.yml
conda activate carla-xav
```

**API keys:** Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`. Load in scripts via `python-dotenv`.

**Important:** If ROS is installed, the conda env has `PYTHONPATH=""` set via `conda env config vars` to prevent ROS path leakage.

## Running the Project

CARLA requires two terminals:

**Terminal 1 — CARLA server:**
```bash
cd ~/carla
./CarlaUE4.sh -quality-level=Epic   # data collection
./CarlaUE4.sh -quality-level=Low    # development/testing
```

**Terminal 2 — Python client:**
```bash
conda activate carla-xav
cd ~/path/to/xav
python scripts/your_script.py
```

CARLA listens on TCP ports 2000 and 2001.

**Verify setup:**
```bash
python -c "import carla; print(dir(carla))"
python -c "import torch; print(torch.__version__)"
python -c "import ultralytics; print('YOLO ok')"
python -c "import openai; print('OpenAI ok')"
```

## Architecture

The pipeline flows: **scenario definition → autonomous driving → data collection → explanation generation → video composition → user study → statistical analysis**

| Directory | Purpose |
|---|---|
| `scripts/scenarios/` | 20 CARLA scenario definitions |
| `scripts/autonomous/` | YOLO-based detection, PID controller, sensor fusion |
| `scripts/data_collection/` | Records RGB video, LiDAR point clouds, telemetry JSON |
| `scripts/explanation_gen/` | GPT-4V calls to generate the 4 explanation types |
| `scripts/video_pipeline/` | OpenCV overlay of explanations onto video + export |
| `data/scenarios/` | Raw recorded data (not committed — too large) |
| `data/explanations/` | Generated explanation text per scenario |
| `analysis/survey/` | Qualtrics survey design |
| `analysis/stats/` | R / Python mixed-effects models |
| `paper/` | CHI 2026 draft |

## Git Workflow

Feature-branch model — never push directly to `main`; all merges via PR with at least one review.

Branch prefixes: `feature/`, `fix/`, `data/`, `analysis/`

## Known Issues

- **MESA warning** (`Driver does not support 0x7d67 PCI ID`) on RTX 5060 (Blackwell) — harmless, CARLA uses NVIDIA proprietary driver.
- **CARLA 0.9.15 download**: GitHub release links are broken — use the Backblaze URL in README Step 8.
- **`nvidia-smi` shows CUDA 13.0 / `nvcc` shows 11.5**: project uses conda-managed CUDA; system nvcc is irrelevant.
