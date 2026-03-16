"""
run_scenario.py — Master runner for AdaptTrust scenarios.

Runs the full pipeline for one scenario:
    1. Pre-flight checks (conda env, CARLA server)
    2. Scenario execution + recording  (ScenarioBase + Recorder)
    3. Explanation generation          (generator.py)
    4. Video overlay rendering         (overlay.py)
    5. Summary

Usage:
    python scripts/run_scenario.py <scenario_name> [options]

Examples:
    python scripts/run_scenario.py L1_highway_cruise
    python scripts/run_scenario.py L2_pedestrian_crossing --run 2
    python scripts/run_scenario.py L3_pedestrian_dash --skip-overlay
    python scripts/run_scenario.py L1_highway_cruise --explain-only
    python scripts/run_scenario.py L1_highway_cruise --overlay-only
"""

import argparse
import importlib
import json
import sys
import time
from pathlib import Path

# Ensure repo root is on sys.path regardless of working directory
_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

import carla

from scripts.explanation_gen.generator import generate_all_explanations
from scripts.video_pipeline.overlay import render_overlays

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _print_header(text: str) -> None:
    width = 62
    print(f"\n{'─' * width}")
    print(f"  {text}")
    print(f"{'─' * width}")


def _print_step(n: int, total: int, label: str) -> None:
    print(f"\n[{n}/{total}] {label} …")


def _check_carla(host: str = "localhost", port: int = 2000, timeout: float = 4.0) -> bool:
    try:
        client = carla.Client(host, port)
        client.set_timeout(timeout)
        client.get_server_version()
        return True
    except Exception:
        return False


def _load_scenario_class(scenario_name: str):
    """
    Dynamically import a scenario class from scripts/scenarios/<scenario_name>.py.

    Expects the module to expose a class whose name matches the CamelCase
    conversion of the file name, e.g.:
        l1_highway_cruise.py  →  L1HighwayCruise
        l3_pedestrian_dash.py →  L3PedestrianDash

    Falls back to scanning the module for any ScenarioBase subclass if the
    exact name isn't found.
    """
    module_path = f"scripts.scenarios.{scenario_name.lower()}"
    try:
        module = importlib.import_module(module_path)
    except ModuleNotFoundError:
        raise SystemExit(
            f"ERROR: No scenario file found for '{scenario_name}'.\n"
            f"Expected: scripts/scenarios/{scenario_name.lower()}.py\n"
            f"Run 'ls scripts/scenarios/' to see available scenarios."
        )

    # Try canonical CamelCase name first
    camel = "".join(part.capitalize() for part in scenario_name.lower().split("_"))
    if hasattr(module, camel):
        return getattr(module, camel)

    # Fall back to first ScenarioBase subclass found in the module
    from scripts.scenarios.scenario_base import ScenarioBase
    for attr_name in dir(module):
        obj = getattr(module, attr_name)
        try:
            if isinstance(obj, type) and issubclass(obj, ScenarioBase) and obj is not ScenarioBase:
                return obj
        except TypeError:
            continue

    raise SystemExit(
        f"ERROR: Found scripts/scenarios/{scenario_name.lower()}.py but could not "
        f"locate a ScenarioBase subclass inside it."
    )


def _format_duration(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s:02d}s" if m else f"{s}s"


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------

def run_scenario_stage(
    ScenarioClass,
    scenario_id: str,
    host: str,
    port: int,
    skip_map_reload: bool = False,
) -> tuple[Path, dict]:
    """
    Instantiate, run, and record one scenario.
    Returns (output_dir, run_metadata).
    """
    from scripts.data_collection.recorder import Recorder
    from scripts.autonomous.autopilot_controller import AutopilotController

    scenario = ScenarioClass(
        scenario_id=scenario_id,
        host=host,
        port=port,
        skip_map_reload=skip_map_reload,
    )

    t0 = time.monotonic()
    with scenario as s:
        ap = AutopilotController(s.ego, s.traffic_manager)
        ap.enable()

        with Recorder(s) as rec:
            metadata = s.run(ap=ap, rec=rec)

        ap.disable()

    wall_time = time.monotonic() - t0
    metadata["wall_time_s"] = round(wall_time, 1)
    metadata["scenario_id"] = scenario_id
    metadata["frames_recorded"] = rec.frame_count
    metadata["yolo_detections"] = rec.detection_count
    metadata["action_events"] = len(s._action_events)
    return scenario.output_dir, metadata


def run_explain_stage(output_dir: Path) -> dict[str, int]:
    """Run explanation generation. Returns {condition: entry_count}."""
    outputs = generate_all_explanations(output_dir)
    return {
        cond: len(json.loads(path.read_text()))
        for cond, path in outputs.items()
    }


def run_overlay_stage(output_dir: Path) -> dict[str, float]:
    """Render overlay videos. Returns {condition: file_size_mb}."""
    paths = render_overlays(output_dir)
    return {
        cond: round(path.stat().st_size / 1e6, 1)
        for cond, path in paths.items()
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="AdaptTrust master scenario runner.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "scenario",
        help="Scenario name matching scripts/scenarios/<name>.py, e.g. L1_highway_cruise",
    )
    parser.add_argument(
        "--run", type=int, default=1, metavar="N",
        help="Run index — appended to output folder name (default: 1).",
    )
    parser.add_argument(
        "--host", default="localhost",
        help="CARLA server host (default: localhost).",
    )
    parser.add_argument(
        "--port", type=int, default=2000,
        help="CARLA server port (default: 2000).",
    )
    parser.add_argument(
        "--skip-overlay", action="store_true",
        help="Skip video overlay rendering (saves time during development).",
    )
    parser.add_argument(
        "--explain-only", action="store_true",
        help="Only run explanation generation on an already-recorded scenario_id.",
    )
    parser.add_argument(
        "--overlay-only", action="store_true",
        help="Only run overlay rendering on an already-generated scenario_id.",
    )
    parser.add_argument(
        "--no-map-reload", action="store_true",
        help=(
            "Skip client.load_world() and use whatever map CARLA already has loaded. "
            "Use this when CARLA is already on the correct map to avoid the Signal 11 "
            "segfault that occurs on some GPUs (e.g. RTX 5060) during map switches."
        ),
    )
    args = parser.parse_args()

    scenario_name = args.scenario
    scenario_id   = f"{scenario_name.lower()}_run{args.run}"
    output_dir    = _REPO_ROOT / "data" / "scenarios" / scenario_id

    total_steps = 2  # scenario + explain
    if not args.skip_overlay:
        total_steps += 1
    if args.explain_only or args.overlay_only:
        total_steps = 1

    _print_header(f"AdaptTrust — {scenario_name}  (run {args.run})")
    print(f"  Scenario ID : {scenario_id}")
    print(f"  Output dir  : {output_dir}")

    # ------------------------------------------------------------------
    # Shortcut modes
    # ------------------------------------------------------------------
    if args.explain_only:
        _print_step(1, 1, "Generating explanations")
        counts = run_explain_stage(output_dir)
        print(f"  Events per condition: {counts}")
        return 0

    if args.overlay_only:
        _print_step(1, 1, "Rendering overlay videos")
        sizes = run_overlay_stage(output_dir)
        for cond, mb in sizes.items():
            print(f"  video_{cond}.mp4  {mb:.1f} MB")
        return 0

    # ------------------------------------------------------------------
    # Pre-flight checks
    # ------------------------------------------------------------------
    step = 0

    step += 1
    _print_step(step, total_steps, "Pre-flight checks")

    env_name = Path(sys.executable).parents[1].name
    if env_name != "carla-xav":
        print(
            f"  WARNING: Active environment is '{env_name}', expected 'carla-xav'.\n"
            f"  Run: conda activate carla-xav"
        )

    print(f"  Checking CARLA at {args.host}:{args.port} …", end=" ", flush=True)
    if not _check_carla(args.host, args.port):
        print("NOT RUNNING")
        print(
            f"\n  ERROR: Cannot connect to CARLA.\n"
            f"  Start the server first:\n"
            f"    cd ~/carla && ./CarlaUE4.sh -quality-level=Low\n"
        )
        return 1
    print("OK")

    ScenarioClass = _load_scenario_class(scenario_name)
    print(f"  Scenario class: {ScenarioClass.__name__}")

    # Map mismatch check — warn before a potentially fatal load_world() call.
    # Instantiating the class without connecting is safe: __init__ only stores
    # map_name, no CARLA calls happen until setup().
    _probe         = ScenarioClass(scenario_id="_probe")
    required_map   = _probe.map_name
    _c             = carla.Client(args.host, args.port)
    _c.set_timeout(4.0)
    current_map    = _c.get_world().get_map().name.split("/")[-1]  # e.g. "Town04"

    if args.no_map_reload:
        print(
            f"  Map check     : --no-map-reload set — skipping load_world(). "
            f"CARLA is on {current_map}, scenario wants {required_map}."
        )
    elif not current_map.endswith(required_map):
        print(f"\n  {'!'*60}")
        print(f"  WARNING: Map mismatch detected.")
        print(f"    CARLA is currently on : {current_map}")
        print(f"    This scenario needs   : {required_map}")
        print(f"  Switching maps can cause a Signal 11 (segfault) crash on")
        print(f"  some GPUs (RTX 5060 / Blackwell). Recommended options:")
        print(f"")
        print(f"    1. Restart CARLA on the correct map (safest):")
        print(f"         cd ~/carla && ./CarlaUE4.sh -quality-level=Low")
        print(f"       Then re-run this command.")
        print(f"")
        print(f"    2. If CARLA is already on {required_map}, skip the reload:")
        print(f"         python scripts/run_scenario.py {scenario_name} --no-map-reload")
        print(f"  {'!'*60}\n")
        try:
            ans = input("  Continue with map switch anyway? [y/N]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            ans = "n"
        if ans != "y":
            print("  Aborted. Restart CARLA on the correct map and retry.")
            return 1
    else:
        print(f"  Map check     : OK ({current_map} matches {required_map})")

    # ------------------------------------------------------------------
    # Stage 1 — Record
    # ------------------------------------------------------------------
    step += 1
    _print_step(step, total_steps, f"Recording  [{scenario_id}]")
    t_record = time.monotonic()
    try:
        output_dir, run_meta = run_scenario_stage(
            ScenarioClass, scenario_id, args.host, args.port,
            skip_map_reload=args.no_map_reload,
        )
    except Exception as e:
        print(f"\n  ERROR during recording: {e}")
        raise
    record_time = time.monotonic() - t_record

    print(
        f"  Recorded {run_meta['frames_recorded']} frames in "
        f"{_format_duration(record_time)}  "
        f"({run_meta['action_events']} triggers, "
        f"{run_meta['yolo_detections']} YOLO detections)"
    )

    # ------------------------------------------------------------------
    # Stage 2 — Explanations
    # ------------------------------------------------------------------
    step += 1
    _print_step(step, total_steps, "Generating explanations")
    t_explain = time.monotonic()
    explain_counts = run_explain_stage(output_dir)
    explain_time = time.monotonic() - t_explain
    n_events = next(iter(explain_counts.values()), 0)
    print(
        f"  {n_events} event(s) × 4 conditions in "
        f"{_format_duration(explain_time)}"
    )

    # ------------------------------------------------------------------
    # Stage 3 — Overlay
    # ------------------------------------------------------------------
    overlay_sizes: dict[str, float] = {}
    if not args.skip_overlay:
        step += 1
        _print_step(step, total_steps, "Rendering overlay videos")
        t_overlay = time.monotonic()
        overlay_sizes = run_overlay_stage(output_dir)
        overlay_time = time.monotonic() - t_overlay
        print(f"  4 videos rendered in {_format_duration(overlay_time)}")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    _print_header("Summary")

    print(f"  {'Scenario':<22} {scenario_id}")
    print(f"  {'Map':<22} {run_meta.get('map', 'unknown')}")
    print(f"  {'Duration (sim)':<22} {run_meta.get('duration_s', '?')} s")
    print(f"  {'Frames recorded':<22} {run_meta['frames_recorded']}")
    print(f"  {'Action triggers':<22} {run_meta['action_events']}")
    print(f"  {'YOLO detections':<22} {run_meta['yolo_detections']}")
    print(f"  {'Wall time':<22} {_format_duration(run_meta['wall_time_s'])}")

    print(f"\n  Output files in: {output_dir}")
    for f in sorted(output_dir.rglob("*")):
        if f.is_file():
            rel = f.relative_to(output_dir)
            size_kb = f.stat().st_size / 1024
            size_str = f"{size_kb/1024:.1f} MB" if size_kb > 1024 else f"{size_kb:.0f} KB"
            print(f"    {str(rel):<45} {size_str:>8}")

    print(f"\n{'─' * 62}")
    print("  PIPELINE COMPLETE")
    print(f"{'─' * 62}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
