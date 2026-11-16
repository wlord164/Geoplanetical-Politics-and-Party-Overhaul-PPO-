"use strict";

const parliamentaryReform = {
  singleParty: false, ceremonial: true, headSelection: "elected", headBallot: "parliament",
  headGovExists: 1, headGovSelection: "parliament", cabinetAccountability: "parliament",
  vacancyHoS: "acting_then_election", vacancyHoG: "party", deputyOffice: "speaker_acts",
  parliamentPower: "sovereign", partyLegality: .95, execConstraints: .85, commissionIndep: .90,
  suffrage: .95, emergencyPowers: "limited", dissolutionPower: "constructive", judicialReview: true,
};

const advisoryOnePartyReform = {
  singleParty: true, ceremonial: false, headSelection: "party", headGovExists: 0,
  vacancyHoS: "council", deputyOffice: "vice_president",
  cabinetAccountability: "head", parliamentPower: "advisory", partyLegality: .15, execConstraints: .2,
  commissionIndep: .25, suffrage: .60, emergencyPowers: "broad", dissolutionPower: "none", judicialReview: false,
};

const gpmUprisingPresetReforms = {
  trotskyist: { ...parliamentaryReform, regime: "trotskyist_workers_republic", label: "Decentralized workers’ republic",
    stateStructure: "decentralized", partyLegality: .80, execConstraints: .8 },
  federalRepublican: { ...parliamentaryReform, regime: "federal_republic", label: "Federal parliamentary republic",
    stateStructure: "federal", upperChamber: 1, bicameralRelation: "symmetric" },
  nasserist: { ...parliamentaryReform, regime: "nasserist_presidential_republic", label: "Arab socialist presidential republic",
    ceremonial: false, headBallot: "two-round", headGovExists: 0, headGovSelection: null,
    vacancyHoS: "deputy", vacancyHoG: null, deputyOffice: "vice_president",
    cabinetAccountability: "head", partyLegality: .45, execConstraints: .55, commissionIndep: .55,
    emergencyPowers: "broad", dissolutionPower: "none" },
  baathist: { ...advisoryOnePartyReform, regime: "baathist_party_republic", label: "Ba’athist party-led republic" },
  secularRepublican: { ...parliamentaryReform, regime: "secular_republic", label: "Secular parliamentary republic" },
  constitutionalMonarchist: { ...parliamentaryReform, regime: "constitutional_monarchy", label: "Parliamentary constitutional monarchy",
    headSelection: "hereditary", headBallot: null, crownPower: "ceremonial", vacancyHoS: "heir", vacancyHoG: "party",
    successionOrder: "primogeniture_absolute", deputyOffice: "crown_prince", dissolutionPower: "none", veto: false },
  agrarianPopulist: { ...parliamentaryReform, regime: "agrarian_republic", label: "Agrarian parliamentary republic",
    stateStructure: "decentralized" },
  socialCorporatist: { ...advisoryOnePartyReform, regime: "social_corporatist_party_state", label: "Social Corporatist one-party state" },
};

function gpmActiveIdeologyPreset(party, presets = gpmPresets) {
  const id = party?.nameDesc?.gpmIdeologyPreset;
  const values = Object.hasOwn(presets, id) ? presets[id].values : null;
  return values?.every((value, index) => {
    const current = party.ideology?.[["econ", "social", "gov", "nat"][index]];
    return Number.isFinite(current) && Math.abs(value / 100 - current) <= .2;
  }) ? id : null;
}

function gpmIdeologyLawTarget(platform, lawId, current, year) {
  const target = platform?.laws?.[lawId];
  if (target === undefined || lawId !== "coal_phaseout_deadline") return target;
  const deadline = Math.max(target, (Number.isFinite(year) ? year : 2026) + 10);
  return current > 0 ? Math.min(current, deadline) : deadline <= 2100 ? deadline : undefined;
}

function gpmUprisingProfile(party, presets = gpmPresets) {
  const axis = id => {
    const value = party?.ideology?.[id];
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  };
  const econ = axis("econ");
  const social = axis("social");
  const gov = axis("gov");
  const nat = axis("nat");
  // The founding preset helps distinguish ideologies with similar scores, while
  // a materially changed party uses its current positions.
  const preset = gpmActiveIdeologyPreset(party, presets);
  if (Object.hasOwn(gpmUprisingPresetReforms, preset)) {
    return { preset, econ, gov, nat, social, ...gpmUprisingPresetReforms[preset] };
  }
  const newRegimes = {
    islamicDemocracy: "islamic_democracy",
    islamicRepublican: "islamic_republic",
    islamicFundamentalist: "islamic_emirate",
    fascist: "fascist_party_state",
    nationalSocialist: "national_socialist_party_state",
    clericalFascist: "clerical_fascist_party_state",
    maoist: "maoist_party_state",
    democraticConfederalist: "democratic_confederation",
    anarchoSyndicalist: "syndicalist_federation",
    ecosocialist: "ecosocialist_republic",
  };
  let regime = Object.hasOwn(newRegimes, preset) ? newRegimes[preset] : null;
  if (regime) {
    const fascistPartyState = ["fascist", "nationalSocialist", "clericalFascist"].includes(preset);
    const singleParty = fascistPartyState || regime === "maoist_party_state";
    const clerical = ["islamic_emirate", "islamic_republic"].includes(regime);
    const emirate = regime === "islamic_emirate";
    const confederal = ["democratic_confederation", "syndicalist_federation"].includes(regime);
    const labels = {
      islamic_democracy: "Islamic parliamentary democracy",
      islamic_republic: "Islamic republic",
      islamic_emirate: "Islamic emirate",
      fascist_party_state: "Fascist one-party state",
      national_socialist_party_state: "National Socialist one-party state",
      clerical_fascist_party_state: "Clerical Fascist one-party state",
      maoist_party_state: "Maoist revolutionary state",
      democratic_confederation: "Democratic confederation",
      syndicalist_federation: "Federation of worker councils",
      ecosocialist_republic: "Ecosocialist parliamentary republic",
    };
    return {
      preset, econ, gov, nat, social, regime, singleParty, label: labels[regime],
      ceremonial: !singleParty && !clerical,
      headSelection: singleParty ? "party" : clerical ? "clerical" : "elected",
      headGovExists: Number(!singleParty && !emirate),
      ...(!singleParty && !clerical ? { headBallot: "parliament" } : {}),
      ...(!singleParty && !emirate ? { headGovSelection: "parliament" } : {}),
      cabinetAccountability: singleParty || emirate ? "head" : "parliament",
      parliamentPower: emirate || fascistPartyState ? "advisory" : "sovereign",
      partyLegality: singleParty ? .1 : emirate ? .15 : clerical ? .55 : .95,
      execConstraints: singleParty || emirate ? .15 : clerical ? .5 : .85,
      commissionIndep: singleParty || emirate ? .2 : clerical ? .55 : .9,
      suffrage: singleParty || emirate ? .55 : clerical ? .75 : .95,
      emergencyPowers: singleParty || emirate ? "broad" : "limited",
      dissolutionPower: singleParty || clerical ? "none" : "constructive",
      judicialReview: !singleParty && !emirate,
      ...(confederal ? { stateStructure: "confederal" } : {}),
    };
  }
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

module.exports = {
  workerFunctions: [`const gpmUprisingPresetReforms = ${JSON.stringify(gpmUprisingPresetReforms)};`,
    gpmActiveIdeologyPreset, gpmIdeologyLawTarget, gpmUprisingProfile],
  gpmActiveIdeologyPreset, gpmIdeologyLawTarget, gpmUprisingProfile,
};
