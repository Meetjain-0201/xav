"""
h5_highway_obstacle.py
Critical event: stationary obstacle car 35 m ahead detected at ~20 m; ego brakes 2s.

Criticality: HIGH
Map: Town04
Duration: 25 s

Implementation notes:
- Obstacle NPC spawned 35 m ahead, IMMEDIATELY stopped + set_simulate_physics(False)
  so it stays perfectly in place regardless of anything else happening
- Trigger is DISTANCE-BASED (ego within 20 m) rather than time-based for reliability
- BasicAgent detects stationary vehicle via its vehicle-obstacle logic and begins
  slowing; we simultaneously force brake=1.0 via ap.override() to guarantee BRAKING
- All TLs frozen GREEN so ego reaches 50+ km/h before the trigger fires
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import carla
from scripts.scenarios.scenario_base import ScenarioBase, ScenarioFailed
from scripts.autonomous.agent_controller import AgentController
from scripts.data_collection.recorder import Recorder

DURATION        = 25.0
TARGET_KMH      = 80.0
MIN_SPEED_KMH   = 50.0
TRIGGER_DIST_M  = 20.0   # ego-to-obstacle distance that fires emergency brake
WARMUP_S        =  5.0
FALLBACK_S      = 16.0   # time-based fallback if distance trigger never fires


def _dest(world, ego, dist_m=700.0):
    wp  = world.get_map().get_waypoint(ego.get_location())
    wps = wp.next(dist_m)
    return wps[0].transform.location if wps \
        else world.get_map().get_spawn_points()[-1].location


class H5HighwayObstacle(ScenarioBase):
    def __init__(self, **kwargs):
        super().__init__(map_name="Town04", spawn_index=10, **kwargs)

    def run(self, ap=None, rec=None) -> dict:
        self.world.set_weather(carla.WeatherParameters.WetCloudyNoon)

        for tl in self.world.get_actors().filter("traffic.traffic_light"):
            tl.set_state(carla.TrafficLightState.Green)
            tl.freeze(True)

        bp_lib  = self.world.get_blueprint_library()
        car_bps = [b for b in bp_lib.filter("vehicle.*")
                   if b.get_attribute("number_of_wheels").as_int() == 4]
        npc_bp  = car_bps[0] if car_bps else bp_lib.filter("vehicle.*")[0]

        # Spawn obstacle 35 m ahead in same lane — STATIONARY from t=0
        ego_wp    = self.world.get_map().get_waypoint(self.ego.get_location())
        ahead_wps = ego_wp.next(35.0)
        obstacle  = None
        if ahead_wps:
            t = ahead_wps[0].transform
            t.location.z += 0.5
            obstacle = self.world.try_spawn_actor(npc_bp, t)

        if obstacle:
            # Brake hard + disable physics so it becomes a true static obstacle
            obstacle.apply_control(
                carla.VehicleControl(brake=1.0, hand_brake=True, throttle=0.0)
            )
            obstacle.set_simulate_physics(False)   # stays exactly in place

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

                if elapsed < WARMUP_S:
                    continue

                # Distance-based trigger: fire when ego is within TRIGGER_DIST_M
                if obstacle and obstacle.is_alive:
                    dist = self.ego.get_location().distance(obstacle.get_location())
                else:
                    dist = 0.0   # obstacle gone → use fallback

                fire = (
                    not critical_triggered
                    and (
                        (frame["speed_kmh"] > MIN_SPEED_KMH and dist < TRIGGER_DIST_M)
                        or elapsed >= FALLBACK_S
                    )
                )

                if fire:
                    critical_triggered = True
                    with ap.override():
                        for _ in range(40):   # 2 s
                            self.ego.apply_control(
                                carla.VehicleControl(brake=1.0, throttle=0.0)
                            )
                            frame   = self.tick()
                            ap.update(frame)
                            rec.record(frame)
                            elapsed = frame["timestamp"] - start

        finally:
            if _owns_rec:
                rec.__exit__(None, None, None)

        if obstacle and obstacle.is_alive:
            obstacle.set_simulate_physics(True)
            obstacle.destroy()
        ap.disable()

        return {
            "scenario_id": self.scenario_id,
            "criticality": "high",
            "map": "Town04",
            "duration_s": DURATION,
            "npc_count": 1 if obstacle else 0,
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
    s = H5HighwayObstacle(scenario_id="h5_highway_obstacle_test")
    s.setup()
    try:
        result = s.run()
        s.verify()
        print(json.dumps(result, indent=2))
    finally:
        s.clean_up()
