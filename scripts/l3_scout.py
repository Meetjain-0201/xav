"""
l3_scout.py — L3_NarrowStreetNav map scout & NPC placement debugger

Connects to CARLA (Town02), walks the route from spawn[0], and for each
planned NPC position:
  - Prints exact x/y/z, side, road_id, lane_id, lane width
  - Draws a colored debug marker in the spectator window
  - Tries a test-spawn to confirm whether the slot is actually usable

RED   markers = left-side NPCs
BLUE  markers = right-side NPCs
GREEN marker  = ego spawn point
YELLOW arrow  = ego forward direction at spawn

Run with CARLA already open on Town02:
  python scripts/l3_scout.py
  python scripts/l3_scout.py --hold       # keeps markers visible, loops
  python scripts/l3_scout.py --test-spawn # actually spawns & destroys test actors
  python scripts/l3_scout.py --all-spawns # also dump every Town02 spawn point
"""

import sys
import time
import math
import argparse
from pathlib import Path

_HOME = Path.home()
sys.path.insert(0, str(_HOME / "scenario_runner"))
sys.path.insert(0, str(_HOME / "carla/PythonAPI/carla"))
sys.path.insert(0, str(_HOME / "carla/PythonAPI/carla/agents"))

import carla

# ---------------------------------------------------------------------------
# L3 NPC layout (mirrors adaptrust_scenarios.py exactly)
# ---------------------------------------------------------------------------
NPC_LAYOUT = [
    (10.0,  -1, "NPC1"),
    (20.0,  -1, "NPC2"),
    (30.0,  -1, "NPC3"),
    (66.0,  -1, "NPC4"),
    (78.0,   1, "NPC5"),
    (90.0,  -1, "NPC6"),
    (102.0,  1, "NPC7"),
    (114.0, -1, "NPC8"),
]
SIDE_OFFSET  = 2.5   # metres lateral from lane centre
SPAWN_INDEX  = 0
MAP_NAME     = "Town02"
EGO_BP       = "vehicle.tesla.model3"

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED    = carla.Color(220,  40,  40)
BLUE   = carla.Color( 40, 100, 220)
GREEN  = carla.Color( 40, 200,  80)
YELLOW = carla.Color(240, 200,   0)
WHITE  = carla.Color(240, 240, 240)


def draw_cross(world, loc, color, size=0.4, life=30.0):
    """Draw a cross (+) at loc using three short lines."""
    d = size / 2
    world.debug.draw_line(
        carla.Location(loc.x - d, loc.y, loc.z + 0.1),
        carla.Location(loc.x + d, loc.y, loc.z + 0.1),
        thickness=0.08, color=color, life_time=life)
    world.debug.draw_line(
        carla.Location(loc.x, loc.y - d, loc.z + 0.1),
        carla.Location(loc.x, loc.y + d, loc.z + 0.1),
        thickness=0.08, color=color, life_time=life)
    world.debug.draw_line(
        carla.Location(loc.x, loc.y, loc.z + 0.1),
        carla.Location(loc.x, loc.y, loc.z + 0.1 + size),
        thickness=0.08, color=color, life_time=life)


def draw_box_at(world, loc, color, life=30.0):
    """Draw a small bounding box to mark a spawn slot."""
    ext = carla.Vector3D(0.5, 0.5, 0.75)
    bbox = carla.BoundingBox(loc, ext)
    world.debug.draw_box(bbox,
                         carla.Rotation(0, 0, 0),
                         thickness=0.06,
                         color=color,
                         life_time=life)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hold",        action="store_true",
                        help="Loop and refresh markers every 25 s (keeps them visible)")
    parser.add_argument("--test-spawn",  action="store_true",
                        help="Physically spawn+destroy a test vehicle at each slot")
    parser.add_argument("--all-spawns",  action="store_true",
                        help="Dump all Town02 spawn points with index/coords/road")
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Connect
    # ------------------------------------------------------------------
    client = carla.Client("localhost", 2000)
    client.set_timeout(20.0)
    world = client.get_world()

    current_map = world.get_map().name.split("/")[-1]
    if current_map != MAP_NAME:
        print(f"[scout] Loading {MAP_NAME} (current: {current_map}) ...")
        world = client.load_world(MAP_NAME)
        time.sleep(3.0)
        print(f"[scout] {MAP_NAME} loaded.")

    cmap       = world.get_map()
    spawn_pts  = cmap.get_spawn_points()
    spectator  = world.get_spectator()

    # ------------------------------------------------------------------
    # Optionally dump all spawn points
    # ------------------------------------------------------------------
    if args.all_spawns:
        print(f"\n{'='*70}")
        print(f"  ALL SPAWN POINTS — {MAP_NAME}  ({len(spawn_pts)} total)")
        print(f"{'='*70}")
        print(f"  {'idx':>4}  {'x':>8}  {'y':>8}  {'z':>6}  {'yaw':>7}  road  lane")
        print(f"  {'-'*4}  {'-'*8}  {'-'*8}  {'-'*6}  {'-'*7}  ----  ----")
        for i, sp in enumerate(spawn_pts):
            wp = cmap.get_waypoint(sp.location)
            marker = " ← L3 SPAWN" if i == SPAWN_INDEX else ""
            print(f"  {i:>4}  {sp.location.x:>8.2f}  {sp.location.y:>8.2f}  "
                  f"{sp.location.z:>6.2f}  {sp.rotation.yaw:>7.1f}°  "
                  f"{wp.road_id:>4}  {wp.lane_id:>4}{marker}")
        print()

    # ------------------------------------------------------------------
    # Ego spawn
    # ------------------------------------------------------------------
    ego_spawn = spawn_pts[SPAWN_INDEX]
    ego_wp    = cmap.get_waypoint(ego_spawn.location)

    print(f"\n{'='*70}")
    print(f"  L3_NarrowStreetNav — NPC placement scout")
    print(f"  Map: {MAP_NAME}   Ego spawn index: {SPAWN_INDEX}")
    print(f"  Ego spawn:  x={ego_spawn.location.x:.2f}  y={ego_spawn.location.y:.2f}  "
          f"z={ego_spawn.location.z:.2f}  yaw={ego_spawn.rotation.yaw:.1f}°")
    print(f"  Ego waypoint: road={ego_wp.road_id}  lane={ego_wp.lane_id}  "
          f"lane_width={ego_wp.lane_width:.2f}m")
    print(f"{'='*70}")
    print(f"  {'NPC':6}  {'dist':>6}  {'side':>5}  {'x':>8}  {'y':>8}  {'z':>6}  "
          f"{'road':>5}  {'lane':>5}  {'lw':>5}  status")
    print(f"  {'-'*6}  {'-'*6}  {'-'*5}  {'-'*8}  {'-'*8}  {'-'*6}  "
          f"{'-'*5}  {'-'*5}  {'-'*5}  ------")

    # ------------------------------------------------------------------
    # Blueprint for test spawns
    # ------------------------------------------------------------------
    bp_lib  = world.get_blueprint_library()
    car_bps = [b for b in bp_lib.filter("vehicle.*")
               if b.get_attribute("number_of_wheels").as_int() == 4]
    test_bp = car_bps[0] if car_bps else None
    spawned_actors = []

    # ------------------------------------------------------------------
    # Walk NPC layout
    # ------------------------------------------------------------------
    life = 60.0 if args.hold else 30.0

    npc_data = []   # store for spectator fly-through

    for dist, sign, label in NPC_LAYOUT:
        side_str = "LEFT" if sign < 0 else "RIGHT"
        color    = RED if sign < 0 else BLUE

        # Walk forward dist metres from ego spawn waypoint
        wps = ego_wp.next(dist)
        if not wps:
            print(f"  {label:6}  {dist:>6.1f}  {side_str:>5}  "
                  f"{'NO WAYPOINT':>8}  —  FAIL")
            continue
        wp = wps[0]

        # Compute lateral offset
        right = wp.transform.get_right_vector()
        side  = sign * SIDE_OFFSET
        loc   = carla.Location(
            x=wp.transform.location.x + side * right.x,
            y=wp.transform.location.y + side * right.y,
            z=wp.transform.location.z + 0.3,
        )

        # Waypoint info at the NPC location
        npc_wp = cmap.get_waypoint(loc)

        # Attempt test spawn
        status = "OK"
        if args.test_spawn and test_bp:
            t_spawn = carla.Transform(loc, wp.transform.rotation)
            actor   = world.try_spawn_actor(test_bp, t_spawn)
            if actor:
                actor.set_simulate_physics(False)
                spawned_actors.append(actor)
                status = "SPAWNED"
            else:
                status = "SPAWN FAIL"

        print(f"  {label:6}  {dist:>6.1f}  {side_str:>5}  "
              f"{loc.x:>8.2f}  {loc.y:>8.2f}  {loc.z:>6.2f}  "
              f"{npc_wp.road_id:>5}  {npc_wp.lane_id:>5}  "
              f"{npc_wp.lane_width:>5.2f}  {status}")

        npc_data.append((label, side_str, color, loc, wp.transform))

        # Draw debug markers
        draw_cross(world, loc, color, size=0.6, life=life)
        draw_box_at(world, loc, color, life=life)
        world.debug.draw_string(
            carla.Location(loc.x, loc.y, loc.z + 1.8),
            f"{label} {side_str}",
            draw_shadow=True, color=color, life_time=life)

    print(f"{'='*70}\n")

    # ------------------------------------------------------------------
    # Draw ego spawn marker + forward arrow
    # ------------------------------------------------------------------
    fwd = ego_spawn.get_forward_vector()
    draw_cross(world, ego_spawn.location, GREEN, size=0.8, life=life)
    world.debug.draw_string(
        carla.Location(ego_spawn.location.x,
                       ego_spawn.location.y,
                       ego_spawn.location.z + 2.0),
        f"EGO SPAWN [{SPAWN_INDEX}]",
        draw_shadow=True, color=GREEN, life_time=life)
    world.debug.draw_arrow(
        ego_spawn.location,
        carla.Location(ego_spawn.location.x + 5 * fwd.x,
                       ego_spawn.location.y + 5 * fwd.y,
                       ego_spawn.location.z + 0.3),
        thickness=0.1, arrow_size=0.3,
        color=YELLOW, life_time=life)

    # ------------------------------------------------------------------
    # Draw line connecting NPC positions (shows the route)
    # ------------------------------------------------------------------
    for i in range(len(npc_data) - 1):
        _, _, _, loc_a, _ = npc_data[i]
        _, _, _, loc_b, _ = npc_data[i + 1]
        world.debug.draw_line(
            carla.Location(loc_a.x, loc_a.y, loc_a.z + 0.15),
            carla.Location(loc_b.x, loc_b.y, loc_b.z + 0.15),
            thickness=0.04, color=WHITE, life_time=life)

    # ------------------------------------------------------------------
    # Fly spectator to overview position above ego spawn
    # ------------------------------------------------------------------
    fwd_r = math.radians(ego_spawn.rotation.yaw)
    spectator.set_transform(carla.Transform(
        carla.Location(
            x=ego_spawn.location.x - 8 * math.cos(fwd_r),
            y=ego_spawn.location.y - 8 * math.sin(fwd_r),
            z=ego_spawn.location.z + 25.0),
        carla.Rotation(pitch=-60.0, yaw=ego_spawn.rotation.yaw)))

    print("[scout] Debug markers drawn in CARLA spectator window.")
    print("        GREEN  = ego spawn")
    print("        RED    = left-side NPCs  (ego should deviate RIGHT past these)")
    print("        BLUE   = right-side NPCs (ego should deviate LEFT past these)")
    print()

    if args.test_spawn and spawned_actors:
        print(f"[scout] {len(spawned_actors)} test actors spawned. "
              f"Press Enter to destroy them and exit.")
        input()
        for a in spawned_actors:
            if a.is_alive:
                a.destroy()
        print("[scout] Test actors destroyed.")
    elif args.hold:
        print("[scout] --hold mode: refreshing markers every 25 s. Ctrl+C to stop.\n")
        try:
            while True:
                time.sleep(25)
                # Redraw — markers have a 30 s life_time so refresh keeps them visible
                for label, side_str, color, loc, wp_t in npc_data:
                    draw_cross(world, loc, color, size=0.6, life=30.0)
                    world.debug.draw_string(
                        carla.Location(loc.x, loc.y, loc.z + 1.8),
                        f"{label} {side_str}",
                        draw_shadow=True, color=color, life_time=30.0)
                draw_cross(world, ego_spawn.location, GREEN, size=0.8, life=30.0)
        except KeyboardInterrupt:
            print("\n[scout] Stopped.")
    else:
        print("[scout] Done. (Run with --hold to keep markers visible longer.)")


if __name__ == "__main__":
    main()
