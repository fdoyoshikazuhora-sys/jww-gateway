import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const validatorScript = path.join(
  process.cwd(),
  "tools",
  "jww-schema-validate.mjs"
);

function baseDocument(overrides = {}) {
  return {
    format: "jww-gateway-json",
    formatVersion: 1,
    sourceFormat: "JWW",
    encoding: "shift_jis",
    meta: {
      jwwVersion: 700,
      paperCode: 2,
      paperSize: "A2",
      ...overrides.meta,
    },
    entities: [],
    ...overrides,
  };
}

function runValidator(document) {
  const folder = mkdtempSync(path.join(tmpdir(), "jww-schema-"));
  const file = path.join(folder, "sample.json");
  writeFileSync(file, JSON.stringify(document), "utf8");
  const result = spawnSync(
    process.execPath,
    ["--no-warnings", validatorScript, file, "--json"],
    { encoding: "utf8" }
  );
  const stdout = result.stdout ?? result.output?.[1]?.toString() ?? "";
  if (!stdout) {
    throw new Error(
      `validator produced no stdout: status=${result.status} error=${result.error?.message || ""} stderr=${result.stderr || ""}`
    );
  }
  return {
    status: result.status,
    stderr: result.stderr,
    output: JSON.parse(stdout),
  };
}

describe("JWW Gateway JSON validator CLI", () => {
  it("accepts structured color, line type, and coverage metadata", () => {
    const result = runValidator(
      baseDocument({
        meta: {
          jwwVersion: 700,
          paperCode: 2,
          paperSize: "A2",
          colorSettings: {
            screenColors: {
              1: { red: 120, green: 120, blue: 120, width: 1, hex: "#787878" },
            },
            printColors: {
              1: {
                red: 0,
                green: 0,
                blue: 0,
                width: 3,
                hex: "#000000",
                pointRadius: 0.5,
              },
            },
            backgroundColor: {
              red: 255,
              green: 255,
              blue: 255,
              width: 1,
              hex: "#ffffff",
            },
            specialColors: {
              S: { red: 255, green: 0, blue: 0, hex: "#ff0000" },
              K: { red: 255, green: 128, blue: 0, hex: "#ff8000" },
              Z: { red: 128, green: 128, blue: 128, hex: "#808080" },
              M: null,
            },
          },
          lineTypeSettings: {
            offset: 100,
            byteLength: 292,
            score: 10,
            rows: {
              LTYPE_02: {
                pattern: "99999999",
                params: [4, 1, 5],
                values: ["99999999", 4, 1, 5],
                offset: 100,
              },
            },
          },
          jwwEnvironment: {
            source: "jww",
            coverage: {
              totalJwfKeysTracked: 210,
              supportedKeys: ["LCOLLOR_S"],
              missingJwfKeys: ["LTYPE_HC", "LCOLLOR_M"],
            },
          },
          jwwInternalSettings: {
            sentinel: {
              start: { x: 0, y: -1000 },
              end: { x: 0, y: -1000 },
            },
            records: [
              {
                id: "jww-internal-setting-42",
                key: "Printer_Orientation",
                sourceIndex: 42,
                settingValue: 0,
                text: "Printer_Orientation = 0",
                startPoint: { x: 0, y: -1000 },
                endPoint: { x: 0, y: -1000 },
              },
            ],
          },
        },
      })
    );

    expect(result.status).toBe(0);
    expect(result.output.valid).toBe(true);
    expect(result.output.errors).toEqual([]);
  });

  it("reports invalid fixed metadata shapes", () => {
    const result = runValidator(
      baseDocument({
        meta: {
          jwwVersion: 700,
          paperCode: 2,
          paperSize: "A2",
          colorSettings: {
            screenColors: {
              1: { red: 300, green: 0, blue: 0, hex: "red" },
            },
            specialColors: {
              M: { red: 0, green: -1, blue: 0, hex: "#00ff00" },
            },
          },
          lineTypeSettings: {
            offset: 10.5,
            rows: [],
          },
          jwwEnvironment: {
            coverage: {
              totalJwfKeysTracked: 210.25,
              supportedKeys: ["LCOLLOR_S", 42],
              missingJwfKeys: "LTYPE_HC",
            },
          },
          jwwInternalSettings: {
            sentinel: {
              start: { x: "0", y: -1000 },
              end: { x: 0, y: -1000 },
            },
            records: [
              {
                id: 0,
                key: "",
                sourceIndex: -1,
                settingValue: "0",
                text: 0,
                startPoint: null,
                endPoint: { x: 0, y: -1000 },
              },
            ],
          },
        },
      })
    );

    expect(result.status).toBe(1);
    expect(result.output.valid).toBe(false);
    expect(result.output.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "meta.colorSettings.screenColors.1.red",
        "meta.colorSettings.screenColors.1.hex",
        "meta.colorSettings.specialColors.M.green",
        "meta.lineTypeSettings.offset",
        "meta.lineTypeSettings.rows",
        "meta.jwwEnvironment.coverage.totalJwfKeysTracked",
        "meta.jwwEnvironment.coverage.supportedKeys[1]",
        "meta.jwwEnvironment.coverage.missingJwfKeys",
        "meta.jwwInternalSettings.sentinel.start.x",
        "meta.jwwInternalSettings.records[0].id",
        "meta.jwwInternalSettings.records[0].key",
        "meta.jwwInternalSettings.records[0].sourceIndex",
        "meta.jwwInternalSettings.records[0].settingValue",
        "meta.jwwInternalSettings.records[0].text",
        "meta.jwwInternalSettings.records[0].startPoint",
      ])
    );
  });
});
