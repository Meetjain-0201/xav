# AdaptTrust — Explainability in Autonomous Vehicles
**CS 6170 AI Capstone | Team: HRI Team (Meet Jain & Yash Phalle) | Professor: Stacy Marsella**

> Do LLM-generated explanations of autonomous vehicle actions improve passenger trust calibration?

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Requirements](#system-requirements)
3. [Verified Hardware (Meet's Machine)](#verified-hardware)
4. [Setup: Step-by-Step](#setup-step-by-step)
   - [Step 1: Boot into Ubuntu](#step-1-boot-into-ubuntu)
   - [Step 2: Verify GPU Driver](#step-2-verify-gpu-driver)
   - [Step 3: Install Miniconda](#step-3-install-miniconda)
   - [Step 4: Accept Conda Terms of Service](#step-4-accept-conda-terms-of-service)
   - [Step 5: Fix PYTHONPATH (ROS users only)](#step-5-fix-pythonpath-ros-users-only)
   - [Step 6: Create the Conda Environment](#step-6-create-the-conda-environment)
   - [Step 7: Isolate from ROS PYTHONPATH](#step-7-isolate-from-ros-pythonpath)
   - [Step 8: Download CARLA 0.9.15](#step-8-download-carla-0915)
   - [Step 9: Extract CARLA](#step-9-extract-carla)
   - [Step 10: Install Python Dependencies](#step-10-install-python-dependencies)
   - [Step 11: Restore Environment from Lock File](#step-11-restore-environment-from-lock-file)
5. [Verify the Full Setup](#verify-the-full-setup)
6. [Running CARLA](#running-carla)
7. [Project Structure](#project-structure)
8. [Environment Variables & API Keys](#environment-variables--api-keys)
9. [Git Workflow](#git-workflow)
10. [Known Issues](#known-issues)
11. [Dataset](#dataset)

---

## Project Overview

AdaptTrust is a within-subjects HCI experiment comparing four types of autonomous vehicle explanations:

| Condition | Type |
|---|---|
| 1 | No explanation (control) |
| 2 | Template-based (rule-based) |
| 3 | LLM-Descriptive (GPT-4V factual) |
| 4 | LLM-Teleological (GPT-4V purpose/goal-oriented) |

**Metrics:** Jian Trust Scale (12-item), Comprehension accuracy, Mental Model Quality (0–4, Cohen's κ > 0.70), NASA-TLX cognitive load.

**Target venue:** CHI 2026

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |
| GPU | NVIDIA RTX 2070 (6GB VRAM) | NVIDIA RTX 3080+ (8GB+ VRAM) |
| RAM | 16GB | 32GB |
| Disk | 30GB free | 50GB+ free |
| Python | 3.8 | 3.10 |
| NVIDIA Driver | 525+ | 580+ |

> **Note for Blackwell GPU users (RTX 5060/5070/5080/5090):** Requires Ubuntu kernel 6.8+. CARLA's server uses Vulkan/OpenGL for rendering (not CUDA), so Blackwell is compatible with the prebuilt binary. MESA warnings about unknown PCI IDs are expected and harmless.

---

## Verified Hardware

Meet's machine (fully tested, confirmed working):

```
Model:   Lenovo Legion 7 16IAX10
CPU:     Intel Core Ultra 7 255HX @ 2.4GHz
GPU:     NVIDIA GeForce RTX 5060 Laptop (8GB VRAM, Blackwell)
RAM:     32GB
Storage: Samsung NVMe SSD
OS:      Ubuntu 22.04.5 LTS
Kernel:  6.8.0-94-generic
Driver:  580.126.09
CUDA:    13.0 (driver) / 11.5 (system toolkit — not used by project)
```

---

## Setup: Step-by-Step

### Step 1: Boot into Ubuntu

This project requires Ubuntu. If dual-booting, select Ubuntu at the GRUB menu.

```bash
# Confirm you're on Ubuntu 22.04
lsb_release -a
uname -r   # Should be 6.8.x or higher
```

---

### Step 2: Verify GPU Driver

```bash
nvidia-smi
```

Expected: driver version 525+ visible, GPU listed, no errors. If `nvidia-smi` fails, install the NVIDIA driver via `ubuntu-drivers autoinstall` before proceeding.

---

### Step 3: Install Miniconda

Installs entirely into your home directory — no sudo required, no system changes.

```bash
cd ~
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
bash ~/miniconda.sh -b -p ~/miniconda3
~/miniconda3/bin/conda init bash
source ~/.bashrc
conda --version   # Should show conda 24.x or higher
```

---

### Step 4: Accept Conda Terms of Service

Required for conda 25.x and later:

```bash
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
```

---

### Step 5: Fix PYTHONPATH (ROS users only)

If you have ROS installed, check for duplicate source lines:

```bash
grep -n "ros\|ROS\|PYTHONPATH" ~/.bashrc
```

If line `source /opt/ros/humble/setup.bash` appears **twice**, remove the duplicate:

```bash
# Replace LINE_NUMBER with the second occurrence's line number
sed -i 'LINE_NUMBERd' ~/.bashrc
```

> **Do not remove ROS** — just the duplicate line. ROS remains fully functional.

---

### Step 6: Create the Conda Environment

```bash
conda create -n carla-xav python=3.10 -y
conda activate carla-xav
python --version   # Should show Python 3.10.x
which python       # Should show ~/miniconda3/envs/carla-xav/bin/python
```

---

### Step 7: Isolate from ROS PYTHONPATH

This prevents ROS paths from leaking into the CARLA environment. Only needs to be done once:

```bash
conda activate carla-xav
conda env config vars set PYTHONPATH=""
conda deactivate
conda activate carla-xav
echo $PYTHONPATH   # Should be empty
```

---

### Step 8: Download CARLA 0.9.15

> **Note:** CARLA releases are hosted on Backblaze B2, not GitHub directly. The GitHub release page links redirect here.

```bash
mkdir -p ~/carla
cd ~/carla
wget "https://carla-releases.s3.us-east-005.backblazeb2.com/Linux/CARLA_0.9.15.tar.gz"
```

This is approximately 12GB. Download time depends on your connection.

---

### Step 9: Extract CARLA

```bash
cd ~/carla
tar -xvzf CARLA_0.9.15.tar.gz
ls ~/carla
```

Expected output includes: `CarlaUE4.sh`, `CarlaUE4/`, `PythonAPI/`, `HDMaps/`, `Import/`

---

### Step 10: Install Python Dependencies

```bash
conda activate carla-xav
pip install carla==0.9.15
pip install numpy pygame opencv-python torch torchvision ultralytics openai python-dotenv
```

---

### Step 11: Restore Environment from Lock File

**Preferred method for Yash** — reproduces Meet's exact verified environment:

```bash
conda env create -f carla-xav-environment.yml
conda activate carla-xav
```

> The `carla-xav-environment.yml` file is committed to this repo and contains all exact package versions tested on Meet's machine.

---

## Verify the Full Setup

Run these checks after setup. All should pass:

```bash
conda activate carla-xav

# 1. Python version
python --version                          # Python 3.10.x

# 2. PYTHONPATH clean
echo $PYTHONPATH                          # (empty)

# 3. CARLA Python package
python -c "import carla; print(dir(carla))"   # Long list of CARLA classes

# 4. Core ML stack
python -c "import torch; print(torch.__version__)"
python -c "import cv2; print(cv2.__version__)"
python -c "import ultralytics; print('YOLO ok')"
python -c "import openai; print('OpenAI ok')"

# 5. CARLA server + traffic test (two terminals needed)
# Terminal 1:
cd ~/carla && ./CarlaUE4.sh -quality-level=Low

# Terminal 2 (after CARLA window opens):
conda activate carla-xav
cd ~/carla
python PythonAPI/examples/generate_traffic.py --host localhost -n 10
# Expected: "spawned 10 vehicles and 9 walkers, press Ctrl+C to exit."
```

---

## Running CARLA

Always use two terminals:

**Terminal 1 — CARLA Server:**
```bash
cd ~/carla
./CarlaUE4.sh -quality-level=Epic    # Full quality for data collection
# OR
./CarlaUE4.sh -quality-level=Low     # For development/testing
```

**Terminal 2 — Python Client:**
```bash
conda activate carla-xav
cd ~/path/to/xav
python scripts/your_script.py
```

> CARLA server listens on TCP ports 2000 and 2001 by default. Ensure these are not blocked by a firewall.

---

## Project Structure

```
xav/
├── README.md
├── carla-xav-environment.yml      # Exact conda environment lock file
├── .env.example                   # API key template (copy to .env)
├── .gitignore
├── scripts/
│   ├── scenarios/                 # CARLA scenario definitions (20 scenarios)
│   ├── autonomous/                # Autonomous driving code (YOLO, PID, sensor fusion)
│   ├── data_collection/           # Recording RGB, LiDAR, telemetry
│   ├── explanation_gen/           # GPT-4V explanation generation (4 types)
│   └── video_pipeline/            # OpenCV overlay + export
├── data/
│   ├── scenarios/                 # Raw recorded data (video + telemetry JSON)
│   └── explanations/              # Generated explanation text per scenario
├── analysis/
│   ├── survey/                    # Qualtrics survey design
│   └── stats/                     # R / Python mixed-effects models
└── paper/                         # CHI 2026 paper draft
```

---

## Environment Variables & API Keys

Copy the template and fill in your keys. **Never commit `.env` to git.**

```bash
cp .env.example .env
```

`.env.example` contents:
```
OPENAI_API_KEY=your_key_here
```

Load in Python scripts with:
```python
from dotenv import load_dotenv
import os
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
```

---

## Git Workflow

We use a simple feature-branch workflow:

```bash
# Start new work
git checkout -b feature/scenario-design

# Stage and commit
git add .
git commit -m "feat: add 7 low-criticality CARLA scenarios"

# Push and open PR
git push origin feature/scenario-design
# Open PR on GitHub → request review from teammate before merging
```

**Branch naming:**
- `feature/` — new functionality
- `fix/` — bug fixes
- `data/` — data collection scripts
- `analysis/` — stats and visualization

**Never push directly to `main`.** All merges via PR with at least one review.

---

## Known Issues

| Issue | Status | Fix |
|---|---|---|
| MESA warning: `Driver does not support 0x7d67 PCI ID` | Expected on RTX 5060 (Blackwell) | Harmless — CARLA uses NVIDIA proprietary driver, not Mesa |
| `nvidia-smi` shows CUDA 13.0 but `nvcc` shows 11.5 | System has old CUDA toolkit installed | Not relevant — project uses conda-managed CUDA, not system nvcc |
| ROS PYTHONPATH leaks into Python sessions | Fixed via conda env config vars | See Step 7 above |
| CARLA 0.9.15 tar.gz 404 on GitHub releases page | GitHub links are broken | Use Backblaze URL in Step 8 |

---

## Dataset

- **BDD-X** (Berkeley DeepDrive Explanations): [github.com/JinkyuKimUCB/BDD-X-dataset](https://github.com/JinkyuKimUCB/BDD-X-dataset) — used as reference for scenario design
- **CARLA-generated data**: Recorded locally during experiment (not committed to repo due to size)

---

*AdaptTrust | HRI Team | CS 6170 AI Capstone | Northeastern University*
