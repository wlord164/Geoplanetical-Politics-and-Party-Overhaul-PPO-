"use strict";

const presets = require("./party-ideology-presets.cjs");
const registerMatches = require("./opening-register-ideologies.json");
const dimensions = ["econ", "social", "gov", "nat"];

function openingIdeology(countryKey, row) {
  const match = registerMatches[countryKey]?.[row.id];
  if (!match) return null;
  const preset = presets[match.preset];
  if (!preset?.congressDoctrine || !Array.isArray(match.sources) || !match.sources.length) {
    throw new Error("Invalid opening ideology match: " + countryKey + "/" + row.id);
  }
  return {
    preset: match.preset,
    scope: match.scope,
    scores: Object.fromEntries(dimensions.map((axis, index) => [axis, preset.values[index] / 100])),
  };
}

module.exports = { openingIdeology };

