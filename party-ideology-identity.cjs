"use strict";

const inferredCurrentPresets = {
  Centrism: "center", "Internationalist Centrism": "center", "Liberal Centrism": "liberalCentre",
  "Social Liberalism": "mixedEconomyCentre", "Market Liberalism": "marketCentre", "Market Right": "classicalLiberal",
  "Social Democracy": "socialDemocrat", "Centre-Left": "socialDemocrat", "Progressive Left": "democraticSocialist",
  "Internationalist Left": "democraticSocialist", "Statist Left": "democraticSocialist", "Internationalist Statist Left": "democraticSocialist",
  "Left Nationalism": "leftNationalist", "Progressive Left Nationalism": "leftNationalist",
  "Centre-Right": "conservative", "Liberal Conservatism": "liberalConservative", "Market Conservatism": "conservative",
  "Social Conservatism": "conservative", "National Conservatism": "nationalConservative",
  "Socially Conservative Left": "paternalistConservative", Progressivism: "green",
};

function gpmPartyIdentity(party, foundingPresetId) {
  const saved = party?.gpmIdeologyIdentity?.version === 1 ? party.gpmIdeologyIdentity : null;
  const presetId = saved?.declared?.id ?? foundingPresetId ?? party?.nameDesc?.gpmDeclaredIdeology ?? party?.nameDesc?.gpmIdeologyPreset;
  const preset = Object.hasOwn(gpmPresets, presetId) ? gpmPresets[presetId] : null;
  const authored = preset?.congressDoctrine;
  const explicitFoundingChoice = !saved && foundingPresetId !== undefined;
  // Current founding choices supply direct evidence. Older saves may carry only a preset hint.
  const doctrine = authored && (saved?.congressDoctrine || saved?.declared?.source === "founding-choice" || explicitFoundingChoice || gpmAxes.every(({ id }, index) =>
    Math.abs(party?.ideology?.[id] - preset.values[index] / 100) <= .2))
    ? { family: authored.family, platform: authored.platform, wings: [...authored.wings] } : null;
  const declared = preset ? { id: presetId, label: preset.label, ideologyLabel: preset.ideologyLabel || preset.label,
    source: saved?.declared?.source ?? "founding-choice" } : saved?.declared ?? null;
  const estimate = !declared ? estimatePartyIdeology(party?.ideology) : null;
  const estimatePreset = estimate && Object.hasOwn(gpmInferredCurrentPresets, estimate) ? gpmInferredCurrentPresets[estimate] : null;
  const compatibility = estimatePreset ? gpmPresets[estimatePreset].congressDoctrine : null;
  const currentCompatibility = compatibility ? { platform: compatibility.platform, wings: compatibility.wings } : null;
  if (saved) return { ...saved, declared, currentCompatibility, ...(doctrine ? { congressDoctrine: doctrine } : {}) };
  return {
    version: 1,
    declared,
    foundingPreset: preset ? { id: presetId, label: preset.label } : null,
    historicalTradition: party?.nameDesc?.gpmHistoricalIdeology || null,
    currentCompatibility,
    ...(doctrine ? { congressDoctrine: doctrine } : {}),
    positions: Object.fromEntries(Object.entries(preset?.positions || {}).map(([key, position]) =>
      [key, { ...position, source: "founding-platform" }])),
  };
}

function gpmRecordPartyIdentity(party, foundingPresetId) {
  const identity = gpmPartyIdentity(party, foundingPresetId);
  party.gpmIdeologyIdentity = identity;
  return identity;
}

module.exports = { workerFunctions: [
  `const gpmInferredCurrentPresets = ${JSON.stringify(inferredCurrentPresets)};`, gpmPartyIdentity, gpmRecordPartyIdentity,
] };
