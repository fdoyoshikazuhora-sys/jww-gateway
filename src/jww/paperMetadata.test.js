import { convertJwwBytes } from "../../tools/jww-gateway.mjs";
import { buildJwwBytes } from "./writer.js";

describe("JWW paper metadata", () => {
  it("keeps the stored paper code authoritative over drawing text", () => {
    const bytes = buildJwwBytes({
      version: 700,
      paperSize: 3,
      entities: [
        {
          type: "TEXT",
          entity: {
            text: "Existing title text A2",
            position: { x: 0, y: 0 },
            endPoint: { x: 20, y: 0 },
            paperTextWidth: 20,
            paperTextHeight: 3,
            fontFamily: "MS Gothic",
            jww: {
              group: 0,
              layerGroup: 0,
              layer: 0,
              penColor: 2,
              penStyle: 1,
              penWidth: 1,
              flag: 0,
            },
          },
        },
      ],
    });

    const converted = convertJwwBytes(bytes);
    expect(converted.meta.paperCode).toBe(3);
    expect(converted.meta.paperSize).toBe("A3");
  });
});
