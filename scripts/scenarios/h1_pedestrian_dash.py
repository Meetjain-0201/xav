"""
h1_pedestrian_dash.py
Critical event: pedestrian runs into road at tick ~200 (t≈10s); ego hard-brakes for 2s.

Criticality: HIGH
Map: Town01
Duration: 20 s

Implementation notes:
- Walker spawn location computed from ego's ACTUAL spawn transform using
  forward/right vectors (NOT from nav-mesh or waypoints — those only reach sidewalks).
- WalkerControl applied EVERY tick after trigger so physics keeps the walker moving.
  A single apply_control() fires once; in sync mode you must re-apply each step.
- All TLs frozen GREEN so ego reaches MIN_SPEED_KMH before trigger fires.
- ap.override() suspends BasicAgent for 40 ticks of brake=1.0.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import carla
from scripts.scenarios.scenario_base import ScenarioBase, ScenarioFailed
from scripts.autonomous.agent_controller import AgentController
from scripts.data_collection.recorder import Recorder

DURATION      = 20.0
TARGET_KMH    = 35.0
MIN_SPEED_KMH = 15.0   # ego must be moving before event fires
WARMUP_S      =  5.0
FALLBACK_S    = 12.0   # fire regardless of speed if this elapses


def _dest(world, ego, dist_m=600.0):
    wp  = world.get_map().get_waypoint(ego.get_location())
    wps = wp.next(dist_m)
    return wps[0].transform.location if wps \
        else world.get_map().get_spawn_points()[-1].location


class H1PedestrianDash(ScenarioBase):
    def __init__(self, **kwargs):
        super().__init__(map_name="Town01", spawn_index=0, **kwargs)

    def run(self, ap=None, rec=None) -> dict:
        self.world.set_weather(carla.WeatherParameters.WetCloudyNoon)

        # Freeze all TLs green so ego reaches speed before the event
        for tl in self.world.get_actors().filter("traffic.traffic_light"):
            tl.set_state(carla.TrafficLightState.Green)
            tl.freeze(True)

        # --- Walker spawn location from ego's actual spawn transform ---
        # 20 m ahead, 3 m to the right of ego's lane → standing on sidewalk
        spawn_points = self.world.get_map().get_spawn_points()
        ego_t   = spawn_points[self.spawn_index]
        fwd     = ego_t.get_forward_vector()
        right   = ego_t.get_right_vector()
        walker_loc = carla.Location(
            x = ego_t.location.x + 20.0 * fwd.x - 3.0 * right.x,
            y = ego_t.location.y + 20.0 * fwd.y - 3.0 * right.y,
            z = ego_t.location.z + 0.5,
        )
        # Walk direction: perpendicular to road, INTO traffic (negate right vector)
        walk_dir = carla.Vector3D(x=-right.x, y=-right.y, z=0.0)

        bp_lib    = self.world.get_blueprint_library()
        ped_bps   = list(bp_lib.filter("walker.pedestrian.*"))
        walker_bp = ped_bps[0] if ped_bps else None
        walker    = None
        if walker_bp:
            walker = self.world.try_spawn_actor(
                walker_bp,
                carla.Transform(walker_loc, carla.Rotation(yaw=ego_t.rotation.yaw + 90)),
            )
            if walker:
                self.world.tick()   # let physics settle before controlling

        if ap is None:
            ap = AgentController(self.ego, self.world,
                                 target_speed_kmh=TARGET_KMH,
                                 ignore_traffic_lights=True)
            ap.set_destination(_dest(self.world, self.ego))
        ap.enable()

        if rec is None:
            rec = Recorder(self); rec.__enter__(); _owns_rec = True
        else:
            _owns_rec = False

        critical_triggered = False

        try:
            start = self.world.get_snapshot().timestamp.elapsed_seconds
            elapsed = 0.0

            while elapsed < DURATION:
                frame   = self.tick()
                ap.update(frame)
                rec.record(frame)
                elapsed = frame["timestamp"] - start

                # Fire when ego is moving (speed gate) or at fallback time
                fire = (
                    not critical_triggered
                    and elapsed >= WARMUP_S
                    and (frame["speed_kmh"] > MIN_SPEED_KMH or elapsed >= FALLBACK_S)
                )

                if fire:
                    critical_triggered = True

                    # Ego emergency-brakes for 40 ticks ≈ 2 s @ 20 Hz
                    # Walker control applied EVERY tick inside the override loop
                    with ap.override():
                        for _ in range(40):
                            self.ego.apply_control(
                                carla.VehicleControl(brake=1.0, throttle=0.0)
                            )
                            # Re-apply WalkerControl each tick (sync mode requires it)
                            if walker and walker.is_alive:
                                walker.apply_control(carla.WalkerControl(
                                    direction=walk_dir,
                                    speed=4.0,
                                    jump=False,
                                ))
                            frame   = self.tick()
                            ap.update(frame)
                            rec.record(frame)
                            elapsed = frame["timestamp"] - start

                # Keep walker moving after override ends
                elif critical_triggered and walker and walker.is_alive:
                    walker.apply_control(carla.WalkerControl(
                        direction=walk_dir,
                        speed=4.0,
                        jump=False,
                    ))

        finally:
            if _owns_rec:
                rec.__exit__(None, None, None)

        if walker and walker.is_alive:
            walker.destroy()
        ap.disable()

        return {
            "scenario_id": self.scenario_id,
            "criticality": "high",
            "map": "Town01",
            "duration_s": DURATION,
            "npc_count": 1 if walker else 0,
        }

    def verify(self) -> None:
        braking = [e for e in self._action_events
                   if e["trigger_type"] == "BRAKING"]
        if not braking:
            raise ScenarioFailed(
                f"{self.scenario_id}: BRAKING trigger required. "
                f"Got: {[e['trigger_type'] for e in self._action_events]}"
            )


if __name__ == "__main__":
    import json
    s = H1PedestrianDash(scenario_id="h1_pedestrian_dash_test")
    s.setup()
    try:
        result = s.run()
        s.verify()
        print(json.dumps(result, indent=2))
    finally:
        s.clean_up()
