# Sim-lite handling, driving assists, engine sound and HUD for "Split Ways" (browser, touch-phone controllers)

Research date: 10 October 2026. Primary sources: the current Speed Dreams source on its Forgejo forge (fetched and read directly), the Rapier 0.21.0 npm package and its Rust source (read directly), and vendor/official pages. Older or superseded sources are marked **[OLDER: year]**. Numbers in "Inferences" are my own calculations or design recommendations. They are not quotes.

---

## 1. Tyre and vehicle models suitable for real-time JS (60-500 Hz, up to 4 cars)

### Takeaway
A per-wheel model is enough for believable sim-lite handling. It needs: wheel spin as a state variable, slip ratio plus slip angle, one simplified Magic Formula curve (B, C, D, E) applied to a combined, normalised slip vector (friction circle), and load-sensitive mu. Weight transfer comes from real springs on the rigid body. Speed Dreams does exactly this and runs the tyre/wheel loop at 500 Hz. The JS cost for 4 cars × 4 wheels is trivial, so a fast tyre substep is affordable.

### Cited Findings
- **Simplified Magic Formula, typical coefficients (longitudinal):** B (stiffness) is 4-12, C (shape) 1-2, D (peak) 0.1-1.9, E (curvature) -10 to 1. For dry tarmac the source gives B=10, C=1.9, D=1, E=0.97; wet B=12, C=2.3, D=0.82, E=1; snow B=5, C=2, D=0.3, E=1; ice B=4, C=2, D=0.1, E=1. Pacejka's reference shape factors are C=1.65 (longitudinal) and C=1.3 (lateral). In the simplified form the coefficients "do not depend on load, camber, or further parameters". — [Edy, Pacejka '94 parameters explained](https://www.edy.es/dev/docs/pacejka-94-parameters-explained-a-comprehensive-guide/) **[OLDER: article ~2011-12, comments up to 2026]**
- The simplified curve can be reused for lateral force by feeding it slip angle with suitable B/C/D/E. The author says the coefficients "have no physical meaning per-se". In the full Pacejka-94 model the reference load is 4000 N, and lateral a4 controls how far the peak moves with load. He advises starting with flat friction and adding the curve later. — [Edy, Pacejka '94 parameters explained](https://www.edy.es/dev/docs/pacejka-94-parameters-explained-a-comprehensive-guide/)
- **Classic game formulas:**
  - Drag is Fdrag = 0.5·Cd·A·ρ·v², with ρ = 1.29 kg/m³. The Corvette example gives Cdrag = 0.4257. Rolling resistance is Crr ≈ 30·Cdrag = 12.8, which the author himself doubts.
  - Weight transfer is Wf = (c/L)·W − (h/L)·M·a and Wr = (b/L)·W + (h/L)·M·a.
  - Slip ratio is SR = (ω·Rw − Vlong)/|Vlong|, and grip peaks at about 6% slip.
  - The linear lateral model is Flat = Ca·α, valid only below the peak. The longitudinal force should be capped at its peak value.
  - Low-speed problems: clamp the torque-curve rpm (e.g. rpm<1000 → 1000), use a clutch to decouple the engine at a standstill, and expect explicit integration to "blow up" at large dt (RK4 suggested).
  — [Marco Monster, Car Physics for Games v1.9](https://www.asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html) **[OLDER: Nov 2003, still widely used as a primer]**
- **Combined slip via friction circle (production example):** Speed Dreams builds a combined slip vector s = sqrt(sx² + sy²), where sx = (vt − ω·R)/|vt| and sy = sin(α). It evaluates one Magic Formula on |s| and splits the force back along the slip vector: Ft = −F·sx/s, Fn = −F·sy/s. That is an isotropic friction circle. In simuv5 the split also gets per-axis `LongMuFactor`/`LatMuFactor` multipliers, which turns it into an ellipse. — [Speed Dreams simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)
- **Load sensitivity (production example):**
  - Speed Dreams uses mu_eff = mu·(lfMin + (lfMax − lfMin)·exp(lfK·Fz/opLoad)), with lfK = ln((1 − lfMin)/(lfMax − lfMin)).
  - The defaults are lfMax = 1.6 and lfMin = 0.8, clamped so that lfMin ≤ 0.9 and lfMax ≥ 1.1.
  - The result gives mu_eff = mu at Fz = opLoad, more grip per newton at light load, and less at heavy load.
  — [Speed Dreams simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)
- **Low-speed slip divergence fix:** with the `FEAT_SLOWGRIP` feature, Speed Dreams computes sx = (vt − ω·R)/max(|vt|, 1.0) ("avoid divergence"). Without it, tyre forces are low-pass filtered between steps with `FLOAT_RELAXATION2(Fn, preFn, 50)`. — [Speed Dreams simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)
- **Simulation rate in a shipping open-source sim:** `RCM_MAX_DT_SIMU = 0.002` (500 Hz physics), robots at 0.02 s. — [Speed Dreams raceman.h](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/interfaces/raceman.h)
- **Aerodynamics (production example):**
  - Body drag is `CdBody = 0.645·Cx·FrontArea`, where 0.645 = ½·1.29. Drag force = −CdBody·v².
  - Front and rear lift forces are −Clift[i]·v²·hm. The ground-effect factor is hm = 2·exp(−3·(1.5·Σ ride heights)⁴).
  - Drag is reduced in another car's slipstream through a `dragK` factor computed from distance.
  — [Speed Dreams simuv5 aero.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/aero.cpp)
- **Differentials (production example):**
  - Supported types: NONE, SPOOL, FREE, LIMITED SLIP, VISCOUS COUPLER, 1.5-WAY LSD and ELECTRONIC LSD.
  - Parameters: inertia, efficiency, ratio, bias, min/max torque bias, viscosity factor, locking input torque, max slip bias and coast max slip bias.
  - When the brake torque exceeds what is needed to stop the axle, the spin change is clamped to zero (`if (ndot*spinVel<0 && |ndot|>|spinVel|) ndot = -spinVel`). This is the standard trick to stop explicit wheel-spin integration oscillating through zero.
  — [Speed Dreams simuv5 differential.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/differential.cpp)
- **Brush model and combined slip (research):**
  - Svendenius and Gäfvert (SAE 2004-01-1064) derive combined braking-plus-cornering forces from pure-slip curves (e.g. the Magic Formula) using a brush-model adhesion/sliding split, with no extra calibration data. — [SAE 2004-01-1064](https://saemobilus.sae.org/content/2004-01-1064) **[OLDER: 2004]**
  - A 2023 lumped LuGre-brush model is described as stable and easy to implement for real-time estimation and control. — [Chalmers research, extended LuGre-brush model](https://research.chalmers.se/en/publication/531428)

### Inferences
- **Recommended JS tyre model (one evaluation per wheel per substep):**
  1. Raycast or shapecast the contact and compute Fz from a spring-damper. Clamp Fz ≥ 0.
  2. Integrate wheel ω from drive torque − brake torque − Fx·R, using the zero-crossing clamp above.
  3. Compute σ = (ω·R − vx)/max(|vx|, 1-3 m/s) and α = atan2(vy, |vx|).
  4. Normalise by peak slips: ρ = sqrt((σ/σpk)² + (α/αpk)²).
  5. F = Fz·mu_eff(Fz)·MF(ρ), with Fx = F·(σ/σpk)/ρ and Fy = F·(α/αpk)/ρ.

  This "normalised combined slip" variant behaves better than TORCS's raw sqrt(sx² + sin²α) when the longitudinal and lateral peak slips differ (typically ~0.08-0.12 slip ratio vs ~6-10°).
- **Cost check:** 4 cars × 4 wheels × 480 Hz ≈ 7,700 tyre evaluations per second. That is negligible for V8 on an M1 (estimate; not benchmarked).
- **Substepping:** stiff tyres (B ≈ 10-12) and light wheel inertia (~1-1.6 kg·m²) make explicit 60 Hz integration unstable. Run the wheel/tyre loop at 4-8 substeps per 60 Hz frame (240-480 Hz), apply the averaged force to the chassis, and keep the force relaxation filter.
- **Weight transfer:** with real springs on a Rapier rigid body, weight transfer appears automatically if the centre-of-mass height is realistic. Set it with `setAdditionalMassProperties`, or by offsetting colliders. Monster's formula is only needed if suspension is faked.
- **Sim-lite simplifications that keep the "feel":** skip tyre temperature and wear, camber thrust and gyroscopic effects. Keep load sensitivity, because it is what makes weight transfer and anti-roll bars change the car's balance.

### Gaps
- Brian Beckman's "Physics of Racing", Kunos, rFactor and BeamNG developer blogs were not fetched in this pass. No first-party 2024-2026 developer write-up on their tyre models was found.
- No source with ready-made lateral B/C/D/E sets for road vs race tyres was found. The values above are longitudinal reference sets, and Edy says lateral sets must be tuned.
- The brush-model papers were seen only as abstracts. No game-ready brush-model code was found.

---

## 2. How TORCS / Speed Dreams simulate cars, and how the car XML maps to physics

### Takeaway
Speed Dreams' main branch now contains **only simuv5**: `src/modules/simu` has just `simureplay` and `simuv5`, and simuv2/2.1/3/4 are no longer in the main tree. simuv5 still reads the same XML parameter names as the TORCS/simuv2 lineage. The car files are readable data tables: torque curve points, gear ratios, the tyre MF shape, aero coefficients and spring/damper rates. With the formulas below they can be reused almost directly in a custom JS model.

### Cited Findings
- **Repository state:**
  - The Speed Dreams code repo is `speed-dreams/speed-dreams-code` on forge.a-lec.org, default branch `main`, last updated 2026-10-07.
  - `src/modules/simu` contains only `CMakeLists.txt`, `simureplay` and `simuv5`.
  - Recent simu commits run to 2026-07-06 ("Notify on car out"), including "Add pre-race configuration" (2026-03-11).
  — [Speed Dreams code, simu directory](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu)
- **XML name ↔ code constant mapping** (car.h): "stiffness" = PRM_CA, "dynamic friction" = PRM_RFACTOR, "elasticity factor" = PRM_EFACTOR, "load factor max/min" = PRM_LOADFMAX/MIN, "operating load" = PRM_OPLOAD, "Cx", "front area", "front Clift", "angle" (wing), "spring", "slow bump", "fast bump". — [Speed Dreams car.h](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/interfaces/car.h)
- **Tyre parameter → Magic Formula mapping** (SimWheelConfig):
  - Defaults: Ca (stiffness) = 30, RFactor (dynamic friction) = 0.8, EFactor = 0.7, mu = 1.0, lfMax = 1.6, lfMin = 0.8, AlignTqFactor = 0.6, wheel inertia = 1.5, wheel mass = 20 kg.
  - RFactor is clamped to [0.1, 1]. Then **C = 2 − asin(RFactor)·2/π, E = EFactor, B = Ca/C**.
  - The force is **F = sin(C·atan(B·s·(1−E) + E·atan(B·s)))·(1 + s·simSkidFactor[skill])**, with s capped at 150. It is then multiplied by **Fz·mu_eff·surface.kFriction·(1 + 0.05·sin(camber·18))**.
  - The code warns if the parameters make the curve "unphysical", meaning it never reaches π/2.
  — [Speed Dreams simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)
- **Aligning torque** (used for force feedback): torqueAlign = 0.025·Fz·mu·kFriction·sin(2·atan(sa/MaxTorqueSlipAngle)), where MaxTorqueSlipAngle = AlignTqFactor·asin(optimal slip). — [Speed Dreams simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)
- **Engine** (SimEngineConfig / SimEngineUpdateTq):
  - Parameters read: revs limiter, revs maxi, tickover, inertia (default 0.2423), fuel cons factor, "brake coefficient" (default 0.03, multiplied by max torque), "brake linear coefficient" (default 0.03), and the "data points" list of (rpm, Tq), interpolated linearly per segment (Tq = a·rads + b).
  - Update: EngBrkK = brakeLinCoeff·rads, and Tq = (Tq_max(rpm) + EngBrkK)·throttle − EngBrkK. At closed throttle it subtracts a further brakeCoeff·maxTq.
  - Above the limiter, throttle is forced to 0, and held there for 0.1 s with FEAT_REVLIMIT.
  - An optional TCL multiplies Tq_max by a 0-1 TCL factor.
  - Below tickover the clutch is applied.
  — [Speed Dreams simuv5 engine.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/engine.cpp)
- **Gearbox and clutch:**
  - "shift time" defaults to 0.2 s and also sets the clutch release time.
  - Each gear has a ratio, efficiency and inertia.
  - Reflected inertia is driveI = (engine.I + gearI)·(gearRatio·finalRatio)², and freeI = gearI·(g·f)² when the clutch is open. Current inertia blends the two by clutch transfer.
  — [Speed Dreams simuv5 transmission.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/transmission.cpp)
- **Aero:**
  - Cx defaults to 0.4 and front area to 2.5 m².
  - Lift can be given either as "front/rear Clift" or as "CliftTotal + CliftBias". Each is scaled by `aero_factor` and capped by a theoretical maximum lift given the drag.
  - Wing area/angle/type are FLAT, PROFILE or THIN. In the classic FLAT model, Kx = −ρ·area, drag = Kx·v²·max(|sin aoa|, 0.02), and downforce = min(0, Kz·v²·sin aoa).
  — [Speed Dreams simuv5 aero.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/aero.cpp)
- **Example car file** (sc-cavallo-360, "Supercars" category), the only car model left in the main data repo:
  - Mass 1360 kg, CoG height 0.25 m, front weight 0.44, Cx 0.32, front area 1.95 m², front/rear Clift 0.56/0.70, wing area 0.
  - 3.6 L V8: tickover 900 rpm, limiter 8500, max 9000, inertia 0.1423, engine brake 0.07 / linear 0.04, TCL enabled. Torque points (rpm: N·m): 0:200, 1000:266.6, 2000:309.9, 3000:338.7, 4000:360.3, 4750:373.0, 6000:370.6, 7000:365.3, 8000:360.0, 8500:351.6, 9000:200.
  - Gears R −3.0, 1st 3.6, 2nd 2.16, 3rd 1.61, 4th 1.27, 5th 1.03, 6th 0.85. Efficiencies 0.954-0.98. Shift time 0.1 s.
  - RWD, rear LIMITED SLIP diff: ratio 4.1, efficiency 0.949, locking input torque 25 N·m, max slip bias 0.3.
  - Steering: steer lock 45°, **max steer speed 120°/s**.
  - Brakes: front/rear 0.54, max pressure 18000 kPa.
  - Tyres: 19" rim, 225 mm wide, ratio 0.35, wheel inertia 1.57, mass 26.35 kg, pressure 29 psi, **stiffness 22, dynamic friction 35 %, elasticity factor 0.86, operating load 3200 N, mu 1.3**, plus temperature, wear and heat factors.
  - Springs 67/69 kN/m (front/rear), slow bump 7, slow rebound 14, fast bump 2.5, fast rebound 5 kN/m/s, limit velocity 0.1 m/s, anti-roll bars 0.
  — [sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)
- **Car sound in the data:** each car folder ships a single engine WAV (e.g. `360.wav`), and the XML "Sound" section only has an "rpm scale" (1.0). — [sc-cavallo-360 folder](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360) and [sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)

### Inferences
- **What the tyre parameters mean** (derived from the code formulas):
  - **"dynamic friction" = sliding grip as a fraction of peak.** Since C = 2 − (2/π)·asin(RF), sin(C·π/2) = RF, so at very large slip the force tends to RF × peak. 35 % means the curve falls to ~0.35 of peak in a full slide (within the 150 cap).
  - **"stiffness" Ca sets the initial slope:** dF/ds at 0 = B·C = Ca, in units of peak force per unit slip.
  - **"mu"** is peak friction at operating load. **"operating load"** is the Fz where the load factor = 1.
- **Worked example, Cavallo-360 tyre** (my numbers from the formulas):
  - C = 1.772, B = 12.41, E = 0.86.
  - The curve peaks at combined slip s ≈ 0.16, i.e. ≈ 9° pure slip angle or 16 % slip ratio. At s = 0.05 it gives 0.79 of peak, at 0.1 → 0.97, at 0.4 → 0.94 and at 1.0 → 0.80.
  - Load sensitivity (lfK = ln 0.25 = −1.386): mu_eff is 1.56 at 1600 N, 1.30 at 3200 N, 1.105 at 6400 N and 1.056 at 9600 N.
  - Static wheel loads are ≈ 2935 N front and 3736 N rear, close to the 3200 N operating load.
- **Worked example, gearing:** wheel radius ≈ 0.320 m (0.2413 m rim radius + 0.0788 m sidewall). At 8500 rpm the gear top speeds are 69 / 116 / 155 / 197 / 243 / 294 km/h for gears 1-6.
- **Worked example, drag and engine braking:** drag constant 0.645·0.32·1.95 = 0.402, so ≈ 2.8 kN at 300 km/h. Closed-throttle engine braking at 8000 rpm ≈ 0.07·373 + 0.04·838 ≈ 60 N·m.
- **Porting rule:** the TORCS/SD tyre is stiff (peak at 0.16 combined slip with B ≈ 12) and was tuned for 500 Hz. If the JS loop runs slower than ~240 Hz, keep the force relaxation filter and the max(|v|, 1) slip denominator, or lower B.
- **SD 1.4 era data:** cars were tuned for the older simuv2/simuv2.1. The same parameter names are still parsed by simuv5, so Speed Dreams 1.4 numbers transfer. Expect to re-tune grip and aero by feel, because simuv5 adds factors (aero_factor, LatMuFactor/LongMuFactor, compounds) that older files do not set.
- **What is worth reusing:** the torque curves, gear ratios, final drives, masses/weight distribution, Cx/area and spring rates are realistic and directly reusable. Each Speed Dreams car can be reduced to roughly a 25-number JSON spec for the JS model.

### Gaps
- The original TORCS simuv2 `tire.cpp` could not be fetched (SourceForge 404s and a Cloudflare challenge). That simuv2 uses the same formula is inferred from shared lineage and identical parameter names; the current simuv5 code was the one actually read.
- I could not confirm when simuv2.1/simuv3/simuv4 were removed from Speed Dreams main.
- `simSkidFactor[]` per-skill values and the exact `aero_factor` default in simuv5 were not located.
- Whether the "%" unit on "dynamic friction" is divided by 100 by GfParm is inferred: the RFactor default of 0.8 and the clamp to ≤ 1 imply a fraction.
- Licence of physics numbers: the Speed Dreams data is mostly Free Art License (per the task brief). Whether bare numeric specs carry that licence was not researched (see assets/legal notes).

---

## 3. Rapier `DynamicRayCastVehicleController` (rapier3d-compat 0.21) vs a custom vehicle model on a Rapier rigid body; fixed timestep and substepping

### Takeaway
Rapier's controller is a port of Bullet's `btRaycastVehicle`. Its suspension is good, but it has no wheel-spin state, slip ratio, slip-angle force curve, engine, gearbox, differential or aero. Lateral grip is a velocity-cancelling constraint capped by a friction-circle impulse, so cars feel "on rails, then suddenly sliding". That explains why the current game needs grip/yaw assists. For Forza-like sim-lite, keep Rapier for the chassis body, collisions and (optionally) the controller's suspension raycasts, and apply your own tyre forces with `addForceAtPoint`.

### Cited Findings
- **Version:** `@dimforge/rapier3d-compat` latest is **0.21.0, published 2026-09-25** (0.20.0 on 2026-08-08). License Apache-2.0. — [npm registry: @dimforge/rapier3d-compat](https://www.npmjs.com/package/@dimforge/rapier3d-compat)
- **Official docs:**
  - The chassis is a single dynamic rigid body, and its wheels "are only represented by ray-casts pushing that body along a spring-like suspension". It is ported from Bullet's btRaycastVehicle.
  - Call `updateVehicle(dt, QueryFilterFlags.EXCLUDE_DYNAMIC)` before `world.step()`.
  - Exclude the chassis from the ray-casts, "otherwise the ray might hit it".
  — [Rapier JS vehicle controller guide](https://rapier.rs/docs/user_guides/javascript/vehicle_controller/)
- **0.21.0 JS API** (from the shipped typings):
  - Setup and query: `addWheel(chassisConnectionCs, directionCs, axleCs, suspensionRestLength, radius)`, `updateVehicle(dt, filterFlags?, filterGroups?, filterPredicate?)`, `currentVehicleSpeed()`, `indexUpAxis` / `indexForwardAxis`.
  - Per-wheel setters and getters for suspension rest length, max travel, radius, stiffness, compression, relaxation, max suspension force, brake, steering, engine force, **frictionSlip** and **sideFrictionStiffness**.
  - Per-wheel readbacks: `wheelRotation`, `wheelForwardImpulse`, `wheelSideImpulse`, `wheelSuspensionForce`, `wheelContactNormal`, `wheelContactPoint`, `wheelSuspensionLength`, `wheelIsInContact`, `wheelGroundObject`.
  — [rapier3d-compat 0.21.0 ray_cast_vehicle_controller.d.ts](https://unpkg.com/@dimforge/rapier3d-compat@0.21.0/dist/control/ray_cast_vehicle_controller.d.ts)
- **Rigid-body force API in 0.21.0:** `addForceAtPoint(force, point, wakeUp)`, `applyImpulseAtPoint(impulse, point, wakeUp)`, `addTorque`, `resetForces`, `setAdditionalMassProperties(mass, centerOfMass, principalAngularInertia, frame, wakeUp?)`. — [rapier3d-compat 0.21.0 rigid_body.d.ts](https://unpkg.com/@dimforge/rapier3d-compat@0.21.0/dist/dynamics/rigid_body.d.ts)
- **Friction model (Rust source):**
  - Defaults: `side_friction_stiffness = 1.0`, `friction_slip = 10.5`, `max_suspension_force = 6000`.
  - The side impulse comes from `resolve_single_bilateral` (or unilateral), solved to cancel the lateral velocity, then multiplied by `side_friction_stiffness`.
  - The forward impulse is `engine_force·dt` when throttle is applied. When braking, rolling friction is capped by `brake`.
  - The friction cap is `max_imp = wheel_suspension_force·dt·friction_slip`, checked against sqrt((0.5·fwd)² + side²). If exceeded, `sliding = true` and both impulses are scaled by `skid_info`.
  - The resulting impulses are applied to the chassis with `apply_impulse_at_point`.
  — [Rapier ray_cast_vehicle_controller.rs](https://github.com/dimforge/rapier/blob/master/src/control/ray_cast_vehicle_controller.rs)
- **Timestep and solver:** `world.timestep` defaults to 1/60. The docs say the timestep should "not vary too much". The integration parameters have `numSolverIterations` default 4, `numInternalPgsIterations` default 1 and `maxCcdSubsteps` default 1. 0.21 also adds soft-body parameters. — [rapier3d-compat 0.21.0 integration_parameters.d.ts / world.d.ts](https://unpkg.com/@dimforge/rapier3d-compat@0.21.0/dist/dynamics/integration_parameters.d.ts)

### Inferences
- **What the controller lacks for racing** (from the source):
  - Wheel ω is not simulated. `wheelRotation` is visual only, so there is no slip ratio, wheelspin, lock-up, ABS or TC signal.
  - Engine force is a direct impulse with no torque curve, gears or diff.
  - Lateral force does not grow with slip angle. It is a constraint ("infinite cornering stiffness") until the cap, then it saturates. That produces binary grip.
  - The cap is linear in suspension force, so there is no load sensitivity, and with `frictionSlip` 10.5 it is effectively ~10 g.
  - No aero, camber or relaxation length.
- **Recommended hybrid (to verify by test):**
  1. Keep the controller for suspension only: raycasts, spring/damper and contact data. Set `setWheelFrictionSlip(i, 0)`, engine force 0 and brake 0. In the source, max_imp = 0 then forces `skid_info = 0`, which zeroes the controller's friction impulses (side impulse non-zero → sliding → factor 0).
  2. Each substep, read `wheelSuspensionForce`, `wheelContactPoint` and `wheelContactNormal`.
  3. Run the custom tyre model and apply Fx/Fy with `chassis.addForceAtPoint` at the contact point.
  4. Alternatively, do your own `castRay`/`castShape` and spring maths, which avoids the controller entirely and allows shapecast wheels for kerbs.
- **Recommended timing:**
  - Use a fixed-step accumulator with Rapier at **120 Hz** (2 steps per 60 Hz frame on a 60 Hz TV). Inside each Rapier step, run **2-4 tyre/wheel substeps** (240-480 Hz) that integrate wheel ω and per-wheel forces, then apply the averaged force for the Rapier step.
  - Render with interpolation between the last two physics states.
  - Cap catch-up steps (e.g. max 4 per frame) to avoid a spiral of death when the frame rate drops.
  - Phone inputs at ~60 Hz should be sampled into the fixed step with linear smoothing.
- Rapier stays responsible for car-car and car-wall collisions, which a hand-rolled model should not try to replace.

### Gaps
- No official Rapier statement on the controller's suitability or limits for racing; the limits above are read from source.
- No benchmark found of Rapier WASM step cost at 120 Hz with 4 cars plus track trimesh on an M1. It needs measuring.
- The behaviour of `frictionSlip = 0` is inferred from source, not tested.

---

## 4. Assists for accessible sim-lite, and touch-steering filtering and mapping

### Takeaway
Shipping sims implement assists as small controllers on top of the real tyre model:
- **ABS and TC** hold wheel slip near the peak of the friction curve.
- **ESP / steering assist** caps the steering angle with speed so the fronts don't exceed peak slip angle.
- **Stability management** brakes individual wheels to correct under- and oversteer.
- **Counter-steer assist** catches slides.
- **Braking assist** brakes and downshifts for the player.

For touch, combine a floating-origin one-axis drag, a small dead zone, an expo curve, a speed-sensitive steering limit and a steering-rate limit. Speed Dreams' own car data has a "max steer speed" of 120°/s.

### Cited Findings
- **Edy's Vehicle Physics (Unity) definitions:** ABS "Wheels don't lock when braking". TC means "No burnouts or throttle-powered drifting". ESP "enables the limit of the steering angle with speed. Front wheels won't slide when steering at high speeds", with `espLevel` 1.0 nominal and 0 = off. Anti-roll bar `stabilizerFactor` 1.0 is nominal and 0 disables it, and `stabilizerMode` can be auto by speed. — [Edy's Vehicle Physics wiki: CarSettings](https://vehiclephysics.repositoryhosting.com/trac/vehiclephysics_edys-vehicle-physics/wiki/CarSettings?format=txt) **[OLDER: ~2012-2013]**
- A search summary of the same wiki states that TC and ABS limit slip "to the peak value of the friction curve", and that `autoSteerLevel` (0 to 1+) limits the steering angle so front sideways slip does not exceed the tyre's maximum force. — [Edy's Vehicle Physics wiki: CarControl](https://vehiclephysics.repositoryhosting.com/trac/vehiclephysics_edys-vehicle-physics/wiki/CarControl?format=txt) (seen via search summary, not fetched directly)
- **Gran Turismo 7:**
  - Countersteering assistance "controls your car's slide, making it harder to spin out".
  - Active Stability Management controls under- and oversteer "with braking".
  - Update 1.31 changed the countersteering default from Strong to Off and increased ASM intervention when oversteering.
  - The manual's presets have Stability Management on for Beginner and Intermediate and off for Expert. Steering assist (under Auto-Drive) "will prevent drivers from oversteering".
  — [GT7 Online Manual: driving options](https://gran-turismo.com/us/gt7/manual/drivingoption/03); [GT7 Beyond the Apex, for beginners](https://gran-turismo.com/gb/gt7/apex/for_beginners/07); [GT7 Update 1.31 physics/assist notice](https://www.gran-turismo.com/us/gt7/news/00_1462138.html) **[2023]**
- **Forza Motorsport (2023) assist list:** suggested line, braking assist (ABS), throttle assist, steering, traction control, stability control, shifting and pit-entry assist. More assists means lower payouts. — [GGRecon Forza Motorsport assists guide](https://www.ggrecon.com/guides/forza-motorsport-difficulty-settings-drivatar-driving-assists)
- Turn 10 says many assists have several levels, and the game adds "Blind Driving Assists", which are configurable audio cues. — [Windows Central](https://windowscentral.com/gaming/forza-motorsport-2023-is-taking-accessibility-seriously-with-blind-driving-assists)
- Player forum description of Forza's speed-sensitive steering: it "decreases steering speed and degree the faster you go". — [Forza forums: faster steering](https://forums.forza.net/t/faster-steering/4093) (player forum, not official)
- Players also describe controller steering as "sluggish, especially around the centre". — [Forza forums thread](https://forums.forza.net/t/steering-feel-on-controller-can-feel-sluggish-especially-around-the-centre/722019) (player forum)
- **Response-curve convention (GT Sport / GT7 DS4 sensitivity):** values below 50 are slower near centre and faster at the end of travel, and values above 50 do the reverse. — [GTPlanet DS4 settings thread](https://www.gtplanet.net/forum/threads/the-holy-grail-my-ds4-controller-settings.394298/post-13136315) (forum)
- **Mobile precedent, Real Racing 3:**
  - Steering assist, brake assist and traction control are on by default, and the game offers an on-screen wheel as a touch steering option.
  - Brake assist "will automatically downshift and brake when approaching corners".
  - EA's tips say turning off brake assist and enabling manual acceleration lets players "carry more speed".
  — [Android Police RR3 review](https://www.androidpolice.com/2013/03/06/real-racing-3-review-there-is-a-good-game-in-here-somewhere/) **[OLDER: 2013]**; [EA: Real Racing 3 tips](https://www.ea.com/news/top-7-tips-for-new-drivers)
- **Steering-rate data in the starter kit:** sc-cavallo-360 has steer lock 45° and "max steer speed" 120°/s. — [sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)
- **In-sim TC precedent:** the Speed Dreams engine scales available torque by a 0-1 TCL factor (`enable tcl` in car XML). — [Speed Dreams simuv5 engine.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/engine.cpp)

### Inferences (concrete algorithms and starting values for "assists on by default")
- **ABS:** per wheel, at the tyre substep rate. Target slip σ* = the peak slip of the active curve (≈ 0.10-0.16 for SD-derived curves). If σ < −1.1·σ*, cut that wheel's brake torque by 30-50 % per substep. If σ > −0.8·σ*, restore it. Show an ABS light on the HUD while it acts.
- **TC:** on driven wheels, if σ > σ*, scale the engine torque request with a PI controller (e.g. Kp ≈ 2-4 on (σ − σ*)/σ*). This mirrors SD's TCL multiplier. A "TC" HUD light flashes while it acts.
- **Stability control (STM/ASM-like):**
  - Reference yaw rate r_ref = v·δ/(L + K·v²), clamped to |r_ref| ≤ 0.85·μ·g/v.
  - Oversteer (|r| > |r_ref| + margin): brake the outside front wheel and cut throttle.
  - Understeer: brake the inside rear wheel and cut throttle.
- **Steering assist (Edy ESP style):** cap the commanded road-wheel angle at δ_max(v) = α_peak + atan((vy_front)/vx), i.e. a front slip angle no larger than peak. A simpler alternative is a speed-sensitive lock curve, e.g. 35° at walking pace down to ~4-6° at 250 km/h.
- **Counter-steer assist:** if rear slip angle exceeds ~α_peak, add δ_cs = k·β (sideslip angle, k ≈ 0.6-1.0) toward the direction of travel, blended out as the player counter-steers.
- **Braking assist:** use the racing-line speed profile. If v > v_target(s + look-ahead) + margin, apply brake (and, on auto, downshift).
- **Racing-line overlay:**
  1. Compute the line from the track centreline (a minimum-curvature line, or the centreline as a first pass).
  2. Speed profile: v_max = sqrt(μ·g/κ), then a forward pass limited by acceleration and a backward pass limited by braking.
  3. Colour segments green / yellow / red by required deceleration, and show it in braking zones only on medium assist.
- **Touch steering (one-axis thumb drag):**
  - Floating origin at touch-down. x = clamp(dx/(0.25-0.30 × screen width), −1, 1).
  - Dead zone 0.03-0.05, rescaled so output stays continuous.
  - Expo curve y = sign(x)·|x|^γ, γ ≈ 1.5-2.0 (finer control near centre).
  - Speed-sensitive lock δ_max(v) as above.
  - Road-wheel rate limit 120-180°/s (the SD data uses 120°/s) when the thumb moves, with a faster return-to-centre (~240°/s) on release.
  - Low-pass the ~60 Hz WebRTC stream (one-pole, τ ≈ 30-50 ms) on the TV side so packet jitter doesn't become steering noise.
- **Left/right buttons:** ramp steering from 0 to the speed-limited full lock over ~0.20-0.30 s while held, and back to centre over ~0.12-0.15 s on release. Holding both buttons = centre.
- **Reverse (players couldn't find it):**
  - Show an explicit gear state on HUD and phone: D / N / R.
  - Brake held at a standstill for >0.5 s engages R and shows a large "R" on the HUD and phone, with a reverse beep.
  - Also put a dedicated R/D toggle on the pad, and auto-return to D when throttle is pressed after stopping.
- **Default assist preset:** ABS on, TC on, stability on, steering assist on (ESP-style cap), counter-steer on, braking assist off or "line only", auto gears. Expose "Pro" (ABS on only) and "Sim" (all off) per player in the lobby.

### Gaps
- No official Turn 10 documentation describing how Forza Motorsport (2023) implements each assist was found. A detailed third-party guide (simracingsetup.com) was blocked by a bot check.
- No primary source (GDC talk or developer blog) on touch-specific steering filtering in mobile racers (Real Racing, Asphalt, GRID mobile) was found. The touch numbers above are design recommendations, not sourced values.
- No GDC racing-assist talk from 2024-2026 was located in this pass.

---

## 5. Engine sound: loops vs granular vs procedural; on/off-load, shifts, turbo, tyres; sourcing recordings

### Takeaway
The industry baseline is still RPM-tagged loops crossfaded and pitch-shifted, split into **on-load / off-load (and neutral)** layers and driven by RPM, throttle and load. Granular tools (Crankcase REV, AudioMotors) cut ramps at piston firings for smoother, faster-to-author results. Pure procedural synthesis tends to sound "synthetic". In a browser, multi-layer loops on Web Audio `AudioBufferSourceNode`s are cheap and proven. Granular is feasible in an AudioWorklet, but there is no off-the-shelf web library. The Speed Dreams sounds are single loops and should be replaced. Commercially usable multi-RPM libraries exist cheaply, but their licences need checking for a subscription web game.

### Cited Findings
- **Project CARS** (FMOD):
  - Each car has a sound set of "well over one hundred separate wave files", layered, crossfaded and driven by physics.
  - Ideal captures come from chassis-dyno recordings, though most were done on track with scripted driver tasks.
  - The article cites an example recording with roughly 8 DPA mics on the engine bay, intakes, exhaust, turbo intake and driver's seat.
  - The interior "helmet cam" uses comb and low-pass filtering that varies with g-force. Tyre sounds are exaggerated so players can read grip.
  — [Designing Sound: Project CARS, Forza Motorsport 5 and REV](https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/) **[OLDER: 2014]**
- **Forza Motorsport 5** (FMOD Studio): audio driven by hundreds of physics parameters. These include separate RPMs for engine, turbo, supercharger and transmission, plus throttle position, engine load, torque, boost pressure, clutch position and gear. Exhaust design questions cover on/off-throttle character, burble/backfire on decel and speed dependence. The engine must stay audible enough for manual-shift cues. — [Designing Sound](https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/) **[OLDER: 2014]**
- **REV (Crankcase Audio)** tracks the harmonics of an acceleration or deceleration ramp and splits it at individual piston firings. It can skip, duplicate, hold or reverse cycles, and includes a gearbox model, a virtual clutch and load/off-load mixing. Turnaround is about 10 minutes vs "3 to 4 days" for a crossfaded loop model. It has shipped with Wwise since 2013.2. In the same article, Greg Hill says crossfaded loops remain the most widely used method. — [Designing Sound](https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/) **[OLDER: 2014]**
- **Audiokinetic (Wwise) loop-based design:** the load states "are referred to as on-load, off-load and neutral load", with on-load "whenever any throttle is applied". RPM is converted to Hz by dividing by 60. — [Audiokinetic: Loop-based car engine design with Wwise, part 1](https://audiokinetic.com/loop-based-car-engine-design-with-wwise-part-1) (search excerpt; the page returned 403 to direct fetch)
- **Granular vs loops (search summaries):**
  - AudioMotors' granular method reuses real-recording snippets, keeping the timbre, with analysis done offline. Grain positions must be "synchronous to pitch (RPM)". — [MCV: making racing car engines roar using AudioMotors/FMOD](https://www.mcvuk.com/development/how-to-make-racing-car-engines-roar-using-audiomotors-fmod)
  - A practitioner says granular interpolation can sound "pretty synthetic" in some situations, and suggests hybrids. — [r/GameAudio vehicle engine sounds](https://lr.in.psf.lt/r/GameAudio/comments/1iyeovd/vehicle_engine_sounds) (forum)
- **Browser precedent:** Google's 2013 "Racer" used only 3 files (acceleration with baked-in gear shifts ending in a top-RPM loop, a deceleration file, and idle) on Web Audio. Playback jumped to positions based on throttle. The team tried 5-6 files per layer and found it "disappointing". They note conventional cross-pitching "can't be too wide or it will sound very synthetic", and that Web Audio loops "precisely ... without glitches or pops". — [web.dev: The Sounds of Racer](https://web.dev/case-studies/racer-sound) **[OLDER: 2013; arcade, not sim]**
- **Procedural web precedent:** `SpudzzDev/en` is a JS/Web Audio engine-sound generator (Three.js demo, based on a published paper). It runs in an AudioWorklet with separate intake, engine-block vibration and outlet sources, and does Doppler via DelayNodes. — [GitHub SpudzzDev/en](https://github.com/SpudzzDev/en)
- A Godot racer models four offset sine cycles driven by RPM plus waveguides for block and exhaust. — [Godot forum: Illegal Velocity](https://forum.godotengine.org/t/illegal-velocity-a-uncompromising-arcade-racing-game/139242?page=2)
- AudioWorklet runs audio code on a dedicated real-time thread. ScriptProcessorNode is deprecated. — [Mozilla Hacks: AudioWorklet in Firefox](https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/) **[2020]**
- **Commercial multi-RPM libraries:**
  - Magic Sound Effects *Car Engines Vol. 2* ($30 minimum): 400 files for 16 vehicles (4 city, 6 sports, 4 off-road, 2 pickups). It includes 80 seamless RPM loops in five bands (idle / low / mid / high / very high), 64 accel and 64 decel clips, 128 transitions and 32 start/stop clips, in 44.1 kHz/16-bit WAV and OGG.
  - Its licence text conflicts: "no limit on the number of projects" vs "personal use and one commercial project". Redistribution as standalone files is prohibited.
  - Vol. 1 ($25): 294 files, including 70 loops at five speeds.
  — [itch.io: Car Engines Vol. 2](https://magicsoundeffects.itch.io/car-engines-vol-2); [itch.io: Car Engines (vol. 1)](https://magicsoundeffects.itch.io/car-engines)
- *Racecar Engine Sounds Vol. 1* on Fab: per car, 40 WAVs (20 exterior, 20 interior) including pre-recorded off-load sounds. It targets the Unity asset "Realistic Engine Sounds 2" and supports FMOD. — [Fab listing](https://www.fab.com/listings/388090df-17dd-422d-b66e-afb7f4baf762) (search summary)
- **Free and commercial-safe sources:**
  - Freesound: CC0 is usable freely. CC-BY is commercial with attribution (title, username, link, licence). CC-BY-NC and Sampling+ are **not** commercial. — [Freesound FAQ](https://freesound.org/help/faq/)
  - Sonniss GDC bundles are described as royalty-free, commercial, no attribution. 2024+ terms reportedly forbid AI training. The 2026 bundle is 7.47 GB+. — [rekkerd.org: Sonniss GDC 2026 bundle](https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/); [GameDev.tv: Sonniss 2018 bundle terms](https://community.gamedev.tv/t/30gb-of-high-quality-royalty-free-sound-effects-the-sonniss-gameaudiogdc-bundle-2018/63406); [Cinevva free SFX guide, July 2026](https://app.cinevva.com/guides/free-sound-effects-music)
- **Speed Dreams baseline:** one WAV per car plus an "rpm scale" parameter. — [sc-cavallo-360 folder](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360)

### Inferences (recommended Web Audio design for 1-4 cars on one TV)
- **Per car:** 6-10 on-load loops and 6-10 off-load loops at ~1000-1500 rpm spacing, plus idle and a limiter loop. Each is an `AudioBufferSourceNode` (loop=true) whose `playbackRate` = rpm/rpm_recorded, kept within ~±15 %.
- Use equal-power crossfades between the two nearest RPM loops, and a load crossfade (on/off) driven by engine torque sign or throttle, smoothed ~50 ms.
- Use `setTargetAtTime` for all automation to avoid zipper noise.
- That is roughly 4-6 active voices per car, ~24 for 4 cars, which is cheap.
- **Extra layers:**
  - Gear shift: a short ignition-cut dip with a clunk/whoosh one-shot, using the 0.1-0.2 s shift time from the car spec.
  - Turbo: a whine pitched by boost, plus a blow-off on throttle lift.
  - Off-throttle crackle/backfire: random one-shots when load is negative and rpm is above ~4000.
  - Tyres: a squeal loop gain-mapped to normalised combined slip above ~0.8 of peak, with pitch rising slightly with slip.
  - Also: road and wind noise ∝ v², a kerb-rumble loop triggered by kerb surface contact, and scrape/impact one-shots from Rapier contact events.
- **Split-screen mix:** keep each player's own car prominent with a per-viewport pan (2-player: L/R; 4-player: subtle). Duck the other players' engines and add a distance low-pass for AI and other cars.
- **Granular upgrade path:** record or buy steady acceleration ramps. Pre-cut them offline into per-firing grains (RPM-synchronous). Play the grains in an AudioWorklet indexed by RPM, crossfading on-load and off-load ramps. This matches REV/AudioMotors practice without licensing middleware.
- **Recording your own car (needs follow-up research):**
  - Steady-RPM holds of about 10 s every 500-1000 rpm, both on load and coasting.
  - Ideally on a chassis dyno, which gives true load; otherwise on a closed private track.
  - Use several synchronized recorders (exhaust ~0.5-1 m off-axis, engine bay, intake, cabin), even phones, with wind protection. Avoid clipping by leaving ~12 dB headroom.

### Gaps
- No 2024-2026 primary article on web/AudioWorklet granular engine synthesis was found. The best engine-audio sources are 2013-2014 and still describe current practice.
- No source on smartphone-microphone recording technique for engines was found.
- No source on the legality of recording and using your own car's sound in a commercial game was found. Open questions include trademark or sound-mark concerns for distinctive engine notes and road-traffic rules while recording. This needs legal review.
- The Magic Sound Effects licence is internally contradictory and silent on subscription and web delivery. Ask the vendor in writing before buying.
- The Fab "Racecar Engine Sounds" licence terms were not read.
- The current Sonniss licence page was not fetched, and no vehicle-engine content in recent bundles was confirmed.

---

## 6. Racing HUD conventions (tach/shift lights, gear incl. clear R, speed, lap/sector, delta, position, mini-map)

### Takeaway
Current sim HUDs share a core set: a rev display with configurable shift-light thresholds and colour states, a large gear readout that changes colour near redline, speed, position and lap, a lap-delta bar (green ahead, red behind), sector times and a relative/position widget. Players prefer the essentials kept compact near the car, with optional elements hideable. Sources here are tool changelogs and forums, not UX research.

### Cited Findings
- Race Element's Shift Indicator HUD has user-set colours, per-colour opacity, and **early and upshift percentages**. Race Element also has a lap-delta bar whose text turns red on an invalidated lap, per-HUD opacity sliders, and a performance pass that cut CPU by up to 24 % ("every frame counts"). — [Race Element updates (OverTake)](https://overtake.gg/downloads/race-element.50578/updates?page=4); [Race Element updates (RaceDepartment)](https://www.racedepartment.com/downloads/race-element.50578/updates?page=4)
- CleanHUD changes the gear readout's font colour to red near redline. It has a relative-position and race-info widget, keeps the delta bar hidden by default (toggle Ctrl+D), and hides sector times by default. — [CleanHUD (RaceDepartment)](https://www.racedepartment.com/downloads/cleanhud.9403/)
- A Forza player request argues for a smaller, simplified HUD that keeps rev counter, gear, position and lap near the car, so players don't look away from the road. — [Forza forums: simplified HUD](https://forums.forza.net/t/simplified-hud/608259) (player forum)
- Hardware dash practice: delta is shown as green when ahead of the best lap and red when behind. — [Race Element updates](https://overtake.gg/downloads/race-element.50578/updates?page=4) (search summary)
- Speed Dreams car specs carry tachometer and speedometer ranges per car (e.g. tachometer max 10000 rpm), and a separate "revs limiter" (8500) for redline placement. — [sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)

### Inferences (layout for split-screen TV viewing at 2-3 m)
- **Per viewport, bottom-right cluster:**
  - Rev arc or bar with 5-10 shift LEDs, from green (~85 % of limiter) through yellow (~92 %) to red/blue flashing at the optimal upshift. The upshift point should come from the torque curve: shift where the next gear's wheel torque exceeds the current gear's.
  - A large gear numeral, the biggest glyph on the HUD (≈ 6-8 % of viewport height). **R in a high-contrast colour** (white on red) with a reverse icon, plus N.
  - Speed in km/h or mph, with a unit toggle.
- **Top-left:**
  - Position "P2/4" and lap "Lap 2/5".
  - Current lap time, best lap, and a live delta to the player's best (or session best) as a coloured bar or number: green negative, red positive.
  - Sector splits flash briefly at each sector line (purple = session best, green = personal best, yellow = slower, as in F1 convention). That colour code is a common convention but is not sourced here.
- **Mini-map:**
  - In 1-2 player layouts, one per viewport, corner-mounted.
  - In 3-4 player layouts, a single shared track map in the centre of the screen, where the split-screen quadrants meet, with coloured player dots. This saves duplicated HUD space.
- **Assist indicators:** small ABS/TC/STM lights that blink when active. This teaches players what the assists are doing, in the spirit of Forza's assist transparency.
- **Readability:** text sized for TV distance, kept inside a ~5 % safe-area margin, with a semi-transparent backing plate. Elements fade when not changing, e.g. the delta hides between sectors on "minimal HUD".

### Gaps
- No peer-reviewed or first-party (Turn 10, Polyphony, Codemasters) HUD UX study was found in this pass. Recommendations above are synthesised conventions.
- No sourced guidance was found on TV-distance HUD font sizes or safe areas specifically for racing (see the TV platform UI notes from the parallel researcher).
- The F1 purple/green/yellow sector colour convention is from general knowledge; no source was fetched.
