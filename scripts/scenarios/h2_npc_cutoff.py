"""
h2_npc_cutoff.py
Critical event: NPC in left lane forced into ego's lane at tick ~200 (t≈10s); ego brakes 2s.

Criticality: HIGH
Map: Town04
Duration: 25 s

Implementation notes:
- NPC spawned in adjacent LEFT lane 15 m ahead at ego spawn time
- tm.force_lane_change(npc, False) is used at t=10s — documented CARLA API call
  that reliably moves an NPC across lanes (False = change to RIGHT = toward ego lane)
- NPC remains on TM autopilot so it actually drives; force_lane_change overrides
  the lane-change decision at the right moment
- ap.override() forces ego brake=1.0 for 40 ticks simultaneously
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import carla
from scripts.scenarios.scenario_base import ScenarioBase, ScenarioFailed
from scripts.autonomous.agent_controller import AgentController
from scripts.data_collection.recorder import Recorder

DURATION      = 25.0
TARGET_KMH    = 70.0
MIN_SPEED_KMH = 40.0
WARMUP_S      =  5.0
FALLBACK_S    = 14.0


def _dest(world, ego, dist_m=700.0):
    wp  = world.get_map().get_waypoint(ego.get_location())
    wps = wp.next(dist_m)
    return wps[0].transform.location if wps \
        else world.get_map().get_spawn_points()[-1].location


class H2NpcCutoff(ScenarioBase):
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

        # Spawn NPC in LEFT adjacent lane, 15 m ahead of ego
        ego_wp    = self.world.get_map().get_waypoint(self.ego.get_location())
        ahead_wps = ego_wp.next(15.0)
        npc       = None
        if ahead_wps:
            left_wp = ahead_wps[0].get_left_lane()
            spawn_wp = left_wp if (left_wp and left_wp.lane_type == carla.LaneType.Driving) \
                       else ahead_wps[0]
            t = spawn_wp.transform
            t.location.z += 0.5
            npc = self.world.try_spawn_actor(npc_bp, t)

        if npc:
            npc.set_autopilot(True, self.traffic_manager.get_port())
            self.traffic_manager.ignore_lights_percentage(npc, 100)
            # NPC slightly faster than ego so it stays in frame
            self.traffic_manager.vehicle_percentage_speed_difference(npc, -10)
            self.traffic_manager.auto_lane_change(npc, False)   # disable random LC

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
                    # Force NPC to change lane RIGHT (toward ego) — documented TM API
                    if npc and npc.is_alive:
                        self.traffic_manager.force_lane_change(npc, False)

                    # Ego emergency-brakes for 40 ticks ≈ 2 s
                    with ap.override():
                        for _ in range(40):
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

        if npc and npc.is_alive:
            npc.destroy()
        ap.disable()

        return {
            "scenario_id": self.scenario_id,
            "criticality": "high",
            "map": "Town04",
            "duration_s": DURATION,
            "npc_count": 1 if npc else 0,
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
    s = H2NpcCutoff(scenario_id="h2_npc_cutoff_test")
    s.setup()
    try:
        result = s.run()
        s.verify()
        print(json.dumps(result, indent=2))
    finally:
        s.clean_up()
