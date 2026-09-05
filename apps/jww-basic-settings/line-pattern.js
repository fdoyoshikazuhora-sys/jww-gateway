// JWF stores the leftmost of the 32 editable positions as the high bit.
export function decodeLinePattern(hex, random = false) {
  if (!/^[0-9a-f]{1,8}$/i.test(String(hex))) return "";
  const bits = Number.parseInt(String(hex), 16).toString(2).padStart(32, "0");
  return bits.replaceAll("1", random ? "'" : "-").replaceAll("0", random ? "," : " ");
}

export function encodeLinePattern(pattern, random = false) {
  if (!(random ? /^[,']{32}$/ : /^[- ]{32}$/).test(pattern)) {
    throw new Error(random
      ? "Enter exactly 32 characters: apostrophe (') or comma (,)."
      : "Enter exactly 32 characters: dash (-) or half-width space.");
  }
  const bits = [...pattern].map(character => character === (random ? "'" : "-") ? "1" : "0").join("");
  return Number.parseInt(bits, 2).toString(16).padStart(8, "0");
}
