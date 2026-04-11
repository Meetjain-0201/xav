"""
scene_logger.py — Scene log + pass/fail verdict for AdaptTrust scenario runs.

Reads telemetry.json, yolo_detections.json, action_events.json, npc_telemetry.json
from a scenario folder and prints:
  1. Frame table at 2 Hz (every 10th frame at 20 Hz).
  2. NPC summary table with closest-approach marker.
  3. Action events with full context (YOLO, NPC, template text, story hint).
  4. VERDICT block: per-check PASS/FAIL + DIAGNOSIS.

Usage:
    python scripts/scene_logger.py data/scenarios/H1_PedestrianDart_run5
    python scripts/scene_logger.py data/scenarios/H1_PedestrianDart_run5 --all-frames
"""

import argparse
import json
import math
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

try:
    from scripts.video_pipeline.overlay import (_derive_action_state, _derive_action_text,
                                                _VEHICLE_CLASSES)
    _HAS_OVERLAY = True
except ImportError:
    _HAS_OVERLAY = False
    _VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle", "bicycle"}

    def _derive_action_state(frame):
        brake = frame.get("brake", 0.0)
        steer = abs(frame.get("steer", 0.0))
        thr   = frame.get("throttle", 0.0)
        if brake > 0.3:  return "BRAKING"
        if steer > 0.2:  return "TURNING"
        if thr   > 0.3:  return "ACCELERATING"
        return "CRUISING"

    def _derive_action_text(frame, yolo_labels=None, has_vehicle=False):
        return ""


# ─── tiny helpers ──────────────────────────────────────────────────────────────

def _dist(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _load_json(path):
    p = Path(path)
    if p.exists():
        return json.loads(p.read_text())
    return None


def _yolo_near(yolo, ts, window=1.0):
    return [d for d in yolo if abs(d.get("timestamp", 0) - ts) <= window]


def _yolo_summary(dets):
    seen = {}
    for d in dets:
        cls  = d["class_name"]
        conf = d.get("confidence", 0.0)
        if conf > seen.get(cls, 0.0):
            seen[cls] = conf
    return ", ".join(f"{c}({v:.0%})" for c, v in sorted(seen.items(), key=lambda x: -x[1])) if seen else ""


def _yolo_labels_from_dets(dets):
    _MAP = {"person": "Pedestrian", "bicycle": "Cyclist", "traffic light": "Traffic Light"}
    seen = {}
    for d in dets:
        cls  = d["class_name"]
        conf = d.get("confidence", 0.0)
        if cls in _MAP and conf > seen.get(cls, 0.0):
            seen[cls] = conf
    return [f"{_MAP[c]}({v:.0%})" for c, v in sorted(seen.items(), key=lambda x: -x[1])]


def _ev_elapsed(ev):
    return ev.get("telemetry_snapshot", {}).get("elapsed_s", ev.get("timestamp", 0.0))


def _ev_brake(ev):
    return ev.get("telemetry_snapshot", {}).get("brake", 0.0)


def _ev_speed(ev):
    return ev.get("telemetry_snapshot", {}).get("speed_kmh", 0.0)


# ─── telemetry analysis primitives ────────────────────────────────────────────

def _max_speed_by(tel, t):
    return max((f.get("speed_kmh", 0) for f in tel if f.get("elapsed_s", 0) <= t), default=0.0)


def _min_speed_in(tel, t0, t1):
    frames = [f for f in tel if t0 <= f.get("elapsed_s", 0) <= t1]
    return min((f.get("speed_kmh", 0) for f in frames), default=999.0)


def _rapid_decel(tel, from_speed=20.0, to_speed=5.0, window_s=3.0):
    """True if speed drops from >from_speed to <to_speed within window_s seconds."""
    for f in tel:
        if f.get("speed_kmh", 0) > from_speed:
            t0 = f.get("elapsed_s", 0)
            subsequent = [ff for ff in tel
                          if t0 < ff.get("elapsed_s", 0) <= t0 + window_s]
            if any(ff.get("speed_kmh", 0) < to_speed for ff in subsequent):
                return True
    return False


def _braking_events_in(events, t0, t1, min_brake=0.0):
    return [e for e in events
            if e.get("trigger_type") == "BRAKING"
            and t0 <= _ev_elapsed(e) <= t1
            and _ev_brake(e) >= min_brake]


def _yolo_has_class_near(yolo, ts, classes, window=1.0):
    return any(d.get("class_name", "") in classes for d in _yolo_near(yolo, ts, window))


def _npc_all_speeds(npc_tel):
    return [npc.get("speed_kmh", 0) for frame in (npc_tel or []) for npc in frame]


def _has_sustained_steer(tel, threshold=0.25, min_frames=5):
    count = 0
    for f in tel:
        if abs(f.get("steer", 0)) > threshold:
            count += 1
            if count >= min_frames:
                return True
        else:
            count = 0
    return False


def _count_steer_stretches(tel, threshold=0.25):
    """Count distinct stretches where |steer| > threshold."""
    count, in_turn = 0, False
    for f in tel:
        if abs(f.get("steer", 0)) > threshold:
            if not in_turn:
                count += 1
            in_turn = True
        else:
            in_turn = False
    return count


# ─── per-scenario check functions ─────────────────────────────────────────────
# Each returns list of (label, passed:bool, detail:str)

def _check_L1(tel, yolo, events, npc_tel):
    r = []

    ms5 = _max_speed_by(tel, 5.0)
    r.append(("Ego reaches 30+ km/h by t=5s", ms5 >= 30, f"actual max: {ms5:.1f} km/h"))

    dt = 0.05  # 20 Hz
    in_rng_s = sum(1 for f in tel if 25 <= f.get("speed_kmh", 0) <= 50) * dt
    r.append(("Speed 25–50 km/h for ≥12s", in_rng_s >= 12.0, f"actual: {in_rng_s:.1f}s"))

    mb = max((f.get("brake", 0) for f in tel), default=0.0)
    r.append(("No brake > 0.5 fires", mb <= 0.5, f"max brake: {mb:.2f}"))

    ms = max((abs(f.get("steer", 0)) for f in tel), default=0.0)
    r.append(("No steer > 0.4 (no sharp turns)", ms <= 0.4, f"max |steer|: {ms:.2f}"))

    return r


def _check_L2(tel, yolo, events, npc_tel):
    r = []

    ms6 = _max_speed_by(tel, 6.0)
    r.append(("Ego reaches 55+ km/h by t=6s", ms6 >= 55, f"actual max: {ms6:.1f} km/h"))

    min_sp = min((f.get("speed_kmh", 0) for f in tel), default=999.0)
    r.append(("Ego speed drops below 40 km/h (following NPC)", min_sp < 40.0,
              f"actual min: {min_sp:.1f} km/h"))

    turn_evts = [e for e in events if e.get("trigger_type") in ("LANE_CHANGE", "TURNING")]
    sus_steer  = _has_sustained_steer(tel, 0.25, min_frames=5)
    has_lc = len(turn_evts) > 0 or sus_steer
    r.append(("LANE_CHANGE or TURNING event (steer > 0.25)", has_lc,
              f"{len(turn_evts)} events, sustained steer: {sus_steer}"))

    lc_time = None
    if turn_evts:
        lc_time = _ev_elapsed(turn_evts[0])
    elif sus_steer:
        for i, f in enumerate(tel):
            if i + 4 < len(tel) and all(abs(tel[j].get("steer", 0)) > 0.25 for j in range(i, i+5)):
                lc_time = f.get("elapsed_s", 0)
                break
    if lc_time is not None:
        post  = [f for f in tel if f.get("elapsed_s", 0) > lc_time + 2.0]
        mp    = max((f.get("speed_kmh", 0) for f in post), default=0.0)
        r.append(("Speed recovers to 50+ km/h after lane change", mp >= 50,
                  f"max post-LC: {mp:.1f} km/h (LC at t={lc_time:.1f}s)"))
    else:
        r.append(("Speed recovers to 50+ km/h after lane change", False,
                  "No lane change detected to measure recovery from"))

    return r


def _check_L3(tel, yolo, events, npc_tel):
    r = []

    dt     = 0.05
    slow_s = sum(1 for f in tel if f.get("speed_kmh", 0) < 25) * dt
    r.append(("Speed < 25 km/h for ≥15s", slow_s >= 15.0, f"actual: {slow_s:.1f}s"))

    n_turns = _count_steer_stretches(tel, 0.25)
    r.append(("At least 2 distinct TURNING events (|steer|>0.25)", n_turns >= 2,
              f"{n_turns} steer stretches detected"))

    mb = max((f.get("brake", 0) for f in tel), default=0.0)
    r.append(("No collision (max brake ≤ 0.8)", mb <= 0.8, f"max brake: {mb:.2f}"))

    has_npc = bool(npc_tel and any(npc_tel))
    r.append(("At least 1 NPC in npc_telemetry throughout", has_npc,
              "NPCs present" if has_npc else "No npc_telemetry.json or empty"))

    return r


def _check_M1(tel, yolo, events, npc_tel):
    r = []

    ms6 = _max_speed_by(tel, 6.0)
    r.append(("Ego reaches 40+ km/h by t=6s", ms6 >= 40, f"actual max: {ms6:.1f} km/h"))

    mn = _min_speed_in(tel, 9.0, 13.0)
    r.append(("Ego stops (< 5 km/h) between t=9s and t=13s", mn < 5.0,
              f"min speed t=9–13s: {mn:.1f} km/h"))

    bkes = _braking_events_in(events, 8.0, 12.0)
    r.append(("BRAKING event fires between t=8s and t=12s", len(bkes) > 0,
              f"{len(bkes)} BRAKING events in window"))

    return r


def _check_M2(tel, yolo, events, npc_tel):
    r = []

    ms5 = _max_speed_by(tel, 5.0)
    r.append(("Ego reaches 30+ km/h by t=5s", ms5 >= 30, f"actual max: {ms5:.1f} km/h"))

    mn = _min_speed_in(tel, 6.0, 10.0)
    r.append(("Ego speed < 8 km/h between t=6s and t=10s", mn < 8.0,
              f"min speed t=6–10s: {mn:.1f} km/h"))

    bkes_win = _braking_events_in(events, 6.0, 10.0)
    r.append(("BRAKING event fires between t=6s and t=10s", len(bkes_win) > 0,
              f"{len(bkes_win)} BRAKING events in window"))

    all_bkes = [e for e in events if e.get("trigger_type") == "BRAKING"]
    if all_bkes:
        bt  = all_bkes[0].get("timestamp", 0)
        det = _yolo_has_class_near(yolo, bt, {"person"}, 1.0)
    else:
        det = False
    r.append(("YOLO detects 'person' near brake event", det,
              "detected" if det else "not detected"))

    return r


def _check_M3(tel, yolo, events, npc_tel):
    r = []

    ms6 = _max_speed_by(tel, 6.0)
    r.append(("Ego reaches 60+ km/h by t=6s", ms6 >= 60, f"actual max: {ms6:.1f} km/h"))

    post7 = [f for f in tel if f.get("elapsed_s", 0) > 7.0]
    mn7   = min((f.get("speed_kmh", 0) for f in post7), default=999.0)
    r.append(("Ego speed drops below 55 km/h after t=7s (yielding)", mn7 < 55,
              f"min speed after t=7s: {mn7:.1f} km/h"))

    bkes = [e for e in events
            if e.get("trigger_type") == "BRAKING" and _ev_elapsed(e) > 7.0]
    r.append(("BRAKING event fires after t=7s", len(bkes) > 0,
              f"{len(bkes)} BRAKING events after t=7s"))

    has_npc = bool(npc_tel and any(npc_tel))
    r.append(("At least 1 NPC in npc_telemetry", has_npc,
              "NPCs present" if has_npc else "No npc_telemetry or empty"))

    return r


def _check_H1(tel, yolo, events, npc_tel):
    r = []

    ms4 = _max_speed_by(tel, 4.0)
    r.append(("Ego reaches 25+ km/h by t=4s", ms4 >= 25, f"actual max: {ms4:.1f} km/h"))

    bkes = _braking_events_in(events, 4.0, 8.0, min_brake=0.8)
    r.append(("BRAKING (brake≥0.8) between t=4s and t=8s", len(bkes) > 0,
              f"{len(bkes)} qualifying events"))

    rapid = _rapid_decel(tel, from_speed=20.0, to_speed=5.0, window_s=3.0)
    r.append(("Speed drops >20→<5 km/h within 3s", rapid,
              "rapid decel detected" if rapid else "no rapid decel in telemetry"))

    all_bkes = [e for e in events if e.get("trigger_type") == "BRAKING"]
    if all_bkes:
        bt  = all_bkes[0].get("timestamp", 0)
        det = _yolo_has_class_near(yolo, bt, {"person"}, 1.0)
    else:
        det = False
    r.append(("YOLO detects 'person' near brake event", det,
              "detected" if det else "not detected"))

    return r


def _check_H2(tel, yolo, events, npc_tel):
    r = []

    ms5 = _max_speed_by(tel, 5.0)
    r.append(("Ego reaches 60+ km/h by t=5s", ms5 >= 60, f"actual max: {ms5:.1f} km/h"))

    speeds    = _npc_all_speeds(npc_tel)
    ever_moved = any(s > 1.0 for s in speeds)
    max_npc   = max(speeds, default=0.0)
    r.append(("NPC visible and moving in npc_telemetry", ever_moved,
              f"max NPC speed: {max_npc:.1f} km/h"))

    bkes   = [e for e in events
              if e.get("trigger_type") == "BRAKING" and _ev_brake(e) >= 0.8]
    brake_t = _ev_elapsed(bkes[0]) if bkes else 999.0

    init_d, min_d = None, 999.0
    for fi, frame_npcs in enumerate(npc_tel or []):
        if fi >= len(tel):
            break
        ef = tel[fi]
        if ef.get("elapsed_s", 0) > brake_t:
            break
        for npc in frame_npcs:
            d = _dist(ef.get("x", 0), ef.get("y", 0), npc.get("x", 0), npc.get("y", 0))
            if init_d is None:
                init_d = d
            min_d = min(min_d, d)

    gap_ok = init_d is not None and init_d > 35 and min_d < 10
    r.append(("NPC gap closes >35m→<10m before brake", gap_ok,
              f"initial={init_d:.1f}m  min={min_d:.1f}m"
              if init_d is not None else "No NPC telemetry"))

    if bkes:
        sp_at = _ev_speed(bkes[0])
        r.append(("BRAKING (brake≥0.8) while ego speed > 40 km/h", sp_at > 40,
                  f"speed at brake: {sp_at:.1f} km/h"))
    else:
        r.append(("BRAKING (brake≥0.8) while ego speed > 40 km/h", False,
                  "No BRAKING event with brake≥0.8"))

    if bkes:
        bt_ts = bkes[0].get("timestamp", 0)
        det   = _yolo_has_class_near(yolo, bt_ts, {"car", "truck"}, 1.0)
    else:
        det = False
    r.append(("YOLO detects 'car'/'truck' near brake event", det,
              "detected" if det else "not detected"))

    return r


def _check_H3(tel, yolo, events, npc_tel):
    r = []

    ms5 = _max_speed_by(tel, 5.0)
    r.append(("Ego reaches 35+ km/h by t=5s", ms5 >= 35, f"actual max: {ms5:.1f} km/h"))

    npc_spd_6 = 0.0
    for fi, frame_npcs in enumerate(npc_tel or []):
        if fi >= len(tel):
            break
        if 5.5 <= tel[fi].get("elapsed_s", 0) <= 7.0:
            for npc in frame_npcs:
                npc_spd_6 = max(npc_spd_6, npc.get("speed_kmh", 0))
    r.append(("NPC speed > 30 km/h at t≈6s (actively driving)", npc_spd_6 > 30,
              f"NPC speed at t≈6s: {npc_spd_6:.1f} km/h"))

    bkes = _braking_events_in(events, 5.0, 10.0, min_brake=0.8)
    r.append(("BRAKING (brake≥0.8) between t=5s and t=10s", len(bkes) > 0,
              f"{len(bkes)} qualifying events"))

    all_bkes = [e for e in events
                if e.get("trigger_type") == "BRAKING" and _ev_brake(e) >= 0.8]
    if all_bkes and npc_tel:
        bt       = _ev_elapsed(all_bkes[0])
        ego_snap = all_bkes[0].get("telemetry_snapshot", {})
        best_fi  = 0
        for fi in range(len(tel)):
            if tel[fi].get("elapsed_s", 0) >= bt:
                best_fi = fi
                break
        npc_d = 999.0
        if best_fi < len(npc_tel):
            for npc in npc_tel[best_fi]:
                npc_d = min(npc_d, _dist(ego_snap.get("x", 0), ego_snap.get("y", 0),
                                          npc.get("x", 0), npc.get("y", 0)))
        r.append(("NPC within 30m of ego when brake fires (in intersection)", npc_d < 30,
                  f"NPC dist at brake: {npc_d:.1f}m"))
    else:
        r.append(("NPC within 30m of ego when brake fires (in intersection)", False,
                  "No BRAKING event or no NPC telemetry"))

    if all_bkes:
        sp = _ev_speed(all_bkes[0])
        r.append(("Ego speed > 25 km/h when brake fired", sp > 25,
                  f"ego speed at brake: {sp:.1f} km/h"))
    else:
        r.append(("Ego speed > 25 km/h when brake fired", False, "No BRAKING event found"))

    return r


SCENARIO_CRITERIA = {
    "L1_GreenLightCruise":  _check_L1,
    "L2_SlowLeadOvertake":  _check_L2,
    "L3_NarrowStreetNav":   _check_L3,
    "M1_YellowLightStop":   _check_M1,
    "M2_CrosswalkYield":    _check_M2,
    "M3_HighwayMergeYield": _check_M3,
    "H1_PedestrianDart":    _check_H1,
    "H2_HighwayCutIn":      _check_H2,
    "H3_RedLightRunner":    _check_H3,
}


# ─── diagnosis ────────────────────────────────────────────────────────────────

def _diagnose(scenario_id, results, tel, events, npc_tel):
    if all(ok for _, ok, _ in results):
        return "All checks passed. Review video to confirm visual quality."

    npc_speeds = _npc_all_speeds(npc_tel)
    bkes_hi    = [e for e in events
                  if e.get("trigger_type") == "BRAKING" and _ev_brake(e) >= 0.8]

    if "H2" in scenario_id:
        max_s = max(npc_speeds, default=0.0)
        if max_s < 1.0:
            return "NPC never moved. WaypointFollower failed to start."
        if max_s < 40:
            return (f"NPC moving (max {max_s:.0f} km/h) but not fast enough. "
                    "AccelerateToCatchUp may not be running. "
                    "Check WaypointFollower+InTriggerDistanceToVehicle chain.")
        if not bkes_hi:
            return "NPC closed gap but LaneChange or ForceEgoBrake did not fire."
        for label, passed, detail in results:
            if "gap" in label.lower() and not passed:
                return (f"ForceEgoBrake fired but NPC was not close enough. "
                        f"{detail}. AccelerateToCatchUp may not have closed the gap in time.")

    if "H3" in scenario_id:
        max_s = max(npc_speeds, default=0.0)
        if max_s < 10:
            return "NPC never moved. ConstantVelocityAgentBehavior failed to start."
        if not bkes_hi:
            return "NPC moving but ForceEgoBrake did not fire in expected window."
        bt_el  = _ev_elapsed(bkes_hi[0])
        ego_sp = _ev_speed(bkes_hi[0])
        if bt_el < 5.0:
            return (f"ForceEgoBrake fired too early (t={bt_el:.1f}s, need >5s). "
                    "InTriggerDistanceToLocation fires before ego reaches speed. "
                    "Add a minimum 5s warmup phase before the junction trigger.")
        if bt_el > 10.0:
            return (f"ForceEgoBrake fired too late (t={bt_el:.1f}s). "
                    "InTriggerDistanceToLocation threshold may be too small.")
        if ego_sp < 25:
            return (f"Brake fired (t={bt_el:.1f}s) but ego was slow ({ego_sp:.0f} km/h). "
                    "Ego needs more time to reach speed before trigger fires.")

    failed = [(l, d) for l, ok, d in results if not ok]
    return "Failed: " + " | ".join(f"{l} ({d})" for l, d in failed[:2])


# ─── frame table ──────────────────────────────────────────────────────────────

def _print_frame_table(telemetry, yolo_detections, events, npc_telemetry, all_frames):
    event_ts_set = {ev["timestamp"] for ev in events}
    has_npc = bool(npc_telemetry and any(npc_telemetry))
    STEP    = 1 if all_frames else 10

    hdr = "{:>7} {:>6} {:>5} {:>5}  {:>10} {:>10}  {:<14} {:<28}  {}"
    npc_col = "  NPC_DIST" if has_npc else ""
    print(hdr.format("TIME", "SPEED", "BRAKE", "STEER",
                     "EGO_X", "EGO_Y", "ACTION", "YOLO_DETECTED",
                     "TEMPLATE_TEXT") + npc_col)
    print("-" * 115)

    for i, frame in enumerate(telemetry):
        ts    = frame.get("timestamp", 0.0)
        el    = frame.get("elapsed_s", 0.0)
        speed = frame.get("speed_kmh", 0.0)
        brake = frame.get("brake", 0.0)
        steer = frame.get("steer", 0.0)
        ex    = frame.get("x", 0.0)
        ey    = frame.get("y", 0.0)

        is_ev = ts in event_ts_set
        if not all_frames and i % STEP != 0 and not is_ev:
            continue

        dets     = _yolo_near(yolo_detections, ts, window=0.25)
        yolo_str = _yolo_summary(dets)[:28]
        yolo_lbl = [l.split("(")[0].strip() for l in _yolo_labels_from_dets(dets)]
        has_veh  = any(d.get("class_name", "") in _VEHICLE_CLASSES for d in dets)
        action   = _derive_action_state(frame)
        tmpl     = _derive_action_text(frame, yolo_lbl, has_vehicle=has_veh)

        npc_str = ""
        if has_npc and i < len(npc_telemetry):
            parts = []
            for npc in npc_telemetry[i]:
                d = _dist(ex, ey, npc["x"], npc["y"])
                parts.append(f"npc{npc['index']}:{d:.1f}m@{npc['speed_kmh']:.0f}kh")
            npc_str = "  " + "  ".join(parts) if parts else ""

        marker = " >>>" if is_ev else ""
        print(hdr.format(
            f"{el:.2f}s", f"{speed:.1f}", f"{brake:.2f}", f"{steer:.2f}",
            f"{ex:.1f}", f"{ey:.1f}", action, yolo_str, str(tmpl)[:30],
        ) + npc_str + marker)


# ─── NPC summary table ────────────────────────────────────────────────────────

def _print_npc_table(telemetry, npc_telemetry):
    if not npc_telemetry or not any(npc_telemetry):
        return
    print()
    print("NPC SUMMARY (2 Hz):")
    print("-" * 80)

    npc_data = {}
    for fi, frame_npcs in enumerate(npc_telemetry):
        if fi >= len(telemetry):
            break
        el = telemetry[fi].get("elapsed_s", 0.0)
        ex = telemetry[fi].get("x", 0.0)
        ey = telemetry[fi].get("y", 0.0)
        for npc in frame_npcs:
            idx = npc["index"]
            if idx not in npc_data:
                npc_data[idx] = {"type": npc["actor_type"], "frames": []}
            d = _dist(ex, ey, npc["x"], npc["y"])
            npc_data[idx]["frames"].append({
                "el": el, "fi": fi,
                "x": npc["x"], "y": npc["y"],
                "speed": npc["speed_kmh"],
                "dist": d,
            })

    for idx, data in sorted(npc_data.items()):
        frames = data["frames"]
        if not frames:
            continue
        min_frame = min(frames, key=lambda f: f["dist"])
        print(f"\nNPC[{idx}]  {data['type']}")
        shown = set()
        for i, f in enumerate(frames):
            if i % 10 == 0:
                marker = "  ← CLOSEST APPROACH" if f is min_frame else ""
                print(f"  t={f['el']:5.1f}s  pos=({f['x']:.1f},{f['y']:.1f})"
                      f"  speed={f['speed']:5.1f} km/h  dist_to_ego={f['dist']:6.1f}m{marker}")
                shown.add(id(f))
        if id(min_frame) not in shown:
            print(f"  t={min_frame['el']:5.1f}s  pos=({min_frame['x']:.1f},{min_frame['y']:.1f})"
                  f"  speed={min_frame['speed']:5.1f} km/h  dist_to_ego={min_frame['dist']:6.1f}m"
                  f"  ← CLOSEST APPROACH")


# ─── action event detail ──────────────────────────────────────────────────────

_STORY_HINTS = {
    "H1_PedestrianDart":    "NPC (pedestrian) should be within 5m; ego speed >20 km/h at brake",
    "H2_HighwayCutIn":      "NPC should be within 10m; ego speed >40 km/h at brake",
    "H3_RedLightRunner":    "NPC within 30m of ego; brake fires between t=5–10s",
    "M1_YellowLightStop":   "Brake fires between t=8–12s after yellow light",
    "M2_CrosswalkYield":    "Brake fires t=6–10s; pedestrian should be in YOLO",
    "M3_HighwayMergeYield": "Brake fires after t=7s when NPC merges into lane",
}


def _print_event_detail(events, yolo_detections, npc_telemetry, telemetry,
                        template_data, scenario_id):
    if not events:
        print("\n(no action events recorded)\n")
        return

    print()
    print(f"ACTION EVENTS ({len(events)})")
    print("=" * 72)
    hint = _STORY_HINTS.get(scenario_id, "")

    for i, ev in enumerate(events):
        ts    = ev.get("timestamp", 0.0)
        snap  = ev.get("telemetry_snapshot", {})
        el    = snap.get("elapsed_s", ts)
        ttype = ev.get("trigger_type", "?")
        speed = snap.get("speed_kmh", 0.0)
        brake = snap.get("brake", 0.0)
        ex    = snap.get("x", 0.0)
        ey    = snap.get("y", 0.0)

        dets     = _yolo_near(yolo_detections, ts, window=0.5)
        yolo_str = _yolo_summary(dets)

        print(f"\n[t={el:.2f}s]  {ttype}  ego=({ex:.1f},{ey:.1f})"
              f"  speed={speed:.1f} km/h  brake={brake:.2f}")
        if yolo_str:
            print(f"  YOLO:     {yolo_str}")

        if npc_telemetry:
            best_fi = min(range(len(telemetry)),
                          key=lambda k: abs(telemetry[k].get("timestamp", 0) - ts))
            npc_at  = npc_telemetry[best_fi] if best_fi < len(npc_telemetry) else []
            for npc in npc_at:
                d = _dist(ex, ey, npc["x"], npc["y"])
                print(f"  NPC[{npc['index']}] {npc['actor_type'].split('.')[-1]:<12}"
                      f"  pos=({npc['x']:.1f},{npc['y']:.1f})"
                      f"  dist={d:.1f}m  speed={npc['speed_kmh']:.0f} km/h")

        if template_data:
            for entry in template_data:
                if entry.get("event_index") == i:
                    print(f"  template: {entry.get('explanation', '')}")
                    break

        if hint:
            print(f"  STORY:    {hint}")


# ─── verdict block ────────────────────────────────────────────────────────────

def _print_verdict(scenario_id, results, tel, events, npc_tel):
    passed    = sum(1 for _, ok, _ in results if ok)
    total     = len(results)
    overall   = passed == total
    diagnosis = _diagnose(scenario_id, results, tel, events, npc_tel)

    W = 66
    print()
    print("╔" + "═" * W + "╗")
    title = f"SCENARIO VERDICT: {scenario_id}"
    print(f"║  {title:<{W-2}}║")
    print("╠" + "═" * W + "╣")
    for label, ok, detail in results:
        tag  = "PASS" if ok else "FAIL"
        line = f"  [{tag}] {label:<42} ({detail})"
        if len(line) > W:
            line = line[:W]
        print(f"║{line:<{W}}║")
    print("╠" + "═" * W + "╣")
    result_str = (f"PASSED  ({passed}/{total} checks passed)"
                  if overall else f"FAILED  ({passed}/{total} checks passed)")
    print(f"║  RESULT: {result_str:<{W-10}}║")

    # wrap long diagnosis
    diag = f"  DIAGNOSIS: {diagnosis}"
    while diag:
        if len(diag) <= W:
            print(f"║{diag:<{W}}║")
            break
        cut = diag[:W].rfind(" ")
        if cut <= 0:
            cut = W
        print(f"║{diag[:cut]:<{W}}║")
        diag = "             " + diag[cut:].lstrip()

    print("╚" + "═" * W + "╝")


# ─── main ─────────────────────────────────────────────────────────────────────

def run(scenario_dir, all_frames=False):
    scenario_dir = Path(scenario_dir)
    if not scenario_dir.exists():
        print(f"ERROR: {scenario_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    # Parse scenario_id: "H1_PedestrianDart_run5" → "H1_PedestrianDart"
    folder_name = scenario_dir.name
    parts = folder_name.rsplit("_run", 1)
    scenario_id = parts[0]

    telemetry       = _load_json(scenario_dir / "telemetry.json") or []
    yolo_detections = _load_json(scenario_dir / "yolo_detections.json") or []
    events          = _load_json(scenario_dir / "action_events.json") or []
    npc_telemetry   = _load_json(scenario_dir / "npc_telemetry.json") or []
    template_data   = _load_json(scenario_dir / "explanations" / "template.json") or []

    if not telemetry:
        print("ERROR: telemetry.json not found or empty", file=sys.stderr)
        sys.exit(1)

    has_npc = bool(npc_telemetry and any(npc_telemetry))

    print(f"\n{'='*72}")
    print(f"  {folder_name}  —  Scene Log")
    print(f"  {len(telemetry)} frames  |  {len(events)} action events  |"
          f"  {len(yolo_detections)} YOLO dets"
          + (f"  |  NPCs tracked" if has_npc else ""))
    print(f"  Scenario ID: {scenario_id}")
    print(f"{'='*72}\n")

    _print_frame_table(telemetry, yolo_detections, events, npc_telemetry, all_frames)
    _print_npc_table(telemetry, npc_telemetry)
    _print_event_detail(events, yolo_detections, npc_telemetry, telemetry,
                        template_data, scenario_id)

    check_fn = SCENARIO_CRITERIA.get(scenario_id)
    if check_fn is None:
        print(f"\n(No criteria defined for scenario_id={scenario_id!r})\n")
        return

    results = check_fn(telemetry, yolo_detections, events, npc_telemetry)
    _print_verdict(scenario_id, results, telemetry, events, npc_telemetry)


def main():
    parser = argparse.ArgumentParser(
        description="Scene log + pass/fail verdict for AdaptTrust scenario runs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python scripts/scene_logger.py data/scenarios/H1_PedestrianDart_run5",
    )
    parser.add_argument("scenario_dir", help="Path to recorded scenario folder")
    parser.add_argument("--all-frames", action="store_true",
                        help="Print every frame instead of 2 Hz subset")
    args = parser.parse_args()
    run(Path(args.scenario_dir), all_frames=args.all_frames)


if __name__ == "__main__":
    main()
