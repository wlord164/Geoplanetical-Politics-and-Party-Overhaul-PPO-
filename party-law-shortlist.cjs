"use strict";

function partyLawShortlist(sim) {
  const day = sim.day || 0;
  if (!sim.player?.pol) return { day, partyId: null, rights: { ok: false, reason: "party" }, laws: [] };
  const { querySim, country, partyId } = rLe(sim);
  const reason = Kpt(querySim, country, partyId);
  const laws = [];
  for (const { law, choice, gain } of yka(querySim, country, partyId, false)) {
    if (!dpt(country, law).ok) continue;
    const forecast = querySim.forecastBillFor(country, law, choice.value, {
      sponsorKind: "party",
      sponsorPartyId: partyId,
      partyLines: { [partyId]: { lineId: "support", setDay: day } },
    });
    if (!forecast.fc || !forecast.procedureKind) continue;
    const stages = { ...forecast.exec, completeHistory: true };
    querySim._procedurePasses(country.pol, forecast.procedureKind, forecast.fc.detail, stages);
    const { requiredVotes, vetoRisk, courtRisk } = yPa(stages._res?.history);
    laws.push({
      lawId: law.id, value: Fa(choice.value), choiceId: choice.id, gain: c6(gain, 2),
      passes: forecast.passes, yes: forecast.fc.yes, total: forecast.fc.total,
      requiredVotes, vetoRisk, courtRisk,
    });
  }

  const margin = law => law.yes - (law.requiredVotes ?? Math.floor(law.total / 2) + 1);
  laws.sort((a, b) => Number(b.passes) - Number(a.passes)
    || margin(b) - margin(a) || b.gain - a.gain || x(a.lawId, b.lawId));
  return { day, partyId, rights: { ok: !reason, reason }, laws };
}

module.exports = { workerFunctions: [partyLawShortlist] };
