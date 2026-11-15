"use strict";

const doctrines = {
  centrist: {
    family: "centre", label: "Centrist",
    description: "Balances a mixed economy and social insurance within competitive elections.",
    axes: { econ: 0, social: 0, gov: 0, nat: 0 },
    positions: { economicControl: .2, socialInsurance: .25, independentLabor: .4, competition: 1 },
  },
  mixedEconomyCentrist: {
    family: "centre", label: "Social Liberalism",
    description: "Supports public and private provision alongside broad social insurance.",
    axes: { econ: -.2, social: -.05, gov: -.15, nat: -.05 },
    positions: { economicControl: -.4, socialInsurance: 1, independentLabor: .65, competition: 1 },
  },
  marketCentrist: {
    family: "centre", label: "Market Liberalism",
    description: "Prioritizes enterprise autonomy and competitive markets, with targeted social insurance.",
    axes: { econ: .28, social: -.05, gov: -.18, nat: -.05 },
    positions: { economicControl: .9, socialInsurance: -.6, independentLabor: .2, competition: 1 },
  },
  liberalCentrist: {
    family: "centre", label: "Constitutional Liberalism",
    description: "Prioritizes civil liberties, independent unions, and checks on executive power.",
    axes: { econ: .02, social: -.42, gov: -.55, nat: -.10 },
    positions: { economicControl: .25, socialInsurance: .2, independentLabor: 1, competition: 1 },
  },
  orthodoxMarxistLeninist: {
    family: "marxistLeninist", label: "Orthodox Marxist–Leninist",
    description: "Keeps the party in control of the state and favors public ownership and central production planning.",
    axes: { econ: -.95, social: -.25, gov: .8, nat: -.45 },
    positions: { economicControl: -1, socialInsurance: 1, independentLabor: -.8, competition: -1 },
  },
  reformistMarxistLeninist: {
    family: "marxistLeninist", label: "Reformist Marxist–Leninist",
    description: "Keeps party control while giving enterprises more autonomy and using regulated markets.",
    axes: { econ: -.48, social: -.22, gov: .64, nat: -.20 },
    positions: { economicControl: 1, socialInsurance: .6, independentLabor: -.45, competition: -1 },
  },
  councilCommunist: {
    family: "councilCommunism", label: "Council Communist",
    description: "Gives elected worker councils political authority and protects independent worker organization and public debate.",
    axes: { econ: -1, social: -.65, gov: -.75, nat: -.55 },
    positions: { economicControl: -.75, independentLabor: 1, councilAutonomy: 1, competition: .75 },
  },
  maoist: {
    family: "maoism", label: "Maoism",
    description: "Favors revolutionary party rule, agrarian redistribution, and uncompensated expropriation.",
    axes: { econ: -1, social: -.30, gov: .85, nat: .35 },
    positions: { economicControl: -1, independentLabor: -.8, agrarianRedistribution: 1, competition: -1 },
  },
  anarchoSyndicalist: {
    family: "anarchoSyndicalism", label: "Anarcho-Syndicalism",
    description: "Builds political authority through federated worker-run unions, with workplace self-management and protected strikes.",
    axes: { econ: -.95, social: -.75, gov: -.95, nat: -.70 },
    positions: { economicControl: -.7, independentLabor: 1, unionAutonomy: 1, competition: .85 },
  },
  centralistFascist: {
    family: "fascist", label: "Fascism",
    description: "Favors leader-centered one-party rule, direct production controls, and official unions.",
    axes: { econ: -.3, social: .85, gov: 1, nat: 1 },
    positions: { economicControl: -1, independentLabor: -1, laborRepresentation: -1, competition: -1 },
  },
  corporatistFascist: {
    family: "fascist", label: "Corporatist Fascist",
    description: "Favors regulated private industry under one-party rule, with worker representation limited to official unions.",
    axes: { econ: .05, social: .79, gov: .75, nat: .88 },
    positions: { economicControl: .7, independentLabor: -1, laborRepresentation: -.5, competition: -1 },
  },
  conservativeCorporatist: {
    family: "conservativeCorporatism", label: "Conservative Corporatist",
    description: "Favors bargaining by industry through licensed employer and worker organizations under state oversight.",
    axes: { econ: -.35, social: .85, gov: .85, nat: .9 },
    positions: { economicControl: .25, independentLabor: -.7, laborRepresentation: 1, competition: -.6 },
  },
  electoralRadicalRight: {
    family: "electoralRadicalRight", label: "Electoral Radical Right",
    description: "Favors tighter citizenship rules and a stronger elected executive under competitive multiparty elections.",
    axes: { econ: .12, social: .65, gov: .4, nat: .92 },
    positions: { economicControl: .4, competition: 1, nationalMembership: -1 },
  },
};

const proposals = {
  centreBroadInsurance: {
    family: "centre", label: "Broad social insurance", issue: "socialInsurance", issueLabel: "Social insurance", value: 1,
    laws: ["unemployment_insurance", "family_allowance", "paid_parental_leave"],
  },
  centreCompetitiveMarkets: {
    family: "centre", label: "Competitive markets", issue: "economicControl", issueLabel: "Economic organization", value: 1,
    laws: ["electricity_market", "regime_propriete"],
    lawTargets: { electricity_market: "regulated_competition", regime_propriete: "full_compensation" },
  },
  centreIndependentLabour: {
    family: "centre", label: "Independent unions and strike rights", issue: "independentLabor", issueLabel: "Independent labor", value: 1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "free", strike_right: "protected" },
  },
  marxistStatePlanning: {
    family: "marxistLeninist", label: "State production planning", issue: "economicControl", issueLabel: "Economic organization", value: -1,
    laws: ["electricity_market", "regime_propriete"],
    lawTargets: { electricity_market: "state_monopoly", regime_propriete: "expropriation_allowed" },
  },
  marxistEnterpriseAutonomy: {
    family: "marxistLeninist", label: "Enterprise autonomy", issue: "economicControl", issueLabel: "Economic organization", value: 1,
    laws: ["electricity_market", "regime_propriete"],
    lawTargets: { electricity_market: "regulated_competition", regime_propriete: "full_compensation" },
  },
  councilCivilProtections: {
    family: "councilCommunism", label: "Protect council speech and association",
    issue: "councilAutonomy", issueLabel: "Council autonomy", value: 1,
    laws: ["media_freedom", "union_freedom"],
    lawTargets: { media_freedom: { press: "free", internet: "open" }, union_freedom: "free" },
  },
  maoistAgrarianRedistribution: {
    family: "maoism", label: "Redistribute agricultural land",
    issue: "agrarianRedistribution", issueLabel: "Agrarian redistribution", value: 1,
    laws: ["land_tenure", "regime_propriete"],
    lawTargets: { land_tenure: "redistribution", regime_propriete: "expropriation_allowed" },
  },
  syndicalistIndustrialFreedom: {
    family: "anarchoSyndicalism", label: "Protect independent unions and strikes",
    issue: "unionAutonomy", issueLabel: "Union autonomy", value: 1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "free", strike_right: "protected" },
  },
  fascistCentralProduction: {
    family: "fascist", label: "Central production controls", issue: "economicControl", issueLabel: "Economic organization", value: -1,
    laws: ["electricity_market", "regime_propriete"],
    lawTargets: { electricity_market: "state_monopoly", regime_propriete: "expropriation_allowed" },
  },
  fascistRegulatedIndustry: {
    family: "fascist", label: "Regulated private industry", issue: "economicControl", issueLabel: "Economic organization", value: 1,
    laws: ["electricity_market", "regime_propriete"],
    lawTargets: { electricity_market: "regulated_competition", regime_propriete: "full_compensation" },
  },
  fascistOfficialUnions: {
    family: "fascist", label: "Party-approved unions", issue: "laborRepresentation", issueLabel: "Labor representation", value: -1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "official", strike_right: "restricted" },
  },
  corporatistSectorBargaining: {
    family: "conservativeCorporatism", label: "Licensed sector bargaining", issue: "laborRepresentation", issueLabel: "Labor representation", value: 1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "licensed", strike_right: "regulated" },
  },
  corporatistOfficialUnion: {
    family: "conservativeCorporatism", label: "Single official union", issue: "laborRepresentation", issueLabel: "Labor representation", value: -1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "official", strike_right: "restricted" },
  },
  electoralRestrictiveCitizenship: {
    family: "electoralRadicalRight", label: "Tighten citizenship eligibility", issue: "nationalMembership", issueLabel: "Citizenship eligibility", value: -1,
    laws: ["nationality_law"],
    lawTargets: { nationality_law: { birthright: "none", residenceYears: 15, dualCitizenship: false } },
  },
  electoralCitizenshipAccess: {
    family: "electoralRadicalRight", label: "Expand access to citizenship", issue: "nationalMembership", issueLabel: "Citizenship eligibility", value: 1,
    laws: ["nationality_law"],
    lawTargets: { nationality_law: { birthright: "conditional", residenceYears: 5, dualCitizenship: true } },
  },
};

function gpmCongressDoctrine(id) {
  const doctrine = Object.hasOwn(gpmCongressDoctrines, id) ? gpmCongressDoctrines[id] : null;
  return doctrine ? { id, ...doctrine } : null;
}

module.exports = {
  doctrines,
  proposals,
  sharedFunctions: [
    "const gpmCongressDoctrines = " + JSON.stringify(doctrines) + ";",
    "const gpmCongressDoctrineProposals = " + JSON.stringify(proposals) + ";",
    gpmCongressDoctrine,
  ],
};
