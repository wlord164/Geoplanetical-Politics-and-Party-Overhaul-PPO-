"use strict";

const issues = {
  ownership: { label: "State and private ownership", laws: ["regime_propriete", "electricity_market"] },
  redistribution: { label: "Redistribution", laws: ["land_tenure", "minimum_wage", "unemployment_insurance", "family_allowance", "paid_parental_leave"] },
  labor: { label: "Labor autonomy", laws: ["union_freedom", "strike_right"] },
  civilLiberties: { label: "Civil liberties", laws: ["media_freedom", "freedom_of_worship"] },
  citizenship: { label: "Citizenship and naturalization", laws: ["nationality_law"] },
  stateReligion: { label: "Religion in public institutions", laws: ["religion_state", "religion_in_education"] },
  executive: { label: "Executive power", laws: [] },
  competition: { label: "Democratic competition", laws: [] },
};

function gpmFactionOrganizationChange(organization, offer) {
  if (offer.status === "delivered") organization.members += offer.membersAdded || 0;
  else if (offer.status === "breached") organization.members = Math.floor(organization.members * .9);
}

function gpmFactionOrganization(state, faction) {
  if (faction.organization) return faction.organization;
  const organization = { members: 0, factor: 1, delegateChange: 0 };
  const closed = state.offers.filter(offer => offer.factionId === faction.id && offer.closedDay != null)
    .sort((a, b) => a.closedDay - b.closedDay);
  for (const offer of closed) gpmFactionOrganizationChange(organization, offer);
  return faction.organization = organization;
}

function gpmFactionCloseDevelopment(state, faction, offer) {
  if (!faction.organization) {
    gpmFactionOrganization(state, faction);
    return;
  }
  gpmFactionOrganizationChange(faction.organization, offer);
}

function gpmFactionDevelopmentReview(day, state, faction) {
  const organization = gpmFactionOrganization(state, faction);
  const outcomes = (state.policyOutcomes || []).filter(outcome =>
    day - outcome.day < 365 && outcome.factionIds.includes(faction.id));
  const fulfilledIssues = new Set(outcomes.map(outcome => outcome.issue));
  organization.factor = 1 + Math.min(.15, organization.members / 500 + fulfilledIssues.size * .01);
  const completed = programme => new Set(outcomes.filter(outcome => outcome.programme === programme)
    .map(outcome => outcome.issue)).size;
  const family = gpmCongressDoctrine(faction.doctrineId)?.family;
  const available = partyCongressAvailableProgrammes({ identity: { congressDoctrine: { family } } });
  const programmes = Object.keys(available);
  const affinity = id => gpmFactionAlignment(faction.ideology, id, faction.positions);
  faction.redLines = programmes.filter(id => affinity(id) <= -.43);
  faction.priorities = programmes.filter(id => !faction.redLines.includes(id)).sort((a, b) =>
    affinity(b) - .3 * completed(b) - (affinity(a) - .3 * completed(a)) || a.localeCompare(b)).slice(0, 1);

  const agendaLaws = partyCongressProgrammes()[faction.priorities[0]]?.laws || [];
  faction.issuePriorities = Object.entries(gpmFactionIssues).flatMap(([id, issue]) => {
    const latest = outcomes.findLast(outcome => outcome.issue === id);
    const onAgenda = !latest && issue.laws.some(law => agendaLaws.includes(law));
    if (!latest && !onAgenda) return [];
    return [{ id, label: issue.label, onAgenda, lastDeliveredDay: latest?.day ?? null }];
  }).sort((a, b) => Number(b.onAgenda) - Number(a.onAgenda) || a.label.localeCompare(b.label));
}

function gpmFactionDelegateFactors(state) {
  return Object.fromEntries(Object.values(state?.factions || {}).flatMap(faction =>
    faction.organization?.factor > 1 ? [[faction.label, faction.organization.factor]] : []));
}

function gpmFactionObserveLaw(sim, country, procedure, before, after) {
  if (!procedure?.id || !procedure.sponsorPartyId || ir(before, after)) return;
  const party = Gq(country, procedure.sponsorPartyId);
  const state = party?.gpmFactionPolitics;
  const programme = state && partyCongressActiveProgramme(party, sim.day);
  if (!programme || !partyCongressProgrammeLawBonus(party, procedure.lawId, sim.day, after)) return;
  const issue = Object.keys(gpmFactionIssues).find(id => gpmFactionIssues[id].laws.includes(procedure.lawId));
  if (!issue) return;

  const law = cA(procedure.lawId);
  const choice = partyCongressProgrammes()[programme.kind];
  if (!law || (!choice.lawTargets && Kst(party, law, before, country) <= Kst(party, law, after, country))) return;
  const outcomes = state.policyOutcomes ??= [];
  if (outcomes.some(outcome => outcome.id === procedure.id)) return;
  const programmeDay = party.gpmCongressSizeState.lastProgrammeVote?.day ?? programme.untilDay - 180;
  const pledgedFactions = new Set(state.offers.filter(offer => offer.status === "delivered" &&
    offer.programme === programme.kind && offer.closedDay >= programmeDay).map(offer => offer.factionId));
  const factionIds = Object.values(state.factions).filter(faction =>
    pledgedFactions.has(faction.id) || faction.priorities.includes(programme.kind)).map(faction => faction.id);
  if (!factionIds.length) return;
  outcomes.push({ id: procedure.id, day: sim.day, issue, label: gpmFactionIssues[issue].label,
    lawId: law.id, from: pa(before), to: pa(after), programme: programme.kind, factionIds });
}

function patchFactionDevelopmentWorker(source, replaceOnce) {
  return replaceOnce(source, 'Tda(t,A.id),s&&_Pt(e,t),{passes:s,vetoed:l,struck:c,decreed:u,',
    'Tda(t,A.id),s&&_Pt(e,t),s&&!u&&gpmFactionObserveLaw(e,t,A,i,t.laws[A.lawId]),{passes:s,vetoed:l,struck:c,decreed:u,');
}

module.exports = {
  patchFactionDevelopmentWorker,
  workerFunctions: [`const gpmFactionIssues = ${JSON.stringify(issues)};`, gpmFactionOrganizationChange,
    gpmFactionOrganization, gpmFactionCloseDevelopment, gpmFactionDevelopmentReview, gpmFactionDelegateFactors,
    gpmFactionObserveLaw],
};
