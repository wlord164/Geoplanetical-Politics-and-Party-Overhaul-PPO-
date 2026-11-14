"use strict";

const gpmOrganizingTerms = {
  meetingDiscount: .5, fullDiscountAt: .025, noDiscountAt: .05,
  contactCap: .32, contactGain: .24, meetingBonus: .85,
  fullBonusAt: .04, noBonusAt: .06, movementFullParticipation: .10,
};

function partyOrganizingWeight(party, groupId) {
  return 1 + Math.min(.5, Math.max(0, party.gpmOrganizing?.groups?.[groupId] || 0));
}

function migratePartyOrganizing(party, day) {
  const record = party.gpmOrganizing;
  if (!record || record.version === 2) return record;
  record.groups ||= {};
  for (const [id, weight] of Object.entries(record.groups)) {
    record.groups[id] = Number.isFinite(weight) ? Math.min(.5, Math.max(0, weight)) : 0;
  }
  record.day = Math.min(day, Number.isFinite(record.day) ? record.day : day);
  record.lastMeetingByBloc ||= {};
  const previous = record.lastAction;
  if (previous?.kind === "meeting") {
    for (const id of previous.groups || []) {
      record.lastMeetingByBloc[id] = Math.max(record.lastMeetingByBloc[id] ?? previous.day, previous.day);
    }
  }
  record.backed ||= [];
  record.projects ||= [];
  record.version = 2;
  return record;
}

function decayPartyOrganizing(party, day, rules = gpmCampaignRulesFor()) {
  const record = migratePartyOrganizing(party, day);
  if (!record || day <= record.day) return;
  const remaining = rules.organizingHalfLife > 0 ? Math.pow(.5, (day - record.day) / rules.organizingHalfLife) : 1;
  for (const [id, weight] of Object.entries(record.groups)) {
    const next = Math.min(.5, Math.max(0, weight)) * remaining;
    if (next < .000001) delete record.groups[id];
    else record.groups[id] = next;
  }
  record.day = day;
}

function peacefulPartyMovement(movement) {
  return movement?.current?.stageId === "mobilization" && !movement.current.riot &&
    !movement.leadershipDemand && !movement.claim?.resolved && partyMovementParticipants(movement) > 0;
}

function partyMovementParticipants(movement) {
  // National totals can overlap. The affected blocs have no reported individual counts.
  return Math.max(0, movement?.current?.participantsM || 0, movement?.current?.strikeWorkersM || 0);
}

function partyMovementParticipation(country, movement, groupShare, fullTurnout) {
  const population = Math.max(0, (country.pop || 0) * groupShare);
  return population > 0 ? Math.min(1, partyMovementParticipants(movement) / (population * fullTurnout)) : 0;
}

function partyOrganizingSeatless(party, country) {
  return !country.pol?.chambers?.some(chamber => chamber.composition?.[party.id] > 0);
}

function partyOrganizingTaper(party, start, end) {
  return Math.max(0, Math.min(1, (end - (party.support || 0)) / (end - start)));
}

function partyMovementDemandFit(party, movement, group) {
  const ideology = party.ideology || {};
  if (movement.demandId === "civil_liberties") return .25 + .75 * (1 - (ideology.gov || 0)) / 2;
  if (["jobs_wages", "public_services"].includes(movement.demandId)) return .55 + .45 * (1 - (ideology.econ || 0)) / 2;
  if (["purchasing_power", "tax_social_policy"].includes(movement.demandId)) {
    return 1 - .25 * Math.abs((ideology.econ || 0) - (group.ideal?.econ || 0));
  }
  if (movement.demandId === "peace") {
    return 1 - .2 * Math.abs((ideology.nat || 0) - (group.ideal?.nat || 0));
  }
  return 1;
}

function partyOrganizingQuote(sim, country, partyId, kind, targetId, groupList = Fwe(country)) {
  const party = YL(country, partyId);
  const record = party?.gpmOrganizing;
  if (!party?.organization || party.legal === false) {
    return { ok: false, reason: "party" };
  }
  if (kind !== "meeting" && kind !== "movement") return { ok: false, reason: "action" };
  const day = sim.day || 0;
  const meeting = kind === "meeting";
  const durationDays = meeting ? 21 : 14;
  const movement = meeting ? null : country.domestic?.movements?.find(item => item.id === targetId);
  if (!meeting && !peacefulPartyMovement(movement)) return { ok: false, reason: "movement" };

  const groups = groupList.filter(group => meeting ? group.id === targetId : movement.groupIds?.includes(group.id));
  if (!groups.length) return { ok: false, reason: "group" };
  const totalShare = groups.reduce((sum, group) => sum + group.share, 0);
  const terms = gpmOrganizingTerms;
  const seatlessMeeting = meeting && partyOrganizingSeatless(party, country);
  const discount = seatlessMeeting ? terms.meetingDiscount *
    partyOrganizingTaper(party, terms.fullDiscountAt, terms.noDiscountAt) : 0;
  const regularCash = zL(meeting ? .02 + .12 * totalShare : .012 + .025 * totalShare);
  const regularActivists = zL(meeting ? .15 + 1.4 * totalShare : .2 + .9 * totalShare);
  const cash = Math.round(regularCash * (1 - discount) * 1e6) / 1e6;
  const activistsK = zL(regularActivists * (1 - discount));
  const influence = meeting ? 2 : 4;
  const previous = record?.lastAction;
  const lastBlocMeeting = record?.lastMeetingByBloc?.[targetId] ??
    (previous?.kind === "meeting" && previous.groups?.includes(targetId) ? previous.day : -90);
  const availableDay = meeting
    ? Math.max((record?.lastMeeting ?? -30) + 30, lastBlocMeeting + 90)
    : (record?.lastBacking ?? -60) + 60;
  const participation = meeting ? 0 : partyMovementParticipation(country, movement, totalShare, terms.movementFullParticipation);
  const meetingBonus = seatlessMeeting ? terms.meetingBonus * partyOrganizingTaper(party, terms.fullBonusAt, terms.noBonusAt) : 0;
  const credibility = Math.max(0, Math.min(1, party.organization.credibility ?? .5));
  const rules = gpmCampaignRulesFor(sim);
  const remaining = rules.organizingHalfLife > 0
    ? Math.pow(.5, Math.max(0, day - (record?.day ?? day)) / rules.organizingHalfLife) : 1;
  const sizeFactor = partyCampaignSmallPartyFactor(party, rules);
  const effects = groups.map(group => {
    const distance = gpmAxes.reduce((sum, { id }) => sum + Math.abs((party.ideology?.[id] || 0) - (group.ideal?.[id] || 0)), 0);
    const fit = Math.max(0, 1 - distance / 8);
    const present = Math.min(.5, Math.max(0, record?.groups?.[group.id] || 0)) * remaining;
    const presence = Math.max(0, Math.min(1, party.outreach?.networks?.[group.id] || 0));
    const base = meeting
      ? (.12 * (.45 + .55 * presence) + meetingBonus * fit) * (.45 + .55 * fit) * (.55 + .45 * credibility)
      : .24 * fit ** 2 * (.45 + .55 * credibility) * Math.sqrt(participation) *
        partyMovementDemandFit(party, movement, group) / Math.sqrt(groups.length);
    const contacts = meeting ? Math.max(0, Math.min(terms.contactCap - presence,
      terms.contactGain * fit * (.5 + .5 * credibility))) : 0;
    return { id: group.id, present, increase: Math.max(0, base * sizeFactor * (1 - present / .5)),
      contacts, contactCap: terms.contactCap };
  });
  const organization = party.organization;
  let reason = null;
  if (!meeting && record?.backed?.includes(targetId)) reason = "already_backed";
  else if (record?.projects?.some(project => project.kind === kind)) reason = "active";
  else if (day < availableDay) reason = "cooldown";
  else if (effects.every(effect => effect.increase <= 0 && effect.contacts <= 0)) reason = "saturated";
  else if (organization.treasuryM < cash) reason = "budget";
  else if (organization.activistsK < activistsK) reason = "resources";
  else if (organization.influence < influence) reason = "influence";
  return { ok: !reason, reason, kind, targetId, availableDay, startDay: day, endDay: day + durationDays, durationDays,
    cash, activistsK, influence, effects, discount, participation,
    groupShare: totalShare, fullTurnout: terms.movementFullParticipation };
}

function applyPartyOrganizing(sim, country, partyId, kind, targetId) {
  const quote = partyOrganizingQuote(sim, country, partyId, kind, targetId);
  if (!quote.ok) return quote;
  const party = YL(country, partyId);
  const day = sim.day || 0;
  const record = party.gpmOrganizing ||= { version: 2, groups: {}, day, backed: [], projects: [], lastMeetingByBloc: {} };
  decayPartyOrganizing(party, day, gpmCampaignRulesFor(sim));
  party.organization.treasuryM = partyForeignFundingTreasury(party,
    Math.round((party.organization.treasuryM - quote.cash) * 1e6) / 1e6);
  party.organization.influence = zL(party.organization.influence - quote.influence);
  party.organization.activistsK = zL(party.organization.activistsK - quote.activistsK);
  record.projects.push({ kind, targetId, startDay: day, endDay: quote.endDay, workedThrough: day,
    activistsK: quote.activistsK,
    ...(kind === "movement" ? { participation: quote.participation, groupShare: quote.groupShare, fullTurnout: quote.fullTurnout } : {}),
    effects: quote.effects.map(({ id, increase, contacts, contactCap }) =>
      ({ id, increase, earned: 0, ...(contacts > 0 ? { contacts, contactCap, contactsEarned: 0 } : {}) })) });
  if (kind === "meeting") {
    record.lastMeeting = day;
    record.lastMeetingByBloc[targetId] = day;
  } else {
    record.lastBacking = day;
    record.backed.push(targetId);
  }
  record.lastAction = { kind, day, groups: quote.effects.map(effect => effect.id) };
  return { ok: true, changed: true };
}

function partyOrganizingMovementRate(country, project, movement, groups) {
  if (project.participation == null) return 1;
  const share = groups.reduce((sum, group) => sum + group.share, 0);
  const rate = partyMovementParticipation(country, movement, share || project.groupShare, project.fullTurnout);
  return project.participation > 0 ? Math.sqrt(Math.min(1, rate / project.participation)) : 0;
}

function creditPartyOrganizingContacts(sim, country, party, effect, amount, day) {
  party.outreach ??= { networks: {}, project: null, lastDay: day, lastStartedDay: null };
  Dnt(sim, country, party);
  const strength = party.outreach.networks[effect.id] || 0;
  const gain = Math.max(0, Math.min(effect.contactCap - strength, amount));
  if (gain > 0) party.outreach.networks[effect.id] = strength + gain;
  effect.contactsEarned = (effect.contactsEarned || 0) + gain;
}

function advancePartyOrganizing(sim, country, party, groups = null) {
  const day = sim.day || 0;
  const rules = gpmCampaignRulesFor(sim);
  const record = migratePartyOrganizing(party, day);
  if (!record) return;
  if (!record.projects.length) {
    decayPartyOrganizing(party, day, rules);
    return;
  }
  const existingGroups = groups || new Map(Fwe(country).map(group => [group.id, group]));
  const finalize = (project, finishedDay, reason = null) => {
    record.projects = record.projects.filter(item => item !== project);
    const available = party.organization.activistsK;
    party.organization.activistsK = zL(Math.min(1e5, available + project.activistsK));
    (record.recent ||= []).unshift({ kind: project.kind, targetId: project.targetId, finishedDay, reason,
      activistsK: zL(party.organization.activistsK - available), effects: project.effects.map(effect =>
        ({ id: effect.id, earned: effect.earned || 0, contactsEarned: effect.contactsEarned || 0 })) });
    record.recent.length = Math.min(3, record.recent.length);
  };
  const eligibleEffects = new Map();
  for (const project of [...record.projects]) {
    const movement = project.kind === "movement" ? country.domestic?.movements?.find(item => item.id === project.targetId) : null;
    const active = party.legal !== false && (project.kind === "meeting" || peacefulPartyMovement(movement));
    const effects = project.effects.filter(effect => existingGroups.has(effect.id) &&
      (project.kind === "meeting" || movement?.groupIds?.includes(effect.id)));
    if (!active || !effects.length) {
      const reason = party.legal === false ? "party" : !active ? "movement" : "group";
      finalize(project, day, reason);
    } else {
      const rate = project.kind === "movement"
        ? partyOrganizingMovementRate(country, project, movement, effects.map(effect => existingGroups.get(effect.id))) : 1;
      eligibleEffects.set(project, { effects, rate });
    }
  }
  const first = record.projects.reduce((soonest, project) => Math.min(soonest, project.workedThrough + 1), day + 1);
  for (let tick = first; tick <= day && record.projects.length; tick++) {
    decayPartyOrganizing(party, tick, rules);
    const credits = new Map();
    for (const project of record.projects) {
      if (tick <= project.workedThrough || tick > project.endDay) continue;
      const { effects, rate } = eligibleEffects.get(project);
      const duration = project.endDay - project.startDay;
      for (const effect of effects) {
        if (!credits.has(effect.id)) credits.set(effect.id, []);
        credits.get(effect.id).push({ effect, requested: effect.increase * rate / duration });
        if (effect.contacts > 0) creditPartyOrganizingContacts(sim, country, party, effect, effect.contacts / duration, tick);
      }
      project.workedThrough = tick;
    }
    for (const [id, entries] of credits) {
      const present = record.groups[id] || 0;
      const requested = entries.reduce((sum, entry) => sum + entry.requested, 0);
      if (requested <= 0) continue;
      const credited = Math.max(0, Math.min(.5 - present, requested));
      record.groups[id] = Math.min(.5, present + credited);
      for (const { effect, requested: portion } of entries) effect.earned += credited * (portion / requested);
    }
    for (const project of [...record.projects]) {
      if (tick >= project.endDay) finalize(project, tick);
    }
  }
  decayPartyOrganizing(party, day, rules);
}

function registerPartyOrganizing() {
  for (const [verb, kind] of [["gpm.party.meeting", "meeting"], ["gpm.party.backMovement", "movement"]]) {
    n5t(verb, {
      validate(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        const quote = partyOrganizingQuote(sim, country, input.partyId, kind, input.targetId);
        return quote.ok ? true : quote;
      },
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        return applyPartyOrganizing(sim, country, input.partyId, kind, input.targetId);
      },
    });
  }
}

function partyOrganizingForecast(sim, country, party, quote, through = quote.endDay + 14, context = null) {
  const blocs = context?.blocs ?? sim._voterBlocs?.(country);
  if (!blocs?.length || !quote.effects?.length || through <= sim.day) return null;
  const groups = context?.groups ?? new Map(Fwe(country).map(group => [group.id, group]));
  const governor = uc(sim, country, "head_of_gov");
  const charisma = governor ? IE(1 + (governor.traits.charisma - .5) * .3 +
    (governor.traits.notoriety || 0) * .12, .5, 1.7) : 1;
  const options = { blocs, salience: country.pol.salience, charisma, growthGainPct: O1e(sim, country) };
  // Project with the shared earnings and native weekly support functions in a private simulation clock.
  const clock = { day: sim.day, gpmCampaignRules: gpmCampaignRulesFor(sim), playerKey: null };
  const copy = member => ({
    ...member, organization: member.organization && { ...member.organization },
    outreach: member.outreach && structuredClone(member.outreach),
    gpmOrganizing: member.gpmOrganizing && structuredClone(member.gpmOrganizing),
  });
  const baseline = { ...country.pol, parties: country.pol.parties.map(copy) };
  const partyIndex = baseline.parties.findIndex(member => member.id === party.id);
  const withProject = copy(party);
  const record = withProject.gpmOrganizing ??= { version: 2, groups: {}, projects: [], day: sim.day };
  record.projects.push({ kind: quote.kind, targetId: quote.targetId, startDay: sim.day, endDay: quote.endDay,
    workedThrough: sim.day, activistsK: 0, participation: quote.participation, fullTurnout: quote.fullTurnout,
    groupShare: quote.groupShare, effects: quote.effects.map(effect => ({ ...effect, earned: 0 })) });
  // The native model holds each party's support between weekly recalculations.
  let withSupport = withProject.support;
  let alternate = baseline.parties.map(member => ({ ...member }));
  for (let tick = sim.day + 1; tick <= through; tick++) {
    clock.day = tick;
    advancePartyOrganizing(clock, country, withProject, groups);
    for (const member of baseline.parties) {
      if (member.gpmOrganizing?.projects.length) advancePartyOrganizing(clock, country, member, groups);
    }
    if (tick % 7) continue;
    for (const member of baseline.parties) {
      advancePartyOrganizing(clock, country, member, groups);
      Dnt(clock, country, member);
    }
    Dnt(clock, country, withProject);
    alternate = baseline.parties.map((member, index) => index === partyIndex
      ? { ...withProject, support: withSupport } : { ...member, support: alternate[index].support });
    Unt(baseline, {}, 7, options);
    Unt({ ...baseline, parties: alternate }, {}, 7, options);
    withSupport = alternate[partyIndex].support;
  }
  const before = Object.fromEntries(baseline.parties.map(member => [member.id, member.support]));
  const after = Object.fromEntries(alternate.map(member => [member.id, member.support]));
  return { day: through, before, after, gain: after[party.id] - before[party.id] };
}

function partyOrganizingView(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!party) return null;
  const groups = Fwe(country);
  const context = { blocs: sim._voterBlocs?.(country), groups: new Map(groups.map(group => [group.id, group])) };
  const preview = (kind, targetId) => {
    const quote = partyOrganizingQuote(sim, country, partyId, kind, targetId, groups);
    if (quote.effects && [null, "budget", "resources", "influence"].includes(quote.reason)) {
      const forecast = partyOrganizingForecast(sim, country, party, quote, quote.endDay + 14, context);
      if (forecast) quote.forecast = { day: forecast.day, gain: forecast.gain };
    }
    return quote;
  };
  const meetings = groups.map(group => ({ id: group.id, quote: preview("meeting", group.id) }));
  const movements = (country.domestic?.movements || []).filter(peacefulPartyMovement).map(movement => ({
    id: movement.id,
    demandId: movement.demandId,
    participantsM: movement.current.participantsM || 0,
    strikeWorkersM: movement.current.strikeWorkersM || 0,
    quote: preview("movement", movement.id),
  })).filter(item => item.quote.reason !== "group");
  const record = party.gpmOrganizing;
  return { meetings, movements, lastAction: record?.lastAction || null, projects: record?.projects || [], recent: record?.recent || [],
    activistsK: party.organization?.activistsK || 0, organizingHalfLife: gpmCampaignRulesFor(sim).organizingHalfLife };
}

function partyOrganizingDetail(quote, ui) {
  if (!quote?.effects) return "This action is unavailable.";
  const cash = rr(quote.cash * 1e6 * hA(), gA());
  const activists = Math.round(quote.activistsK * 1e3).toLocaleString(cs());
  const costs = `${cash} and ${quote.influence} influence · ${activists} activists assigned`;
  const completion = `${quote.durationDays} days · Scheduled to finish ${ui.gameDate(quote.endDay)} if started today`;
  const gains = quote.effects.map(effect => {
    const headroom = Math.max(0, .5 - effect.present);
    return `${Vr(effect.id)} +${(Math.min(effect.increase, headroom) * 100).toFixed(1)} points of voting weight`;
  }).join(" · ");
  const reasons = {
    already_backed: "Your party already backed this movement.",
    active: "Your party already has a project of this type underway.",
    cooldown: "Available again " + (quote.reason === "cooldown" ? ui.gameDate(quote.availableDay) : "") + ".",
    saturated: "Your organizing bonus is already at its limit here.",
    budget: "The party treasury is too low.",
    resources: "You need more available activists.",
    influence: "You need more influence.",
  };
  const contacts = quote.effects.some(effect => effect.contacts > 0)
    ? "Builds contacts in the existing Outreach network as work is completed" : "";
  const projection = quote.forecast
    ? `Estimated national gain of ${(quote.forecast.gain * 100).toFixed(3)} percentage points by ${ui.gameDate(quote.forecast.day)} at current conditions` : "";
  const discount = quote.discount ? `Seatless-party discount ${Math.round(quote.discount * 100)}%` : "";
  return [costs, discount, completion, `At today's bloc limits · ${gains}`, projection, contacts, reasons[quote.reason]].filter(Boolean).join(". ");
}

function renderPartyOrganizing(view, ui) {
  const data = view.party?.organizing;
  if (!data) return "";
  const selected = data.meetings.find(item => item.id === ui._gpmMeetingBloc) || data.meetings.find(item => item.quote.ok) || data.meetings[0];
  const rows = data.movements.map(item => `<div class="gpm-organizing-action">
    <div><strong>${b(o("domestic.demand." + item.demandId))}</strong> · ${b(Math.round(item.participantsM * 1e6).toLocaleString(cs()))} participants
      ${item.strikeWorkersM > 0 ? ` · ${b(Math.round(item.strikeWorkersM * 1e6).toLocaleString(cs()))} striking workers` : ""}</div>
    <small>${b(partyOrganizingDetail(item.quote, ui))}</small>
    <button class="k" type="button" data-gpm-back-movement="${b(item.id)}" ${item.quote.ok ? "" : "disabled"}>Back mobilization</button>
  </div>`).join("");
  const options = data.meetings.map(item => `<option value="${b(item.id)}" ${item.id === selected?.id ? "selected" : ""}>${b(Vr(item.id))}</option>`).join("");
  const projects = (data.projects || []).map(project => `<div class="gpm-organizing-action">
    <strong>${project.kind === "meeting" ? "Public meeting" : "Mobilization backing"} · ${b(project.effects.map(effect => Vr(effect.id)).join(", "))}</strong>
    <small>${b(Math.round(project.activistsK * 1e3).toLocaleString(cs()))} activists assigned until ${b(ui.gameDate(project.endDay))} · ${b(project.workedThrough - project.startDay)} of ${b(project.endDay - project.startDay)} days worked</small>
  </div>`).join("");
  const decay = data.organizingHalfLife > 0
    ? `Bonuses halve every ${data.organizingHalfLife} days.` : "Bonuses persist under these campaign rules.";
  const recent = (data.recent || []).map(project => {
    const kind = project.kind === "meeting" ? "Public meeting" : "Mobilization backing";
    const status = project.reason ? "ended early" : "completed";
    const reasons = { movement: "The mobilization ceased to qualify.", group: "The participating bloc changed.",
      party: "The party lost legal status." };
    const gains = project.effects.map(effect => `${Vr(effect.id)} +${(effect.earned * 100).toFixed(1)} points of voting weight`
      + (effect.contactsEarned ? ` and +${(effect.contactsEarned * 100).toFixed(1)} Outreach points` : "")).join(" · ");
    const returned = Math.round(project.activistsK * 1e3).toLocaleString(cs());
    return `<div class="gpm-organizing-action"><strong>${b(kind)} ${b(status)} ${b(ui.gameDate(project.finishedDay))}</strong>
      <small>${b(gains)} · ${b(returned)} activists returned ${b(reasons[project.reason] || "")}</small></div>`;
  });
  return `<section class="mcard wide gpm-organizing" aria-label="Party organizing">
    <h3 class="mc-title">Party organizing</h3>
    <small>${b(Math.round(data.activistsK * 1e3).toLocaleString(cs()))} activists available.
    Meetings and mobilizations share a +50% voting-weight limit per bloc. ${b(decay)}</small>
    ${projects ? `<h4>Projects underway</h4>${projects}` : ""}
    ${recent[0] || ""}
    ${recent.length > 1 ? `<details><summary>Earlier organizing results</summary>${recent.slice(1).join("")}</details>` : ""}
    ${selected ? `<div class="gpm-organizing-action"><label>Public meeting <select class="k" data-gpm-meeting-bloc>${options}</select></label>
      <small data-gpm-meeting-detail>${b(partyOrganizingDetail(selected.quote, ui))}</small>
      <button class="k" type="button" data-gpm-meeting ${selected.quote.ok ? "" : "disabled"}>Hold meeting</button></div>` : ""}
    <h4>Peaceful mobilizations</h4>
    ${rows || "<small>No active peaceful mobilizations.</small>"}
  </section>`;
}

function bindPartyOrganizing(host, view, ui) {
  const panel = host.querySelector(".gpm-organizing");
  const data = view.party?.organizing;
  if (!panel || !data) return;
  const select = panel.querySelector("[data-gpm-meeting-bloc]");
  const meeting = panel.querySelector("[data-gpm-meeting]");
  const submit = async (button, verb, targetId) => {
    await ui._mpSubmit(button, "applyPlayerAction", [{ verb, targetId }]);
  };
  if (select && meeting) {
    select.onchange = () => {
      ui._gpmMeetingBloc = select.value;
      const quote = data.meetings.find(item => item.id === select.value)?.quote;
      panel.querySelector("[data-gpm-meeting-detail]").textContent = partyOrganizingDetail(quote, ui);
      meeting.disabled = !quote?.ok;
    };
    meeting.onclick = () => submit(meeting, "gpm.party.meeting", select.value);
  }
  for (const button of panel.querySelectorAll("[data-gpm-back-movement]")) {
    button.onclick = () => submit(button, "gpm.party.backMovement", button.dataset.gpmBackMovement);
  }
}

module.exports = {
  workerFunctions: [`const gpmOrganizingTerms = ${JSON.stringify(gpmOrganizingTerms)};`,
    partyOrganizingWeight, migratePartyOrganizing, decayPartyOrganizing, peacefulPartyMovement,
    partyMovementParticipants, partyMovementParticipation, partyOrganizingSeatless, partyOrganizingTaper,
    partyMovementDemandFit, partyOrganizingQuote, applyPartyOrganizing, partyOrganizingMovementRate,
    creditPartyOrganizingContacts, advancePartyOrganizing, registerPartyOrganizing, partyOrganizingForecast, partyOrganizingView],
  rendererFunctions: [partyOrganizingDetail, renderPartyOrganizing, bindPartyOrganizing],
};
