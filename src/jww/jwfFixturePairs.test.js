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
  const nonSerialized = new Set(
    environment.coverage?.nonSerializedJwfKeys || []
  );
  return Object.fromEntries(
    [...new Set([...supported, ...missing, ...nonSerialized])].map((key) => [
      key,
      supported.has(key)
        ? "extracted"
        : nonSerialized.has(key)
          ? "not-serialized"
          : "missing",
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
  it("classifies LTYPE_HC and LCOLLOR_M as non-serialized JWF-only keys", async () => {
    const rows = await valueScanRows("jwf-open-items-core");
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

    expect(byKey.LTYPE_HC.status).toBe("missing");
    expect(byKey.LTYPE_HC.gatewayCandidate).toMatchObject({
      nonSerializedJwfKey: true,
    });
    expect(byKey.LTYPE_HC.gatewayCandidateComparison).toMatchObject({
      nonSerializedJwfKey: true,
      comparisonRequired: false,
    });
    expect(byKey.LCOLLOR_M.status).toBe("missing");
    expect(byKey.LCOLLOR_M.gatewayCandidate).toMatchObject({
      nonSerializedJwfKey: true,
    });
    expect(byKey.LCOLLOR_M.gatewayCandidateComparison).toMatchObject({
      nonSerializedJwfKey: true,
      comparisonRequired: false,
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

  it("classifies layer default rows as non-serialized JWF-only keys", async () => {
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
      nonSerialized: 3,
      directMatchCandidates: 0,
      promotionCandidates: 0,
    });
    expect(audit.rows.map((row) => row.key).sort()).toEqual([
      "LAYCOL_0",
      "LAYTYP_0",
      "LAYWID_0",
    ]);
    expect(audit.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "LAYCOL_0",
          gatewayStatus: "not-serialized",
          nonSerializedJwfKey: true,
        }),
        expect.objectContaining({
          key: "LAYWID_0",
          gatewayStatus: "not-serialized",
          nonSerializedJwfKey: true,
        }),
        expect.objectContaining({
          key: "LAYTYP_0",
          gatewayStatus: "not-serialized",
          nonSerializedJwfKey: true,
        }),
      ])
    );
  });
});
