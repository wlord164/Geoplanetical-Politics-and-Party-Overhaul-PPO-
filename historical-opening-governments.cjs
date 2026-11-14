"use strict";

const yemenControl = "https://sanaacenter.org/the-yemen-review/oct-dec-2025/26133";
const houthis = "ucdp-actor-123";
const plc = "ucdp-actor-6254";
const stc = "ucdp-actor-7344";

const subdivided = {
  "myanmar-arakan-conflict": {
    title: "Arakkha Revolutionary Government", partyTag: "ULA", mapName: "Arakan Army",
    administration: "Arakkha People’s Revolutionary Government",
    color: "#9d7245", reform: { stateStructure: "decentralized", judicialReview: true },
  },
  "myanmar-kachin-conflict": {
    title: "Kachin Independence Organization", partyTag: "KIO", mapName: "Kachin Independence Army",
    color: "#519475", reform: { stateStructure: "decentralized" },
  },
  "myanmar-chin-conflict": {
    title: "Chinland Council and Government", partyTag: "CNF", mapName: "Chinland Council",
    color: "#9074a7", regime: "federal_parliamentary",
  },
  "myanmar-karen-conflict": {
    title: "Karen National Union", partyTag: "KNU", mapName: "Karen National Union",
    color: "#5d80ad", regime: "federal_parliamentary",
  },
  "ucdp-state-17740": {
    title: "AFC/M23 Parallel Administration", partyTag: "AFC/M23", mapName: "AFC/M23",
    color: "#8e764f", regime: "provisional_council", reform: { headGovExists: 0 },
  },
  "syr-suwayda-government": {
    title: "Suwayda Local Administration", partyTag: "SNG", mapName: "Suwayda National Guard",
    color: "#9d5f73", reform: { headGovExists: 0, judicialReview: true },
  },
  "ucdp-state-14784": {
    title: "North and East Syria Administration", partyTag: "DAANES", mapName: "AANES",
    administration: "Democratic Autonomous Administration of North and East Syria",
    color: "#638c7d", regime: "federal_parliamentary", reform: { stateStructure: "decentralized" },
  },
};

const openingAreas = [
  { ...require("./historical-arakan-opening-area.json"), id: "arakan-rakhine",
    frontId: "myanmar-arakan-conflict", name: "Arakan Townships" },
  ...require("./historical-kivu-opening-areas.json"),
  ...require("./historical-myanmar-town-opening-areas.json"),
  ...require("./historical-syria-town-opening-areas.json"),
];

const governments = {
  "ucdp-state-14595": {
    parentKey: "887", parentActorId: plc, actorId: houthis, title: "Government of Change and Construction",
    provinceKeys: ["YEM-3498", "YEM-3496", "YEM-152", "YEM-155", "YEM-153", "YEM-156", "YEM-3499", "YEM-333"],
    replacementCapitalKey: "YEM-3510", startDate: "2014-09-21", regime: "islamic_republic",
    partyName: "Ansar Allah", partyTag: "AA", mapName: "Ansar Allah", color: "#71794a",
    laws: {
      religion_state: 3, freedom_of_worship: 1, religious_funding: 5, religion_in_education: 5,
      media_freedom: { press: "muzzled", internet: "censored" },
    },
    sources: [yemenControl, "https://warwatch.ch/situations/armed-conflicts-in-yemen/classification/",
      "https://www.uscirf.gov/sites/default/files/2025-08/2025%20Factsheet%20Houthi.pdf",
      "https://digitallibrary.un.org/record/4004108/files/S_2023_130-EN.pdf"],
  },
  "ucdp-nonstate-15915": {
    parentKey: "887", parentActorId: plc, actorId: stc, title: "Southern Transitional Council",
    provinceKeys: ["YEM-332", "YEM-336"], startDate: "2025-12-02", regime: "provisional_council",
    partyTag: "STC", color: "#54799e", reform: { headGovExists: 0, upperChamber: true, bicameralRelation: "asymmetric" },
    sources: [yemenControl, "https://osesgy.unmissions.org/en/node/77743",
      "https://en.stcaden.com/posts/11062", "https://en.stcaden.com/posts/11523"],
  },
  "libya-national-truce": {
    parentKey: "434", parentActorId: "libya-gnu", actorId: "libya-gns", title: "Government of National Stability",
    provinceKeys: ["LBY-2984"], regime: "provisional_council", partyTag: "GNS",
    mapName: "Government of National Stability", color: "#8c6b9d",
    reform: { headGovExists: 0, judicialReview: true },
    sources: ["https://digitallibrary.un.org/record/4073810/files/S_2024_914-EN.pdf",
      "https://unsmil.unmissions.org/en/node/134165",
      "https://www.everycrsreport.com/files/2025-05-22_IF11556_9b7350b3ce107ebd99e8bbb0de8297b78481cca3.pdf"],
  },
  "ucdp-state-750": {
    parentKey: "706", parentActorId: "ucdp-actor-95", actorId: "ucdp-actor-717", title: "Al-Shabaab Administration",
    provinceKeys: ["SOM-2315"], startDate: "2006-01-01", regime: "islamic_emirate", partyTag: "AS", color: "#746850",
    laws: {
      religion_state: 4, freedom_of_worship: 1, religious_funding: 5, religion_in_education: 5,
      death_penalty: "ordinary_crimes", same_sex_status: "capital",
    },
    sources: ["https://dip-aws.euaa.europa.eu/coi/somalia/2025/security-situation/21-jubbaland/212-middle-juba",
      "https://www.ris.bka.gv.at/Dokumente/Bvwg/BVWGT_20260107_W268_2309024_1_00/BVWGT_20260107_W268_2309024_1_00.html",
      "https://www.euaa.europa.eu/country-guidance-somalia/security-situation-recent-events",
      "https://www.euaa.europa.eu/country-guidance-somalia/34-individuals-refusing-pay-taxes-al-shabaab",
      "https://digitallibrary.un.org/record/4046158"],
  },
};

const contested = {
  "ucdp-state-14595": [
    ...["YEM-150", "YEM-154", "YEM-151"].map(key => ({
      key, dominantActorId: houthis, secondaryActorId: plc, source: yemenControl,
      note: "Ansar Allah governed much of this governorate. Its stock boundary includes areas held by other forces.",
    })),
    ...["YEM-335", "YEM-337", "YEM-158", "YEM-334", "YEM-157"].map(key => ({
      key, source: yemenControl, note: "The stock governorate includes more than one wartime authority.",
    })),
  ],
  "ucdp-nonstate-15915": [
    ...["YEM-3497", "YEM-3510"].map(key => ({
      key, dominantActorId: stc, secondaryActorId: plc, source: yemenControl,
      note: "The STC held main centers in December. Rival forces and overlapping civil authority prevent a whole-governorate assignment.",
    })),
  ],
  "ucdp-state-17740": [
    { key: "COD-1898", source: "https://digitallibrary.un.org/record/4085466/files/S_2025_446-EN.pdf",
      note: "The AFC/M23 parallel administration governed Goma and other areas. The stock province also includes territory outside its administration." },
    { key: "COD-1894", source: "https://digitallibrary.un.org/record/4085466/files/S_2025_446-EN.pdf",
      note: "The AFC/M23 parallel administration governed Bukavu and other areas. The stock province also includes territory outside its administration." },
  ],
};

function addSubdividedGovernments(catalog) {
  return Object.fromEntries(Object.entries(subdivided).map(([frontId, government]) => {
    const front = catalog.conflicts.find(conflict => conflict.id === frontId);
    const areas = openingAreas.filter(area => area.frontId === frontId);
    const actorId = areas[0]?.actorId;
    if (!front || !areas.every(area => area.actorId === actorId)) {
      throw new Error("Invalid subdivided historical government " + frontId);
    }
    const actor = catalog.actors[actorId];
    const opposing = front.sides.find(side => !side.includes(actorId));
    const victory = catalog.victories[frontId]?.[actorId];
    return [frontId, {
      parentKey: actor.countryKey, actorId, parentActorId: opposing[0],
      provinceKeys: areas.map(area => "PPO-" + area.id.toUpperCase()),
      provinceNames: Object.fromEntries(areas.map(area => ["PPO-" + area.id.toUpperCase(), area.name])),
      regime: "regional_council", laws: victory?.laws, ...government,
      subdivided: true, sources: front.sources,
    }];
  }));
}

module.exports = { governments, contested, addSubdividedGovernments };
