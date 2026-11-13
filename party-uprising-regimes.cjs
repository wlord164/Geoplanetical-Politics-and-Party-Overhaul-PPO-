"use strict";

function gpmUprisingProfile(party, presets = gpmPresets) {
  const axis = id => {
    const value = party?.ideology?.[id];
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  };
  const econ = axis("econ");
  const social = axis("social");
  const gov = axis("gov");
  const nat = axis("nat");
  const axes = [econ, social, gov, nat];
  const savedPreset = party?.nameDesc?.gpmIdeologyPreset;
  const values = Object.hasOwn(presets, savedPreset) ? presets[savedPreset].values : null;
  // The founding preset helps distinguish ideologies with similar scores, while
  // a materially changed party uses its current positions.
  const preset = values?.every((value, index) => Math.abs(value / 100 - axes[index]) <= .2)
    ? savedPreset : null;
  let regime;
  if (preset === "religiousTraditionalist") {
    regime = "theocracy";
  } else if (["corporatistNationalist", "authoritarianUltranationalist"].includes(preset) ||
      (!preset && gov >= .65 && nat >= .65 && social >= .45)) {
    regime = "nationalist_single_party";
  } else if (["marxistLeninist", "hardlineStateSocialist"].includes(preset) ||
      (!preset && gov >= .65 && econ <= -.65)) {
    regime = "socialist_single_party";
  } else if (["councilCommunist", "anarchoCommunist"].includes(preset) ||
      (!preset && gov <= -.65 && econ <= -.85)) {
    regime = "council_republic";
  } else if (["green", "anarchoCapitalist"].includes(preset) || (!preset && gov <= -.85)) {
    regime = "decentralized_republic";
  } else if (["leftNationalist", "nationalConservative"].includes(preset) || gov >= .35) {
    regime = "presidential_republic";
  } else {
    regime = "parliamentary_republic";
  }

  const singleParty = regime === "socialist_single_party" || regime === "nationalist_single_party";
  const clerical = regime === "theocracy";
  const ceremonial = !singleParty && !clerical && regime !== "presidential_republic";
  const confederal = preset === "anarchoCommunist" || preset === "anarchoCapitalist" ||
    (!preset && gov <= -.95);
  const decentralized = regime === "decentralized_republic" || regime === "council_republic";
  const labels = {
    socialist_single_party: "Socialist one-party state",
    nationalist_single_party: "Nationalist one-party state",
    theocracy: "Clerical republic",
    council_republic: "Council republic",
    decentralized_republic: confederal ? "Confederal republic" : "Decentralized parliamentary republic",
    presidential_republic: "Presidential republic",
    parliamentary_republic: "Parliamentary republic",
  };
  const stateStructure = decentralized ? (confederal ? "confederal" : "decentralized") : undefined;

  return {
    preset, econ, gov, nat, social, regime, label: labels[regime], singleParty, ceremonial,
    headSelection: singleParty ? "party" : clerical ? "clerical" : "elected",
    headGovExists: ceremonial ? 1 : 0,
    ...(ceremonial ? { headBallot: "parliament", headGovSelection: "parliament" } : {}),
    cabinetAccountability: ceremonial ? "parliament" : "head",
    partyLegality: singleParty ? .1 : clerical ? .55 : .95,
    execConstraints: singleParty ? .15 : clerical ? .25 : ceremonial ? .85 : .65,
    commissionIndep: singleParty ? .2 : clerical ? .45 : ceremonial ? .9 : .75,
    parliamentPower: clerical || regime === "nationalist_single_party" ? "advisory" : "sovereign",
    ...(stateStructure ? { stateStructure } : {}),
    emergencyPowers: singleParty || clerical ? "broad" : "limited",
    dissolutionPower: ceremonial ? "constructive" : "none",
    suffrage: singleParty ? .65 : clerical ? .55 : .95,
  };
}

module.exports = { workerFunctions: [gpmUprisingProfile], gpmUprisingProfile };