import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildLayerDefaultsAudit } from "../../tools/jww-layer-defaults-audit.mjs";
import { buildSpecialColorAudit } from "../../tools/jww-special-color-audit.mjs";
import { scanValues } from "../../tools/jww-jwf-value-scan.mjs";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";
import { parseJwfBytes } from "./jwf.js";

function fixturePath(file) {
  return fileURLToPath(
    new URL(`../../samples/jwf-pairs/${file}`, import.meta.url)
  );
}

function extractionStatusFromEnvironment(environment = {}) {
  const supported = new Set(environment.coverage?.supportedKeys || []);
  const missing = new Set(environment.coverage?.missingJwfKeys || []);
  return Object.fromEntries(
    [...new Set([...supported, ...missing])].map((key) => [
      key,
      supported.has(key) ? "extracted" : "missing",
    ])
  );
}

async function valueScanRows(baseName) {
  const jww = fixturePath(`${baseName}.jww`);
  const jwf = fixturePath(`${baseName}.jwf`);
  const [jwwBytes, jwfBytes] = await Promise.all([readFile(jww), readFile(jwf)]);
  const converted = convertJwwBytes(new Uint8Array(jwwBytes), {
    encoding: "shift_jis",
    sourcePath: jww,
  });
  const environment = converted.meta?.jwwEnvironment || {};
  const parsed = parseJwfBytes(new Uint8Array(jwfBytes), {
    encoding: "shift_jis",
    includeAfterEnd: true,
  });
  return scanValues(
    new Uint8Array(jwwBytes),
    parsed,
    8,
    extractionStatusFromEnvironment(environment),
    environment
  );
}

describe("generated JWF/JWW fixture pairs", () => {
  it("keeps LTYPE_HC and LCOLLOR_M sample-blocked without direct matches", async () => {
    const rows = await valueScanRows("jwf-open-items-core");
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

    expect(byKey.LTYPE_HC.status).toBe("missing");
    expect(byKey.LTYPE_HC.gatewayCandidateComparison).toMatchObject({
      directU32Match: false,
    });
    expect(byKey.LCOLLOR_M.status).toBe("missing");
    expect(byKey.LCOLLOR_M.gatewayCandidateComparison).toMatchObject({
      directSpecialMatch: false,
    });

    const specialAudit = await buildSpecialColorAudit({
      jww: fixturePath("jwf-open-items-core.jww"),
      jwf: fixturePath("jwf-open-items-core.jwf"),
      encoding: "shift_jis",
      includeAfterEnd: true,
      radius: 1024,
      limit: 24,
    });
    expect(specialAudit.counts.directMatches).toBe(0);
  });

  it("keeps layer default rows audit-only when saved JWW has no direct row matches", async () => {
    const audit = await buildLayerDefaultsAudit({
      jww: fixturePath("jwf-open-items-layer-defaults.jww"),
      jwf: fixturePath("jwf-open-items-layer-defaults.jwf"),
      encoding: "shift_jis",
      includeAfterEnd: true,
      maxMatches: 8,
    });

    expect(audit.counts).toMatchObject({
      rows: 3,
      missing: 3,
      directMatchCandidates: 0,
      promotionCandidates: 0,
    });
    expect(audit.rows.map((row) => row.key).sort()).toEqual([
      "LAYCOL_0",
      "LAYTYP_0",
      "LAYWID_0",
    ]);
  });
});
