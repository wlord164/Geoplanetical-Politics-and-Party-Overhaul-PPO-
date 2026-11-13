"use strict";

const presets = {
  center: { label: "Centrist", values: [0, 0, 0, 0] },
  socialDemocrat: { label: "Social Democrat", values: [-35, -40, -40, -20] },
  democraticSocialist: { label: "Democratic Socialist", values: [-75, -45, -55, -30] },
  councilCommunist: { label: "Council Communist", values: [-100, -65, -75, -55] },
  anarchoCommunist: { label: "Anarcho-Communist", values: [-100, -95, -100, -90] },
  marxistLeninist: { label: "Marxist–Leninist", values: [-95, -25, 80, -45] },
  hardlineStateSocialist: { label: "Hardline State Socialist", values: [-100, 0, 100, -15] },
  leftNationalist: { label: "Left Nationalist", values: [-65, 0, 40, 75] },
  green: { label: "Green", values: [-35, -80, -55, -60] },
  classicalLiberal: { label: "Classical Liberal", values: [75, -20, -70, -35] },
  anarchoCapitalist: { label: "Anarcho-Capitalist", values: [100, 0, -100, -35] },
  liberalConservative: { label: "Liberal Conservative", values: [55, 55, -45, 20] },
  conservative: { label: "Conservative", values: [40, 60, 10, 30] },
  paternalistConservative: { label: "Paternalist Conservative", values: [-20, 65, 15, 45] },
  nationalConservative: { label: "National Conservative", values: [30, 75, 40, 80] },
  religiousTraditionalist: { label: "Religious Traditionalist", values: [0, 100, 75, 30] },
  corporatistNationalist: { label: "Corporatist Nationalist", values: [-35, 85, 85, 90] },
  authoritarianUltranationalist: { label: "Authoritarian Ultranationalist", values: [0, 95, 100, 100] },
  islamicDemocracy: {
    label: "Islamic Democracy", values: [-10, 50, -65, 15],
    program: "Islamic-inspired policy under competitive elections and constitutional limits.",
    laws: { religion_state: 2, freedom_of_worship: 4 },
  },
  islamicRepublican: {
    label: "Islamic Republicanism", values: [-15, 70, 55, 30],
    program: "A confessional republic with separate religious and parliamentary offices and judicial review.",
    laws: { religion_state: 3, freedom_of_worship: 3 },
  },
  islamicFundamentalist: {
    label: "Islamic Fundamentalism", values: [-15, 100, 95, 20],
    program: "An executive religious authority and the supremacy of its interpretation of Islamic law.",
    laws: { religion_state: 4, freedom_of_worship: 1, religion_in_education: 5 },
  },
  fascist: {
    label: "Fascism", values: [-30, 85, 100, 100],
    program: "A leader-centered one-party state with official unions and restrictions on strikes and the press.",
    laws: { union_freedom: "official", strike_right: "restricted", media_freedom: { press: "muzzled", internet: "censored" } },
  },
  maoist: {
    label: "Maoism", values: [-100, -30, 85, 35],
    program: "A revolutionary party government, agrarian redistribution and expropriation powers.",
    laws: { land_tenure: "redistribution", regime_propriete: "expropriation_allowed" },
  },
  democraticConfederalist: {
    label: "Democratic Confederalism", values: [-75, -90, -90, -65],
    program: "Local assemblies share authority in a confederation with strong civil protections.",
    laws: { religion_state: 0, freedom_of_worship: 4, media_freedom: { press: "free", internet: "open" } },
  },
  anarchoSyndicalist: {
    label: "Anarcho-Syndicalism", values: [-95, -75, -95, -70],
    program: "Federated worker-run unions, workplace self-management and protected industrial action.",
    laws: { union_freedom: "free", strike_right: "protected" },
  },
  ecosocialist: {
    label: "Ecosocialism", values: [-80, -80, -60, -45],
    program: "Pluralist government, public or cooperative ownership and an accelerated coal phase-out.",
    laws: { electricity_market: "state_monopoly", coal_phaseout_deadline: 2040 },
  },
};

module.exports = presets;
