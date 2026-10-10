# Owner decisions log (orchestrator)

- 2026-10-10: One track only. M9 (Track 2) and M10 (Track 3) dropped for now. After M8 goes live,
  polish Track 1 (visuals, car feel, sound), push each improvement live when green, then stop for the
  owner's playtest. P6 must record this in DECISIONS.md and ROADMAP.md.

# Orchestrator calls on ART-DIRECTION.md §15
- Items 1-11: accepted, P5 implements them (P5 follows ART-DIRECTION.md where it differs from the spec).
- Item 14 (camera values): assigned to P5 (`CAMERA` in config.ts).
- Item 13 (placement jitter, cap order, tunnel sections): offered to P2 as optional if cheap and in scope.
- Item 12 (composite lift/gain, haze v2, 3D LUT) and item 15 (misty look): Track 1 polish phase, after M8.

# Paused by owner (2026-10-10 ~12:12 UTC)
- Stopped workflows: m8-p3-p4 (run wf_f8c37cc8-3ca, script workflows/scripts/m8-p3-p4-wf_f8c37cc8-3ca.js)
  and m8-p2-trackgen (run wf_85391dab-fdc). Resume each with Workflow({scriptPath, resumeFromRunId}).
- Check-in trigger deleted. No dev servers or browsers left running.
- State at pause: P3 built and committed (d73440e, 6b2a7a1), P4 built and committed (f10c59a), P2 mid-build
  (a62b35c + 4 uncommitted files). Integration = 94eb246 (P1 merged). Nothing pushed.
