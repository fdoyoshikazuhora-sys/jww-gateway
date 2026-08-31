import {
  JWW_INTERNAL_SETTING_KEYS,
  partitionJwwInternalSettings,
  readJwwInternalSetting,
} from "./internalSettings.js";

function textEntity(content, overrides = {}) {
  return {
    value: {
      base: {
        pen_style: 9,
        pen_color: 9,
        pen_width: 0,
        layer: 0,
        layer_group: 6,
        flag: 0,
      },
      start_x: 0,
      start_y: -1000,
      end_x: 0,
      end_y: -1000,
      content,
      ...overrides,
    },
  };
}

describe("Jw_cad internal setting text", () => {
  it("recognizes only the six setting keys observed in a Jw_cad 10.02.1 resave", () => {
    for (const key of JWW_INTERNAL_SETTING_KEYS) {
      expect(readJwwInternalSetting(textEntity(`${key} = 0`))).toMatchObject({
        key,
        settingValue: 0,
        text: `${key} = 0`,
      });
    }
  });

  it("keeps the same visible text when it is placed in the drawing", () => {
    const visible = textEntity("Printer_Orientation = 0", {
      start_x: 12,
      start_y: 34,
      end_x: 56,
      end_y: 34,
    });

    const result = partitionJwwInternalSettings([visible]);

    expect(result.settings).toEqual([]);
    expect(result.drawingEntities).toEqual([visible]);
    expect(result.drawingEntityIndexes).toEqual([0]);
  });

  it("keeps unknown assignments even at the internal sentinel position", () => {
    const visible = textEntity("Printer_Custom = 0");

    const result = partitionJwwInternalSettings([visible]);

    expect(result.settings).toEqual([]);
    expect(result.drawingEntities).toEqual([visible]);
    expect(result.drawingEntityIndexes).toEqual([0]);
  });

  it("partitions recognized settings without changing drawing entity order", () => {
    const first = { value: { start_x: 1, start_y: 2, end_x: 3, end_y: 4 } };
    const setting = textEntity("View_Direct2d = 1");
    const last = { value: { x: 5, y: 6 } };

    const result = partitionJwwInternalSettings([first, setting, last]);

    expect(result.drawingEntities).toEqual([first, last]);
    expect(result.drawingEntityIndexes).toEqual([0, 2]);
    expect(result.settings).toMatchObject([
      {
        key: "View_Direct2d",
        settingValue: 1,
        sourceIndex: 1,
      },
    ]);
  });
});
