"use strict";

function gpmFoundingSupportCap(rules) {
  return Number.isFinite(rules?.startingSupport) && rules.startingSupport > 0
    ? rules.startingSupport / 100 : .02;
}

function gpmFoundingSeatPlan(country, party, requested) {
  const politics = country.pol;
  const institution = Xe(country);
  const canStand = Object.hasOwn(r6(politics, { [party.id]: party.support }), party.id);
  if (!canStand || !institution || party.legal === false) return { seats: 0, reason: "party-ineligible" };

  const chamber = (politics.chambers || []).filter(candidate => {
    const selection = ar(country, "chamber:" + candidate.id)?.selection;
    return selection?.method === "election" && !["appointed", "hereditary", "delegated"].includes(selection.selectMode);
  }).sort((left, right) => {
    const order = id => ar(country, "chamber:" + id)?.order || 0;
    return order(left.id) - order(right.id);
  })[0];
  if (!chamber) return { seats: 0, reason: "no-elected-chamber" };

  const composition = { ...chamber.composition };
  const counts = Object.values(composition);
  if (!counts.every(seats => Number.isSafeInteger(seats) && seats >= 0) ||
      counts.reduce((total, seats) => total + seats, 0) !== chamber.seats ||
      composition[party.id] > 0) return { seats: 0, reason: "unsupported-composition" };

  const government = p1a(politics);
  const legal = new Set(politics.parties.filter(member => member.legal !== false && member.id !== party.id).map(member => member.id));
  const donors = Object.keys(composition).filter(id => legal.has(id));
  const majority = Math.floor(chamber.seats / 2) + 1;
  const governingSeats = donors.reduce((total, id) => total + (government.has(id) ? composition[id] : 0), 0);
  let governmentTransferCapacity = Math.max(0, governingSeats - majority);
  let assigned = 0;
  while (assigned < requested) {
    const eligible = donors.filter(id => composition[id] > 1 && (!government.has(id) || governmentTransferCapacity > 0));
    eligible.sort((left, right) =>
      Number(government.has(left)) - Number(government.has(right)) ||
      composition[right] - composition[left] || left.localeCompare(right));
    const donor = eligible[0];
    if (!donor) break;
    if (government.has(donor)) governmentTransferCapacity--;
    composition[donor]--;
    assigned++;
  }
  if (!assigned) return { seats: 0, reason: "seats-unavailable" };
  composition[party.id] = assigned;
  return {
    seats: assigned,
    ...(assigned < requested ? { reason: "seats-unavailable" } : {}),
    chamberId: chamber.id,
    chambers: politics.chambers.map(candidate => candidate === chamber ? { ...candidate, composition } : candidate),
  };
}

function gpmApplyCampaignFounding(sim, country, party, rules, draft) {
  if (rules.startingCash != null) party.organization.treasuryM = rules.startingCash / 1e6;
  if (rules.startingActivists != null) party.organization.activistsK = rules.startingActivists / 1e3;
  if (rules.startingInfluence != null) party.organization.influence = rules.startingInfluence;

  const regionKeys = [];
  const startingPresence = (rules.startingPresence || 0) / 100;
  if (startingPresence > 0 && Array.isArray(draft.startingRegions)) {
    for (const key of new Set(draft.startingRegions.slice(0, 12))) {
      if (typeof key !== "string") continue;
      const province = sim.world?.provByKey?.get(key);
      if (province && partyRegionalProvince(sim, country, province.__provId, key)) regionKeys.push(key);
    }
  }
  if (regionKeys.length) {
    party.gpmRegional = {
      regions: Object.fromEntries(regionKeys.map(key => [key, { presence: startingPresence, presenceDay: sim.day }])),
      projects: [],
      headquarters: null,
    };
    country.pol.campaignPolls = {};
  }

  const requested = Math.min(12, Math.max(0, Math.trunc(rules.startingSeats || 0)));
  if (!requested) return { seats: 0, regionKeys };
  const plan = gpmFoundingSeatPlan(country, party, requested);
  if (!plan.seats) return { seats: 0, regionKeys, seatReason: plan.reason };
  const institution = Xe(country);
  const result = Yc(sim, country, {
    intent: "constitution.reconcile",
    transitionId: "gpm.founding.seats:" + country.key + ":" + party.id,
    expectedRevision: institution.revision,
    constitutionRevision: institution.constitutionRevision + 1,
    day: sim.day,
    sourceProcedureId: "gpm.founding.seats",
    constitution: country.pol.constitution,
    chambers: plan.chambers,
  });
  if (!result.ok) return { seats: 0, regionKeys, seatReason: result.reason || "seat-transition-failed" };
  gpmBindCampaignPolity(sim, country.pol);
  country.pol.campaignPolls = {};
  return { seats: plan.seats, chamberId: plan.chamberId, regionKeys,
    ...(plan.reason ? { seatReason: plan.reason } : {}) };
}

module.exports = {
  workerFunctions: [gpmFoundingSupportCap, gpmFoundingSeatPlan, gpmApplyCampaignFounding],
};
