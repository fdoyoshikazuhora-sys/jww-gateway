#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_ENCODINGS = new Set([
  "shift_jis",
  "utf-8",
  "utf-16le",
  "utf-16be",
]);

function parseArgs(argv) {
  const args = { input: "", json: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (!args.input) args.input = arg;
  }
  return args;
}

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function addError(errors, pathName, message, value) {
  errors.push({ path: pathName, message, actualType: typeOf(value) });
}

function hasNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasInteger(value) {
  return Number.isInteger(value);
}

function validateStringArray(errors, pathName, value) {
  if (!Array.isArray(value)) {
    addError(errors, pathName, "must be an array", value);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      addError(errors, `${pathName}[${index}]`, "must be a string", item);
    }
  });
}

function validatePoint(errors, pathName, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, pathName, "must be an object point", value);
    return;
  }
  if (!hasNumber(value.x))
    addError(errors, `${pathName}.x`, "must be a finite number", value.x);
  if (!hasNumber(value.y))
    addError(errors, `${pathName}.y`, "must be a finite number", value.y);
}

function validateColorEntry(errors, pathName, value) {
  if (value === null || value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, pathName, "must be a color object or null", value);
    return;
  }
  for (const key of ["red", "green", "blue"]) {
    if (
      value[key] !== undefined &&
      (!hasInteger(value[key]) || value[key] < 0 || value[key] > 255)
    ) {
      addError(
        errors,
        `${pathName}.${key}`,
        "must be an integer from 0 to 255",
        value[key]
      );
    }
  }
  if (value.hex !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value.hex)) {
    addError(
      errors,
      `${pathName}.hex`,
      "must be a #rrggbb color string",
      value.hex
    );
  }
}

function validateColorTable(errors, pathName, value) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, pathName, "must be a color table object", value);
    return;
  }
  Object.entries(value).forEach(([key, color]) =>
    validateColorEntry(errors, `${pathName}.${key}`, color)
  );
}

function validateColorSettings(errors, value) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, "meta.colorSettings", "must be an object", value);
    return;
  }
  validateColorTable(
    errors,
    "meta.colorSettings.screenColors",
    value.screenColors
  );
  validateColorTable(
    errors,
    "meta.colorSettings.printColors",
    value.printColors
  );
  validateColorEntry(
    errors,
    "meta.colorSettings.backgroundColor",
    value.backgroundColor
  );
  if (value.specialColors !== undefined) {
    if (
      !value.specialColors ||
      typeof value.specialColors !== "object" ||
      Array.isArray(value.specialColors)
    ) {
      addError(
        errors,
        "meta.colorSettings.specialColors",
        "must be an object",
        value.specialColors
      );
    } else {
      for (const key of ["S", "K", "Z", "M"]) {
        validateColorEntry(
          errors,
          `meta.colorSettings.specialColors.${key}`,
          value.specialColors[key]
        );
      }
    }
  }
}

function validateLineTypeSettings(errors, value) {
  if (value === null || value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(
      errors,
      "meta.lineTypeSettings",
      "must be an object or null",
      value
    );
    return;
  }
  if (value.offset !== undefined && !hasInteger(value.offset)) {
    addError(
      errors,
      "meta.lineTypeSettings.offset",
      "must be an integer",
      value.offset
    );
  }
  if (value.byteLength !== undefined && !hasInteger(value.byteLength)) {
    addError(
      errors,
      "meta.lineTypeSettings.byteLength",
      "must be an integer",
      value.byteLength
    );
  }
  if (
    value.rows !== undefined &&
    (!value.rows || typeof value.rows !== "object" || Array.isArray(value.rows))
  ) {
    addError(
      errors,
      "meta.lineTypeSettings.rows",
      "must be an object",
      value.rows
    );
  }
}

function validateJwwEnvironment(errors, value) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, "meta.jwwEnvironment", "must be an object", value);
    return;
  }
  const coverage = value.coverage;
  if (coverage !== undefined) {
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) {
      addError(
        errors,
        "meta.jwwEnvironment.coverage",
        "must be an object",
        coverage
      );
    } else {
      if (
        coverage.totalJwfKeysTracked !== undefined &&
        !hasInteger(coverage.totalJwfKeysTracked)
      ) {
        addError(
          errors,
          "meta.jwwEnvironment.coverage.totalJwfKeysTracked",
          "must be an integer",
          coverage.totalJwfKeysTracked
        );
      }
      if (coverage.supportedKeys !== undefined) {
        validateStringArray(
          errors,
          "meta.jwwEnvironment.coverage.supportedKeys",
          coverage.supportedKeys
        );
      }
      if (coverage.missingJwfKeys !== undefined) {
        validateStringArray(
          errors,
          "meta.jwwEnvironment.coverage.missingJwfKeys",
          coverage.missingJwfKeys
        );
      }
    }
  }
}

function validateBounds(errors, value) {
  if (value === null || value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, "bounds", "must be null or an object", value);
    return;
  }
  for (const key of ["minX", "maxX", "minY", "maxY"]) {
    if (!hasNumber(value[key])) {
      addError(errors, `bounds.${key}`, "must be a finite number", value[key]);
    }
  }
}

function validateEntityShape(errors, item, index) {
  const prefix = `entities[${index}]`;
  const entity = item.entity || {};
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    addError(errors, `${prefix}.entity`, "must be an object", entity);
    return;
  }

  if (item.type === "LINE") {
    validatePoint(errors, `${prefix}.entity.start`, entity.start);
    validatePoint(errors, `${prefix}.entity.end`, entity.end);
  } else if (item.type === "POINT") {
    validatePoint(errors, `${prefix}.entity.position`, entity.position);
  } else if (item.type === "TEXT") {
    if (typeof entity.text !== "string") {
      addError(
        errors,
        `${prefix}.entity.text`,
        "must be a string",
        entity.text
      );
    }
    validatePoint(errors, `${prefix}.entity.position`, entity.position);
    if (entity.height !== undefined && !hasNumber(entity.height)) {
      addError(
        errors,
        `${prefix}.entity.height`,
        "must be a finite number",
        entity.height
      );
    }
  } else if (item.type === "CIRCLE" || item.type === "ARC") {
    validatePoint(errors, `${prefix}.entity.center`, entity.center);
    if (!hasNumber(entity.radius) || entity.radius < 0) {
      addError(
        errors,
        `${prefix}.entity.radius`,
        "must be a non-negative finite number",
        entity.radius
      );
    }
    if (item.type === "ARC") {
      if (!hasNumber(entity.startAngle)) {
        addError(
          errors,
          `${prefix}.entity.startAngle`,
          "must be a finite number",
          entity.startAngle
        );
      }
      if (!hasNumber(entity.endAngle)) {
        addError(
          errors,
          `${prefix}.entity.endAngle`,
          "must be a finite number",
          entity.endAngle
        );
      }
    }
  } else if (item.type === "SOLID") {
    if (!Array.isArray(entity.vertices) || entity.vertices.length < 3) {
      addError(
        errors,
        `${prefix}.entity.vertices`,
        "must contain at least 3 points",
        entity.vertices
      );
    } else {
      entity.vertices.forEach((point, pointIndex) =>
        validatePoint(errors, `${prefix}.entity.vertices[${pointIndex}]`, point)
      );
    }
  }
}

export function validateCadstudioJwwJson(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, "$", "must be an object", value);
    return { valid: false, errors };
  }

  if (value.format !== "cadstudio-jww-json") {
    addError(errors, "format", 'must be "cadstudio-jww-json"', value.format);
  }
  if (value.formatVersion !== 1) {
    addError(errors, "formatVersion", "must be 1", value.formatVersion);
  }
  if (value.sourceFormat !== "JWW") {
    addError(errors, "sourceFormat", 'must be "JWW"', value.sourceFormat);
  }
  if (!SUPPORTED_ENCODINGS.has(value.encoding)) {
    addError(
      errors,
      "encoding",
      "must be a supported encoding",
      value.encoding
    );
  }

  const meta = value.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    addError(errors, "meta", "must be an object", meta);
  } else {
    if (!("jwwVersion" in meta))
      addError(errors, "meta.jwwVersion", "is required", meta.jwwVersion);
    if (!("paperCode" in meta))
      addError(errors, "meta.paperCode", "is required", meta.paperCode);
    if (!("paperSize" in meta))
      addError(errors, "meta.paperSize", "is required", meta.paperSize);
    if (
      meta.jwwVersion !== null &&
      meta.jwwVersion !== undefined &&
      !hasNumber(meta.jwwVersion)
    ) {
      addError(
        errors,
        "meta.jwwVersion",
        "must be a finite number or null",
        meta.jwwVersion
      );
    }
    if (
      meta.paperCode !== null &&
      meta.paperCode !== undefined &&
      !hasNumber(meta.paperCode)
    ) {
      addError(
        errors,
        "meta.paperCode",
        "must be a finite number or null",
        meta.paperCode
      );
    }
    if (
      meta.paperSize !== null &&
      meta.paperSize !== undefined &&
      typeof meta.paperSize !== "string"
    ) {
      addError(
        errors,
        "meta.paperSize",
        "must be a string or null",
        meta.paperSize
      );
    }
    validateColorSettings(errors, meta.colorSettings);
    validateLineTypeSettings(errors, meta.lineTypeSettings);
    validateJwwEnvironment(errors, meta.jwwEnvironment);
  }

  validateBounds(errors, value.bounds);

  if (!Array.isArray(value.entities)) {
    addError(errors, "entities", "must be an array", value.entities);
  } else {
    value.entities.forEach((item, index) => {
      const prefix = `entities[${index}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        addError(errors, prefix, "must be an object", item);
        return;
      }
      if (typeof item.id !== "string" || !item.id) {
        addError(errors, `${prefix}.id`, "must be a non-empty string", item.id);
      }
      if (typeof item.type !== "string" || !item.type) {
        addError(
          errors,
          `${prefix}.type`,
          "must be a non-empty string",
          item.type
        );
      }
      if (item.source !== "jww") {
        addError(errors, `${prefix}.source`, 'must be "jww"', item.source);
      }
      if (item.colorNumber !== undefined && !hasNumber(item.colorNumber)) {
        addError(
          errors,
          `${prefix}.colorNumber`,
          "must be a finite number",
          item.colorNumber
        );
      }
      if (item.stroke !== undefined && typeof item.stroke !== "string") {
        addError(errors, `${prefix}.stroke`, "must be a string", item.stroke);
      }
      if (
        item.renderStroke !== undefined &&
        typeof item.renderStroke !== "string"
      ) {
        addError(
          errors,
          `${prefix}.renderStroke`,
          "must be a string",
          item.renderStroke
        );
      }
      if (
        item.renderLineWidth !== undefined &&
        !hasNumber(item.renderLineWidth)
      ) {
        addError(
          errors,
          `${prefix}.renderLineWidth`,
          "must be a finite number",
          item.renderLineWidth
        );
      }
      validateEntityShape(errors, item, index);
    });
  }

  return { valid: errors.length === 0, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      "Usage: node tools/jww-schema-validate.mjs <cadstudio-jww.json> [--json]"
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const result = validateCadstudioJwwJson(input);

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ file: inputPath, ...result }, null, 2)}\n`
    );
  } else if (result.valid) {
    process.stdout.write(`Valid CAD Studio JWW JSON: ${inputPath}\n`);
  } else {
    process.stdout.write(`Invalid CAD Studio JWW JSON: ${inputPath}\n`);
    for (const error of result.errors) {
      process.stdout.write(
        `- ${error.path}: ${error.message} (${error.actualType})\n`
      );
    }
  }

  process.exitCode = result.valid ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
