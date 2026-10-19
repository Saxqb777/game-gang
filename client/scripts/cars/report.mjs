/** The per-car report and the budget checks of spec 4.4 (shared by build and --check). */
import budgets from './budgets.json' with { type: 'json' };
import { CORNERS } from './classify.mjs';

const MB = 1024 * 1024;

function n(value) {
  return Math.round(value).toLocaleString('en-GB');
}

function mm(value) {
  return value.toFixed(3);
}

/** Every broken budget of one car, as readable lines. */
export function budgetFailures(report) {
  const failures = [];
  const check = (ok, line) => {
    if (!ok) failures.push(line);
  };
  check(
    report.lod0.tris <= budgets.lod0.triangles,
    `LOD0 ${n(report.lod0.tris)} triangles > ${n(budgets.lod0.triangles)}`,
  );
  check(
    report.lod0.draws <= budgets.lod0.draws,
    `LOD0 ${report.lod0.draws} meshes > ${budgets.lod0.draws}`,
  );
  check(
    report.gpuLod0 <= budgets.lod0.gpuBytes,
    `LOD0 GPU ${(report.gpuLod0 / MB).toFixed(1)} MB > ${budgets.lod0.gpuBytes / MB} MB`,
  );
  check(
    report.lod1.tris <= budgets.lod1.triangles,
    `LOD1 ${n(report.lod1.tris)} triangles > ${n(budgets.lod1.triangles)}`,
  );
  check(
    report.lod1.draws <= budgets.lod1.draws,
    `LOD1 ${report.lod1.draws} meshes > ${budgets.lod1.draws}`,
  );
  check(
    report.gpuLod1 <= budgets.lod1.gpuBytes,
    `LOD1 GPU ${(report.gpuLod1 / MB).toFixed(1)} MB > ${budgets.lod1.gpuBytes / MB} MB`,
  );
  check(
    report.lod2.tris <= budgets.lod2.triangles,
    `LOD2 ${n(report.lod2.tris)} triangles > ${n(budgets.lod2.triangles)}`,
  );
  check(
    report.lod2.draws <= budgets.lod2.draws,
    `LOD2 ${report.lod2.draws} meshes > ${budgets.lod2.draws}`,
  );
  check(
    report.shadow.tris <= budgets.shadow.triangles,
    `shadow ${n(report.shadow.tris)} triangles > ${n(budgets.shadow.triangles)}`,
  );
  check(
    report.fileBytes <= budgets.fileBytes,
    `file ${(report.fileBytes / MB).toFixed(2)} MB > ${budgets.fileBytes / MB} MB`,
  );
  for (const image of report.images) {
    check(
      Math.max(image.width, image.height) <= budgets.lod0.maxImagePx,
      `image ${image.name} is ${image.width}x${image.height} (> ${budgets.lod0.maxImagePx} px)`,
    );
  }
  return failures;
}

/** Readable per-car report: tris and draws per LOD, sizes, textures, measured geometry vs config. */
export function formatReport(id, report, geometry, { sha }) {
  const lines = [];
  lines.push(
    `${id}: source ${n(report.sourceTris)} triangles, SHA-256 ${sha.slice(0, 8)}...${sha.slice(-5)}`,
  );
  lines.push(
    `  LOD0 ${n(report.lod0.tris)} tris / ${report.lod0.draws} draws | LOD1 ${n(report.lod1.tris)} / ${report.lod1.draws}` +
      ` | LOD2 ${n(report.lod2.tris)} / ${report.lod2.draws} | shadow ${n(report.shadow.tris)}`,
  );
  lines.push(
    `  file ${(report.fileBytes / MB).toFixed(2)} MB | GPU estimate LOD0 ${(report.gpuLod0 / MB).toFixed(1)} MB,` +
      ` LOD1 ${(report.gpuLod1 / MB).toFixed(1)} MB`,
  );
  for (const image of report.images) {
    lines.push(
      `  texture ${image.name}: ${image.width}x${image.height} ${image.mimeType.replace('image/', '')}` +
        ` ${(image.bytes / 1024).toFixed(0)} KB${image.lod0 ? '' : ' (LOD1/LOD2)'}`,
    );
  }
  lines.push('  geometry (measured | CARS config):');
  for (const corner of CORNERS) {
    const [x, y, z] = report.hubs[corner];
    const front = corner[0] === 'f';
    const left = corner[1] === 'l';
    const half = front ? geometry.halfTrackFront : geometry.halfTrackRear;
    const radius = front ? geometry.radiusFront : geometry.radiusRear;
    lines.push(
      `    hub ${corner}: x ${mm(x)} y ${mm(y)} z ${mm(z)} r ${mm(report.radii[corner])}` +
        ` | x ${mm(left ? half : -half)} y ${mm(radius)} z ${mm(front ? geometry.wheelbaseHalf : -geometry.wheelbaseHalf)} r ${mm(radius)}`,
    );
  }
  const { hubs, radii } = report;
  const measured = {
    wheelbaseHalf: (hubs.fl[2] + hubs.fr[2] - hubs.rl[2] - hubs.rr[2]) / 4,
    halfTrackFront: (hubs.fl[0] - hubs.fr[0]) / 2,
    halfTrackRear: (hubs.rl[0] - hubs.rr[0]) / 2,
    radiusFront: (radii.fl + radii.fr) / 2,
    radiusRear: (radii.rl + radii.rr) / 2,
  };
  lines.push(
    `    wheelbaseHalf ${mm(measured.wheelbaseHalf)} | ${mm(geometry.wheelbaseHalf)}; halfTrack F/R ${mm(measured.halfTrackFront)}/${mm(measured.halfTrackRear)}` +
      ` | ${mm(geometry.halfTrackFront)}/${mm(geometry.halfTrackRear)}; radius F/R ${mm(measured.radiusFront)}/${mm(measured.radiusRear)}` +
      ` | ${mm(geometry.radiusFront)}/${mm(geometry.radiusRear)}`,
  );
  lines.push(
    `    body L x W x H ${report.size.length.toFixed(2)} x ${report.size.width.toFixed(2)} x ${report.size.height.toFixed(2)}` +
      ` (with mirrors) | ${geometry.length} x ${geometry.width} x ${geometry.height}`,
  );
  for (const warning of report.warnings) lines.push(`  warning: ${warning}`);
  return lines.join('\n');
}
