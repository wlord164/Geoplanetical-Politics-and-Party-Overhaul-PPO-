"use strict";

const number = (id, label, min, max, step, help = "", nullable = false) =>
  ({ id, label, type: "number", min, max, step, help, nullable });
const choice = (id, label, options, help) => ({ id, label, type: "select", options, help });
const sections = [
  { title: "New party start", fields: [
    number("startingCash", "Party treasury (USD)", 0, 10000000, 1, "Blank uses the game's founding balance.", true),
    number("startingActivists", "Activists", 0, 50000, 1, "Blank uses the game's founding roster.", true),
    number("startingInfluence", "Influence", 0, 100, 1, "Blank uses the game's founding influence.", true),
    number("startingSupport", "National support (%)", 0.5, 20, 0.5, "The country's party roster may reduce this starting target."),
    number("startingPresence", "Regional presence (%)", 0, 100, 1, "Applied in each selected region."),
  ] },
  { title: "Legislative start", fields: [
    number("startingSeats", "Seats in the main elected chamber", 0, 12, 1,
      "Seats come from existing parties. Holding any seat blocks the uprising route while you hold it."),
  ] },
  { title: "Support decay", fields: [
    number("rallyGraceDays", "Days before rally support starts to fade", 0, 365, 1),
    number("rallyHalfLife", "Rally half-life (days)", 0, 1460, 1, "0 makes rally bonuses permanent."),
    number("organizingHalfLife", "Voter bloc organizing half-life (days)", 0, 1460, 1, "0 makes organizing bonuses permanent."),
    number("presenceHalfLife", "Regional presence half-life (days)", 0, 3650, 1, "0 keeps investments permanent. Applies to all parties."),
  ] },
  { title: "Campaigning", fields: [
    number("rallyCost", "Base rally cost (USD)", 0, 1000000, 1, "Region size, local presence, and Congress priorities affect the quote."),
    number("investmentCost", "Base local investment cost (USD)", 0, 1000000, 1, "Region size and Congress priorities affect the quote."),
    number("headquartersCost", "Base headquarters cost (USD)", 0, 1000000, 1, "The quote scales with region size."),
    number("rallyDays", "Rally duration (days)", 1, 365, 1),
    number("investmentDays", "Investment duration (days)", 1, 365, 1),
    number("headquartersDays", "Headquarters duration (days)", 1, 365, 1),
    number("rallyCooldown", "Regional rally cooldown (days)", 0, 365, 1),
    number("maxRegionalProjects", "Simultaneous regional projects", 1, 3, 1, "One project of each type may run at a time."),
    number("regionalEffectiveness", "Regional project effectiveness (%)", 25, 250, 1),
    number("smallPartyBonus", "Maximum small-party boost (%)", 0, 100, 1, "The same bonus applies to all parties and tapers to zero at 15% national support."),
  ] },
  { title: "Party funding", fields: [
    { id: "foreignFunding", label: "Allow foreign party funding", type: "checkbox" },
    number("grantSize", "Foreign grant size (%)", 25, 300, 1),
    number("fundingCooldown", "Days between funding requests", 0, 730, 1),
    number("fundingExposure", "Private funding exposure risk (%)", 0, 300, 1, "Scales the base exposure risk. 0 turns it off."),
  ] },
  { title: "AI competition", fields: [
    choice("regionalAI", "Regional campaigning scope", [["world", "All eligible countries"], ["domestic", "Your country"]], "Sets where AI parties plan PPO regional projects."),
    choice("aiPlanning", "AI campaign planning", [["basic", "Basic"], ["balanced", "Balanced"], ["strong", "Strong"]], "Changes how widely the AI looks for campaign opportunities. It uses the same costs, cooldowns, and decay."),
  ] },
];

const standard = {
  startingCash: null, startingActivists: null, startingInfluence: null,
  startingSupport: 2.5, startingSeats: 0, startingPresence: 0,
  rallyGraceDays: 21, rallyHalfLife: 60, organizingHalfLife: 180, presenceHalfLife: 0,
  rallyCost: 12000, investmentCost: 30000, headquartersCost: 55000,
  rallyDays: 7, investmentDays: 42, headquartersDays: 28, rallyCooldown: 35,
  maxRegionalProjects: 3, regionalEffectiveness: 100, smallPartyBonus: 12,
  foreignFunding: true, grantSize: 100, fundingCooldown: 120, fundingExposure: 100,
  regionalAI: "world", aiPlanning: "balanced",
};

const presets = {
  standard: { label: "Standard", description: "PPO’s usual pace, shared AI rules, and a modest boost for small parties.", values: standard },
  easy: { label: "Easy", description: "A stronger start for your new party, cheaper organizing for everyone, and simpler AI planning.",
    values: { ...standard, startingCash: 125000, startingActivists: 400, startingInfluence: 35, startingSupport: 5,
      rallyCost: 9000, investmentCost: 23000, headquartersCost: 42000, rallyHalfLife: 90,
      organizingHalfLife: 240, smallPartyBonus: 22, fundingExposure: 70, aiPlanning: "basic" } },
  competitive: { label: "Competitive", description: "Sharper AI planning, shorter-lived boosts, and greater upkeep for local organizations.",
    values: { ...standard, rallyHalfLife: 45, organizingHalfLife: 135, presenceHalfLife: 540, aiPlanning: "strong" } },
};

function gpmNormalizeCampaignRules(input, legacy = false) {
  if (input?.version === 1 && gpmValidatedCampaignRules.has(input)) return input;
  const name = Object.hasOwn(gpmCampaignPresets, input?.preset) ? input.preset : "standard";
  const defaults = gpmCampaignPresets[name].values;
  const rules = { ...defaults, version: 1, preset: input?.preset === "custom" ? "custom" : name };
  if (!input && legacy) {
    rules.startingSupport = 2;
    rules.smallPartyBonus = 0;
  }
  for (const { id, type, min, max, step, options, nullable } of gpmCampaignFields) {
    if (!input || !Object.hasOwn(input, id)) continue;
    const value = input[id];
    if (type === "number") {
      if (value === null && nullable) rules[id] = null;
      else if (typeof value === "number" && Number.isFinite(value)) {
        rules[id] = Math.min(max, Math.max(min, Math.round(value / step) * step));
      }
    } else if (type === "checkbox" && typeof value === "boolean" ||
        type === "select" && options.some(([key]) => key === value)) {
      rules[id] = value;
    }
  }
  rules.startingRegions = Object.freeze(Array.isArray(input?.startingRegions)
    ? [...new Set(input.startingRegions.filter(key => typeof key === "string" && /^[\w+?.-]{1,32}$/.test(key)))].slice(0, 12)
    : []);
  gpmValidatedCampaignRules.add(rules);
  return Object.freeze(rules);
}

function gpmCampaignRulesFor(simOrPolity) {
  return simOrPolity?.gpmCampaignRules || gpmLegacyCampaignRules;
}

function gpmBindCampaignPolity(sim, polity) {
  if (!polity || polity.gpmCampaignRules === sim.gpmCampaignRules) return;
  Object.defineProperty(polity, "gpmCampaignRules", { value: sim.gpmCampaignRules, configurable: true });
}

function gpmInitializeCampaignRules(sim, input, loading) {
  sim.gpmCampaignRules = gpmNormalizeCampaignRules(loading ? sim.gpmCampaignRules : input, loading);
  for (const country of sim.countries.values()) gpmBindCampaignPolity(sim, country.pol);
}

const declarations = [
  `const gpmCampaignPresets = ${JSON.stringify(presets)};`,
  `const gpmCampaignFields = ${JSON.stringify(sections.flatMap(section => section.fields))};`,
  "const gpmValidatedCampaignRules = new WeakSet();",
  gpmNormalizeCampaignRules, gpmCampaignRulesFor, gpmBindCampaignPolity, gpmInitializeCampaignRules,
  "const gpmLegacyCampaignRules = gpmNormalizeCampaignRules(null, true);",
];

module.exports = { presets, sections, declarations };
