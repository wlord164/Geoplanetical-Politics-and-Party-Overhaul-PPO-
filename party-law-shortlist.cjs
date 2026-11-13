"use strict";

function partyLawShortlist(sim) {
  const day = sim.day || 0;
  if (!sim.player?.pol) return { day, partyId: null, rights: { ok: false, reason: "party" }, laws: [] };
  const { querySim, country, partyId } = Lqe(sim);
  const reason = fft(querySim, country, partyId);
  const party = country?.pol?.parties.find(item => item.id === partyId);
  const platform = gpmPresets[gpmActiveIdeologyPreset(party)];
  const candidates = new Map(QRa(querySim, country, partyId, false).map(item => [item.law.id, item]));
  for (const lawId of Object.keys(platform?.laws || {})) {
    const law = ba(lawId);
    const current = country.laws?.[lawId];
    const target = gpmIdeologyLawTarget(platform, lawId, current, querySim._simYear || 2026);
    if (!law || current == null || target === undefined) continue;
    candidates.delete(lawId);
    if (Jr(current, target) || (country.lawCooldown?.[lawId] || 0) > day ||
        country.procedures?.some(procedure => procedure.kind === "law" && procedure.lawId === lawId)) continue;
    const distance = value => typeof target === "number" ? Math.abs(target - value) :
      typeof target === "object" ? Object.keys(target).filter(key => target[key] !== value?.[key]).length :
        Number(value !== target);
    const choices = Lg(law, country, current).filter(choice => distance(choice.value) < distance(current));
    choices.sort((a, b) => distance(a.value) - distance(b.value));
    if (choices.length) {
      const choice = choices[0];
      const gain = jWe(party, law, current, country) - jWe(party, law, choice.value, country);
      candidates.set(lawId, { law, choice, gain, priority: true });
    }
  }
  const laws = [];
  for (const { law, choice, gain, priority } of candidates.values()) {
    if (!$mt(country, law).ok) continue;
    const forecast = querySim.forecastBillFor(country, law, choice.value, {
      sponsorKind: "party",
      sponsorPartyId: partyId,
      partyLines: { [partyId]: { lineId: "support", setDay: day } },
    });
    if (!forecast.fc || !forecast.procedureKind) continue;
    const stages = { ...forecast.exec, completeHistory: true };
    querySim._procedurePasses(country.pol, forecast.procedureKind, forecast.fc.detail, stages);
    const { requiredVotes, vetoRisk, courtRisk } = Zwa(stages._res?.history);
    laws.push({
      lawId: law.id, value: Ga(choice.value), choiceId: choice.id, gain: O6(gain, 2), ...(priority ? { priority } : {}),
      passes: forecast.passes, yes: forecast.fc.yes, total: forecast.fc.total,
      requiredVotes, vetoRisk, courtRisk,
    });
  }

  const margin = law => law.yes - (law.requiredVotes ?? Math.floor(law.total / 2) + 1);
  laws.sort((a, b) => Number(b.passes) - Number(a.passes)
    || Number(Boolean(b.priority)) - Number(Boolean(a.priority))
    || margin(b) - margin(a) || b.gain - a.gain || x(a.lawId, b.lawId));
  return { day, partyId, rights: { ok: !reason, reason }, laws };
}

module.exports = { workerFunctions: [partyLawShortlist] };
