"use strict";

function gpmPoliticalCrisisUnit(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function gpmPoliticalCrisisSignals(sim, country) {
  const unit = gpmPoliticalCrisisUnit;
  const unemployment = country.unemployment;
  const inflation = country.inflation;
  const normalInflation = Math.max(4, (country.inflationObserved0 || 0) + 2);
  const health = Pi(sim, country.key)?.status;
  return {
    jobs: Math.max(unit((unemployment - 9) / 14), unit((unemployment - country.unemployment0 - 2) / 8),
      unit((-country.growth - .7) / 8)),
    prices: Math.max(unit((inflation - normalInflation) / 14), unit((inflation - 12) / 25) * .7),
    health: Math.max(unit((health?.band - 1) * .42), health?.saturated ? .9 : 0),
    stability: unit((55 - country.stab) / 33),
    failure: unit((54 - country.approval) / 42),
  };
}

function gpmPoliticalCrisisLocalFit(party, groups) {
  let compatible = 0;
  let total = 0;
  for (const group of groups) {
    const distance = Math.hypot(...gpmAxes.map(({ id }) => (party.ideology?.[id] || 0) - (group.ideal?.[id] || 0)));
    compatible += group.share * gpmPoliticalCrisisUnit((1.45 - distance) / 1.05);
    total += group.share;
  }
  return total > 0 ? compatible / total : 0;
}

function gpmPoliticalCrisisReach(country, party, groups) {
  const unit = gpmPoliticalCrisisUnit;
  const population = country.pop || 0;
  const activists = unit(party.organization.activistsK / Math.max(.15, .025 * population));
  const members = unit(gpmDomesticMembership(party).members / Math.max(250, 65 * population));
  let contacts = 0;
  for (const group of groups) {
    const strength = Math.max(party.outreach?.networks?.[group.id] || 0, party.gpmOrganizing?.groups?.[group.id] || 0);
    contacts += group.share * unit(strength);
  }
  return Math.max(activists, members, unit(2.6 * contacts));
}

function gpmPoliticalCrisisAppeal(party, pressure) {
  const { econ = 0, gov = 0 } = party.ideology || {};
  const identity = gpmPartyIdentity(party);
  const doctrine = gpmCongressDoctrine(identity.congressDoctrine?.platform);
  const insurance = doctrine?.positions.socialInsurance ?? -econ;
  return Math.max(
    pressure.jobs * (.64 - .27 * econ + .09 * insurance),
    pressure.prices * (.58 + .23 * econ),
    pressure.health * (.61 + .29 * insurance),
    pressure.stability * (.65 + .22 * Math.abs(gov)),
  );
}

function gpmPoliticalCrisisUpdate(sim, country, day = sim.day) {
  const polity = country.pol;
  const groups = yke(country);
  if (!polity?.parties?.length || !groups.length || !Number.isFinite(day)) return null;
  const current = gpmPoliticalCrisisSignals(sim, country);
  const { failure, ...issues } = current;
  const acute = Math.max(...Object.values(issues));
  const prior = polity.gpmPoliticalCrisis;
  if (prior?.lastDay >= day) return prior.weights || null;
  if (!prior && (acute <= .22 || failure <= .24)) return null;
  const ruling = PXr(polity);
  const government = Et(country);
  const handover = prior && prior.government !== government;
  const weeks = Math.min(2, Math.max(1, Math.round((day - (prior?.lastDay ?? day)) / 7)));
  const smooth = (before, now) => now + ((before || 0) - now) * (now > before ? .79 : .72) ** weeks;
  const pressures = Object.fromEntries(Object.entries(issues).map(([issue, signal]) =>
    [issue, smooth(prior?.pressures?.[issue] || 0, signal)]));
  const blame = smooth((prior?.blame || 0) * (handover ? .35 : 1), failure);
  const sustained = acute > .22 && failure > .24;
  const duration = Math.max(0, Math.min(12, (handover ? 0 : prior?.duration || 0) + (sustained ? weeks : -weeks)));
  if (!sustained && !duration && Math.max(...Object.values(pressures)) < .04) {
    delete polity.gpmPoliticalCrisis;
    return null;
  }
  const weights = {};
  if (duration >= 3) {
    for (const party of polity.parties) {
      if (ruling.includes(party.id) || party.id === government || !gpmDomesticEligibleParty(country, party)) continue;
      const credibility = gpmPoliticalCrisisUnit(party.organization.credibility ?? .5);
      const reach = gpmPoliticalCrisisReach(country, party, groups);
      if (credibility < .28 || reach < .16) continue;
      const localFit = gpmPoliticalCrisisLocalFit(party, groups);
      if (localFit < .12) continue;
      const opportunity = 2.65 * blame * reach * Math.sqrt(localFit) * (.4 + .6 * credibility) *
        gpmPoliticalCrisisAppeal(party, pressures);
      if (opportunity < .025) continue;
      weights[party.id] = 1 + opportunity;
    }
  }
  polity.gpmPoliticalCrisis = { lastDay: day, government, pressures, blame, duration, weights };
  return Object.keys(weights).length ? weights : null;
}

function gpmPoliticalCrisisRecruitment(country, party, day) {
  const state = country.pol?.gpmPoliticalCrisis;
  if (!state || day < state.lastDay - 7 || day > state.lastDay + 21) return 1;
  return 1 + Math.min(.45, Math.max(0, (state.weights[party.id] || 1) - 1) * .32);
}

function gpmPoliticalCrisisView(country, partyId) {
  const state = country.pol?.gpmPoliticalCrisis;
  if (!(state?.weights?.[partyId] > 1)) return null;
  const labels = { jobs: "jobs and livelihoods", prices: "price pressures", health: "a public-health emergency", stability: "political instability" };
  return Object.entries(state.pressures).filter(([, value]) => value >= .22)
    .sort((a, b) => b[1] - a[1]).map(([issue]) => labels[issue]).filter(Boolean);
}

function patchPoliticalCrisisWorker(source, replaceOnce) {
  const declarations = [gpmPoliticalCrisisUnit, gpmPoliticalCrisisSignals, gpmPoliticalCrisisLocalFit, gpmPoliticalCrisisReach,
    gpmPoliticalCrisisAppeal, gpmPoliticalCrisisUpdate, gpmPoliticalCrisisRecruitment, gpmPoliticalCrisisView].join("\n");
  const changes = [
    ['registerPartyOrganizing();', declarations + '\nregisterPartyOrganizing();'],
    ['EWa(e,t),Hct(e,t);let r={approval:', 'EWa(e,t),Hct(e,t);let gpmCrisisWeights=gpmPoliticalCrisisUpdate(e,t),r={approval:'],
    ['growthGainPct:lme(e,t)})}else eut', 'growthGainPct:lme(e,t),crisisWeights:gpmCrisisWeights})}else eut'],
    ['growthGainPct:r.growthGainPct})', 'growthGainPct:r.growthGainPct,crisisWeights:r.crisisWeights})'],
    ['I*=Lct(b,p.id)*partyOrganizingWeight(b,p.id)',
      'I*=Lct(b,p.id)*partyOrganizingWeight(b,p.id)*(a.crisisWeights?.[b.id]??1)'],
    ['_electorateBreakdown(t){return CWa(this,t)}', '_electorateBreakdown(t,gpmIncludeCrisis=true){return CWa(this,t,gpmIncludeCrisis)}'],
    ['function CWa(e,t){', 'function CWa(e,t,gpmIncludeCrisis=true){'],
    ['let u=IWa(a,c,n),d=Object.entries(u)', 'let u=IWa(a,c,n,gpmIncludeCrisis?a.gpmPoliticalCrisis?.weights:null),d=Object.entries(u)'],
    ['function IWa(e,t,a){return Pke', 'function IWa(e,t,a,gpmCrisisWeights=null){return Pke'],
    ['charisma:1,growthGainPct:a})}function _Wa', 'charisma:1,growthGainPct:a,crisisWeights:gpmCrisisWeights})}function _Wa'],
  ];
  return changes.reduce((bundle, [before, after]) => replaceOnce(bundle, before, after), source);
}

module.exports = { patchPoliticalCrisisWorker };
