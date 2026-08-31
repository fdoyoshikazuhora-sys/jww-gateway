import { unwrapJwwEntity } from "./shared.js";

export const JWW_INTERNAL_SETTING_KEYS = Object.freeze([
  "Printer_Orientation",
  "Printer_PaperSize",
  "Printer_D2dBMP",
  "Printer_BmpZENTAI",
  "View_Direct2d",
  "Draw_BmpTOUKA",
]);

const INTERNAL_SETTING_KEYS = new Set(JWW_INTERNAL_SETTING_KEYS);
const SETTING_ASSIGNMENT =
  /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/;

function isInternalSettingPosition(value = {}) {
  return (
    Number(value.start_x) === 0 &&
    Number(value.start_y) === -1000 &&
    Number(value.end_x) === 0 &&
    Number(value.end_y) === -1000
  );
}

export function readJwwInternalSetting(source) {
  const value = unwrapJwwEntity(source);
  if (!value || typeof value !== "object" || !isInternalSettingPosition(value)) {
    return null;
  }

  const text = String(value.content || "");
  const match = SETTING_ASSIGNMENT.exec(text);
  if (!match || !INTERNAL_SETTING_KEYS.has(match[1])) return null;

  const settingValue = Number(match[2]);
  if (!Number.isFinite(settingValue)) return null;

  return {
    source,
    value,
    key: match[1],
    settingValue,
    text,
  };
}

export function partitionJwwInternalSettings(entities = []) {
  const drawingEntities = [];
  const drawingEntityIndexes = [];
  const settings = [];

  entities.forEach((source, sourceIndex) => {
    const setting = readJwwInternalSetting(source);
    if (setting) settings.push({ ...setting, sourceIndex });
    else {
      drawingEntities.push(source);
      drawingEntityIndexes.push(sourceIndex);
    }
  });

  return { drawingEntities, drawingEntityIndexes, settings };
}
