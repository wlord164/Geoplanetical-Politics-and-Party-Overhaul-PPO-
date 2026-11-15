"use strict";

function gpmPartyIdentity(party, foundingPresetId = party?.nameDesc?.gpmIdeologyPreset) {
  if (party?.gpmIdeologyIdentity?.version === 1) return party.gpmIdeologyIdentity;
  const preset = Object.hasOwn(gpmPresets, foundingPresetId) ? gpmPresets[foundingPresetId] : null;
  return {
    version: 1,
    declared: preset ? { id: foundingPresetId, label: preset.label, source: "founding-choice" } : null,
    foundingPreset: preset ? { id: foundingPresetId, label: preset.label } : null,
    historicalTradition: party?.nameDesc?.gpmHistoricalIdeology || null,
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
