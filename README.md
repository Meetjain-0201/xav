# AdaptTrust — Explainability in Autonomous Vehicles
**CS 6170 AI Capstone | Meet Jain & Yash Phalle | Prof. Stacy Marsella | Target: CHI 2026**

> Do LLM-generated explanations of autonomous vehicle actions improve passenger trust calibration?

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Requirements](#system-requirements)
3. [Verified Hardware](#verified-hardware)
4. [Setup](#setup)
5. [Running the Pipeline](#running-the-pipeline)
6. [Scenarios](#scenarios)
7. [Project Structure](#project-structure)
8. [Output Files](#output-files)
9. [Environment Variables](#environment-variables)
10. [Git Workflow](#git-workflow)
11. [Known Issues](#known-issues)

---

## Project Overview

AdaptTrust records autonomous vehicle scenarios in CARLA and generates four explanation variants for each critical driving event. These videos are shown to study participants to measure how explanation type affects trust calibration.

**Four explanation conditions:**

| # | Type | Description |
|---|---|---|
| 1 | None | No explanation shown (control) |
| 2 | Template | Rule-based text, no API call |
| 3 | LLM-Descriptive | GPT-4o factual description of what happened |
| 4 | LLM-Teleological | GPT-4o goal-oriented explanation of why |

**Metrics:** Jian Trust Scale (12-item), Comprehension accuracy, Mental Model Quality (0–4, Cohen's κ > 0.70), NASA-TLX cognitive load.

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |
| GPU | NVIDIA RTX 2070 (6 GB VRAM) | NVIDIA RTX 3080+ (8 GB+ VRAM) |
| RAM | 16 GB | 32 GB |
| Disk | 30 GB free | 50 GB+ free |
| Python | 3.10 | 3.10 |
| NVIDIA Driver | 525+ | 580+ |

> **RTX 5060 / Blackwell users:** Requires Ubuntu kernel 6.8+. MESA warnings about unknown PCI IDs are harmless — CARLA uses the NVIDIA proprietary driver, not Mesa. Do not use `client.load_world()` between scenarios (causes Signal 11 segfault); use `switch_town.sh` instead.

---

## Verified Hardware

Meet's machine (fully tested):

```
Model:   Lenovo Legion 7 16IAX10
CPU:     Intel Core Ultra 7 255HX
GPU:     NVIDIA GeForce RTX 5060 Laptop (8 GB, Blackwell)
RAM:     32 GB
OS:      Ubuntu 22.04.5 LTS, Kernel 6.8.0
Driver:  580.126.09
```

---

## Setup

### 1. Install Miniconda

```bash
cd ~
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
bash ~/miniconda.sh -b -p ~/miniconda3
~/miniconda3/bin/conda init bash
source ~/.bashrc
```

### 2. Accept Conda Terms of Service (conda 25+)

```bash
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
```

### 3. Restore the environment

```bash
cd ~/xav
conda env create -f carla-xav-environment.yml
conda activate carla-xav
```

> This reproduces the exact package versions used during development. Prefer this over installing manually.

### 4. Isolate from ROS PYTHONPATH (ROS users only)

```bash
conda activate carla-xav
conda env config vars set PYTHONPATH=""
conda deactivate && conda activate carla-xav
echo $PYTHONPATH   # should be empty
```

### 5. Download CARLA 0.9.15

> The GitHub release links for CARLA 0.9.15 are broken. Use this Backblaze URL directly:

```bash
mkdir -p ~/carla && cd ~/carla
wget "https://carla-releases.s3.us-east-005.backblazeb2.com/Linux/CARLA_0.9.15.tar.gz"
tar -xvzf CARLA_0.9.15.tar.gz
```

Expected contents after extraction: `CarlaUE4.sh`, `CarlaUE4/`, `PythonAPI/`, `HDMaps/`

### 6. Set up API key

```bash
cp .env.example .env
# edit .env and add your OpenAI key:
# OPENAI_API_KEY=sk-...
```

### 7. Verify the setup

```bash
conda activate carla-xav
python -c "import carla; print('carla ok')"
python -c "import torch; print(torch.__version__)"
python -c "import ultralytics; print('yolo ok')"
python -c "import openai; print('openai ok')"
python -c "from scripts.scenarios.adaptrust_scenarios import SCENARIO_REGISTRY; print(sorted(SCENARIO_REGISTRY))"
```

---

## Running the Pipeline

Every scenario run produces four overlay videos (one per explanation condition), telemetry JSON, YOLO detections, and a pass/fail verdict.

### Step 1 — Start CARLA on the right map

Each scenario is pinned to a specific CARLA map. Use `switch_town.sh` to restart CARLA on the correct map (this avoids the Signal 11 segfault on Blackwell GPUs that happens with `load_world()`).

```bash
# Syntax: bash scripts/switch_town.sh <MapName>
bash scripts/switch_town.sh Town04   # for H2, L2, M3
bash scripts/switch_town.sh Town03   # for H3, L1, M1
bash scripts/switch_town.sh Town02   # for H1, L3, M2
```

The script kills any running CARLA instance, launches a fresh one on the requested map, and polls until it's ready. Wait for the `[switch_town] CARLA ready` message before proceeding.

Alternatively, start CARLA manually:

```bash
cd ~/carla
./CarlaUE4.sh -quality-level=Low +Map=Town04
```

### Step 2 — Record a scenario

Open a second terminal:

```bash
conda activate carla-xav
cd ~/xav
python scripts/run_adaptrust.py --scenario <SCENARIO_ID> --run <N> --skip-map-reload
```

`--skip-map-reload` is required when using `switch_town.sh` (which already loaded the map).

**Examples:**

```bash
python scripts/run_adaptrust.py --scenario H1_PedestrianDart   --run 1 --skip-map-reload
python scripts/run_adaptrust.py --scenario H2_HighwayCutIn     --run 1 --skip-map-reload
python scripts/run_adaptrust.py --scenario H3_RedLightRunner   --run 1 --skip-map-reload
python scripts/run_adaptrust.py --scenario L1_GreenLightCruise --run 1 --skip-map-reload
```

Output is written to `data/scenarios/<SCENARIO_ID>_run<N>/`.

### Step 3 — Check the verdict

After each run, a verdict file is written automatically:

```bash
cat data/scenarios/H2_HighwayCutIn_run1/scenario_verdict.json
```

For HIGH criticality scenarios, this checks whether an emergency brake (≥ 0.8) actually fired:

```json
{
  "scenario_id": "H2_HighwayCutIn",
  "critical_event_required": "BRAKING",
  "critical_event_fired": true,
  "critical_event_count": 1,
  "PASSED": true,
  "note": "Emergency brake detected"
}
```

If `PASSED` is `false`, the critical event didn't fire — re-run on the correct map.

### Step 4 — Inspect the run (optional)

```bash
python scripts/scene_logger.py data/scenarios/H2_HighwayCutIn_run1
```

Prints a timestamped event log with speed, brake, YOLO detections, and all four explanation strings at each trigger point.

---

## Scenarios

All 9 scenarios, their maps, and what the critical event is:

| ID | Map | Criticality | Critical Event | Description |
|---|---|---|---|---|
| L1_GreenLightCruise | Town03 | LOW | — | Cruise at 40 km/h through all-green lights |
| L2_SlowLeadOvertake | Town04 | LOW | — | Slow lead vehicle at ~20 km/h; ego follows |
| L3_NarrowStreetNav | Town02 | LOW | — | Navigate past 4 parked cars at 20 km/h |
| M1_YellowLightStop | Town03 | MEDIUM | — | TL turns yellow at t=8 s; ego soft-brakes |
| M2_CrosswalkYield | Town02 | MEDIUM | — | Pedestrian crosses; ego yields |
| M3_HighwayMergeYield | Town04 | MEDIUM | — | NPC merges from left; ego yields |
| H1_PedestrianDart | Town02 | HIGH | BRAKING | Child darts into road; ego emergency-brakes |
| H2_HighwayCutIn | Town04 | HIGH | BRAKING | NPC catches up from behind and cuts in; ego emergency-brakes |
| H3_RedLightRunner | Town03 | HIGH | BRAKING | NPC runs red from cross street; ego emergency-brakes |

**Map → scenario mapping:**

| Map | Scenarios |
|---|---|
| Town02 | H1, L3, M2 |
| Town03 | H3, L1, M1 |
| Town04 | H2, L2, M3 |

---

## Project Structure

```
xav/
├── README.md
├── CLAUDE.md                          # Dev notes for Claude Code
├── carla-xav-environment.yml          # Conda environment lock file
├── .env.example                       # API key template
├── .gitignore
│
├── scripts/
│   ├── run_adaptrust.py               # Entry point — run any scenario from CLI
│   ├── adaptrust_runner.py            # Core runner: spawns ego, sensors, tick loop
│   ├── scene_logger.py                # Diagnostic: print event log for a recorded run
│   ├── switch_town.sh                 # Kill + restart CARLA on a new map safely
│   │
│   ├── scenarios/
│   │   └── adaptrust_scenarios.py     # All 9 scenario classes + SCENARIO_REGISTRY
│   │
│   ├── data_collection/
│   │   └── recorder.py                # RGB recording, YOLO detection, trigger logging
│   │
│   ├── explanation_gen/
│   │   └── generator.py               # GPT-4o calls → 4 explanation variants per event
│   │
│   └── video_pipeline/
│       └── overlay.py                 # OpenCV HUD overlay → 4 output videos
│
├── data/
│   ├── scenarios/                     # Recorded runs (not in git — too large)
│   └── explanations/                  # Cached explanation text
│
├── analysis/
│   ├── survey/                        # Qualtrics survey design
│   └── stats/                         # R / Python mixed-effects models
│
└── paper/                             # CHI 2026 draft
```

---

## Output Files

Each `data/scenarios/<SCENARIO_ID>_run<N>/` directory contains:

| File | Description |
|---|---|
| `video.mp4` | Raw 1920×1080 recording at 30 fps |
| `telemetry.json` | Per-frame: speed, throttle, brake, steer, position |
| `npc_telemetry.json` | Per-frame position and speed of each NPC |
| `action_events.json` | Trigger events (BRAKING, ACCELERATING, etc.) with telemetry snapshots |
| `scenario_verdict.json` | Pass/fail based on whether the critical event fired |
| `trigger_frames/` | JPEG screenshots at each trigger point (sent to GPT-4o) |
| `explanations/` | JSON files for each of the 4 explanation conditions |
| `video_none.mp4` | Overlay video — no explanation |
| `video_template.mp4` | Overlay video — template explanation |
| `video_descriptive.mp4` | Overlay video — LLM descriptive explanation |
| `video_teleological.mp4` | Overlay video — LLM teleological explanation |

---

## Environment Variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | For LLM conditions only | GPT-4o API key. Without it, descriptive and teleological conditions get placeholder text instead of real explanations. |

---

## Git Workflow

Feature-branch model — never push directly to `main`.

```bash
git checkout -b feature/my-change
git add <files>
git commit -m "short description of what changed"
git push origin feature/my-change
# open PR on GitHub, get one review, then merge
```

Branch prefixes: `feature/`, `fix/`, `data/`, `analysis/`

---

## Known Issues

| Issue | Notes |
|---|---|
| MESA warning `Driver does not support 0x7d67 PCI ID` | Harmless on RTX 5060. CARLA uses NVIDIA driver, not Mesa. |
| `client.load_world()` causes Signal 11 segfault | RTX 5060 / Blackwell only. Use `switch_town.sh` instead. |
| `nvidia-smi` shows CUDA 13.0, `nvcc` shows 11.5 | Irrelevant — project uses conda-managed CUDA. |
| CARLA 0.9.15 GitHub download links broken | Use the Backblaze URL in Setup Step 5. |
| `No module named 'carla'` in switch_town.sh | Script uses the conda env python. Make sure `~/miniconda3/envs/carla-xav/bin/python` exists. |

---

*AdaptTrust | HRI Team | CS 6170 AI Capstone | Northeastern University*
