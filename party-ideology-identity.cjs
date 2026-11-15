"use strict";

function gpmPartyIdentity(party, foundingPresetId) {
  const saved = party?.gpmIdeologyIdentity?.version === 1 ? party.gpmIdeologyIdentity : null;
  const presetId = saved ? saved.declared?.id : foundingPresetId ?? party?.nameDesc?.gpmIdeologyPreset;
  const preset = Object.hasOwn(gpmPresets, presetId) ? gpmPresets[presetId] : null;
  const authored = preset?.congressDoctrine;
  const explicitFoundingChoice = !saved && foundingPresetId !== undefined;
  // Current founding choices supply direct evidence. Older saves may carry only a preset hint.
  const doctrine = authored && (explicitFoundingChoice || gpmAxes.every(({ id }, index) =>
    Math.abs(party?.ideology?.[id] - preset.values[index] / 100) <= .2))
    ? { family: authored.family, platform: authored.platform, wings: [...authored.wings] } : null;
  if (saved) return doctrine && !saved.congressDoctrine ? { ...saved, congressDoctrine: doctrine } : saved;
  return {
    version: 1,
    declared: preset ? { id: presetId, label: preset.label, source: "founding-choice" } : null,
    foundingPreset: preset ? { id: presetId, label: preset.label } : null,
    historicalTradition: party?.nameDesc?.gpmHistoricalIdeology || null,
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

module.exports = { workerFunctions: [gpmPartyIdentity, gpmRecordPartyIdentity] };
