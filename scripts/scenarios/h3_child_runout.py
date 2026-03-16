"""
h3_child_runout.py
Critical event: child runs into road at tick ~200 (t≈10s); ego hard-brakes for 2s.

Criticality: HIGH
Map: Town02  (narrow urban streets, lower speeds)
Duration: 20 s

Same approach as H1:
- Child blueprint selected by ID (shorter pedestrian models)
- Walker spawn from ego's actual spawn transform (NOT nav-mesh)
- WalkerControl reapplied EVERY tick after trigger
- All TLs frozen GREEN; ap.override() forces brake=1.0 for 40 ticks
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import carla
from scripts.scenarios.scenario_base import ScenarioBase, ScenarioFailed
from scripts.autonomous.agent_controller import AgentController
from scripts.data_collection.recorder import Recorder

DURATION      = 20.0
TARGET_KMH    = 25.0
MIN_SPEED_KMH = 10.0
WARMUP_S      =  4.0
FALLBACK_S    = 11.0

# CARLA child/shorter pedestrian blueprint IDs
_CHILD_IDS = (
    "walker.pedestrian.0008",
    "walker.pedestrian.0012",
    "walker.pedestrian.0014",
    "walker.pedestrian.0016",
)


def _dest(world, ego, dist_m=400.0):
    wp  = world.get_map().get_waypoint(ego.get_location())
    wps = wp.next(dist_m)
    return wps[0].transform.location if wps \
        else world.get_map().get_spawn_points()[-1].location


class H3ChildRunout(ScenarioBase):
    def __init__(self, **kwargs):
        super().__init__(map_name="Town02", spawn_index=0, **kwargs)

    def run(self, ap=None, rec=None) -> dict:
        self.world.set_weather(carla.WeatherParameters.WetCloudyNoon)

        for tl in self.world.get_actors().filter("traffic.traffic_light"):
            tl.set_state(carla.TrafficLightState.Green)
            tl.freeze(True)

        # --- Select child blueprint ---
        bp_lib    = self.world.get_blueprint_library()
        child_bps = [b for b in bp_lib.filter("walker.pedestrian.*")
                     if b.id in _CHILD_IDS]
        walker_bp = child_bps[0] if child_bps else \
                    (list(bp_lib.filter("walker.pedestrian.*")) or [None])[0]

        # --- Spawn location from ego's actual spawn transform ---
        spawn_points = self.world.get_map().get_spawn_points()
        ego_t   = spawn_points[self.spawn_index]
        fwd     = ego_t.get_forward_vector()
        right   = ego_t.get_right_vector()
        walker_loc = carla.Location(
            x = ego_t.location.x + 18.0 * fwd.x - 3.0 * right.x,
            y = ego_t.location.y + 18.0 * fwd.y - 3.0 * right.y,
            z = ego_t.location.z + 0.5,
        )
        walk_dir = carla.Vector3D(x=-right.x, y=-right.y, z=0.0)

        walker = None
        if walker_bp:
            walker = self.world.try_spawn_actor(
                walker_bp,
                carla.Transform(walker_loc, carla.Rotation(yaw=ego_t.rotation.yaw + 90)),
            )
            if walker:
                self.world.tick()

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

                fire = (
                    not critical_triggered
                    and elapsed >= WARMUP_S
                    and (frame["speed_kmh"] > MIN_SPEED_KMH or elapsed >= FALLBACK_S)
                )

                if fire:
                    critical_triggered = True
                    with ap.override():
                        for _ in range(40):
                            self.ego.apply_control(
                                carla.VehicleControl(brake=1.0, throttle=0.0)
                            )
                            if walker and walker.is_alive:
                                walker.apply_control(carla.WalkerControl(
                                    direction=walk_dir,
                                    speed=3.5,
                                    jump=False,
                                ))
                            frame   = self.tick()
                            ap.update(frame)
                            rec.record(frame)
                            elapsed = frame["timestamp"] - start

                elif critical_triggered and walker and walker.is_alive:
                    walker.apply_control(carla.WalkerControl(
                        direction=walk_dir,
                        speed=3.5,
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
            "map": "Town02",
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
    s = H3ChildRunout(scenario_id="h3_child_runout_test")
    s.setup()
    try:
        result = s.run()
        s.verify()
        print(json.dumps(result, indent=2))
    finally:
        s.clean_up()
