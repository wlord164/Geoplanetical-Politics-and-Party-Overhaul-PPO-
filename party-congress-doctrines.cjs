"use strict";

// Charter positions describe how each current wants its own party to operate.
const doctrines = {
  centrist: {
    family: "centre", label: "Centrist",
    description: "Accepts competitive elections, delegate ballots, and negotiated compromise between party branches.",
    axes: { econ: 0, social: 0, gov: 0, nat: 0 },
    positions: { economicControl: .2, socialInsurance: .25, independentLabor: .4, competition: 1, memberAuthority: .6, branchAutonomy: .1 },
  },
  mixedEconomyCentrist: {
    family: "centre", label: "Social Liberalism",
    description: "Couples broad social rights with equal participation, independent civic associations, and elected representation.",
    axes: { econ: -.2, social: -.05, gov: -.15, nat: -.05 },
    positions: { economicControl: -.4, socialInsurance: 1, independentLabor: .65, competition: 1, memberAuthority: 1, branchAutonomy: .4 },
  },
  marketCentrist: {
    family: "centre", label: "Market Liberalism",
    description: "Protects voluntary association and gives locally organized groups room to act alongside competitive markets.",
    axes: { econ: .28, social: -.05, gov: -.18, nat: -.05 },
    positions: { economicControl: .9, socialInsurance: -.6, independentLabor: .2, competition: 1, memberAuthority: .7, branchAutonomy: 1 },
  },
  liberalCentrist: {
    family: "centre", label: "Constitutional Liberalism",
    description: "Protects civil liberties, independent unions, elected representatives, and binding checks on executive power.",
    axes: { econ: .02, social: -.42, gov: -.55, nat: -.10 },
    positions: { economicControl: .25, socialInsurance: .2, independentLabor: 1, competition: 1, memberAuthority: 1, branchAutonomy: .75 },
  },
  orthodoxMarxistLeninist: {
    family: "marxistLeninist", label: "Orthodox Marxist–Leninist",
    description: "Keeps the party in control of the state and puts regional party appointments and production planning under central direction.",
    axes: { econ: -.95, social: -.25, gov: .8, nat: -.45 },
    positions: { economicControl: -1, socialInsurance: 1, independentLabor: -.8, competition: -1, memberAuthority: -.9, branchAutonomy: -1 },
  },
  reformistMarxistLeninist: {
    family: "marxistLeninist", label: "Reformist Marxist–Leninist",
    description: "Keeps the party in control of the state and favors elected party representatives, more autonomous branches, and enterprise autonomy.",
    axes: { econ: -.48, social: -.22, gov: .64, nat: -.20 },
    positions: { economicControl: 1, socialInsurance: .6, independentLabor: -.45, competition: -1, memberAuthority: .85, branchAutonomy: .8 },
  },
  councilCommunist: {
    family: "councilCommunism", label: "Council Communist",
    description: "Gives elected worker councils political authority and protects independent worker organization and public debate.",
    axes: { econ: -1, social: -.65, gov: -.75, nat: -.55 },
    positions: { economicControl: -.75, independentLabor: 1, councilAutonomy: 1, competition: .75, memberAuthority: 1, branchAutonomy: 1 },
  },
  maoist: {
    family: "maoism", label: "Maoism",
    description: "Organizes through rural mass participation under central party direction and prioritizes agrarian redistribution.",
    axes: { econ: -1, social: -.30, gov: .85, nat: .35 },
    positions: { economicControl: -1, independentLabor: -.8, agrarianRedistribution: 1, competition: -1, memberAuthority: .45, branchAutonomy: -.75 },
  },
  anarchoSyndicalist: {
    family: "anarchoSyndicalism", label: "Anarcho-Syndicalism",
    description: "Builds political authority through federated worker-run unions, with workplace self-management and protected strikes.",
    axes: { econ: -.95, social: -.75, gov: -.95, nat: -.70 },
    positions: { economicControl: -.7, independentLabor: 1, unionAutonomy: 1, competition: .85, memberAuthority: 1, branchAutonomy: 1 },
  },
  centralistFascist: {
    family: "fascist", label: "Fascism",
    description: "Favors leader-centered one-party rule, direct production controls, and official unions.",
    axes: { econ: -.3, social: .85, gov: 1, nat: 1 },
    positions: { economicControl: -1, independentLabor: -1, laborRepresentation: -1, competition: -1, memberAuthority: -1, branchAutonomy: -1 },
  },
  corporatistFascist: {
    family: "fascist", label: "Fascism · Regulated Enterprise", chartAs: "centralistFascist",
    description: "Favors regulated private industry under one-party rule, with worker representation limited to official unions.",
    axes: { econ: .05, social: .79, gov: .75, nat: .88 },
    positions: { economicControl: .7, independentLabor: -1, laborRepresentation: -.5, competition: -1, memberAuthority: -1, branchAutonomy: -1 },
  },
  nationalSocialist: {
    family: "nationalSocialism", label: "National Socialism", explicitOrganization: true,
    description: "A racial-nationalist doctrine that favors absolute party leadership, ancestry-based political exclusion, and suppression of independent media.",
    axes: { econ: -.22, social: .97, gov: 1, nat: 1 },
    positions: { competition: -1, independentLabor: -1, civilLiberties: -1, nationalMembership: -1,
      racializedCitizenship: 1, religiousAuthority: -.85, memberAuthority: -1, branchAutonomy: -1 },
  },
  clericalFascist: {
    family: "clericalFascism", label: "Clerical Fascism", explicitOrganization: true,
    description: "Favors a one-party state allied with an established church, confessional education, and state-supervised representation by industry.",
    axes: { econ: -.28, social: .98, gov: .94, nat: .82 },
    positions: { competition: -.95, independentLabor: -.75, laborRepresentation: 1, racializedCitizenship: -.2,
      religiousAuthority: 1, worshipFreedom: -.65, memberAuthority: -.8, branchAutonomy: -.65 },
  },
  conservativeCorporatist: {
    family: "conservativeCorporatism", label: "Conservative Corporatist",
    description: "Favors bargaining by industry through licensed employer and worker organizations under state oversight.",
    axes: { econ: -.35, social: .85, gov: .85, nat: .9 },
    positions: { economicControl: .25, independentLabor: -.7, laborRepresentation: 1, competition: -.6, memberAuthority: -.45, branchAutonomy: -.55 },
  },
  electoralRadicalRight: {
    family: "electoralRadicalRight", label: "Electoral Radical Right",
    description: "Favors tighter citizenship rules and a stronger elected executive under competitive multiparty elections.",
    axes: { econ: .12, social: .65, gov: .4, nat: .92 },
    positions: { economicControl: .4, competition: 1, nationalMembership: -1, memberAuthority: .8, branchAutonomy: -.65 },
  },
  socialDemocrat: {
    family: "socialDemocracy", label: "Social Democrat",
    description: "Seeks reform through competitive elections, elected party delegates, and bargaining with independent unions.",
    axes: { econ: -.35, social: -.4, gov: -.4, nat: -.2 },
    positions: { competition: 1, independentLabor: 1, socialInsurance: 1, memberAuthority: .85, branchAutonomy: .35 },
  },
  democraticSocialist: {
    family: "democraticSocialism", label: "Democratic Socialist",
    description: "Keeps multiparty elections and gives organized workers and cooperatives a governing role in the economy.",
    axes: { econ: -.75, social: -.45, gov: -.55, nat: -.3 },
    positions: { competition: 1, independentLabor: 1, economicControl: -.75, memberAuthority: 1, branchAutonomy: .8 },
  },
  anarchoCommunist: {
    family: "anarchoCommunism", label: "Anarcho-Communist",
    description: "Locates authority in freely federated communes with common stewardship and recallable delegates.",
    axes: { econ: -1, social: -.95, gov: -1, nat: -.9 },
    positions: { competition: .7, independentLabor: 1, economicControl: -.9, memberAuthority: 1, branchAutonomy: 1 },
  },
  hardlineStateSocialist: {
    family: "stateSocialism", label: "Hardline State Socialist",
    description: "Puts economic and political direction in centralized state institutions and favors party leadership appointments.",
    axes: { econ: -1, social: 0, gov: 1, nat: -.15 },
    positions: { competition: -.85, economicControl: -1, independentLabor: -.8, memberAuthority: -1, branchAutonomy: -1 },
  },
  leftNationalist: {
    family: "leftNationalism", label: "Left Nationalist",
    description: "Organizes around civic self-determination, domestic control of strategic institutions, and member representation.",
    axes: { econ: -.65, social: 0, gov: .4, nat: .75 },
    positions: { competition: .55, economicControl: -.8, nationalMembership: .4, memberAuthority: .65, branchAutonomy: -.45 },
  },
  green: {
    family: "greenPolitics", label: "Green",
    description: "Puts ecological stewardship and public accountability above short-term goals, with directly elected local delegates.",
    axes: { econ: -.35, social: -.8, gov: -.55, nat: -.6 },
    positions: { competition: 1, independentLabor: .7, memberAuthority: 1, branchAutonomy: 1 },
  },
  classicalLiberal: {
    family: "classicalLiberalism", label: "Classical Liberal",
    description: "Limits public power through constitutional courts, civil equality, freedom of association, and elected representatives.",
    axes: { econ: .75, social: -.2, gov: -.7, nat: -.35 },
    positions: { competition: 1, civilLiberties: 1, economicControl: .9, memberAuthority: .8, branchAutonomy: .7 },
  },
  anarchoCapitalist: {
    family: "anarchoCapitalism", label: "Anarcho-Capitalist",
    description: "Prefers voluntary private associations and adjudication, with autonomous local groups and no central party appointments.",
    axes: { econ: 1, social: 0, gov: -1, nat: -.35 },
    positions: { competition: .6, civilLiberties: .9, economicControl: 1, memberAuthority: .65, branchAutonomy: 1 },
  },
  liberalConservative: {
    family: "conservatism", label: "Liberal Conservative",
    description: "Combines gradual reform and inherited institutions with political pluralism and binding limits on executive power.",
    axes: { econ: .55, social: .55, gov: -.45, nat: .2 },
    positions: { competition: 1, civilLiberties: .8, economicControl: .7, memberAuthority: .85, branchAutonomy: .55 },
  },
  conservative: {
    family: "conservatism", label: "Conservative",
    description: "Preserves existing institutions through gradual reform, keeps electoral competition, and gives established branches a say.",
    axes: { econ: .4, social: .6, gov: .1, nat: .3 },
    positions: { competition: .85, economicControl: .5, memberAuthority: .6, branchAutonomy: .35 },
  },
  paternalistConservative: {
    family: "conservatism", label: "Paternalist Conservative",
    description: "Emphasizes social obligations and locally rooted civic bodies, with a national leadership responsible for party appointments.",
    axes: { econ: -.2, social: .65, gov: .15, nat: .45 },
    positions: { competition: .85, socialInsurance: .7, independentLabor: .3, memberAuthority: -.6, branchAutonomy: .7 },
  },
  nationalConservative: {
    family: "conservatism", label: "National Conservative",
    description: "Defends national sovereignty and inherited public institutions through elections and a disciplined national party.",
    axes: { econ: .3, social: .75, gov: .4, nat: .8 },
    positions: { competition: .8, nationalMembership: -.7, memberAuthority: .6, branchAutonomy: -.75 },
  },
  religiousTraditionalist: {
    family: "religiousTraditionalism", label: "Religious Traditionalist",
    description: "Defends the public role of established religious institutions and expects the party leadership to uphold their principles.",
    axes: { econ: 0, social: 1, gov: .75, nat: .3 },
    positions: { competition: .25, religiousAuthority: .6, memberAuthority: -.7, branchAutonomy: .55 },
  },
  christianDemocrat: {
    family: "christianDemocracy", label: "Christian Democrat",
    description: "Draws on Christian social teaching while protecting constitutional elections, freedom of worship, and autonomous local associations.",
    axes: { econ: -.12, social: .45, gov: -.25, nat: .15 },
    positions: { competition: 1, worshipFreedom: 1, socialInsurance: .65, memberAuthority: .8, branchAutonomy: 1 },
  },
  authoritarianUltranationalist: {
    family: "authoritarianUltranationalism", label: "Authoritarian Ultranationalist",
    description: "Subordinates organized opposition and regional party bodies to a strong executive claiming to embody national unity.",
    axes: { econ: 0, social: .95, gov: 1, nat: 1 },
    positions: { competition: -.85, nationalMembership: -.9, civilLiberties: -.85, memberAuthority: -1, branchAutonomy: -1 },
  },
  islamicDemocracy: {
    family: "islamicDemocracy", label: "Islamic Democracy",
    description: "Brings Islamic principles into political debate through competitive elections, civil oversight, and member-elected delegates.",
    axes: { econ: -.1, social: .5, gov: -.65, nat: .15 },
    positions: { competition: 1, worshipFreedom: 1, religiousAuthority: -.4, memberAuthority: 1, branchAutonomy: .65 },
  },
  islamicRepublican: {
    family: "islamicRepublicanism", label: "Islamic Republicanism",
    description: "Combines elected civil offices with a distinct religious authority reviewing legislation and public appointments.",
    axes: { econ: -.15, social: .7, gov: .55, nat: .3 },
    positions: { competition: .4, worshipFreedom: .25, religiousAuthority: .65, memberAuthority: .6, branchAutonomy: -.7 },
  },
  islamicFundamentalist: {
    family: "islamicFundamentalism", label: "Islamic Fundamentalism",
    description: "Treats religious authority as the final source of civil law and favors centralized selection of party representatives.",
    axes: { econ: -.15, social: 1, gov: .95, nat: .2 },
    positions: { competition: -.85, worshipFreedom: -.85, religiousAuthority: 1, memberAuthority: -1, branchAutonomy: -.9 },
  },
  democraticConfederalist: {
    family: "democraticConfederalism", label: "Democratic Confederalism",
    description: "Locates political authority in federated community assemblies, protecting plural representation and local self-government.",
    axes: { econ: -.75, social: -.9, gov: -.9, nat: -.65 },
    positions: { competition: 1, civilLiberties: 1, worshipFreedom: 1, memberAuthority: 1, branchAutonomy: 1 },
  },
  ecosocialist: {
    family: "ecosocialism", label: "Ecosocialism",
    description: "Gives workers and affected communities a governing role in the ecological transition under a plural political system.",
    axes: { econ: -.8, social: -.8, gov: -.6, nat: -.45 },
    positions: { competition: 1, independentLabor: .9, economicControl: -.8, memberAuthority: .9, branchAutonomy: .85 },
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
  nationalSocialistCitizenshipAndPress: {
    family: "nationalSocialism", label: "Restrict naturalization and the press",
    issue: "racializedCitizenship", issueLabel: "Citizenship and political exclusion", value: 1,
    laws: ["nationality_law", "media_freedom"],
    lawTargets: { nationality_law: { birthright: "none", residenceYears: 15, dualCitizenship: false },
      media_freedom: { press: "muzzled", internet: "censored" } },
  },
  clericalFascistConfessionalInstitutions: {
    family: "clericalFascism", label: "Confessional state and education",
    issue: "religiousAuthority", issueLabel: "Religious authority in public institutions", value: 1,
    laws: ["religion_state", "religion_in_education"],
    lawTargets: { religion_state: 3, religion_in_education: 5 },
  },
  clericalFascistLicensedSectors: {
    family: "clericalFascism", label: "Licensed sector representation",
    issue: "laborRepresentation", issueLabel: "Labor representation", value: 1,
    laws: ["union_freedom", "strike_right"],
    lawTargets: { union_freedom: "licensed", strike_right: "regulated" },
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
  christianDemocraticWorship: {
    family: "christianDemocracy", label: "Protect freedom of worship", issue: "worshipFreedom", issueLabel: "Freedom of worship", value: 1,
    laws: ["freedom_of_worship"],
    lawTargets: { freedom_of_worship: 4 },
  },
  islamicDemocraticWorship: {
    family: "islamicDemocracy", label: "Protect freedom of worship", issue: "worshipFreedom", issueLabel: "Freedom of worship", value: 1,
    laws: ["freedom_of_worship"],
    lawTargets: { freedom_of_worship: 4 },
  },
  islamicRepublicanStateReligion: {
    family: "islamicRepublicanism", label: "Recognize an official state religion", issue: "religiousAuthority", issueLabel: "Public religious authority", value: .65,
    laws: ["religion_state"],
    lawTargets: { religion_state: 3 },
  },
  islamicFundamentalistStateReligion: {
    family: "islamicFundamentalism", label: "Expand the official role of religion", issue: "religiousAuthority", issueLabel: "Public religious authority", value: 1,
    laws: ["religion_state"],
    lawTargets: { religion_state: 4 },
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
