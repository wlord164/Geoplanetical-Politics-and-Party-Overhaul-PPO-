"use strict";

const { doctrines } = require("./party-congress-doctrines.cjs");
const presets = require("./party-ideology-presets.cjs");

const namedColors = {
  "Left Nationalism": "#e27d75",
  "Civic Nationalism": "#a2b5d4",
  "Left Conservatism": "#bb7982",
  "Economic Nationalism": "#c8845d",
  "Integral Nationalism": "#a27656",
  "National Conservative": "#9b8ec0",
  "Authoritarian Nationalist": "#a17a68",
  "Liberal Nationalist": "#b0aad6",
  "Market Nationalist": "#ae9a58",
  Nationalist: "#b6a085",
  "Conservative Socialism": "#cd786e",
  "Authoritarian Socialist": "#cf5e67",
  "Authoritarian Capitalist": "#a09560",
  "Authoritarian Conservative": "#7990aa",
  "Authoritarian Progressive": "#a587b3",
  "Authoritarian Centrist": "#d58854",
  "Paternalistic Conservatism": "#77a699",
  "Internationalist Socialist": "#de648a",
  "State Socialist": "#c95a58",
  "Social Democrat": "#ee8298",
  "Internationalist Left": "#d381a8",
  "Progressive Left": "#d699c6",
  "Centre-left": "#e6a7a8",
  "Liberal Conservative": "#83a8d3",
  "Market Conservative": "#6f9ec5",
  "Market Liberal": "#bbd4de",
  "Socially Liberal Right": "#b1a3d4",
  "Free-market Right": "#acbacb",
  "Centre-right": "#97b4d2",
  "Social Liberal": "#a2b4e1",
  Progressive: "#d785c1",
  "Social Conservative": "#88a2b5",
  Internationalism: "#88b7cb",
  "Democratic Socialist": "#e0716a",
  "Anarcho-Communist": "#b8779a",
  "Hardline State Socialist": "#cd5a72",
  "Left Nationalist": "#d68581",
  Green: "#9fc95f",
  "Classical Liberal": "#eee1c4",
  "Anarcho-Capitalist": "#d3bd5e",
  Conservative: "#7197c7",
  "Paternalist Conservative": "#81aea7",
  "Religious Traditionalist": "#a6a6ad",
  "Christian Democrat": "#c4b1c1",
  "Authoritarian Ultranationalist": "#1d2024",
  "Islamic Democracy": "#4ed7af",
  "Islamic Republicanism": "#57aa79",
  "Islamic Fundamentalism": "#7bbd76",
  Monarchy: "#ab7ce1",
  Monarchism: "#ab7ce1",
  Monarchist: "#ab7ce1",
  Royalism: "#bc92e4",
  Royalist: "#bc92e4",
  "Constitutional Monarchism": "#c2a6e7",
  "Constitutional Monarchy": "#c2a6e7",
  "Absolute Monarchism": "#9972c9",
  "Absolute Monarchy": "#9972c9",
  "Democratic Confederalism": "#ef9aab",
  Ecosocialism: "#b2c771",
};

const doctrineColors = {
  centrist: "#ed9f55",
  mixedEconomyCentrist: "#aba1dd",
  marketCentrist: "#aed0e7",
  liberalCentrist: "#c4a5eb",
  orthodoxMarxistLeninist: "#dc4955",
  reformistMarxistLeninist: "#f07f5d",
  councilCommunist: "#e26b80",
  maoist: "#bf5366",
  anarchoSyndicalist: "#ae7789",
  centralistFascist: "#8a5236",
  corporatistFascist: "#39291f",
  nationalSocialist: "#000000",
  clericalFascist: "#85817e",
  conservativeCorporatist: "#be8b66",
  electoralRadicalRight: "#db954f",
  socialDemocrat: namedColors["Social Democrat"],
  democraticSocialist: namedColors["Democratic Socialist"],
  anarchoCommunist: namedColors["Anarcho-Communist"],
  hardlineStateSocialist: namedColors["Hardline State Socialist"],
  leftNationalist: namedColors["Left Nationalist"],
  green: namedColors.Green,
  classicalLiberal: namedColors["Classical Liberal"],
  anarchoCapitalist: namedColors["Anarcho-Capitalist"],
  liberalConservative: namedColors["Liberal Conservative"],
  conservative: namedColors.Conservative,
  paternalistConservative: namedColors["Paternalist Conservative"],
  nationalConservative: namedColors["National Conservative"],
  religiousTraditionalist: namedColors["Religious Traditionalist"],
  christianDemocrat: namedColors["Christian Democrat"],
  authoritarianUltranationalist: namedColors["Authoritarian Ultranationalist"],
  islamicDemocracy: namedColors["Islamic Democracy"],
  islamicRepublican: namedColors["Islamic Republicanism"],
  islamicFundamentalist: namedColors["Islamic Fundamentalism"],
  democraticConfederalist: namedColors["Democratic Confederalism"],
  ecosocialist: namedColors.Ecosocialism,
  trotskyist: "#e6539e",
  federalRepublican: "#548ce1",
  nasserist: "#4f9e83",
  baathist: "#b76c60",
  secularRepublican: "#70bdc6",
  constitutionalMonarchist: namedColors["Constitutional Monarchism"],
  agrarianPopulist: "#aba255",
  socialCorporatist: "#ac5471",
};

const outlinesByColor = {
  [doctrineColors.centralistFascist]: "#e4b699",
  [doctrineColors.corporatistFascist]: "#dcaa76",
  [doctrineColors.nationalSocialist]: "#f2eee8",
  [doctrineColors.clericalFascist]: "#dcd1bb",
  [namedColors["Authoritarian Ultranationalist"]]: "#c6ccd6",
};

function partyCongressColorName(value) {
  return (value || "").trim().toLowerCase().replace(/[–—−]/g, "-").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
}

const colorsByDisplayName = { ...namedColors };
for (const [id, color] of Object.entries(doctrineColors)) {
  if (doctrines[id]) colorsByDisplayName[doctrines[id].label] = color;
}
for (const preset of Object.values(presets)) {
  const color = doctrineColors[preset.congressDoctrine?.platform];
  if (!color) continue;
  for (const name of [preset.label, preset.ideologyLabel]) {
    if (name && !Object.hasOwn(colorsByDisplayName, name)) colorsByDisplayName[name] = color;
  }
}
const colorsByName = Object.fromEntries(Object.entries(colorsByDisplayName).map(([name, color]) => [partyCongressColorName(name), color]));

function partyCongressIdeologyColor(group) {
  const doctrine = group.doctrineId || (group.label?.startsWith("doctrine:") ? group.label.slice(9) : "");
  if (Object.hasOwn(gpmCongressDoctrineColors, doctrine)) return gpmCongressDoctrineColors[doctrine];
  const inferred = partyCongressColorName(partyCongressFactionLabel(group.label));
  const name = partyCongressColorName(group.displayLabel) || inferred;
  if (Object.hasOwn(gpmCongressNamedColors, name)) return gpmCongressNamedColors[name];

  let hash = 2166136261;
  for (const character of name || inferred || doctrine) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  const shade = hash >>> 0;
  if (/\b(?:islam|islamic|islamism|islamist|muslim)\b/.test(name)) {
    return "hsl(" + (130 + shade % 39) + ", 46%, 62%)";
  }
  if (/\b(?:monarchy|monarchism|monarchist|royalism|royalist)\b/.test(name)) {
    return "hsl(" + (265 + shade % 28) + ", 56%, 66%)";
  }
  if (/\b(?:religious|theocracy|theocratic|clerical|christian|catholic|protestant|jewish|judaism|hindu|hinduism|hindutva|buddhist|buddhism|sikh|sikhism|shinto)\b/.test(name)) {
    return "hsl(225, 5%, " + (59 + shade % 21) + "%)";
  }
  if (Object.hasOwn(gpmCongressNamedColors, inferred)) return gpmCongressNamedColors[inferred];
  return "hsl(" + (shade % 360) + ", 57%, 66%)";
}

module.exports = {
  colorsByDisplayName,
  outlinesByColor,
  rendererFunctions: [
    "const gpmCongressDoctrineColors = " + JSON.stringify(doctrineColors) + ";",
    "const gpmCongressNamedColors = " + JSON.stringify(colorsByName) + ";",
    "const gpmCongressColorOutlines = " + JSON.stringify(outlinesByColor) + ";",
    partyCongressColorName,
    partyCongressIdeologyColor,
  ],
};
