"use strict";

function gpmUprisingCountryRoot(countryKey, countryName) {
  // Some game labels name a state form, omit part of the polity, or collide
  // with the short name of another state. These forms identify the territory.
  const distinctNames = {
    "032": "Argentina",
    "104": "Myanmar",
    "140": "the Central African Republic",
    "158": "Taiwan",
    "178": "Congo-Brazzaville",
    "180": "Congo-Kinshasa",
    "203": "Czechia",
    "214": "the Dominican Republic",
    "250": "France",
    "266": "Gabon",
    "300": "Greece",
    "336": "Vatican City",
    "344": "Hong Kong",
    "446": "Macao",
    "380": "Italy",
    "408": "North Korea",
    "410": "South Korea",
    "417": "Kyrgyzstan",
    "418": "Laos",
    "422": "Lebanon",
    "484": "Mexico",
    "583": "Micronesia",
    "620": "Portugal",
    "643": "Russia",
    "703": "Slovakia",
    "756": "Switzerland",
    "760": "Syria",
    "768": "Togo",
    "784": "the Emirates",
    "826": "Great Britain and Northern Ireland",
    "840": "the United States",
    "858": "Uruguay",
    "n:N. Cyprus": "Northern Cyprus",
  };
  const key = String(countryKey).padStart(3, "0");
  if (Object.hasOwn(distinctNames, key)) return distinctNames[key];
  const title = String(countryName || "").trim();
  const root = title.replace(
    /^(?:(?:People['’]s|Democratic|Socialist|Islamic|Arab|Federal|Federative|Plurinational|Bolivarian|Co-operative|Independent|United|Hashemite|Turkish)\s+)*(?:Republic|Kingdom|Emirate|State|Sultanate|Commonwealth|Territory|Grand Duchy|Principality|Bailiwick|Union|Federation)\s+of\s+/iu,
    ""
  );
  // A lexical article remains part of the name, but "of The Netherlands"
  // should use the ordinary mid-sentence capitalization.
  return (root || title || String(countryKey)).replace(/^The\s+/u, "the ");
}

function gpmUprisingIdentity(countryKey, countryName, profile, seed) {
  const root = gpmUprisingCountryRoot(countryKey, countryName);
  const { preset, regime, econ = 0, gov = 0, nat = 0, social = 0 } = profile || {};
  const key = String(countryKey).padStart(3, "0");
  let name;
  if (regime === "socialist_single_party") {
    name = preset === "hardlineStateSocialist"
      ? "Socialist Republic of " + root
      : "Democratic People's Republic of " + root;
  } else if (regime === "nationalist_single_party") {
    name = key === "422" ? "Lebanese National Republic" : "National Republic of " + root;
  } else if (regime === "theocracy") {
    name = "Religious Commonwealth of " + root;
  } else if (regime === "council_republic") {
    name = preset === "anarchoCommunist" ? "Free Communes of " + root : "Council Republic of " + root;
  } else if (regime === "decentralized_republic") {
    name = "Free Confederation of " + root;
  } else if (key === "156" && ["parliamentary_republic", "presidential_republic"].includes(regime) && gov < .45) {
    name = "Democratic Republic of China";
  } else if (preset === "democraticSocialist" || (econ <= -.65 && gov < 0)) {
    name = "Democratic Socialist Republic of " + root;
  } else if (preset === "green") {
    name = "Republic of " + root;
  } else if (preset === "socialDemocrat" || (econ <= -.3 && gov <= -.35 && social < 0)) {
    name = "Social Republic of " + root;
  } else if (preset === "leftNationalist" || (econ <= -.45 && nat >= .6)) {
    name = "Popular Republic of " + root;
  } else if (nat >= .6) {
    name = "National Republic of " + root;
  } else if (gov <= -.45 || preset === "liberalConservative") {
    name = "Constitutional Republic of " + root;
  } else if (social >= .4) {
    name = "Constitutional Republic of " + root;
  } else if (regime === "presidential_republic") {
    name = "Presidential Republic of " + root;
  } else {
    name = "Democratic Republic of " + root;
  }
  const adjective = { "140": "Central African", "214": "Dominican" }[key];
  const countryAliases = {
    "070": "Bosnia-Herzegovina",
    "239": "South Georgia",
    "260": "French Antarctica",
    "334": "Heard–McDonald Is.",
    "580": "Northern Marianas",
    "584": "Marshall Islands",
    "612": "Pitcairn Islands",
    "654": "St Helena & Dependencies",
    "659": "St Kitts and Nevis",
    "666": "St Pierre & Miquelon",
    "670": "St Vincent & Grenadines",
    "796": "Turks and Caicos",
    "826": "Britain & N. Ireland",
    "850": "U.S. Virgin Is.",
    "n:Indian Ocean Ter.": "Christmas & Cocos Is.",
  };
  const isChinaDemocratic = name === "Democratic Republic of China";
  const place = adjective || countryAliases[key] || root;
  const subject = place.charAt(0).toUpperCase() + place.slice(1);
  const countryForm = form => adjective ? adjective + " " + form : form + " of " + place;
  let variants;
  switch (regime) {
    case "socialist_single_party":
      variants = [countryForm("Socialist Republic"), countryForm("People's Republic"),
        countryForm("Socialist State"), subject + " Socialist Republic"];
      break;
    case "nationalist_single_party":
      variants = [countryForm("National Republic"), countryForm("National State"),
        subject + " National Republic", countryForm("State")];
      break;
    case "theocracy":
      variants = [countryForm("Religious State"), countryForm("Confessional Republic"),
        countryForm("Commonwealth"), subject + " Religious Republic"];
      break;
    case "council_republic":
      variants = [countryForm("Council Republic"), countryForm("Free Communes"),
        countryForm("Federation of Communes"), subject + " Council Republic"];
      break;
    case "decentralized_republic":
      variants = [countryForm("Free Confederation"), countryForm("Federation"),
        countryForm("Confederation"), subject + " Federal Republic"];
      break;
    default:
      if (preset === "green") {
        variants = [countryForm("Republic"), countryForm("Democratic Republic"),
          subject + " Federal Republic", countryForm("Commonwealth")];
      } else if (econ <= -.65 || preset === "democraticSocialist") {
        variants = [countryForm("Socialist Republic"), subject + " Socialist Republic",
          countryForm("Democratic Republic"), countryForm("People's Republic")];
      } else if (econ <= -.3 || ["leftNationalist", "socialDemocrat"].includes(preset)) {
        variants = [countryForm("Social Republic"), countryForm("Democratic Republic"),
          countryForm("Popular Republic"), subject + " Social Republic"];
      } else if (nat >= .6) {
        variants = [countryForm("National Republic"), countryForm("Republic"),
          subject + " National Republic", subject + " Federal Republic"];
      } else if (gov <= -.45 || preset === "liberalConservative") {
        variants = [countryForm("Democratic Republic"), countryForm("Commonwealth"),
          countryForm("Constitutional Republic"), subject + " Federal Republic"];
      } else {
        variants = [countryForm("Republic"), countryForm("Commonwealth"),
          countryForm("Democratic Republic"), subject + " Federal Republic"];
      }
  }
  const stateForm = name.slice(0, name.lastIndexOf(" of " + root));
  if (adjective) name = adjective + " " + stateForm;
  else if (name.length > 40 && stateForm && place !== root) name = countryForm(stateForm);
  const parent = String(countryName || "").trim();
  const options = [];
  for (let candidate of [name, ...variants]) {
    if (candidate.localeCompare(parent, "en", { sensitivity: "base" }) === 0) {
      candidate = "Provisional " + candidate;
    }
    if (candidate.length <= 40 && !options.includes(candidate)) options.push(candidate);
  }
  if (!options.length) {
    // Preserve whole words for a long custom name the built-in aliases cannot cover.
    const words = place.match(/\p{L}[\p{L}\p{M}'’-]*/gu) || [];
    const shortName = words.reduce((part, word) => {
      const next = part ? part + " " + word : word;
      return next.length <= 27 ? next : part;
    }, "");
    options.push(shortName ? "Republic of " + shortName : "Provisional Republic");
  }
  const seeded = Number.isFinite(seed) && !isChinaDemocratic;
  const index = seeded ? (Math.trunc(seed) >>> 0) % options.length : 0;
  return { name: options[index], alternatives: options.filter((_, i) => i !== index) };
}

module.exports = { workerFunctions: [gpmUprisingCountryRoot, gpmUprisingIdentity] };