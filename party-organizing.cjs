"use strict";

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
    !movement.leadershipDemand && !movement.claim?.resolved &&
    (movement.current.participantsM > 0 || movement.current.strikeWorkersM > 0);
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
  const cash = meeting ? zL(.02 + .12 * totalShare) : zL(.012 + .025 * totalShare);
  const activistsK = zL(meeting ? .15 + 1.4 * totalShare : .2 + .9 * totalShare);
  const influence = meeting ? 2 : 4;
  const previous = record?.lastAction;
  const lastBlocMeeting = record?.lastMeetingByBloc?.[targetId] ??
    (previous?.kind === "meeting" && previous.groups?.includes(targetId) ? previous.day : -90);
  const availableDay = meeting
    ? Math.max((record?.lastMeeting ?? -30) + 30, lastBlocMeeting + 90)
    : (record?.lastBacking ?? -60) + 60;
  const strength = Math.max(0, Math.min(1, movement?.mobilization01 || 0));
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
      ? .12 * (.45 + .55 * fit) * (.45 + .55 * presence) * (.55 + .45 * credibility)
      : .115 * (.35 + .65 * fit) * (.45 + .55 * credibility) * (.65 + .35 * strength) *
        partyMovementDemandFit(party, movement, group) / Math.sqrt(groups.length);
    return { id: group.id, present, increase: base * sizeFactor * (1 - present / .5) };
  });
  const organization = party.organization;
  let reason = null;
  if (!meeting && record?.backed?.includes(targetId)) reason = "already_backed";
  else if (record?.projects?.some(project => project.kind === kind)) reason = "active";
  else if (day < availableDay) reason = "cooldown";
  else if (effects.every(effect => effect.increase <= 0)) reason = "saturated";
  else if (organization.treasuryM < cash) reason = "budget";
  else if (organization.activistsK < activistsK) reason = "resources";
  else if (organization.influence < influence) reason = "influence";
  return { ok: !reason, reason, availableDay, startDay: day, endDay: day + durationDays, durationDays, cash, activistsK, influence, effects };
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
    activistsK: quote.activistsK, effects: quote.effects.map(({ id, increase }) => ({ id, increase, earned: 0 })) });
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

function advancePartyOrganizing(sim, country, party) {
  const day = sim.day || 0;
  const rules = gpmCampaignRulesFor(sim);
  const record = migratePartyOrganizing(party, day);
  if (!record) return;
  if (!record.projects.length) {
    decayPartyOrganizing(party, day, rules);
    return;
  }
  const existingGroups = new Set(Fwe(country).map(group => group.id));
  const finalize = project => {
    record.projects = record.projects.filter(item => item !== project);
    party.organization.activistsK = zL(Math.min(1e5, party.organization.activistsK + project.activistsK));
  };
  const eligibleEffects = new Map();
  for (const project of [...record.projects]) {
    const movement = project.kind === "movement" ? country.domestic?.movements?.find(item => item.id === project.targetId) : null;
    const active = party.legal !== false && (project.kind === "meeting" || peacefulPartyMovement(movement));
    const effects = project.effects.filter(effect => existingGroups.has(effect.id) &&
      (project.kind === "meeting" || movement?.groupIds?.includes(effect.id)));
    if (!active || !effects.length) finalize(project);
    else eligibleEffects.set(project, effects);
  }
  const first = record.projects.reduce((soonest, project) => Math.min(soonest, project.workedThrough + 1), day + 1);
  for (let tick = first; tick <= day && record.projects.length; tick++) {
    decayPartyOrganizing(party, tick, rules);
    const credits = new Map();
    for (const project of record.projects) {
      if (tick <= project.workedThrough || tick > project.endDay) continue;
      for (const effect of eligibleEffects.get(project)) {
        if (!credits.has(effect.id)) credits.set(effect.id, []);
        credits.get(effect.id).push({ effect, requested: effect.increase / (project.endDay - project.startDay) });
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
      if (tick >= project.endDay) finalize(project);
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

function partyOrganizingView(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!party) return null;
  const groups = Fwe(country);
  const meetings = groups.map(group => ({ id: group.id, quote: partyOrganizingQuote(sim, country, partyId, "meeting", group.id, groups) }));
  const movements = (country.domestic?.movements || []).filter(peacefulPartyMovement).map(movement => ({
    id: movement.id,
    demandId: movement.demandId,
    participantsM: Math.max(movement.current.participantsM || 0, movement.current.strikeWorkersM || 0),
    quote: partyOrganizingQuote(sim, country, partyId, "movement", movement.id, groups),
  })).filter(item => item.quote.reason !== "group");
  return { meetings, movements, lastAction: party.gpmOrganizing?.lastAction || null, projects: party.gpmOrganizing?.projects || [] };
}

function partyOrganizingDetail(quote, ui) {
  if (!quote?.effects) return "This action is unavailable.";
  const cash = rr(quote.cash * 1e6 * hA(), gA());
  const activists = Math.round(quote.activistsK * 1e3).toLocaleString(cs());
  const costs = `${cash} and ${quote.influence} influence · ${activists} activists assigned`;
  const completion = `${quote.durationDays} days · Scheduled to finish ${ui.gameDate(quote.endDay)} if started today`;
  const gains = quote.effects.map(effect => `${Vr(effect.id)} +${(effect.increase * 100).toFixed(1)} points of local voting weight`).join(" · ");
  const reasons = {
    already_backed: "Your party already backed this movement.",
    active: "Your party already has a project of this type underway.",
    cooldown: "Available again " + (quote.reason === "cooldown" ? ui.gameDate(quote.availableDay) : "") + ".",
    saturated: "Your organizing bonus is already at its limit here.",
    budget: "The party treasury is too low.",
    resources: "You need more available activists.",
    influence: "You need more influence.",
  };
  return [costs, completion, "Expected gain · " + gains, reasons[quote.reason]].filter(Boolean).join(". ");
}

function renderPartyOrganizing(view, ui) {
  const data = view.party?.organizing;
  if (!data) return "";
  const selected = data.meetings.find(item => item.id === ui._gpmMeetingBloc) || data.meetings.find(item => item.quote.ok) || data.meetings[0];
  const rows = data.movements.map(item => `<div class="gpm-organizing-action">
    <div><strong>${b(o("domestic.demand." + item.demandId))}</strong> · ${b(Math.round(item.participantsM * 1e6).toLocaleString())} participants</div>
    <small>${b(partyOrganizingDetail(item.quote, ui))}</small>
    <button class="k" type="button" data-gpm-back-movement="${b(item.id)}" ${item.quote.ok ? "" : "disabled"}>Back mobilization</button>
  </div>`).join("");
  const options = data.meetings.map(item => `<option value="${b(item.id)}" ${item.id === selected?.id ? "selected" : ""}>${b(Vr(item.id))}</option>`).join("");
  const projects = (data.projects || []).map(project => `<div class="gpm-organizing-action">
    <strong>${project.kind === "meeting" ? "Public meeting" : "Mobilization backing"} · ${b(project.effects.map(effect => Vr(effect.id)).join(", "))}</strong>
    <small>${b(Math.round(project.activistsK * 1e3).toLocaleString(cs()))} activists assigned until ${b(ui.gameDate(project.endDay))} · ${b(project.workedThrough - project.startDay)} of ${b(project.endDay - project.startDay)} days worked</small>
  </div>`).join("");
  return `<section class="mcard wide gpm-organizing" aria-label="Party organizing">
    <h3 class="mc-title">Party organizing</h3>
    <small>Meetings and mobilizations share a +50% voting-weight limit per bloc. The bonus halves every 180 days.</small>
    ${projects ? `<h4>Projects underway</h4>${projects}` : ""}
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
    const response = await ui._mpSubmit(button, "applyPlayerAction", [{ verb, targetId }]);
    if (response?.ok) {
      ui.refreshHUD?.(ui._mpSession);
      ui.refreshTab?.(ui._mpSession);
    }
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
  workerFunctions: [partyOrganizingWeight, migratePartyOrganizing, decayPartyOrganizing, peacefulPartyMovement,
    partyMovementDemandFit, partyOrganizingQuote, applyPartyOrganizing, advancePartyOrganizing,
    registerPartyOrganizing, partyOrganizingView],
  rendererFunctions: [partyOrganizingDetail, renderPartyOrganizing, bindPartyOrganizing],
};
