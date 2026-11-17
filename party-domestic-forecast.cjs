"use strict";

function gpmMigrateDomesticCampaign(sim) {
  if (sim.gpmDomesticMigration === 1) return;
  const rules = gpmCampaignRulesFor(sim);
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) {
      const regional = party.gpmRegional;
      if (!regional) continue;
      for (const { rally } of Object.values(regional.regions || {})) {
        if (rally && rally.halfLife == null) {
          rally.halfLife = rally.fullUntil == null ? gpmRegionalRules.legacyRallyHalfLife : rules.rallyHalfLife;
        }
      }
      for (const project of regional.projects || []) {
        if (project.kind === "rally") {
          project.rallyGraceDays ??= rules.rallyGraceDays;
          project.rallyHalfLife ??= rules.rallyHalfLife;
        }
      }
    }
  }
  sim.gpmDomesticMigration = 1;
}

function gpmProjectedRegionalParty(sim, country, party, electionDay) {
  const regional = party.gpmRegional;
  if (!regional?.projects?.length) return regional;
  const rules = gpmCampaignRulesFor(sim);
  const projected = { ...regional, regions: { ...regional.regions } };
  for (const project of [...regional.projects].sort((a, b) => a.endDay - b.endDay)) {
    if (project.endDay > electionDay || !partyRegionalProjectEligible(sim, country, party, project, Boolean(regional.headquarters))) continue;
    const local = projected.regions[project.key] || {};
    if (project.kind === "headquarters") {
      projected.headquarters = { key: project.key, weight: project.gain ?? gpmRegionalRules.headquartersWeight };
    } else if (project.kind === "investment") {
      const presence = partyRegionalPresence(local, project.endDay, rules);
      const expected = project.expectedGain ?? Math.min(1 - presence, .13 *
        rules.regionalEffectiveness / 100 * partyCampaignSmallPartyFactor(party, rules) * (1 - .65 * presence));
      projected.regions[project.key] = { ...local, presence: Math.min(1, presence + expected), presenceDay: project.endDay };
    } else if (project.kind === "rally") {
      const previous = partyRegionalRallyWeight(local.rally, project.endDay, rules);
      projected.regions[project.key] = { ...local, rally: {
        day: project.endDay, fullUntil: project.endDay + (project.rallyGraceDays ?? rules.rallyGraceDays),
        halfLife: project.rallyHalfLife ?? rules.rallyHalfLife,
        weight: Math.min(gpmRegionalRules.rallyLimit, previous + (project.gain || 0)),
      } };
    }
  }
  return projected;
}

function gpmProjectedOrganization(sim, country, party, through) {
  const blocs = sim._voterBlocs?.(country);
  if (!blocs?.length || through <= sim.day) return null;
  const canRecruit = gpmDomesticEligibleParty(country, party);
  const last = Math.min(through, sim.day + 730);
  const regional = party.gpmRegional;
  const recruitment = !canRecruit ? [] : (regional?.projects || []).filter(project =>
    project.domesticMembership && project.endDay <= last &&
    partyRegionalProjectEligible(sim, country, party, project, Boolean(regional.headquarters)))
    .sort((a, b) => a.endDay - b.endDay);
  const active = party.gpmOrganizing?.projects?.length || Object.keys(party.gpmOrganizing?.groups || {}).length ||
    party.outreach?.project || Object.keys(party.outreach?.networks || {}).length || recruitment.length;
  if (!active) return null;
  const groups = new Map(yke(country).map(group => [group.id, group]));
  const governor = N0(sim, country, "head_of_gov");
  const charisma = governor ? TO(1 + (governor.traits.charisma - .5) * .3 +
    (governor.traits.notoriety || 0) * .12, .5, 1.7) : 1;
  const options = { blocs, salience: country.pol.salience, charisma, growthGainPct: lme(sim, country) };
  const rules = gpmCampaignRulesFor(sim);
  const clock = { day: sim.day, gpmCampaignRules: rules, playerKey: null, gpmDomesticForecast: canRecruit };
  const members = country.pol.parties.map(member => ({ ...member }));
  const expected = members.find(member => member.id === party.id);
  expected.gpmOrganizing = party.gpmOrganizing && structuredClone(party.gpmOrganizing);
  expected.outreach = party.outreach && structuredClone(party.outreach);
  expected.organization = { ...party.organization };
  expected.gpmDomestic = party.gpmDomestic?.membership ? { membership: { ...party.gpmDomestic.membership } } : null;
  const polity = { ...country.pol, parties: members };
  let nextRecruitment = 0;
  for (let tick = sim.day + 7 - sim.day % 7; tick <= last; tick += 7) {
    clock.day = tick;
    advancePartyOrganizing(clock, country, expected, groups);
    while (recruitment[nextRecruitment]?.endDay <= tick) {
      const { kind, activistsK, endDay } = recruitment[nextRecruitment++];
      gpmDomesticEarnMembers(clock, country, expected, kind, activistsK, endDay);
    }
    jct(clock, country, expected);
    eut(polity, {}, 7, options);
  }
  return Object.fromEntries(members.map(member => [member.id, member.support]));
}

function gpmPartyElectionRecap(sim, country, chamber, votes, previous, day, contestId) {
  const polity = country.pol;
  const eligible = zg(polity, votes);
  const totals = partyRegionalNationalShares(polity, DO(sim, country), eligible);
  return {
    ...partyCampaignChamberRules(chamber), day, contestId,
    chamberName: chamber.name || chamber.id, chamberNameKey: chamber._nameKey || null,
    totalSeats: chamber.seats,
    parties: polity.parties.filter(party => totals[party.id] > 0 || chamber.composition[party.id] || previous[party.id])
      .map(party => ({
        id: party.id, label: party.nameDesc?.gpmName || party.id,
        votes: totals[party.id] || 0, seats: chamber.composition[party.id] || 0, previousSeats: previous[party.id] || 0,
      })).sort((a, b) => b.seats - a.seats || b.votes - a.votes || a.id.localeCompare(b.id)),
  };
}

function gpmStorePartyElectionRecap(country, recap) {
  (country.gpmPartyElectionRecaps ??= {})[recap.contestId] = recap;
}

function gpmPartyElectionRecapView(country, partyId, contestId = null) {
  const recaps = country.gpmPartyElectionRecaps || {};
  const recap = contestId ? recaps[contestId] : Object.values(recaps)
    .sort((a, b) => b.day - a.day || a.contestId.localeCompare(b.contestId))[0];
  if (!recap) return null;
  const party = recap.parties.find(row => row.id === partyId);
  return { ...recap, seats: party?.seats ?? 0, beforeSeats: party?.previousSeats ?? 0, voteShare: party?.votes ?? 0 };
}

function gpmDomesticAgenda(sim, country, partyId) {
  if (!partyId || !country.pol) return { rows: [] };
  const party = sL(country, partyId);
  if (!party) return { rows: [] };
  const day = sim.day || 0;
  const rows = [];
  function add(id, kind, title, tab, date, status, contestId = null) {
    rows.push({ id, kind, title, tab, day: date, deadlineDay: status === "upcoming" ? date : null, status, contestId });
  }
  for (const contest of Object.values(st(country)?.contests || {})) {
    if (contest.nextDay != null && contest.nextDay >= day && contest.nextDay - day <= 60) {
      add(contest.id, "vote", "Election · " + (contest.targetOrganId.split(":").at(-1) || contest.id), "plan",
        contest.nextDay, "upcoming", contest.id);
    }
  }
  const current = gpmPartyElectionRecapView(country, partyId);
  if (current && day - current.day <= 60) add(current.contestId, "electionRecap", "Election results", "plan",
    current.day, "completed", current.contestId);
  const projects = [...(party.gpmRegional?.projects || []), ...(party.gpmOrganizing?.projects || []),
    ...(party.outreach?.project ? [{ ...party.outreach.project, kind: "outreach" }] : [])];
  const projectNames = { investment: "Local investment", headquarters: "Headquarters", rally: "Regional rally",
    meeting: "Public meeting", movement: "Movement backing", outreach: "Outreach" };
  for (const project of projects) {
    add("due:" + project.kind + ":" + project.endDay, "project", (projectNames[project.kind] || "Party work") + " due",
      "plan", project.endDay, "upcoming");
  }
  for (const completed of [...(party.gpmRegional?.recent || []), ...(party.gpmOrganizing?.recent || [])]) {
    const date = completed.finishedDay ?? completed.day;
    if (day >= date && day - date <= 14) {
      add("done:" + completed.kind + ":" + date, "project", (projectNames[completed.kind] || "Party work") +
        (completed.result === "cancelled" || completed.reason ? " ended" : " completed"), "plan", date, "completed");
    }
  }
  const funding = party.gpmForeignFunding;
  if (funding?.offer) add("funding:" + funding.offer.requestId, "offer", "Foreign grant offer", "foreign", funding.offer.expiresDay, "upcoming");
  for (const grant of partyForeignFundingGrants(funding)) {
    if (grant.exposed) add("grant:" + grant.requestId, "offer", "Foreign grant response", "foreign", grant.responseDay, "upcoming");
  }
  if (typeof partyAgreementAgenda === "function") rows.push(...partyAgreementAgenda(sim, country, partyId));
  if (typeof partyCongressAgenda === "function") rows.push(...partyCongressAgenda(sim, country, partyId));
  if (sim.playerKey === country.key) {
    for (const item of gpmUprising.inheritedWars(sim)?.wars || []) {
      if (!item.choice && ["available", "ready"].includes(item.peace?.status)) {
        const expires = item.peace.expiresDay;
        add("peace:" + item.key, "conflict", "Review inherited war", "conflicts", expires ?? day,
          expires == null ? "available" : "upcoming");
      }
    }
    for (const { definition, row, war, summaryStatus } of sim.gpmHistoricalState ? gpmHistoricalConflictEntries(sim) : []) {
      if (war || summaryStatus !== "occupation" || row.nativeId) continue;
      const { option } = gpmHistoricalWithdrawalAction(sim, definition, row);
      const pending = row.withdrawalPetition?.countryKey === country.key && row.withdrawalPetition?.status === "pending"
        ? row.withdrawalPetition : row.pending?.term === "propose-withdrawal" && row.pending.offeredBy === country.key
          ? row.pending : null;
      if (option || pending) add("withdrawal:" + definition.id, "conflict", option?.label || "Withdrawal review pending",
        "conflicts", pending?.reviewDay ?? day, pending ? "upcoming" : "available");
    }
  }
  rows.sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") ||
    (a.status === "completed" ? b.day - a.day : a.day - b.day) || a.id.localeCompare(b.id));
  return { rows: rows.slice(0, 12) };
}

function partyCampaignPlanForecast(sim, country, partyId, contestId) {
  const contest = st(country)?.contests?.[contestId];
  const party = sL(country, partyId);
  if (!party || !contest) return null;
  const current = partyCampaignForecast(sim, country, partyId, contestId, 0, { local: true });
  if (!current) return null;
  const chamber = country.pol.chambers.find(item => contest.targetOrganId === "chamber:" + item.id);
  const projectedPolity = { ...country.pol, parties: country.pol.parties.map(member =>
    member.id === partyId ? { ...member, gpmRegional: gpmProjectedRegionalParty(sim, country, member, contest.nextDay) } : member) };
  const election = partyCampaignForecast(sim, country, partyId, contestId, 0, {
    day: contest.nextDay, base: gpmProjectedOrganization(sim, country, party, contest.nextDay),
    projectedPolity, local: true,
  });
  return {
    contestId, day: sim.day, kind: current.kind, electionDay: contest.nextDay, totalSeats: current.totalSeats,
    chamberName: chamber?.name || chamber?.id || contest.targetOrganId,
    chamberNameKey: chamber?._nameKey || null, mode: current.mode, formula: current.formula,
    threshold: current.threshold, legalThreshold: current.legalThreshold, current: current.before,
    election: election?.before ?? current.before,
    assumptions: "Estimate using current world conditions, ongoing work and expected project results. Later decisions may change it." +
      (contest.nextDay - sim.day > 730 ? " National organizing is projected through the first 730 days." : ""),
    projects: [...(party.gpmRegional?.projects || []), ...(party.gpmOrganizing?.projects || []),
      ...(party.outreach?.project ? [{ ...party.outreach.project, kind: "outreach" }] : [])]
      .map(item => ({ kind: item.kind, key: item.key ?? item.targetId, endDay: item.endDay }))
      .sort((a, b) => a.endDay - b.endDay),
    recentResult: gpmPartyElectionRecapView(country, partyId, contestId),
  };
}

module.exports = {
  workerFunctions: [gpmMigrateDomesticCampaign, gpmProjectedRegionalParty, gpmProjectedOrganization,
    gpmPartyElectionRecap, gpmStorePartyElectionRecap, gpmPartyElectionRecapView, gpmDomesticAgenda, partyCampaignPlanForecast],
};
