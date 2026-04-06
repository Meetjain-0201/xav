#!/usr/bin/env bash
# setup_extra.sh
# Run this ONCE after "conda env create -f carla-xav-environment.yml"
# on any new machine. Installs the things the conda yml can't cover.
#
# Usage:
#   conda activate carla-xav
#   bash scripts/setup_extra.sh

set -e

echo "[setup] Cloning scenario_runner v0.9.15 ..."
if [ -d ~/scenario_runner ]; then
  echo "[setup] ~/scenario_runner already exists — skipping clone."
else
  git clone --depth=1 --branch v0.9.15 \
    https://github.com/carla-simulator/scenario_runner.git \
    ~/scenario_runner
  echo "[setup] scenario_runner cloned."
fi

echo "[setup] Creating roaming_agent compatibility stub ..."
STUB=~/carla/PythonAPI/carla/agents/navigation/roaming_agent.py
if [ ! -f "$STUB" ]; then
  echo "# Compatibility stub — roaming_agent was removed in CARLA 0.9.10+." > "$STUB"
  echo "# srunner v0.9.15 imports it; this empty stub satisfies the import." >> "$STUB"
  echo "[setup] Stub created at $STUB"
else
  echo "[setup] Stub already exists — skipping."
fi

echo "[setup] Pinning py-trees to 0.8.3 (required by scenario_runner v0.9.15) ..."
pip install "py-trees==0.8.3" -q

echo "[setup] Installing shapely (required by CARLA basic_agent) ..."
pip install shapely -q

echo "[setup] Removing incompatible pip srunner if present ..."
pip uninstall srunner -y 2>/dev/null && echo "[setup] srunner removed." \
  || echo "[setup] srunner not installed — nothing to remove."

echo ""
echo "[setup] Done. Verify with:"
echo "  python -c \"from scripts.scenarios.adaptrust_scenarios import SCENARIO_REGISTRY; print('OK:', sorted(SCENARIO_REGISTRY))\""
