"use strict";

function partyAgreementContext(country) {
  if (!country?.pol) return null;
  const institution = st(country);
  const government = institution?.government;
  const power = Wx(country, "confidence");
  const chamber = Zpe(country, "confidence");
  if (government?.status !== "minority" || !government.leadPartyId || !chamber ||
      power?.target !== "head_of_gov" || power.holder !== `chamber:${chamber.id}` ||
      !government.confidenceOrganIds?.includes(power.holder)) return null;
  const contestId = `election:chamber:${chamber.id}`;
  const contest = institution.contests?.[contestId];
  const holder = pt(country, power.target);
  if (!holder || contest?.type !== "chamber" || contest.targetOrganId !== power.holder ||
      government.formationProcedureId !== contestId) return null;
  const seats = Object.entries(chamber.composition || {}).sort(([a], [b]) => a.localeCompare(b));
  const total = seats.reduce((sum, [, count]) => sum + count, 0);
  if (!total || !(chamber.composition[government.leadPartyId] > 0)) return null;
  const key = JSON.stringify([government.id, institution.governmentRevision, institution.constitutionRevision, holder,
    power.holder, power.target, seats]);
  return { government, chamber, contest, key };
}

function partyAgreementPartners(country, context) {
  const { government, chamber } = context;
  const existing = new Set([...(government.coalitionPartyIds || []), ...(government.supportPartyIds || [])]);
  return (country.pol.parties || []).filter(party => partyCongressEligible(party) &&
    !existing.has(party.id) && chamber.composition[party.id] > 0);
}

function partyAgreementState(country) {
  const state = country?.gpmSupportAgreement;
  return state?.version === 1 ? state : null;
}

function partyAgreementStatus(country, day, agreement, context = undefined) {
  if (!agreement || !["offered", "active"].includes(agreement.status)) return agreement?.status || null;
  if (context === undefined) context = partyAgreementContext(country);
  if (!context || context.key !== agreement.scopeKey || context.government.leadPartyId !== agreement.leadId ||
      !partyCongressEligible(pW(country, agreement.leadId)) ||
      !partyAgreementPartners(country, context).some(party => party.id === agreement.supportId)) return "lapsed";
  if (day >= (agreement.status === "offered" ? agreement.offerUntilDay : agreement.untilDay)) return "expired";
  if (agreement.status === "active" && agreement.tabledDay == null && day >= agreement.billDueDay) return "missed";
  return agreement.status;
}

function partyAgreementClose(sim, country, agreement, status) {
  const state = partyAgreementState(country);
  if (!state || state.current !== agreement) return;
  Object.assign(agreement, { status, closedDay: sim.day });
  state.nextOfferDay = Math.max(state.nextOfferDay || 0, sim.day + 21);
}

function partyAgreementReview(sim, country) {
  const agreement = partyAgreementState(country)?.current;
  const status = partyAgreementStatus(country, sim.day, agreement);
  if (agreement && status !== agreement.status) partyAgreementClose(sim, country, agreement, status);
}

function partyAgreementTerms(sim, country, leadId, supportId) {
  const lead = pW(country, leadId);
  const support = pW(country, supportId);
  if (!partyCongressEligible(lead) || !partyCongressEligible(support)) return [];
  const day = sim.day || 0;
  const candidates = ODa(sim, country, supportId, false).map(entry => ({
    ...entry,
    interest: $je(lead, entry.law, country.laws[entry.law.id], country) -
      $je(lead, entry.law, entry.choice.value, country),
    programme: partyCongressProgrammeLawBonus(support, entry.law.id, day, entry.choice.value),
  })).filter(entry => entry.interest >= -8 && jyt(country, entry.law).ok)
    .sort((a, b) => b.programme - a.programme || b.appeal + b.interest - (a.appeal + a.interest) ||
      a.law.id.localeCompare(b.law.id));
  const terms = [];
  for (const entry of candidates.slice(0, 8)) {
    const lawId = entry.law.id;
    const value = ar(entry.choice.value);
    const forecast = sim.forecastBillFor(country, entry.law, value, { sponsorKind: "government", sponsorPartyId: leadId });
    if (!forecast?.fc || !forecast.procedureKind || forecast.decreed) continue;
    terms.push({ id: JSON.stringify([lawId, entry.choice.id, value]), lawId, value,
      choiceId: entry.choice.id, passes: forecast.passes, programme: entry.programme > 0 });
    if (terms.length === 3) break;
  }
  return terms;
}

function partyAgreementOpenReason(sim, country, context, partyId) {
  if (!context) return "government";
  const day = sim.day || 0;
  if (day - context.government.installedDay > 90) return "window";
  const state = partyAgreementState(country);
  if (state?.acceptedScopeKey === context.key) return "agreed";
  if (day < (state?.nextOfferDay || 0)) return "cooldown";
  if (["offered", "active"].includes(partyAgreementStatus(country, day, state?.current, context))) return "active";
  if (partyId !== context.government.leadPartyId &&
      !partyAgreementPartners(country, context).some(party => party.id === partyId)) return "party";
  return null;
}

function partyAgreementOptions(sim, country, partyId, context, eligible = () => true) {
  const { government } = context;
  const leadId = government.leadPartyId;
  const partners = partyAgreementPartners(country, context);
  return partners.filter(party => (partyId === leadId || party.id === partyId) && eligible(party.id)).flatMap(party =>
    partyAgreementTerms(sim, country, leadId, party.id).map(term => ({
      ...term, supportId: party.id, leadId,
      token: JSON.stringify([context.key, partyId, party.id, term.id]),
    })));
}

function partyAgreementApply(sim, country, party, action, input) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  partyAgreementReview(sim, country);
  const context = partyAgreementContext(country);
  const day = sim.day || 0;
  const state = partyAgreementState(country);
  const agreement = state?.current;
  if (action === "offer") {
    const reason = partyAgreementOpenReason(sim, country, context, party.id);
    if (reason) return { ok: false, reason };
    const leadId = context.government.leadPartyId;
    const supportId = input.supportId;
    if ((party.id !== leadId && party.id !== supportId) ||
        !partyAgreementPartners(country, context).some(partner => partner.id === supportId)) {
      return { ok: false, reason: "party" };
    }
    const term = partyAgreementTerms(sim, country, leadId, supportId)
      .find(option => JSON.stringify([context.key, party.id, supportId, option.id]) === input.token);
    if (!term) return { ok: false, reason: "stale" };
    const targetId = party.id === leadId ? supportId : leadId;
    const offerUntilDay = Math.min(day + 35, context.contest.nextDay ?? Infinity);
    if (offerUntilDay <= day) return { ok: false, reason: "window" };
    const id = JSON.stringify([country.key, context.government.id, party.id, targetId, day, term.id]);
    const record = country.gpmSupportAgreement = state || { version: 1 };
    record.current = { id, scopeKey: context.key, leadId, supportId, offererId: party.id, targetId,
      status: "offered", offeredDay: day, offerUntilDay, lawId: term.lawId, choiceId: term.choiceId, value: term.value };
    return { ok: true, changed: true };
  }
  if (!agreement || agreement.id !== input.id ||
      ![agreement.leadId, agreement.supportId].includes(party.id)) return { ok: false, reason: "stale" };
  if (action === "accept" || action === "decline") {
    if (agreement.status !== "offered" || party.id !== agreement.targetId) return { ok: false, reason: "stale" };
    if (action === "decline") {
      partyAgreementClose(sim, country, agreement, "declined");
      return { ok: true, changed: true };
    }
    const term = partyAgreementTerms(sim, country, agreement.leadId, agreement.supportId)
      .find(option => option.lawId === agreement.lawId && uo(option.value, agreement.value));
    if (!term) return { ok: false, reason: "stale" };
    const untilDay = Math.min(day + 120, context.contest.nextDay ?? Infinity);
    if (untilDay - day < 14) return { ok: false, reason: "window" };
    const openMotions = (country.procedures || []).filter(procedure => procedure.kind === "confidence");
    Object.assign(agreement, { status: "active", acceptedDay: day, untilDay,
      billDueDay: Math.min(day + 45, untilDay), priorMotionIds: openMotions.map(motion => motion.id) });
    state.acceptedScopeKey = context.key;
    return { ok: true, changed: true };
  }
  if (action === "withdraw" && agreement.status === "offered" && agreement.offererId === party.id) {
    partyAgreementClose(sim, country, agreement, "withdrawn");
    return { ok: true, changed: true };
  }
  if (action === "end" && agreement.status === "active") {
    partyAgreementClose(sim, country, agreement, "ended");
    return { ok: true, changed: true };
  }
  if (action === "table" && agreement.status === "active" && agreement.leadId === party.id && agreement.tabledDay == null) {
    if (sim.playerControlsParty?.(country, party.id) && !sim.playerControlsGovernment(country)) {
      return { ok: false, reason: "government" };
    }
    const bill = V6(sim, country, agreement.lawId, agreement.value,
      { sponsorKind: "government", sponsorPartyId: party.id, notify: sim.playerKey === country.key });
    return bill.ok ? { ok: true, changed: true } : bill;
  }
  return { ok: false, reason: "stale" };
}

function partyAgreementBillTabled(sim, country, bill) {
  const agreement = partyAgreementState(country)?.current;
  if (bill.sponsorKind !== "government" || agreement?.status !== "active" ||
      agreement.tabledDay != null || agreement.leadId !== bill.sponsorPartyId ||
      agreement.lawId !== bill.lawId || !uo(agreement.value, bill.target) ||
      partyAgreementStatus(country, sim.day, agreement) !== "active") return;
  agreement.tabledDay = sim.day;
  agreement.procedureId = bill.id;
}

function partyAgreementConfidenceRows(sim, country, sponsorId, rows, motion = null, resolving = false) {
  const agreement = partyAgreementState(country)?.current;
  if (!sim || agreement?.status !== "active" || sponsorId === agreement.supportId) return rows;
  const active = motion || (country.procedures || []).find(procedure =>
    procedure.kind === "confidence" && procedure.sponsorPartyId === sponsorId);
  if (active && (active.day0 < agreement.acceptedDay || active.targetOfficeId !== "head_of_gov" ||
      agreement.priorMotionIds?.includes(active.id))) return rows;
  const day = sim.day || 0;
  const voteDay = resolving ? day : Math.max(day, active?.voteDay ?? day + PDa);
  if (partyAgreementStatus(country, voteDay, agreement) !== "active") return rows;
  return rows.map(row => row.id === agreement.supportId && row.seats > 0
    ? { ...row, pYes: 0, yesSeats: 0, vote: false, gpmAgreementId: agreement.id } : row);
}

function partyAgreementView(sim, country, partyId, includeOptions = false) {
  const context = partyAgreementContext(country);
  const state = partyAgreementState(country);
  const agreement = state?.current;
  const involved = [agreement?.leadId, agreement?.supportId].includes(partyId);
  const status = partyAgreementStatus(country, sim.day, agreement, context);
  const reason = partyAgreementOpenReason(sim, country, context, partyId);
  const options = !reason && includeOptions ? partyAgreementOptions(sim, country, partyId, context) : [];
  return {
    partyId,
    reason: reason || (includeOptions && !options.length ? "terms" : null),
    canOffer: !reason,
    day: sim.day,
    agreement: involved || status === "active" ? { ...agreement, status } : null,
    options,
  };
}

function partyAgreementQuery(sim) {
  const country = sim.player;
  if (!country?.pol) return null;
  return partyAgreementView(sim, country, cn(country), true);
}

function partyAgreementAgenda(sim, country, partyId) {
  const agreement = partyAgreementState(country)?.current;
  if (!agreement || ![agreement.leadId, agreement.supportId].includes(partyId)) return [];
  const status = partyAgreementStatus(country, sim.day, agreement);
  if (!["offered", "active"].includes(status)) return [];
  const deadlineDay = status === "offered" ? agreement.offerUntilDay :
    agreement.tabledDay == null ? agreement.billDueDay : agreement.untilDay;
  return [{ id: agreement.id, kind: "agreement", title: status === "offered" ? "Support agreement offer" : "Support agreement",
    day: agreement.acceptedDay ?? agreement.offeredDay, deadlineDay, status, tab: "agreement" }];
}

function advancePartyAgreementsAI(sim, country, party) {
  if (!partyCongressEligible(party)) return null;
  partyAgreementReview(sim, country);
  const context = partyAgreementContext(country);
  if (!context) return null;
  const state = partyAgreementState(country);
  const agreement = state?.current;
  if (agreement?.status === "offered" && agreement.targetId === party.id) {
    const compatible = partyAgreementTerms(sim, country, agreement.leadId, agreement.supportId)
      .some(term => term.lawId === agreement.lawId && uo(term.value, agreement.value));
    return partyAgreementApply(sim, country, party, compatible ? "accept" : "decline", { id: agreement.id });
  }
  if (agreement?.status === "active" && agreement.leadId === party.id && agreement.tabledDay == null) {
    return partyAgreementApply(sim, country, party, "table", { id: agreement.id });
  }
  if (partyAgreementOpenReason(sim, country, context, party.id)) return null;
  const composition = context.chamber.composition;
  const threshold = Math.floor(Object.values(composition).reduce((sum, seats) => sum + seats, 0) / 2) + 1;
  const governingSeats = context.government.coalitionPartyIds.reduce((sum, id) => sum + (composition[id] || 0), 0);
  const options = partyAgreementOptions(sim, country, party.id, context,
    supportId => governingSeats + composition[supportId] >= threshold);
  const preferred = options.find(term => term.passes && term.programme);
  const choice = party.id === context.government.leadPartyId
    ? preferred || options.find(term => term.passes) || options[0] : preferred;
  return choice ? partyAgreementApply(sim, country, party, "offer", choice) : null;
}

function registerPartyAgreements() {
  for (const action of ["offer", "accept", "decline", "withdraw", "end", "table"]) {
    Xgt("gpm.party.agreement." + action, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || cn(country) !== input.partyId) return { ok: false, reason: "party" };
        return partyAgreementApply(sim, country, pW(country, input.partyId), action, input);
      },
    });
  }
}

function patchAgreementWorker(source, replaceOnce) {
  const methods = [partyAgreementContext, partyAgreementPartners, partyAgreementState, partyAgreementStatus, partyAgreementClose,
    partyAgreementReview, partyAgreementTerms, partyAgreementOpenReason, partyAgreementOptions, partyAgreementApply,
    partyAgreementBillTabled, partyAgreementConfidenceRows, partyAgreementView, partyAgreementQuery, partyAgreementAgenda,
    advancePartyAgreementsAI, registerPartyAgreements].join("\n");
  const anchor = "function EDa(e,t,a=null){";
  source = replaceOnce(source, anchor, methods + "\n" + anchor);
  source = replaceOnce(source, "registerPartyCongressSize();\n",
    "registerPartyCongressSize();\nregisterPartyAgreements();\n");
  const changes = [
    ['function _q(e,t){let a=EDa(e,e.approval,t),', 'function _q(e,t,sim,motion=null,resolving=false){let a=partyAgreementConfidenceRows(sim,e,t,EDa(e,e.approval,t),motion,resolving),'],
    ['let i=RDa(e,t,a),s=_q(t,a);', 'let i=RDa(e,t,a),s=_q(t,a,e);'],
    ['forecast:_q(t,a)}}}function u4t', 'forecast:_q(t,a,e)}}}function u4t'],
    ['fc:_q(t,a)};return t.procedures', 'fc:_q(t,a,e)};return t.procedures'],
    ['let c=_q(t,a.sponsorPartyId),u={targetOrgan:o}', 'let c=_q(t,a.sponsorPartyId,e,a,true),u={targetOrgan:o}'],
    ['m1o(e,t,s.id,_q(t,s.id))', 'm1o(e,t,s.id,_q(t,s.id,e))'],
    ['partyConfidenceForecastFor(t,a){return _q(t,a)}', 'partyConfidenceForecastFor(t,a){return _q(t,a,this)}'],
    ['function UOa(e){for(let t of e.countries.values())if(t?.procedures?.length){',
      'function UOa(e){for(let t of e.countries.values())if(t?.gpmSupportAgreement&&partyAgreementReview(e,t),t?.procedures?.length){'],
    ['return t.procedures.push(v),u==="government"&&(t.approval=', 'return t.procedures.push(v),partyAgreementBillTabled(e,t,v),u==="government"&&(t.approval='],
    ['appeal:Z6(I+s*w,2)', 'appeal:Z6(I+s*w+6*partyCongressProgrammeLawBonus(o,y.id,e.day||0,P.value),2)'],
    ['let l=i.reaction.appeal*.65+i.reaction.partyFit*.25+(i.feasibility.score||0)*.1;return s.reaction.appeal*.65+s.reaction.partyFit*.25+(s.feasibility.score||0)*.1-l',
      'let l=u=>u.reaction.appeal*.65+u.reaction.partyFit*.25+(u.feasibility.score||0)*.1+(u.promise.kind===eq ? .12*partyCongressProgrammeLawBonus(o,u.promise.subjectId,e.day||0,u.promise.target) : 0);return l(s)-l(i)'],
    ['score:l.reaction.appeal*.65+l.reaction.partyFit*.25+(l.feasibility?.score||0)*n',
      'score:l.reaction.appeal*.65+l.reaction.partyFit*.25+(l.feasibility?.score||0)*n+(l.promise.kind===eq ? .12*partyCongressProgrammeLawBonus(a,l.promise.subjectId,e.day||0,l.promise.target) : 0)'],
    ['Hqe(r,a,t.params||{})', '(a==="gpm.partyAgreement"?partyAgreementQuery(r):Hqe(r,a,t.params||{}))'],
    ['|| margin(b) - margin(a) || b.gain - a.gain || K(a.lawId, b.lawId));',
      '|| Number(b.programme || partyCongressProgrammeLawBonus(party,b.lawId,day,b.value))-Number(a.programme || partyCongressProgrammeLawBonus(party,a.lawId,day,a.value))\n    || margin(b) - margin(a) || b.gain - a.gain || K(a.lawId, b.lawId));'],
  ];
  return changes.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

function partyAgreementReason(reason) {
  return {
    government: "Support agreements open after a confidence chamber elects a minority government.",
    window: "The post-election offer window has closed.",
    agreed: "An agreement has already been accepted for this government and chamber.",
    cooldown: "Negotiations are available again after the waiting period.",
    active: "An agreement or offer is already open.",
    party: "You need a seat in the confidence chamber and an eligible party role.",
    terms: "No eligible bill matches these parties’ current priorities.",
    stale: "The terms or political circumstances changed. Review the current offer.",
    pending: "A bill on this subject is already in progress.",
    full: "The legislature’s bill queue is full.",
    same: "The legislation already has this value.",
  }[reason] || "This action is unavailable.";
}

function partyAgreementPartyName(view, partyId) {
  const party = view.player?.pol?.parties?.find(item => item.id === partyId);
  return party ? Sa(party, view.player.key) : partyId;
}

function partyAgreementLawName(view, terms) {
  const name = Un(terms.lawId);
  const definition = Ds(terms.lawId);
  const value = definition ? xi(definition, terms.value, view.player) : "";
  return value ? name + " · " + value : name;
}

function partyAgreementContents(view, party, ui, data, choices, working) {
  const record = data.agreement;
  const date = day => v(ui.gameDate(day));
  const button = (action, label, attributes = "") =>
    `<button class="k" type="button" data-gpm-agreement="${action}" ${attributes}${working ? " disabled" : ""}>${v(label)}</button>`;
  if (record && ["offered", "active"].includes(record.status)) {
    const partner = partyAgreementPartyName(view, record.supportId);
    const lead = partyAgreementPartyName(view, record.leadId);
    const law = partyAgreementLawName(view, record);
    const heading = record.status === "offered" ? "Proposed agreement" : "Active agreement";
    const terms = `<p><b>${v(lead)}</b> will introduce ${v(law)}. <b>${v(partner)}</b> will vote against covered motions of no confidence.</p>`;
    if (record.status === "offered") {
      const actions = record.targetId === party.id ? button("accept", "Accept offer") + button("decline", "Decline offer") :
        record.offererId === party.id ? button("withdraw", "Withdraw offer") : "";
      return `<h4>${heading}</h4>${terms}<p>Respond by ${date(record.offerUntilDay)}.</p><div class="gpm-congress-control">${actions}</div>`;
    }
    const progress = record.tabledDay == null ? `Bill due ${date(record.billDueDay)}.` : `Bill introduced ${date(record.tabledDay)}.`;
    const table = record.leadId === party.id && record.tabledDay == null ? button("table", "Introduce agreed bill") : "";
    const end = [record.leadId, record.supportId].includes(party.id) ? button("end", "End agreement") : "";
    return `<h4>${heading}</h4>${terms}<p>${progress} Agreement expires ${date(record.untilDay)}.</p>
      <small>The bill follows the ordinary legislative process. A change of government or chamber ends the agreement.</small>
      ${table || end ? `<div class="gpm-congress-control">${table}${end}</div>` : ""}`;
  }
  const outcomes = {
    declined: "The offer was declined.",
    withdrawn: "The offer was withdrawn.",
    lapsed: "The government, chamber, or party eligibility changed.",
    expired: "The agreement or offer expired.",
    missed: "The deadline to introduce the bill passed.",
    ended: "A party ended the agreement.",
  };
  const result = record && outcomes[record.status] ? `<p>${v(outcomes[record.status])}</p>` : "";
  if (!data.canOffer) return result + `<p>${v(partyAgreementReason(data.reason))}</p>`;
  const rows = (choices?.options || []).map((term, index) => {
    const otherId = term.leadId === party.id ? term.supportId : term.leadId;
    return `<li class="gpm-congress-faction"><strong>${v(partyAgreementPartyName(view, otherId))}</strong>
      <span>${v(partyAgreementLawName(view, term))}</span><small>${term.passes ? "Bill forecast to pass" : "Bill faces opposition"}</small>
      ${button("offer", "Offer agreement", 'data-gpm-agreement-option="' + index + '"')}</li>`;
  }).join("");
  const status = choices?.reason ? `<p>${v(partyAgreementReason(choices.reason))}</p>` : "";
  return result + `<p>Offer confidence support in exchange for introducing one bill. An agreement lasts up to 120 days.</p>
    ${button("refresh", choices ? "Refresh terms" : "Check available terms")}${status}
    ${rows ? `<ul class="gpm-congress-vote-rows" aria-label="Possible support agreements">${rows}</ul>` : ""}`;
}

function renderPartyAgreement(view, party, ui) {
  const data = view.party?.agreement;
  if (!data || !party) return "";
  return `<section class="mcard wide" aria-label="Support agreement">
    <h3 class="mc-title">Support Agreement</h3><p data-gpm-agreement-feedback role="status"></p>
    <div data-gpm-agreement-contents>${partyAgreementContents(view, party, ui, data, null, false)}</div></section>`;
}

function bindPartyAgreement(host, view, party, ui) {
  const panel = host.querySelector('[data-mp-reading="gpm-agreement"]');
  const data = view.party?.agreement;
  const session = ui._mpSession;
  if (!panel || !data || !party || !session) return;
  let state = ui._gpmPartyAgreement;
  if (!state || state.session !== session || state.countryKey !== view.player?.key || state.partyId !== party.id) {
    state = ui._gpmPartyAgreement = { session, countryKey: view.player?.key, partyId: party.id, busy: false };
  }
  const contents = panel.querySelector("[data-gpm-agreement-contents]");
  const feedback = panel.querySelector("[data-gpm-agreement-feedback]");
  if (!contents || !feedback) return;
  state.data = data;
  const isCurrent = () => panel.isConnected && ui._mpSession === session && ui._gpmPartyAgreement === state;
  const paint = () => {
    const html = partyAgreementContents(view, party, ui, state.data, state.choices, state.busy);
    if (contents._gpmAgreementHtml !== html) {
      contents.innerHTML = html;
      contents._gpmAgreementHtml = html;
    }
    feedback.textContent = state.busy ? "Checking the agreement…" : state.message || "";
  };
  state.paint = paint;
  contents.onclick = async event => {
    const button = event.target.closest("[data-gpm-agreement]");
    if (!button || state.busy || !isCurrent()) return;
    const action = button.dataset.gpmAgreement;
    const record = state.data.agreement;
    const term = state.choices?.options?.[Number(button.dataset.gpmAgreementOption)];
    state.busy = true;
    state.message = "";
    // Keep the native submit button connected while its dispatch runs.
    feedback.textContent = "Checking the agreement…";
    for (const control of contents.querySelectorAll("button")) control.disabled = true;
    try {
      if (action !== "refresh") {
        const fields = action === "offer" ? { supportId: term?.supportId, token: term?.token } : { id: record?.id };
        const response = await ui._mpSubmit(button, "applyPlayerAction", [{ ...fields, verb: "gpm.party.agreement." + action }]);
        if (!isCurrent()) return;
        if (!response?.ok) state.message = partyAgreementReason(response?.reason);
        else state.message = ({
          offer: "Agreement offer sent.", accept: "Support agreement accepted.", decline: "Offer declined.",
          withdraw: "Offer withdrawn.", end: "Support agreement ended.", table: "Agreed bill introduced.",
        })[action];
      }
      const current = await Je(session, "gpm.partyAgreement", {});
      if (!isCurrent() || current?.partyId !== party.id) return;
      state.choices = current;
      state.data = current;
    } catch {
      if (isCurrent()) state.message = "Could not check the support agreement. Try again.";
    } finally {
      if (ui._gpmPartyAgreement === state) {
        state.busy = false;
        contents._gpmAgreementHtml = null;
        state.paint();
        if (action !== "refresh" && ui._mpSession === session) ui.refreshTab?.(session);
      }
    }
  };
  paint();
}

module.exports = { patchAgreementWorker, rendererFunctions: [
  partyAgreementReason, partyAgreementPartyName, partyAgreementLawName, partyAgreementContents,
  renderPartyAgreement, bindPartyAgreement,
] };
