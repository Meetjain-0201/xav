"""
h4_red_light.py
Critical event: traffic light turns RED at t≈8s; ego hard-brakes for 2s.

Criticality: HIGH
Map: Town03
Duration: 20 s

Implementation notes:
- All TLs frozen GREEN at start so BasicAgent approaches at 40 km/h
- At TL_TRIGGER_S: check ego.is_at_traffic_light() first (most reliable);
  fall back to nearest TL by distance
- TL frozen RED via set_state + freeze(True)
- ap.override() simultaneously forces brake=1.0 for 40 ticks regardless of
  whether BasicAgent would brake on its own (guarantees BRAKING trigger)
- After RED_HOLD_S, TL reset GREEN so ego can continue if scenario duration allows
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import carla
from scripts.scenarios.scenario_base import ScenarioBase, ScenarioFailed
from scripts.autonomous.agent_controller import AgentController
from scripts.data_collection.recorder import Recorder

DURATION      = 20.0
TARGET_KMH    = 40.0
MIN_SPEED_KMH = 15.0
TL_TRIGGER_S  =  8.0
RED_HOLD_S    = 10.0
FALLBACK_S    = 13.0


def _dest(world, ego, dist_m=500.0):
    wp  = world.get_map().get_waypoint(ego.get_location())
    wps = wp.next(dist_m)
    return wps[0].transform.location if wps \
        else world.get_map().get_spawn_points()[-1].location


class H4RedLight(ScenarioBase):
    def __init__(self, **kwargs):
        super().__init__(map_name="Town03", spawn_index=0, **kwargs)

    def run(self, ap=None, rec=None) -> dict:
        self.world.set_weather(carla.WeatherParameters.WetCloudyNoon)

        tl_actors = list(self.world.get_actors().filter("traffic.traffic_light"))
        # Freeze all green so ego approaches at speed
        for tl in tl_actors:
            tl.set_state(carla.TrafficLightState.Green)
            tl.freeze(True)

        if ap is None:
            ap = AgentController(self.ego, self.world,
                                 target_speed_kmh=TARGET_KMH,
                                 ignore_traffic_lights=True)   # we control TL manually
            ap.set_destination(_dest(self.world, self.ego))
        ap.enable()

        if rec is None:
            rec = Recorder(self); rec.__enter__(); _owns_rec = True
        else:
            _owns_rec = False

        critical_triggered = False
        forced_tl          = None
        tl_trigger_elapsed = None

        try:
            start = self.world.get_snapshot().timestamp.elapsed_seconds
            elapsed = 0.0

            while elapsed < DURATION:
                frame   = self.tick()
                ap.update(frame)
                rec.record(frame)
                elapsed = frame["timestamp"] - start

                # --- Step 1: set nearest TL to RED at TL_TRIGGER_S ---
                if forced_tl is None and elapsed >= TL_TRIGGER_S:
                    tl_trigger_elapsed = elapsed
                    # Prefer the TL currently governing the ego
                    try:
                        if self.ego.is_at_traffic_light():
                            forced_tl = self.ego.get_traffic_light()
                        else:
                            ego_loc = self.ego.get_location()
                            forced_tl = min(
                                tl_actors,
                                key=lambda tl: tl.get_location().distance(ego_loc),
                            )
                    except Exception:
                        forced_tl = None

                    if forced_tl:
                        forced_tl.set_state(carla.TrafficLightState.Red)
                        forced_tl.freeze(True)   # stays red indefinitely until we change it

                # --- Step 2: force ego brake when moving ---
                fire = (
                    not critical_triggered
                    and elapsed >= TL_TRIGGER_S
                    and (frame["speed_kmh"] > MIN_SPEED_KMH or elapsed >= FALLBACK_S)
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

                # --- Step 3: release TL after hold so ego can proceed ---
                if (forced_tl is not None
                        and tl_trigger_elapsed is not None
                        and elapsed >= tl_trigger_elapsed + RED_HOLD_S):
                    try:
                        forced_tl.set_state(carla.TrafficLightState.Green)
                        forced_tl.freeze(True)
                    except Exception:
                        pass
                    forced_tl = None

        finally:
            if _owns_rec:
                rec.__exit__(None, None, None)

        ap.disable()

        return {
            "scenario_id": self.scenario_id,
            "criticality": "high",
            "map": "Town03",
            "duration_s": DURATION,
            "npc_count": 0,
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
    s = H4RedLight(scenario_id="h4_red_light_test")
    s.setup()
    try:
        result = s.run()
        s.verify()
        print(json.dumps(result, indent=2))
    finally:
        s.clean_up()
