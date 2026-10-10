# M8 work-in-progress backup

Saved 2026-10-10 when the owner paused M8. This branch is a backup only: it is not deployed and must
not be merged into `claude/gracious-bell-2pgra5` as it is. Delete `_m8-backup/` before any merge.

## Branch state at the pause

| Branch | Commit | State |
|---|---|---|
| `m8/integration` | `94eb246a15a7f6a31fd3e99599e29c4d4b7fbde1` | P1 merged, M8 gate passes. The tree of this branch equals it (plus this folder). |
| `m8/p1-cleanup` | `fa016cb4663dee1c3d12d54f8df8d0c34f0247bf` | Done, reviewed, merged. |
| `m8/p2-trackgen` | `1db58235db77849fb9c73c8aa6d496731efe8f38` | Mid-build. The last commit is a work-in-progress snapshot. |
| `m8/p3-render` | `6b2a7a1c1cff0d58103301279eb475d364b09e0e` | First build done. Review not started. |
| `m8/p4-controller` | `f10c59a0618707d77086ad2d497340cf9028bfda` | First build done. Review not started. |

All five are reachable from this branch (the second commit is an "ours" merge of P2, P3 and P4).
To restore them in a fresh clone:

```sh
git fetch origin m8-wip-backup
git branch m8/integration   94eb246a15a7f6a31fd3e99599e29c4d4b7fbde1
git branch m8/p1-cleanup    fa016cb4663dee1c3d12d54f8df8d0c34f0247bf
git branch m8/p2-trackgen   1db58235db77849fb9c73c8aa6d496731efe8f38
git branch m8/p3-render     6b2a7a1c1cff0d58103301279eb475d364b09e0e
git branch m8/p4-controller f10c59a0618707d77086ad2d497340cf9028bfda
```

Then recreate the worktrees under `/home/user/m8-wt/` (spec §2.1), run `pnpm install` in each, and
copy `plan/m8-gate.sh` to `/tmp/claude-0/m8-gate.sh`.

## What is in this folder

- `plan/`: the M8 build spec (rev 3), the art-direction guide, owner decisions log, gate script.
- `layouts/final/`: the owner-approved original Kestrel Pines layout (P2 copies these files) and its
  design notes. `layouts/a-d` are the four competition entries.
- `carkit/`: the five converted car models (.glb) with previews and conversion tools, and
  `LINEUP.md` (the M12 plan). They still carry real-world plates and tyre text: debrand before use.
  Licences and credits are in `cars/shortlist.json` and the car-kit journal.
- `cars/`, `tools/`, `verify/`: car shortlist, layout checker, originality check (real-circuit
  outlines from OpenStreetMap, TUMFTM and the F1 GeoJSON set).
- `e2e/`: Playwright scripts used by each package (they are not part of the repo).
- `research/`: the research report and its notes.
- `workflows/`: the orchestration scripts and the journals of every run (agent results).

Nothing from Speed Dreams is included.
