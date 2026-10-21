// Output comparison: ignore trailing whitespace on each line and trailing blank lines,
// which is what most online judges do.
export function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function outputsMatch(actual, expected) {
  return normalize(actual) === normalize(expected);
}
