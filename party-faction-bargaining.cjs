"use strict";

const subjects = ["programme", "organizing"];
const defaultMandate = { enabled: false, subjects, maxCashM: .05, reserveM: .025 };

function gpmFactionMandate(input) {
  const defaults = gpmFactionMandateDefaults;
  return {
    enabled: input?.enabled === true,
    subjects: defaults.subjects.filter(subject => !Array.isArray(input?.subjects) || input.subjects.includes(subject)),
    maxCashM: Number.isFinite(input?.maxCashM) ? gpmDomesticMoney(Math.max(0, Math.min(1, input.maxCashM))) : defaults.maxCashM,
    reserveM: Number.isFinite(input?.reserveM) ? gpmDomesticMoney(Math.max(0, Math.min(1000, input.reserveM))) : defaults.reserveM,
  };
}

function gpmFactionId(label) {
  return partyCongressFactionId(label);
}

function gpmFactionResolveId(state, id) {
  return Object.hasOwn(state?.legacyFactionIds || {}, id) ? state.legacyFactionIds[id] : id;
}

function gpmFactionAlignment(ideology, programme, positions) {
  const choice = partyCongressProgrammes()[programme];
  return choice.issue ? partyCongressIssueAffinity(positions, choice)
    : choice.direction * (choice.axis === "economicWeight" ? ideology.econ : ideology.gov);
}

function gpmFactionSetDoctrine(faction, group) {
  faction.displayLabel = group.displayLabel;
  faction.doctrineId = group.doctrineId;
  faction.positions = group.positions;
}

function gpmFactionHasRedLine(faction, programme) {
  const choice = partyCongressProgrammes()[programme];
  return choice?.issue ? partyCongressIssueAffinity(faction.positions, choice) <= -.43
    : (faction.redLines || []).includes(programme);
}

function gpmFactionAddMigratedDoctrinePolicy(faction) {
  const family = gpmCongressDoctrine(faction.doctrineId)?.family;
  const choices = Object.entries(partyCongressProgrammes()).filter(([, choice]) => choice.issue && choice.family === family);
  const opposing = choices.filter(([id]) => gpmFactionHasRedLine(faction, id)).map(([id]) => id);
  const supported = choices.map(([id, choice]) => ({ id, affinity: partyCongressIssueAffinity(faction.positions, choice) }))
    .filter(choice => choice.affinity > .12)
    .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id));
  // A migrated term keeps legacy priorities and red lines. Only the newly available motions need positions.
  faction.redLines = [...new Set([...(faction.redLines || []), ...opposing])];
  if (supported.length) faction.priorities = [...new Set([supported[0].id, ...(faction.priorities || [])])];
}

function gpmFactionMigratePartyDoctrines(sim, country, party) {
  const state = party.gpmFactionPolitics;
  if (!state || state.version >= 2 || !gpmPartyIdentity(party).congressDoctrine) return;
  const previous = Object.values(state.factions || {});
  if (!previous.length) { state.version = 2; return; }
  const planning = partyCongressPlanningData(sim, country);
  const data = partyCongressView(sim, country, party.id, planning.electorate, planning.people, null, true);
  const groups = partyCongressFactions(data, data.size).filter(group => group.doctrineId && group.seats > 0);
  const committed = new Set((state.offers || []).filter(gpmFactionOpen).map(offer => offer.factionId));
  const platform = data.profiles.find(profile => profile.origin === "platform");
  const oldPlatform = estimatePartyIdeology(platform?.ideology);
  // Preserve each existing representative and promise in a distinct record when several old blocs overlap.
  const reserved = new Set();
  const factions = {}, aliases = {}, assignments = {}, protectedLabels = [];
  previous.sort((a, b) => Number(b.label === oldPlatform) - Number(a.label === oldPlatform) ||
    Number(committed.has(b.id)) - Number(committed.has(a.id)) ||
    (b.seats || 0) - (a.seats || 0) || a.id.localeCompare(b.id));
  for (const faction of previous) {
    const oldKey = faction.label;
    const candidates = groups.filter(group => !reserved.has(group.id) && group.legacyWeights[oldKey] > 0);
    const anchored = oldKey === oldPlatform && candidates.find(group => group.doctrineId === data.identity.congressDoctrine.platform);
    const target = anchored || candidates.sort((a, b) => b.legacyWeights[oldKey] - a.legacyWeights[oldKey] || a.id.localeCompare(b.id))[0];
    if (!target) {
      factions[faction.id] = faction;
      protectedLabels.push(oldKey);
      continue;
    }
    reserved.add(target.id);
    assignments[oldKey] = target.doctrineId;
    aliases[faction.id] = target.id;
    factions[target.id] = faction;
    for (const period of sim.people?.get(faction.leadership?.personId)?.gpmFactionCareer || []) {
      if (period.factionId === faction.id && period.partyId === party.id && period.countryKey === country.key && period.untilDay == null) {
        period.factionId = target.id;
      }
    }
    faction.id = target.id;
    faction.label = target.label;
    gpmFactionSetDoctrine(faction, target);
    gpmFactionAddMigratedDoctrinePolicy(faction);
  }
  for (const offer of state.offers || []) {
    const previousId = offer.factionId;
    if (!Object.hasOwn(aliases, previousId)) continue;
    offer.factionId = aliases[previousId];
    const prefix = "[" + JSON.stringify(previousId) + ",";
    if (offer.requestKey?.startsWith(prefix)) {
      offer.requestKey = "[" + JSON.stringify(offer.factionId) + "," + offer.requestKey.slice(prefix.length);
    }
  }
  for (const outcome of state.policyOutcomes || []) {
    outcome.factionIds = outcome.factionIds.map(id => aliases[id] || id);
  }
  state.factions = factions;
  state.legacyFactionIds = aliases;
  state.legacyAssignments = assignments;
  state.legacyProtectedLabels = protectedLabels;
  state.version = 2;
}

function gpmMigrateFactionDoctrines(sim) {
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) {
      if (!party.gpmFactionPolitics) continue;
      gpmFactionMigratePartyDoctrines(sim, country, party);
      gpmFactionSeparatePartyLeader(sim, country, party);
    }
  }
}

function gpmFactionOpen(offer) {
  return ["offered", "countered", "accepted"].includes(offer.status);
}

function gpmFactionPublicOffer({ requestId, requestKey, ...offer }) {
  return offer;
}

function gpmFactionReview(sim, country, party) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  gpmFactionMigratePartyDoctrines(sim, country, party);
  const old = party.gpmFactionPolitics;
  const sizeState = party.gpmCongressSizeState;
  const pendingResize = sizeState?.pendingResize;
  const nextReviewDay = pendingResize?.effectiveDay ?? old?.nextReviewDay;
  if (sim.day < nextReviewDay) return { ok: false, reason: "review", nextReviewDay };
  const planning = partyCongressPlanningData(sim, country);
  const data = partyCongressView(sim, country, party.id, planning.electorate, planning.people);
  const size = pendingResize?.size ?? data.size;
  const baseline = partyCongressFactions({ ...data, factionDelegateFactors: {} }, size);
  if (!baseline.length) return { ok: false, reason: "review" };

  const version = data.identity.congressDoctrine ? 2 : 1;
  const state = old ?? { version, factions: {}, offers: [], nextId: 1 };
  // Test a resize against the roster with the new review's organization factors.
  const reviewed = pendingResize ? { ...state, factions: Object.fromEntries(Object.entries(state.factions)
    .map(([id, faction]) => [id, { ...faction, organization: faction.organization && { ...faction.organization } }])) }
    : state;
  const baselineByLabel = new Map(baseline.map(group => [group.label, group]));
  const refresh = (faction, group) => {
    gpmFactionSetDoctrine(faction, group);
    faction.ideology = Object.fromEntries(gpmAxes.map(({ id }) => [id, group.axisWeights[id] / group.weight]));
    gpmFactionDevelopmentReview(sim.day, reviewed, faction);
  };
  for (const faction of Object.values(reviewed.factions)) {
    const group = baselineByLabel.get(faction.label);
    faction.seats = group?.seats || 0;
    if (group) refresh(faction, group);
  }

  const represented = partyCongressFactions({ ...data, factionDelegateFactors: gpmFactionDelegateFactors(reviewed) }, size);
  if (pendingResize) {
    const seated = new Set(represented.filter(group => group.seats > 0).map(group => group.label));
    const blocking = state.offers.filter(offer => offer.status === "accepted" && offer.deadlineDay > sim.day &&
      state.factions[offer.factionId] && !seated.has(state.factions[offer.factionId].label));
    if (blocking.length) {
      const titles = new Map(represented.map(group => [group.label, group.displayLabel]));
      const factionLabels = [...new Set(blocking.map(offer => {
        const label = state.factions[offer.factionId].label;
        return titles.get(label) || partyCongressFactionLabel(label);
      }))].sort();
      const untilDay = Math.min(...blocking.map(offer => offer.deadlineDay));
      pendingResize.effectiveDay = untilDay;
      pendingResize.deferred = { reason: "commitment", factionLabels, untilDay, offerIds: blocking.map(offer => offer.id) };
      return { ok: true, changed: true, size: data.size, pendingResize, nextReviewDay: untilDay };
    }
  }
  const minimum = partyCongressRecognitionSeats(size);
  for (const group of represented) {
    const id = gpmFactionId(group.label);
    let faction = reviewed.factions[id];
    if (!faction) {
      if (group.seats < minimum) continue;
      faction = reviewed.factions[id] = { id, label: group.label, trust: 50, organizedDay: sim.day };
      refresh(faction, group);
      // A newly recognized faction starts with neutral representation at this review.
      faction.organization.factor = 1;
    }
    faction.organization.delegateChange = group.seats - baselineByLabel.get(group.label).seats;
    faction.seats = group.seats;
  }

  party.gpmFactionPolitics = state;
  state.factions = reviewed.factions;
  gpmRecordPartyIdentity(party);
  state.nextReviewDay = sim.day + 90;
  if (pendingResize) {
    sizeState.size = size;
    delete sizeState.pendingResize;
    for (const faction of Object.values(state.factions)) {
      if (!faction.seats && faction.leadership?.personId) {
        gpmFactionLeader(sim, country, party, faction, new Set(), planning.people, false);
      }
    }
  }
  gpmFactionUpdateLeaders(sim, country, party, planning.people);
  return { ok: true, changed: true, size, nextReviewDay: state.nextReviewDay, pendingResize: null,
    ...(pendingResize ? { appliedResize: { ...pendingResize, appliedDay: sim.day } } : {}) };
}

function gpmFactionPartyLeader(sim, country, party) {
  const offices = tao(sim, country, party.id) ? sim.playerControl?.controlledOfficeIds || [] : HW(country, party);
  return o3a(sim, country, party.id, HZ(country, party, offices).heldOfficeIds);
}

function gpmFactionSeparatePartyLeader(sim, country, party) {
  const state = party?.gpmFactionPolitics;
  if (state?.nextReviewDay == null || !partyCongressEligible(party)) return;
  const partyLeaderId = gpmFactionPartyLeader(sim, country, party)?.id;
  if (!partyLeaderId || !Object.values(state.factions).some(faction =>
    faction.seats > 0 && faction.leadership?.personId === partyLeaderId)) return;
  gpmFactionUpdateLeaders(sim, country, party, partyCongressPlanningData(sim, country).people, partyLeaderId);
}

function gpmFactionUpdateLeaders(sim, country, party, people, partyLeaderId = gpmFactionPartyLeader(sim, country, party)?.id) {
  const state = party.gpmFactionPolitics;
  const factions = Object.values(state?.factions || {}).filter(faction => faction.seats > 0);
  const used = new Set(partyLeaderId ? [partyLeaderId] : []);
  const minimum = partyCongressRecognitionSeats(party.gpmCongressSizeState?.size ?? gpmCongressDefaultSize);
  for (const faction of factions) {
    const outgoingId = faction.leadership?.personId;
    const others = new Set(factions.filter(other => other !== faction).map(other => other.leadership?.personId).filter(Boolean));
    const leader = gpmFactionLeader(sim, country, party, faction, new Set([...used, ...others]), people, faction.seats >= minimum);
    if (leader) used.add(leader.id);
    const separating = outgoingId && outgoingId === partyLeaderId;
    if (!separating && !leader) continue;
    // A commitment already accepted by the party follows the faction during this role separation.
    for (const offer of state.offers) {
      if (offer.factionId !== faction.id || !gpmFactionOpen(offer)) continue;
      const outgoingOffer = separating && offer.leaderId === outgoingId;
      if (outgoingOffer && offer.status !== "accepted") {
        gpmFactionClose(sim, country, party, state, offer, "expired", offer.deadlineDay <= sim.day ? "deadline" : "leader");
      } else if (offer.status === "accepted" && offer.deadlineDay > sim.day && (offer.leaderId === null || outgoingOffer)) {
        offer.leaderId = leader?.id ?? null;
      }
    }
  }
}

function gpmFactionLiveLeader(sim, country, party, faction) {
  if (!faction?.seats || !partyCongressEligible(party)) return null;
  const person = sim.people?.get(faction.leadership?.personId);
  if (!person || faction.leadership.termEndDay <= sim.day) return null;
  const charter = gpmFactionLeadershipCharter(sim, party, faction);
  if (charter.method === "none" || faction.leadership.charterKey !== charter.key) return null;
  return gpmFactionLeaderEligibility(sim, country, party, charter, person, new Set()).eligible ? person : null;
}

function gpmFactionEndorsements(sim, country, party) {
  const state = party.gpmFactionPolitics;
  const accepted = (state?.offers || []).filter(offer => offer.status === "accepted" && offer.deadlineDay > sim.day);
  if (!accepted.length) return [];
  const partyLeaderId = gpmFactionPartyLeader(sim, country, party)?.id;
  return accepted.flatMap(offer => {
    if (!offer.leaderId || offer.leaderId === partyLeaderId) return [];
    const faction = state.factions[offer.factionId];
    if (gpmFactionLiveLeader(sim, country, party, faction)?.id !== offer.leaderId) return [];
    return [{ label: faction.label, programme: offer.programme, extraYes: offer.extraYes }];
  });
}

function gpmFactionPresentationTitles(sim, country, party) {
  const { electorate, people } = partyCongressPlanningData(sim, country);
  const congress = partyCongressView(sim, country, party.id, electorate, people);
  return new Map(partyCongressFactions(congress, congress.size).map(group => [group.label, group.displayLabel]));
}

function gpmFactionPresentationTitle(sim, country, party, faction) {
  return gpmFactionPresentationTitles(sim, country, party).get(faction.label) || partyCongressFactionLabel(faction.label);
}

function gpmFactionView(sim, country, party) {
  const state = party.gpmFactionPolitics;
  const offers = state?.offers || [];
  const partyLeader = gpmFactionPartyLeader(sim, country, party);
  return {
    day: sim.day,
    initialized: state?.nextReviewDay != null,
    nextReviewDay: party.gpmCongressSizeState?.pendingResize?.effectiveDay ?? state?.nextReviewDay ?? null,
    partyLeader: partyLeader ? { id: partyLeader.id, name: DX(partyLeader) } : null,
    factions: Object.values(state?.factions || {}).map(({ id, label, seats, trust, priorities, redLines, leadership, organization, issuePriorities, doctrineId, positions }) => ({
      id, label, displayLabel: partyCongressFactionLabel(label), seats, trust, priorities, redLines, doctrineId, positions, leader: gpmFactionLeaderView(sim, { leadership }),
      organization, issuePriorities,
    })),
    offers: offers.slice().reverse().filter((offer, index) => index < 30 || gpmFactionOpen(offer))
      .map(gpmFactionPublicOffer),
    mandate: gpmFactionMandate(state?.mandate),
    programmes: Object.entries(partyCongressAvailableProgrammes({ identity: gpmPartyIdentity(party) }))
      .map(([id, choice]) => ({ id, label: choice.label })),
  };
}

function gpmFactionCongressData(sim, country, partyId) {
  const party = AL(country, partyId);
  if (!party || yn(country) !== partyId) return null;
  const congress = partyCongressView(sim, country, partyId, undefined, undefined, {
    bargaining: gpmFactionView(sim, country, party),
  });
  congress.bargaining.programmes = Object.entries(partyCongressAvailableProgrammes(congress))
    .map(([id, choice]) => ({ id, label: choice.label }));
  return congress;
}

function gpmFactionCashAvailable(sim, party, cashM, actor, subject) {
  const grants = partyForeignFundingGrants(party.gpmForeignFunding);
  const restricted = grants.reduce((sum, grant) => sum + grant.unspentM, 0);
  if (cashM > Math.max(0, gpmDomesticMoney(party.organization.treasuryM - restricted))) return false;
  if (actor !== "staff") return true;
  const state = party.gpmFactionPolitics;
  const mandate = gpmFactionMandate(state.mandate);
  const month = p3e(sim);
  const paid = state.offers.reduce((sum, offer) => offer.acceptedBy === "staff" && offer.reservedMonth === month &&
    ["accepted", "delivered"].includes(offer.status) ? sum + offer.cashM : sum, 0);
  return mandate.subjects.includes(subject) && mandate.enabled && (!cashM ||
    (gpmDomesticMoney(paid + cashM) <= mandate.maxCashM &&
      gpmDomesticMoney(party.organization.treasuryM - cashM) >= mandate.reserveM));
}

function gpmFactionQuote(sim, country, party, input, actor) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  const state = party.gpmFactionPolitics;
  const faction = state?.factions[gpmFactionResolveId(state, input.factionId)];
  if (!state || !faction) return { ok: false, reason: "review" };
  const { subject, programme } = input;
  const cashM = input.cashM ?? 0;
  if (!gpmFactionMandateDefaults.subjects.includes(subject) || !Object.hasOwn(partyCongressProgrammes(), programme) ||
      !Number.isFinite(cashM) || cashM < 0 || cashM > 1 || (subject === "programme" && cashM !== 0)) {
    return { ok: false, reason: "terms" };
  }
  const leaderId = faction.leadership?.personId;
  if (leaderId && leaderId === gpmFactionPartyLeader(sim, country, party)?.id) return { ok: false, reason: "party-leader" };
  if (state.offers.some(offer => offer.factionId === faction.id && gpmFactionOpen(offer) && offer.deadlineDay > sim.day)) {
    return { ok: false, reason: "conflict" };
  }
  const leader = gpmFactionLiveLeader(sim, country, party, faction);
  if (!leader) return { ok: false, reason: "leader" };
  const data = partyCongressView(sim, country, party.id);
  const vote = partyCongressProgrammeVote(data, programme);
  if (!vote.ok) return { ok: false, reason: "programme" };
  const group = vote.factions.find(item => item.label === faction.label);
  const affinity = gpmFactionAlignment(faction.ideology, programme, faction.positions);
  const needed = subject === "organizing" ? Math.round(8 + faction.seats * .2 + Math.max(0, 50 - faction.trust) * .2) / 1000 : 0;
  const money = Math.max(needed, gpmDomesticMoney(cashM));
  const support = .18 + .10 * affinity + .002 * (faction.trust - 50) + (subject === "organizing" ? .08 : 0);
  const extraYes = Math.min((group?.currentSeats || 0) - (group?.yes || 0), Math.max(1, Math.round(faction.seats * support)));
  const decision = gpmFactionHasRedLine(faction, programme) ? ["refused", "red-line"] :
    !extraYes ? ["refused", "programme"] :
    !gpmFactionCashAvailable(sim, party, money, actor, subject) ? ["refused", "budget"] :
    cashM < needed ? ["countered", "market"] : ["offered", affinity >= .12 ? "aligned" : "open"];
  const [status, reason] = decision;
  const quote = { ok: true, status, reason, factionId: faction.id, leaderId: leader.id, subject,
    programme, cashM: status === "refused" ? gpmDomesticMoney(cashM) : money,
    deadlineDay: sim.day + 21, extraYes: status === "refused" ? 0 : extraYes };
  quote.expected = JSON.stringify([quote.factionId, quote.leaderId, subject, programme, quote.cashM,
    quote.status, quote.reason, quote.deadlineDay, quote.extraYes]);
  return quote;
}

function gpmFactionClose(sim, country, party, state, offer, status, reason) {
  if (!gpmFactionOpen(offer)) return;
  const wasCommitted = offer.status === "accepted";
  const faction = state.factions[offer.factionId];
  offer.status = status;
  offer.reason = reason;
  offer.closedDay = sim.day;
  if (!wasCommitted) return;

  if (status === "delivered") {
    faction.trust = Math.min(100, faction.trust + 10);
    if (offer.cashM) {
      const before = gpmDomesticMembership(party).members;
      // An organizing grant supports membership work through the same member and dues system as regional projects.
      gpmDomesticEarnMembers(sim, country, party, "investment", offer.cashM * .4);
      offer.membersAdded = gpmDomesticMembership(party).members - before;
    }
  } else {
    faction.trust = Math.max(0, faction.trust - 15);
    if (offer.cashM && party.organization) {
      party.organization.treasuryM = gpmDomesticMoney(party.organization.treasuryM + offer.cashM);
      gpmDomesticReceipt(sim, country, party, "faction-refund", { cashM: offer.cashM, details: gpmFactionPresentationTitle(sim, country, party, faction) });
    }
  }
  gpmFactionCloseDevelopment(state, faction, offer);
}

function gpmFactionExpire(sim, country, party) {
  const state = party.gpmFactionPolitics;
  const threshold = partyCongressRecognitionSeats(party.gpmCongressSizeState?.size ?? gpmCongressDefaultSize);
  for (const offer of state?.offers || []) {
    if (!gpmFactionOpen(offer)) continue;
    const faction = state.factions[offer.factionId];
    if (offer.status === "accepted" && offer.deadlineDay > sim.day &&
        (offer.leaderId === null || (faction?.seats > 0 && faction.seats < threshold))) continue;
    const leader = gpmFactionLiveLeader(sim, country, party, faction);
    if (offer.deadlineDay > sim.day && leader?.id === offer.leaderId) continue;
    const reason = offer.deadlineDay <= sim.day ? "deadline" : "leader";
    gpmFactionClose(sim, country, party, state, offer, offer.status === "accepted" ? "breached" : "expired", reason);
  }
}

function gpmFactionSettleVote(sim, country, party, vote) {
  const state = party.gpmFactionPolitics;
  gpmFactionSeparatePartyLeader(sim, country, party);
  gpmFactionExpire(sim, country, party);
  for (const offer of state?.offers || []) {
    if (offer.status !== "accepted") continue;
    if (offer.programme === vote.programme) {
      gpmFactionClose(sim, country, party, state, offer, vote.passed ? "delivered" : "breached", vote.passed ? "vote-passed" : "vote-failed");
    } else if (vote.passed) {
      gpmFactionClose(sim, country, party, state, offer, "breached", "other-programme");
    }
  }
}

function gpmFactionAction(sim, country, party, input, actor = "player") {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  if (actor === "player" && (country.key !== sim.playerKey || yn(country) !== party.id)) return { ok: false, reason: "party" };
  if (actor !== "player" && (actor === "staff") !== tao(sim, country, party.id)) return { ok: false, reason: "party" };
  if (input.action === "review") return gpmFactionReview(sim, country, party);
  if (input.action === "mandate" && actor === "player") {
    const state = party.gpmFactionPolitics ??= { version: 1, factions: {}, offers: [], nextId: 1 };
    state.mandate = gpmFactionMandate(input.mandate);
    return { ok: true, changed: true };
  }

  const state = party.gpmFactionPolitics;
  if (!state || state.nextReviewDay == null) return { ok: false, reason: "review" };
  if (actor === "staff" && !state.mandate?.enabled) return { ok: false, reason: "mandate" };
  gpmFactionDaily(sim, country, party);
  if (input.action === "offer") {
    const requestId = input.requestId;
    if (typeof requestId !== "string" || !/^[a-z0-9:_.-]{1,150}$/i.test(requestId)) return { ok: false, reason: "terms" };
    const factionId = gpmFactionResolveId(state, input.factionId);
    const requestKey = JSON.stringify([factionId, input.subject, input.programme, input.cashM ?? 0]);
    const duplicate = state.offers.find(offer => offer.requestId === requestId);
    if (duplicate) return duplicate.requestKey === requestKey ?
      { ok: true, changed: false, offer: gpmFactionPublicOffer(duplicate) } : { ok: false, reason: "stale" };
    const quote = gpmFactionQuote(sim, country, party, input, actor);
    if (!quote.ok) return quote;
    if (input.expected != null && quote.expected !== input.expected) return { ok: false, reason: "stale" };
    const { ok, expected, ...terms } = quote;
    const offer = { ...terms, id: `faction-offer:${state.nextId++}`, day: sim.day, requestId, requestKey, actor };
    state.offers.push(offer);
    return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
  }

  const offer = state.offers.find(item => item.id === input.offerId);
  if (!offer || !["accept", "withdraw"].includes(input.action)) return { ok: false, reason: "terms" };
  if (input.action === "accept" && ["accepted", "delivered"].includes(offer.status)) {
    return { ok: true, changed: false, offer: gpmFactionPublicOffer(offer) };
  }
  if (!["offered", "countered"].includes(offer.status)) return { ok: false, reason: offer.reason, offer: gpmFactionPublicOffer(offer) };
  if (input.action === "withdraw") {
    gpmFactionClose(sim, country, party, state, offer, "withdrawn", "withdrawn");
    return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
  }
  if (partyCongressActiveProgramme(party, sim.day) ||
    sim.day < (party.gpmCongressSizeState?.nextProgrammeVoteDay || 0)) return { ok: false, reason: "programme" };
  const faction = state.factions[offer.factionId];
  if (gpmFactionHasRedLine(faction, offer.programme)) return { ok: false, reason: "red-line" };
  if (!gpmFactionCashAvailable(sim, party, offer.cashM, actor, offer.subject)) return { ok: false, reason: "budget" };
  if (offer.cashM) party.organization.treasuryM = gpmDomesticMoney(party.organization.treasuryM - offer.cashM);
  Object.assign(offer, { status: "accepted", reason: offer.cashM ? "reserved" : "accepted", acceptedDay: sim.day,
    reservedMonth: p3e(sim), acceptedBy: actor });
  gpmDomesticReceipt(sim, country, party, "faction-commitment", { cashM: -offer.cashM,
    details: gpmFactionPresentationTitle(sim, country, party, faction), staffDecision: true });
  return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
}

function gpmFactionAutomate(sim, country, party, actor) {
  const state = party.gpmFactionPolitics;
  if (!partyCongressEligible(party) || (actor === "staff" && !state?.mandate?.enabled)) return;
  // An enacted programme marks an earlier review for parties without faction records.
  if (!state?.nextReviewDay && !party.gpmCongressSizeState?.lastProgrammeVote?.passed) return;
  if ((state?.nextReviewDay ?? 0) <= sim.day) gpmFactionAction(sim, country, party, { action: "review" }, actor);
  const current = party.gpmFactionPolitics;
  if (!current || partyCongressActiveProgramme(party, sim.day)) return;
  const open = current.offers.find(offer => offer.actor === actor &&
    ["offered", "countered"].includes(offer.status) && offer.deadlineDay > sim.day);
  if (open) {
    gpmFactionAction(sim, country, party, { action: "accept", offerId: open.id }, actor);
    return;
  }
  const programmes = partyCongressAvailableProgrammes({ identity: gpmPartyIdentity(party) });
  const programme = Object.keys(programmes).find(id => programmes[id].laws.some(law => country.laws?.[law] != null));
  const faction = Object.values(current.factions).find(item => item.seats > 0 && item.priorities.includes(programme));
  if (!faction || current.offers.some(offer => gpmFactionOpen(offer) && offer.deadlineDay > sim.day)) return;
  const mandate = gpmFactionMandate(actor === "staff" ? current.mandate : null);
  const subject = mandate.subjects[0];
  if (!subject) return;
  const result = gpmFactionAction(sim, country, party, { action: "offer", factionId: faction.id, subject, programme,
    requestId: `${actor}:${sim.day}:${faction.id}` }, actor);
  if (result.offer) gpmFactionAction(sim, country, party, { action: "accept", offerId: result.offer.id }, actor);
}

function gpmFactionDaily(sim, country, party, reviewResize = false) {
  let state = party.gpmFactionPolitics;
  if (state?.nextReviewDay != null) {
    gpmFactionSeparatePartyLeader(sim, country, party);
    gpmFactionExpire(sim, country, party);
  }
  if (!partyCongressEligible(party)) return;
  const pendingResize = reviewResize && party.gpmCongressSizeState?.pendingResize;
  if (pendingResize) {
    const clearedBlocker = pendingResize.deferred?.offerIds?.some(id => !state?.offers.some(offer =>
      offer.id === id && offer.status === "accepted" && offer.deadlineDay > sim.day));
    if (clearedBlocker) pendingResize.effectiveDay = Math.min(pendingResize.effectiveDay, sim.day);
    if (pendingResize.effectiveDay <= sim.day) {
      const resize = gpmFactionReview(sim, country, party);
      if (resize.appliedResize) return;
      state = party.gpmFactionPolitics;
    }
  }
  if (state?.nextReviewDay == null) return;
  const minimum = partyCongressRecognitionSeats(party.gpmCongressSizeState?.size ?? gpmCongressDefaultSize);
  const due = Object.values(state.factions).some(faction => {
    if (!faction.seats) return false;
    const leadership = faction.leadership;
    const charter = gpmFactionLeadershipCharter(sim, party, faction);
    if (faction.seats < minimum && !leadership?.personId) return false;
    if (!leadership || leadership.charterKey !== charter.key) return true;
    if (charter.method === "none") return false;
    if (leadership.retryDay > sim.day) return false;
    return !gpmFactionLiveLeader(sim, country, party, faction);
  });
  if (due) gpmFactionUpdateLeaders(sim, country, party, partyCongressPlanningData(sim, country).people);
}

function gpmFactionAgenda(sim, country, partyId) {
  const party = AL(country, partyId);
  const state = party?.gpmFactionPolitics;
  const offers = (state?.offers || []).filter(offer => gpmFactionOpen(offer) && offer.deadlineDay > sim.day);
  if (!offers.length) return [];
  const titles = gpmFactionPresentationTitles(sim, country, party);
  return offers.map(offer => {
    const { label } = state.factions[offer.factionId];
    const title = (titles.get(label) || partyCongressFactionLabel(label)) + " · " + partyCongressProgrammes()[offer.programme].label;
    return { id: offer.id, kind: "congress", tab: "congress", title, day: offer.day,
      deadlineDay: offer.deadlineDay, status: offer.status };
  });
}

function registerPartyFactionBargaining() {
  gvt("gpm.party.factionBargain", {
    apply(sim, country, input) { return gpmFactionAction(sim, country, AL(country, input.partyId), input); },
  });
}

module.exports = { workerFunctions: [
  `const gpmFactionMandateDefaults = ${JSON.stringify(defaultMandate)};`,
  gpmFactionMandate, gpmFactionId, gpmFactionResolveId, gpmFactionAlignment, gpmFactionSetDoctrine,
  gpmFactionHasRedLine, gpmFactionAddMigratedDoctrinePolicy,
  gpmFactionOpen, gpmFactionMigratePartyDoctrines, gpmMigrateFactionDoctrines, gpmFactionPublicOffer, gpmFactionReview,
  gpmFactionPartyLeader, gpmFactionSeparatePartyLeader, gpmFactionUpdateLeaders,
  gpmFactionLiveLeader, gpmFactionEndorsements, gpmFactionPresentationTitles, gpmFactionPresentationTitle, gpmFactionView, gpmFactionCongressData, gpmFactionCashAvailable, gpmFactionQuote, gpmFactionClose,
  gpmFactionExpire, gpmFactionSettleVote, gpmFactionAction, gpmFactionAutomate, gpmFactionDaily, gpmFactionAgenda,
  registerPartyFactionBargaining,
] };
