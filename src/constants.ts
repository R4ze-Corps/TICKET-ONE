import constantsJson from "../constants.json" with { type: "json" };
import emojisJson from "../emojis.json" with { type: "json" };

declare global {
  const constants: typeof constantsJson;
  const emojis: typeof emojisJson;
}
Object.assign(
  globalThis,
  Object.freeze({
    constants: constantsJson,
    emojis: emojisJson,
  }),
);
