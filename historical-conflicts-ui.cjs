"use strict";

const style = `
  .gpm-history { display: grid; gap: var(--gap-3); min-width: 0; container: gpm-conflicts / inline-size; }
  .gpm-history :is(p, ul, dl) { margin: 0; }
  .gpm-history h3, .gpm-history h4 { margin-block: 0 var(--gap-1); }
  .gpm-history-tools, .gpm-history-actions { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gap-2); }
  .gpm-history-tools label { display: grid; gap: var(--gap-1); min-width: 0; }
  .gpm-history-tools label:first-child { flex: 1 1 14rem; }
  .gpm-history-tools :is(input, select) { width: 100%; min-width: 0; }
  .gpm-history-tabs { display: flex; flex-wrap: wrap; gap: var(--gap-1); border-bottom: 1px solid var(--line, #545861); padding-bottom: var(--gap-2); }
  .gpm-history-tabs > [aria-pressed=true] { background: #284151; border-color: #8bb5cc; color: #fff; }
  .gpm-history-tabs [data-history-decisions-count] { margin-inline-start: .3rem; color: #ffdc96; }
  .gpm-history-list { display: grid; align-content: start; gap: var(--gap-1); max-height: 34rem; overflow: auto; min-width: 0; }
  .gpm-history-war-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr)); align-items: start; gap: var(--gap-3); }
  .gpm-history [hidden] { display: none !important; }
  .gpm-history .gpm-history-list button.k, .gpm-history .gpm-history-actions button.k, [data-gpm-region-control-box] button.k {
    align-content: center; height: auto; min-height: 2.25rem; max-height: none;
    padding: 6px 9px; text-align: start; white-space: normal; overflow-wrap: anywhere; line-height: 1.25;
  }
  .gpm-history .gpm-history-list button.k { display: grid; justify-items: start; gap: 3px; }
  .gpm-history-list button[aria-pressed=true] { border-color: var(--mark-late, #edc583); }
  .gpm-history-detail {
    display: grid; align-content: start; gap: var(--gap-2); min-width: 0; overflow-wrap: anywhere;
  }
  .gpm-petition-assessment { display: grid; gap: .4rem; }
  .gpm-petition-odds, .gpm-petition-factors { display: grid; gap: .4rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gpm-petition-odds > div, .gpm-petition-factors > div { padding: .45rem .55rem; border: 1px solid #52616a; border-radius: 4px; }
  .gpm-petition-odds b { display: block; }
  .gpm-petition-explanation > summary { cursor: pointer; }
  .gpm-petition-explanation > :not(summary) { margin-block-start: .4rem; }
  .gpm-petition-factors ul { padding-inline-start: 1.25em; }
  .gpm-petition-for, .gpm-petition-for + ul li::marker { color: #a6e1a9; }
  .gpm-petition-against, .gpm-petition-against + ul li::marker { color: #ffb5ae; }
  [data-history-detail] { min-width: 0; }
  .gpm-history-region { display: grid; gap: var(--gap-2); padding: var(--gap-2); }
  .gpm-history-actor-heading, .gpm-war-portrait { display: flex; align-items: center; gap: var(--gap-2); }
  .gpm-history-flag { width: 2.6rem; max-height: 1.75rem; object-fit: contain; }
  .gpm-war-portrait img { width: 2rem; height: 2rem; object-fit: cover; object-position: center 25%; border-radius: 3px; }
  .gpm-history-map { display: grid; gap: var(--gap-1); }
  .gpm-history-map svg { display: block; width: 100%; max-height: 16rem; background: var(--bg, #12191f); }
  .gpm-history-map path { stroke: #141b21; stroke-width: 1px; vector-effect: non-scaling-stroke; cursor: pointer; }
  .gpm-history-map path[data-history-region]:focus { outline: none; }
  .gpm-history-map path:is([data-selected], :hover, :focus-visible) { stroke: #fff2bd; stroke-width: 2px; }
  .gpm-history-map path[data-history-region]:focus-visible:not([data-selected]) { stroke-dasharray: 3px 2px; }
  .gpm-history-map-key { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
  .gpm-history-map-key i { display: inline-block; width: .8em; height: .8em; margin-inline-end: .3em; border: 1px solid currentColor; }
  .gpm-history-section { padding-block-start: var(--gap-2); border-top: 1px solid var(--line, #545861); }
  .gpm-history-section > summary { cursor: pointer; }
  .gpm-history-section > :not(summary) { margin-block-start: var(--gap-2); }
  .gpm-history-region-select { display: grid; gap: var(--gap-1); }
  .gpm-history-region-select select { min-width: 0; width: 100%; }
  .gpm-history-control { display: grid; gap: var(--gap-1); }
  .gpm-history-control-bar { display: flex; gap: 1px; overflow: hidden; height: .55rem; background: var(--bg, #12191f); border-radius: var(--radius, 4px); }
  .gpm-history-control-bar > span { height: 100%; }
  .gpm-history-control-list { display: grid; gap: 3px; padding: 0; list-style: none; }
  .gpm-history-control-list > li { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 6px; }
  .gpm-history-control-list i { width: 8px; height: 8px; }
  .gpm-history-control-list b { font-variant-numeric: tabular-nums; }
  [data-gpm-region-control-box] {
    position: fixed; z-index: 28; display: grid; gap: 5px; box-sizing: border-box;
    width: max-content; min-width: min(12rem, calc(100vw - 16px)); max-width: min(21rem, calc(100vw - 16px));
    max-height: min(25rem, calc(100vh - 16px)); padding: 8px 10px; overflow: auto; overflow-wrap: anywhere;
    color: var(--text, #eff3f7); background: #172029; border: 1px solid #56606b;
    border-radius: var(--radius, 4px); box-shadow: 0 4px 14px #0006; font-size: .82rem;
  }
  [data-gpm-region-control-box] :is(ul, p) { margin: 0; }
  [data-gpm-region-control-box] ul { padding: 0; list-style: none; }
  [data-gpm-region-control-box] [data-gpm-control-row] { display: flex; justify-content: space-between; gap: 12px; padding-block: 2px; }
  [data-gpm-region-control-box] [data-gpm-control-row] > b { flex: none; font-variant-numeric: tabular-nums; }
  [data-gpm-region-control-box] [data-history-overlay-actions] { display: flex; flex-wrap: wrap; gap: 4px; }
  [data-gpm-region-control-box] button.k { max-width: 100%; }
  [data-gpm-region-control-box] details { border-top: 1px solid #8995a045; padding-top: 4px; }
  [data-gpm-region-control-box] summary { cursor: pointer; }
  [data-gpm-region-control-box] [data-history-overlay-front] { display: grid; gap: 3px; padding-block: 4px; }
  body:has([data-gpm-region-control-box]) #tooltip.gpm-history-map-tip { visibility: hidden; }
  [data-gpm-faction-inspector] .insp-head img.flag { object-fit: contain; }
  [data-gpm-faction-inspector] .insp-leader { cursor: default; }
  [data-gpm-faction-inspector] .insp-econ { grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); }
  [data-gpm-faction-inspector] .insp-rel { display: grid; gap: var(--gap-2); }
  [data-gpm-faction-inspector] .ir-cell { text-align: left; }
  [data-gpm-faction-inspector] .gpm-faction-laws { padding-inline-start: var(--gap-4); margin-block: var(--gap-1) 0; }
  [data-gpm-faction-inspector] .gpm-faction-laws li + li { margin-top: var(--gap-1); }
  .gpm-war-card { display: grid; gap: .7rem; padding: .8rem; min-width: 0; border: 1px solid #4e626f; border-radius: 5px;
    background: #17242e; color: #f0f5f7; overflow-wrap: anywhere; }
  .gpm-war-card[data-history-card] { cursor: pointer; }
  .gpm-war-card[data-history-card]:hover, .gpm-war-card[data-history-card]:focus-within { border-color: #8bb5cc; }
  .gpm-war-card[data-involved] { border-color: #b7a274; }
  .gpm-war-card .gpm-war-title { display: block; width: 100%; box-sizing: border-box; min-height: 0; margin: 0; padding: .6em .75em;
    border: 1px solid #607888; border-radius: 3px; background: #203545; color: #f3f7f9; text-align: center;
    line-height: 1.2; font-weight: 700; font-size: 1.02rem; white-space: normal; overflow-wrap: anywhere; }
  .gpm-war-card--detail .gpm-war-title, .gpm-war-card--alert .gpm-war-title { font-size: clamp(1.05rem, 2vw, 1.45rem); }
  .gpm-war-status { display: grid; gap: .24rem; padding: .4rem .55rem; color: #b9ccd7; }
  .gpm-war-status > small { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: .55rem; }
  .gpm-war-status > small > b { color: #eef5f7; }
  .gpm-war-status strong { color: #ffdc96; }
  .gpm-war-status p { margin: 0; font-size: .9rem; }
  .gpm-war-sides { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(3, auto);
    column-gap: .8rem; row-gap: .4rem; }
  .gpm-war-side { display: grid; grid-row: 1 / -1; grid-template-rows: subgrid; padding: .62rem; min-width: 0;
    border: 1px solid #415763; border-top: 3px solid #8fa8b4; background: #152029; border-radius: 4px; }
  .gpm-war-side--def { border-top-color: #8bbacd; }
  .gpm-war-side--atk { border-top-color: #db9b83; }
  .gpm-war-side h4 { margin: 0; color: #e8f1f4; letter-spacing: .04em; }
  .gpm-war-side--def h4 { color: #a1cee1; }
  .gpm-war-side--atk h4 { color: #f0a990; }
  .gpm-war-roster, .gpm-war-goals { display: grid; align-content: start; gap: .32rem; min-width: 0; }
  .gpm-war-roster details { min-width: 0; }
  .gpm-war-roster summary { cursor: pointer; }
  .gpm-war-roster summary, .gpm-war-goals { font-size: .9rem; }
  .gpm-war-more { color: #b9ccd7; }
  .gpm-war-supporters { margin-top: .15rem; }
  .gpm-war-supporters > summary { color: #b9ccd7; margin-bottom: .2rem; }
  .gpm-war-participant + .gpm-war-participant { padding-top: .2rem; border-top: 1px solid #7793aa30; }
  .gpm-war-participant > summary { position: relative; display: flex; align-items: center; min-height: 1.6rem; gap: .37rem;
    padding-inline-end: 1rem; list-style: none; color: #eef5f7; }
  .gpm-war-participant > summary::-webkit-details-marker { display: none; }
  .gpm-war-participant > summary::after { position: absolute; inset-inline-end: 0; content: "▾"; color: #b9ccd7; }
  .gpm-war-participant[open] > summary::after { content: "▴"; }
  .gpm-war-participant > summary > span { min-width: 0; }
  .gpm-war-flag { flex: none; width: 1.65rem; height: 1.12rem; object-fit: contain; }
  .gpm-war-card--alert .gpm-war-flag, .gpm-war-card--detail .gpm-war-flag { width: 2.2rem; height: 1.45rem; }
  .gpm-war-participant small { display: block; color: #b9ccd7; }
  .gpm-war-stat { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .4rem; margin: .32rem 0 .15rem; padding: .42rem;
    border-radius: 3px; background: #233440; font-size: .8rem; }
  .gpm-war-stat dt { color: #b9ccd7; }
  .gpm-war-stat dd { margin: 0; font-weight: 650; }
  .gpm-war-stat:has(> :only-child) { grid-template-columns: 1fr; }
  .gpm-war-goals { padding-top: .35rem; border-top: 1px solid #7793aa45; }
  .gpm-war-goals ul { margin: 0; padding-inline-start: 1.3em; }
  .gpm-war-alert { box-sizing: border-box; color: #edf4f6; background: #111b23; border: 1px solid #7394a6; border-radius: 8px;
    position: fixed; inset: 0; margin: auto; width: min(48rem, calc(100vw - 28px)); max-height: min(42rem, calc(100vh - 28px));
    padding: 1rem; box-shadow: 0 24px 90px #0008; }
  .gpm-war-alert::backdrop { background: #061018bb; }
  .gpm-war-alert > p { margin: 0 0 .6rem; }
  .gpm-war-alert footer { position: sticky; bottom: -1rem; display: flex; flex-wrap: wrap; justify-content: end;
    gap: .5rem; margin-top: .35rem; padding: .5rem 0 .15rem; background: #111b23; }
  .gpm-war-alert footer button { min-width: 7rem; }
  .gpm-history-decisions, .gpm-history-decisions > section, .gpm-history-decisions article { display: grid; gap: var(--gap-2); }
  .gpm-history-decisions article { padding: var(--gap-2); }
  .gpm-peace-terms { display: grid; gap: .35rem; border-inline-start: 2px solid #607888; padding-inline-start: .75rem; }
  .gpm-peace-terms ul { margin: 0; padding-inline-start: 1.2em; }
  .gpm-history-war-list h4 { grid-column: 1 / -1; margin-bottom: -.35rem; }
  @container gpm-conflicts (max-width: 32rem) { .gpm-history-list { max-height: 14rem; } }
`;

function gpmHistoricalLabel(value) {
  const labels = {
    active: "Active fighting", ended: "Ended", suspended: "Fighting suspended", ceasefire: "Ceasefire", settled: "Settled",
    frozen: "Frozen", contested: "Contested", occupation: "Occupation", dormant: "Dormant armed conflict", uncertain: "Uncertain", civil_war: "Civil war", civil: "Civil war",
    interstate: "Interstate war", nonstate: "Conflict between non-state groups", insurgency: "Insurgency", coalition: "Coalition",
    strategic: "Strategic", operational: "War Theatre", regional: "Regional simulation", native: "Native war", stock: "Base-game war",
    "aid-access": "Humanitarian access agreement", autonomy: "Regional autonomy agreement",
    transition: "Transitional government agreement", "native-settlement": "War settlement", "native-conflict": "War began",
    "political-agreement": "Political agreement", "decisive-victory": "Decisive victory", "negotiated-concession": "Negotiated concession",
    "government-transition": "Government transition", postwar: "Postwar policy", "negotiated-withdrawal": "Negotiated withdrawal",
    "negotiated-peace": "Negotiated peace",
    historical_term_unavailable: "That proposal is no longer available",
  };
  return Object.hasOwn(labels, value) ? labels[value] : String(value || "Unknown")
    .replaceAll(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function gpmHistoricalPlayerRole(role, status) {
  if (["principal", "cobelligerent", "combatant"].includes(role)) {
    return status === "active" ? "Your country is fighting" : "Your country is a party to this war";
  }
  if (role === "support") return "Your country is supporting a side";
  if (role === "access" || role === "territorial_access") return "Your country granted access";
  if (role === "affected") return "Your country is affected";
  return "";
}

function gpmHistoricalWarParticipant(participant, scopeId, { actor, focused, page } = {}) {
  const { id, countryKey, name, flagAsset, flagUrl, flagCode, associatedFlagCode, associatedFlagLabel, role, strength, deaths } = participant;
  const fallbackFlag = gpmHistoricalAssetUrl(flagAsset) || flagUrl || (flagCode ? Mi(flagCode) : null);
  const participantFlag = countryKey ? gpmHistoricalNativeMapFlag(countryKey, fallbackFlag) : fallbackFlag;
  const associatedFlag = !participantFlag && associatedFlagCode && associatedFlagLabel ? Mk(associatedFlagCode)?.url : null;
  const flag = participantFlag || associatedFlag;
  const involvement = role === "support" ? "Supporter" : ["access", "territorial_access"].includes(role) ? "Grants access" : "";
  const key = `war-${scopeId}-${id}`;
  const estimate = strength?.label || "Unknown";
  return `<details class="gpm-war-participant" data-history-panel="${b(key)}"${focused ? " open data-history-focused-actor" : ""}>
    <summary data-focus-key="${b(key)}" data-authority-safe>
      ${flag ? `<img class="gpm-war-flag" src="${b(flag)}" alt="${associatedFlag ? b(associatedFlagLabel) : ""}"${associatedFlag ? ` title="${b(associatedFlagLabel)}"` : ""} loading="lazy">` : ""}
      <span><b>${b(name)}</b>${involvement ? `<small>${involvement}</small>` : ""}</span>
    </summary>
    <dl class="gpm-war-stat">
      <div><dt>Estimated strength</dt><dd>${b(estimate)}</dd>${strength?.scope ? `<small>${b(strength.scope)}</small>` : ""}</div>
      ${Number.isFinite(deaths) || !page ? `<div><dt>Military deaths in this war</dt><dd>${Number.isFinite(deaths) ? b(deaths.toLocaleString(Ds())) : "Unknown"}</dd></div>` : ""}
    </dl>
    ${actor ? gpmHistoricalWarPortrait(actor) : ""}
  </details>`;
}

function gpmHistoricalWarPortrait(actor) {
  const leader = actor.leadership?.leader;
  const opening = [actor.identity?.headOfState, actor.identity?.leader, actor.identity?.headOfGovernment]
    .find(official => official?.portrait?.asset);
  const representative = actor.identity?.representative;
  const illustration = gpmHistoricalDossierIllustrations[actor.id];
  const portrait = leader ? pl(leader, actor.leadership.year) : gpmHistoricalAssetUrl(opening?.portrait?.asset);
  const representativeImage = gpmHistoricalAssetUrl(representative?.portrait?.asset);
  const canUseIllustration = !leader || !!leader.gpmHistoricalPerson;
  const image = portrait || (canUseIllustration && (representativeImage || gpmHistoricalAssetUrl(illustration?.asset)));
  if (!image) return "";
  const label = portrait ? (leader ? Dt(leader) : opening?.name) : representativeImage ? representative.name : "Illustrative portrait";
  return `<div class="gpm-war-portrait"><img src="${b(image)}" alt="" loading="lazy"><small>${b(label || "Portrait")}</small></div>`;
}

function gpmHistoricalWarCard(card, variant, { actors, actorId } = {}) {
  const { id, name, status, playerRole, entryReason, context, modeledSides } = card;
  const compact = variant === "compact";
  const role = gpmHistoricalPlayerRole(playerRole, status);
  const statusLabel = status === "occupation" ? "Reported occupation" :
    variant === "detail" && status === "ceasefire" ? "Ceasefire · Fighting paused" : gpmHistoricalLabel(status);
  const sides = card.sides || [];
  const heading = compact
    ? `<button type="button" class="k gpm-war-title" data-authority-safe data-history-select="${b(id)}" data-focus-key="history-select-${b(id)}" aria-label="View war: ${b(name)}">${b(name)}</button>`
    : `<h3 class="gpm-war-title"${variant === "alert" ? ' id="gpm-war-alert-title"' : ""}>${b(name)}</h3>`;
  const side = ({ goals = [], goalBasis, participants = [] }, index) => {
    const label = index === 0 ? "DEF" : "ATK";
    const sideClass = `gpm-war-side--${label.toLowerCase()}`;
    const supporting = participant => ["support", "access", "territorial_access"].includes(participant.role);
    const main = participants.filter(participant => !supporting(participant));
    const supportingMembers = participants.filter(supporting);
    const visible = compact ? main.slice(0, 3) : main;
    const remaining = main.length - visible.length;
    const visibleGoals = compact ? goals.slice(0, 2) : goals;
    const member = participant => gpmHistoricalWarParticipant(participant, `${id}-${index}`,
      { actor: actors?.get(participant.id), focused: participant.id === actorId, page: variant !== "alert" });
    const supportersOpen = actorId && supportingMembers.some(participant => participant.id === actorId);
    const supporters = supportingMembers.length ? `<details class="gpm-war-supporters" data-history-panel="supporters-${b(id)}-${index}"${supportersOpen ? " open" : ""}>
      <summary data-focus-key="supporters-${b(id)}-${index}">${b(supportingMembers.length)} supporting or granting access</summary>
      ${supportingMembers.map(member).join("")}</details>` : "";
    return `<section class="gpm-war-side ${sideClass}"><h4>${label}</h4>
      <div class="gpm-war-roster">${visible.map(member).join("")}
        ${remaining ? `<small class="gpm-war-more">${b(remaining)} more in war details</small>` : ""}${supporters}</div>
      <div class="gpm-war-goals"><b>War goals</b>${goalBasis ? `<small>${b(goalBasis)}</small>` : ""}
        ${visibleGoals.length ? `<ul>${visibleGoals.map(goal => `<li>${b(goal)}</li>`).join("")}</ul>` : ""}
        ${goals.length > visibleGoals.length ? `<small>${b(goals.length - visibleGoals.length)} more in war details</small>` : ""}</div>
    </section>`;
  };
  return `<article class="gpm-war-card gpm-war-card--${variant}"${compact ? ` data-history-card="${b(id)}"` : ""}${role ? " data-involved" : ""}>
    ${heading}<section class="gpm-war-status" aria-label="War status"><small><b>War status</b>
      <span>${b(statusLabel)}${role ? ` · <strong>${b(role)}</strong>` : ""}${variant === "detail" && modeledSides ? " · Scenario roles" : ""}</span></small>
      ${context ? `<p>${b(context)}</p>` : ""}${entryReason && !compact ? `<p>${b(entryReason)}</p>` : ""}</section>
    ${sides.length ? `<div class="gpm-war-sides">${sides.map(side).join("")}</div>` : ""}
  </article>`;
}

function gpmHistoricalWarFallback(conflict, actors) {
  const incident = conflict.crimeReport || conflict.strategicOnly;
  return { id: conflict.id, name: conflict.shortTitle || conflict.name, status: conflict.status, context: conflict.note,
    modeledSides: true, sides: (conflict.sides || []).map(ids => ({
      goals: incident ? ["Maintain influence in the affected area"] : ["Protect positions on this front"], goalBasis: "Scenario objectives",
      participants: ids.map(id => {
        const actor = actors?.get(id);
        return { id, name: actor?.shortName || actor?.name || G(id), flagAsset: actor?.identity?.flag?.asset,
          strength: actor?.strength?.range ? { label: actor.strength.range, scope: "Historical estimate" } : null };
      }) })) };
}

function gpmShowNextWarAlert(presenter) {
  const alerts = presenter._gpmWarAlerts;
  if (alerts.showing || !alerts.queue.length || presenter.sim !== Ue) return;
  const { id, warCard } = alerts.queue.shift();
  alerts.showing = true;
  const render = card => {
    if (presenter.sim !== Ue) return;
    const priorFocus = document.activeElement;
    let viewing = false;
    const dialog = document.createElement("dialog");
    alerts.dialog = dialog;
    dialog.className = "gpm-war-alert";
    dialog.dataset.gpmWarAlert = "";
    dialog.setAttribute("aria-labelledby", "gpm-war-alert-title");
    dialog.innerHTML = `<p>You entered a war</p>${gpmHistoricalWarCard(card, "alert")}
      <footer><button type="button" class="k" data-authority-safe data-gpm-view-war>View War</button>
      <button type="button" class="k" data-authority-safe data-gpm-continue>Continue</button></footer>`;
    dialog.querySelector("[data-gpm-view-war]").onclick = () => {
      viewing = true;
      dialog.close();
      gpmHistoricalMapOpenFront({ id });
    };
    const continueButton = dialog.querySelector("[data-gpm-continue]");
    continueButton.onclick = () => dialog.close();
    dialog.addEventListener("close", () => {
      dialog.remove();
      alerts.dialog = null;
      alerts.showing = false;
      if (alerts.queue.length && presenter.sim === Ue) {
        gpmShowNextWarAlert(presenter);
      } else {
        alerts.release?.();
        alerts.release = null;
        if (!viewing && priorFocus?.isConnected && !priorFocus.closest("[hidden],.hidden,[inert]")) priorFocus.focus({ preventScroll: true });
      }
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    continueButton.focus();
  };
  if (warCard) return render(warCard);
  Je(presenter.sim, "gpm.historicalConflicts", { id }).then(result => {
    const selected = result?.selected;
    render(selected?.warCard || (selected ? gpmHistoricalWarFallback(selected, new Map(selected.actors?.map(actor => [actor.id, actor]))) :
      { id, name: "War entry", status: "active" }));
  }).catch(error => {
    console.warn("[PPO] War alert details could not load", error);
    render({ id, name: "War entry", status: "active" });
  });
}

function gpmQueueWarAlert(presenter, { id, warCard } = {}, eventId) {
  if (!id || presenter.sim !== Ue) return;
  const alerts = presenter._gpmWarAlerts ||= { seen: new Set(), queue: [], showing: false };
  const key = eventId ?? id;
  if (alerts.seen.has(key)) return;
  alerts.seen.add(key);
  alerts.queue.push({ id, warCard });
  alerts.release ||= presenter.pauseController.hold("ppo-war-entry");
  presenter.onWar?.();
  gpmShowNextWarAlert(presenter);
}

function gpmMountHistoricalInspector(ui, session, shell) {
  const host = K("insp-body");
  if (!host || ui.sim !== session) return false;
  if (ui.inspectedKey) ui.closeInspector();
  ui._resetInspectorTransient();
  ui.globe?.setSelected(null);
  ui.tooltip(null);
  host.replaceChildren(shell);
  host.scrollTop = 0;
  ui._showInspectorPanel();
  return true;
}

function gpmHistoricalFactionHeading(actor) {
  const flag = actor.identity?.flag;
  const flagUrl = gpmHistoricalAssetUrl(flag?.asset);
  const ratio = Number.isFinite(flag?.ratio) && flag.ratio > 0 ? flag.ratio : 1.5;
  return `<div class="insp-head">
    ${flagUrl ? `<img class="flag fl-xl" data-gpm-faction-flag style="--flag-ratio:${ratio}"
      src="${b(flagUrl)}" alt="${b(flag.name || actor.name)}">` : ""}
    <div class="insp-id">
      <div class="insp-name">${b(actor.mapName || actor.wartimeMapName || actor.shortName || actor.name)}</div>
      <div class="insp-regime">${b(gpmHistoricalLabel(actor.kind))}</div>
    </div>
  </div>`;
}

function gpmHistoricalFactionProfile(actor, front) {
  const identity = actor.identity;
  const opening = identity?.headOfState || identity?.leader || identity?.headOfGovernment;
  const leader = actor.leadership?.leader;
  const representative = identity?.representative;
  const illustration = gpmHistoricalDossierIllustrations[actor.id];
  const currentName = leader ? Dt(leader) : opening?.name;
  const documented = !leader || !!leader.gpmHistoricalPerson;
  const portrait = leader ? pl(leader, actor.leadership.year) : gpmHistoricalAssetUrl(opening?.portrait?.asset);
  const representativeImage = documented && !portrait && gpmHistoricalAssetUrl(representative?.portrait?.asset);
  const illustrativeImage = documented && !portrait && !representativeImage && gpmHistoricalAssetUrl(illustration?.asset);
  const photo = portrait || representativeImage || illustrativeImage;
  const leaderName = currentName || (representativeImage && representative.name) ||
    (illustrativeImage && illustration.fictionalName) || "Leadership not documented";
  const leaderRole = (leader && !documented ? vd(leader.role, leader.g) : opening?.role) ||
    (representativeImage ? "Faction representative" : illustrativeImage && illustration.fictionalName ? "Fictional scenario character" : null);
  const photoCredit = representativeImage ? "Photo: " + representative.name + " (faction representative)" :
    illustrativeImage ? "Illustrative portrait" : null;
  const officials = (identity?.additionalOfficials || [])
    .filter(person => person.name !== currentName && (!representativeImage || person.name !== representative.name));
  const officialRow = person => {
    const image = gpmHistoricalAssetUrl(person.portrait?.asset);
    return `<li class="gpm-war-portrait">${image ? `<img src="${b(image)}" alt="" loading="lazy">` : ""}
      <span><b>${b(person.name)}</b> <small>${b(person.role)}</small></span></li>`;
  };
  const ideology = actor.ppoIdeology;
  const politics = ideology?.historicalLabel || ideology?.label ||
    (actor.ideology?.length <= 80 ? actor.ideology.replace(/\.$/, "") : null) ||
    (ideology?.territorial ? gpmHistoricalLabel(ideology.territorial) : null);
  const badges = front.status === "active" ? `<span class="badge alert">${o("inspector.badge.atWar")}</span>` :
    front.status ? `<span class="badge">${b(gpmHistoricalLabel(front.status))}</span>` : "";
  const stats = [
    ["Active forces", actor.nativeForces?.active],
    ["Reserve forces", actor.nativeForces?.reserve],
    ["Scenario forces", actor.nativeForces?.active == null ? actor.strength?.gamePersonnel : null],
  ].filter(([, value]) => Number.isFinite(value));
  const government = actor.administrationName || ideology?.relatedAdministration?.name;
  const details = [["Administration", government], ["Ideology", politics]].filter(([, value]) => value);
  const laws = (actor.laws || []).filter(law => law.name);
  const policy = law => {
    const statuses = { in_force: "In force", in_practice: "In practice", charter: "Charter" };
    const status = law.status && (statuses[law.status] || gpmHistoricalLabel(law.status));
    return `<li>${b(law.name)}${status ? ` <small class="regime-class">${b(status)}</small>` : ""}</li>`;
  };
  return `${gpmHistoricalFactionHeading(actor)}
    ${badges ? `<div class="badges insp-badges">${badges}</div>` : ""}
    <div class="k insp-leader" data-gpm-faction-leader>
      <span class="insp-ic il-ic">${photo ? `<img class="il-av" src="${b(photo)}" alt="${b(photoCredit || leaderName)}">` : Y.user}</span>
      <span class="il-txt"><span class="il-role">${b(leaderName)}</span>
        ${leaderRole || photoCredit ? `<span class="il-sub">${b([leaderRole, photoCredit].filter(Boolean).join(" · "))}</span>` : ""}
      </span>
    </div>
    ${officials.length ? `<details data-gpm-faction-officials><summary>Opening faction officials</summary>
      <ul class="gpm-faction-laws">${officials.map(officialRow).join("")}</ul></details>` : ""}
    ${stats.length ? `<div class="insp-econ">${stats.map(([label, value]) =>
      `<div class="stat" data-gpm-faction-stat><label>${b(label)}</label><span class="v">${b(value.toLocaleString(Ds()))}</span></div>`).join("")}</div>` : ""}
    ${details.length ? `<div class="insp-rel">${details.map(([label, value]) =>
      `<div class="ir-cell"><label>${b(label)}</label><span>${b(value)}</span></div>`).join("")}</div>` : ""}
    ${laws.length ? `<div data-gpm-faction-policies><div class="insp-tier">Policies</div>
      <ul class="gpm-faction-laws">${laws.slice(0, 3).map(policy).join("")}</ul>
      ${laws.length > 3 ? `<details><summary>More policies</summary><ul class="gpm-faction-laws">${laws.slice(3).map(policy).join("")}</ul></details>` : ""}</div>` : ""}`;
}

async function gpmOpenHistoricalFactionInspector(ui, session, item, front, faction) {
  const shell = document.createElement("section");
  shell.setAttribute("data-gpm-faction-inspector", "");
  shell.dataset.factionId = faction.id;
  const heading = gpmHistoricalFactionHeading(faction);
  shell.innerHTML = heading + '<p class="empty-note" role="status">Loading faction profile…</p>';
  if (!gpmMountHistoricalInspector(ui, session, shell)) return;
  const selection = { session, factionId: faction.id, provinceKey: item.provinceKey };
  ui._gpmFactionInspector = selection;
  try {
    const result = await Je(session, "gpm.historicalConflicts", { id: front.id });
    if (ui._gpmFactionInspector !== selection || ui.sim !== session || !shell.isConnected) return;
    const conflict = result?.selected;
    const actor = conflict?.actors?.find(candidate => candidate.id === faction.id);
    if (!actor) throw new Error("Faction absent from conflict view");
    shell.innerHTML = gpmHistoricalFactionProfile({ ...actor, mapName: faction.mapName }, front);
  } catch (error) {
    if (ui._gpmFactionInspector !== selection || ui.sim !== session || !shell.isConnected) return;
    console.warn("[PPO] Faction inspector could not load", error);
    shell.innerHTML = heading + '<p class="empty-note">Could not load the faction profile.</p>';
  }
}

function gpmHistoricalControlSummary(region, authority, compact = false, chart = false) {
  let rows = region.control;
  const military = region.militaryControl;
  if (!rows?.length && military?.totalCells > 0 && military.sides?.length === 2) {
    const first = Math.round(1000 * military.sides[0].cells / military.totalCells) / 10;
    rows = military.sides.map((side, index) => ({
      name: side.actorId ? authority(side.actorId) : G(side.countryKey),
      percent: index ? 100 - first : first,
    }));
  }
  if (rows?.length) {
    const percentage = new Intl.NumberFormat(Ds(), { style: "percent", maximumFractionDigits: 1 });
    if (chart) {
      const palette = ["#648aa4", "#b48a60", "#a18ab5", "#77a18d"];
      const visual = rows.map((side, index) => ({
        name: side.name, share: Math.min(100, Math.max(0, side.percent)),
        color: /^#[0-9a-f]{6}$/i.test(side.color) ? side.color : palette[index % palette.length],
      }));
      return `<div class="gpm-history-control-bar" aria-hidden="true" data-gpm-control-chart>
        ${visual.filter(side => side.share > 0).map(side => `<span style="flex:${side.share};background:${side.color}"></span>`).join("")}</div>
        <ul class="gpm-history-control-list">${visual.map(side => `<li data-gpm-control-row><i aria-hidden="true" style="background:${side.color}"></i>
          <span>${b(side.name)}</span><b>${b(percentage.format(side.share / 100))}</b></li>`).join("")}</ul>`;
    }
    return `${compact ? "" : "<small>Modeled share of regional control.</small>"}
      <ul>${rows.map(side => `<li data-gpm-control-row><span>${b(side.name)}</span>
        <b>${b(percentage.format(side.percent / 100))}</b></li>`).join("")}</ul>`;
  }
  if (compact) return "<p>Exact control unknown</p>";
  const dominant = region.dominantActorId || (region.contested && region.controller);
  return `<p>Exact control unknown</p>${dominant ? `<p>${b(authority(dominant))} is reported to hold more of this area.</p>` : ""}`;
}

function gpmHistoricalControlStatus({ contested, captured, controlled, modeledContact, reportedRegion }) {
  if (contested) return "Contested";
  if (captured) return "Captured";
  if (controlled) return "Held";
  if (modeledContact) return "Modeled front";
  return reportedRegion ? "Reported area" : null;
}

function gpmHistoricalFrontSummary(front, actors) {
  const sideName = id => actors[id]?.shortName || actors[id]?.name;
  const sides = (front.sides || []).map(side => [...new Set(side.map(sideName).filter(Boolean))].join(", ")).filter(Boolean);
  const controller = sideName(front.controllerId);
  const reported = sideName(front.reportedDominantId);
  const status = front.status === "ceasefire" ? "Ceasefire · Fighting paused" :
    front.status === "occupation" && !front.captured ? "Reported occupation" : gpmHistoricalControlStatus(front) || gpmHistoricalLabel(front.status);
  const name = controller || (front.occupationKey && G(front.occupationKey));
  const clue = front.contested ? reported && (reported + " reported dominant") :
    (front.captured || front.controlled) && name;
  return { sides: sides.length ? sides.join(" vs ") : (front.actorIds || []).map(sideName).filter(Boolean).join(" / "), status, clue };
}

function gpmHistoricalOverlayFront(front, map, globe, primary = false) {
  const summary = gpmHistoricalFrontSummary(front, map.actors);
  const actors = [...new Set([front.reportedDominantId, ...(front.sides || []).flat(), ...(front.actorIds || [])].filter(Boolean))];
  const actions = actors.map(id => gpmHistoricalFactionActions(globe, map, id)).filter(Boolean);
  const button = (id, action, label) => label ? `<button type="button" class="k k-sm" data-history-faction="${b(id)}"
    data-history-faction-action="${action}" data-focus-key="${b(front.id + id + action)}">${b(label)}</button>` : "";
  const title = front.shortTitle || front.name;
  return `<section data-history-overlay-front="${b(front.id)}">
    ${primary ? `<b>${b(title)}</b>` : `<b>${b(title)} · ${b(summary.status)}</b>`}
    ${summary.sides && summary.sides !== title ? `<p>${b(summary.sides)}</p>` : ""}
    ${summary.clue ? `<p>${b(summary.clue)}</p>` : ""}
    ${front.contested || front.control?.length ? gpmHistoricalControlSummary(front, null, true) : ""}
    ${actions.length ? `<div data-history-overlay-actions>${actions.map(row =>
      button(row.id, "open", row.openLabel) + button(row.id, "zoom", row.zoomLabel)).join("")}</div>` : ""}
    ${!primary ? `<button type="button" class="k k-sm" data-history-overlay-details="${b(front.id)}"
      data-focus-key="${b(front.id)}">View conflict</button>` : ""}
  </section>`;
}

function gpmCloseRegionalControlBox(ui) {
  const selection = ui._gpmRegionControlBox;
  if (!selection) return;
  ui._gpmRegionControlBox = null;
  selection.controller.abort();
  selection.shell.remove();
}

function gpmOpenRegionalControlBox(ui, session, { region, mode, map, opener, x = Pm[0], y = Pm[1] }) {
  if (ui.sim !== session || !map || !region.fronts[0] || !(region.fronts[0].contested || region.fronts[0].captured)) return;
  gpmCloseRegionalControlBox(ui);
  ui.tooltip(null);
  const shell = document.createElement("aside");
  shell.setAttribute("data-gpm-region-control-box", "");
  shell.setAttribute("aria-label", "Military control in " + region.name);
  shell.tabIndex = -1;
  shell.dataset.provinceKey = region.provinceKey;
  document.body.append(shell);
  const place = () => {
    const left = x + 12 + shell.offsetWidth <= window.innerWidth - 8 ? x + 12 : x - shell.offsetWidth - 12;
    const top = y + 12 + shell.offsetHeight <= window.innerHeight - 8 ? y + 12 : y - shell.offsetHeight - 12;
    shell.style.left = Math.max(8, Math.min(left, window.innerWidth - shell.offsetWidth - 8)) + "px";
    shell.style.top = Math.max(8, Math.min(top, window.innerHeight - shell.offsetHeight - 8)) + "px";
  };
  const controller = new AbortController();
  const { signal } = controller;
  let html = "";
  const selection = { session, mode, provinceKey: region.provinceKey, shell, controller, render };
  ui._gpmRegionControlBox = selection;
  function render(currentRegion) {
    region = currentRegion;
    const [primary, ...overlapping] = region.fronts;
    const next = `<strong>${b(region.name)} · ${primary.contested ? "Contested" : "Captured"}</strong>
      <div data-history-military-control>${gpmHistoricalOverlayFront(primary, map, ui.globe, true)}</div>
      ${overlapping.length ? `<details data-history-overlay-overlap>
        <summary>${overlapping.length} other ${overlapping.length === 1 ? "conflict" : "conflicts"}</summary>
        ${overlapping.map(front => gpmHistoricalOverlayFront(front, map, ui.globe)).join("")}</details>` : ""}`;
    if (html === next) return;
    const detail = shell.querySelector("details");
    const opened = detail?.open;
    const focused = document.activeElement;
    const active = shell.contains(focused);
    const key = active && focused.dataset.focusKey;
    const scroll = shell.scrollTop;
    shell.innerHTML = next;
    html = next;
    const updated = shell.querySelector("details");
    if (updated) updated.open = !!opened;
    shell.scrollTop = scroll;
    if (active) {
      const replacement = key ? shell.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) :
        focused === detail?.querySelector("summary") ? updated?.querySelector("summary") : shell;
      (replacement || shell).focus({ preventScroll: true });
    }
    place();
  }
  shell.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.historyFaction) {
      gpmHistoricalRunFactionAction(ui.globe, map, button.dataset.historyFaction, button.dataset.historyFactionAction);
    } else if (button.dataset.historyOverlayDetails) {
      const front = region.fronts.find(front => front.id === button.dataset.historyOverlayDetails);
      if (front) gpmHistoricalMapOpenFront(front, region.provinceKey);
    }
  }, { signal });
  shell.addEventListener("toggle", place, { capture: true, signal });
  document.addEventListener("pointerdown", event => {
    if (!shell.contains(event.target)) gpmCloseRegionalControlBox(ui);
  }, { capture: true, signal });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    gpmCloseRegionalControlBox(ui);
    opener?.focus({ preventScroll: true });
  }, { capture: true, signal });
  window.addEventListener("resize", place, { signal });
  render(region);
  if (opener) shell.focus({ preventScroll: true });
}

function gpmHistoricalRegions(conflict, actors, state, ui) {
  if (!conflict.regions?.length) return "";
  const selected = conflict.regions.find(region => region.key === state.regionKey) ||
    conflict.regions.find(region => (region.currentContested ?? region.contested) && (region.control?.length || region.militaryControl)) ||
    conflict.regions.find(region => region.currentContested ?? region.contested) || conflict.regions[0];
  const name = region => Vt(region.key, region.name);
  const authority = id => actors.get(id)?.shortName || actors.get(id)?.name || G(id);
  const describeControl = region => gpmHistoricalControlStatus({ ...region,
    contested: region.currentContested ?? region.contested,
    captured: !!region.occupationKey && !region.currentContested });
  const category = region => {
    const status = describeControl(region);
    if (status === "Contested") return "contested";
    if (status === "Captured") return "captured";
    const controller = region.currentController ?? region.controller;
    if (!region.controlled || !controller) return "unmapped";
    const side = conflict.sides?.findIndex(members => members.includes(controller));
    return side === 0 ? "first" : side === 1 ? "second" : "other";
  };
  const colors = { contested: "#af7643", captured: "#b6a153", first: "#416b86", second: "#7d64a3", other: "#56826d", unmapped: "#525b66" };
  const world = ui.globe?.world;
  const byKey = new Map(conflict.regions.map(region => [region.key, region]));
  const signature = JSON.stringify([...byKey.keys()]);
  if (state.geometry?.world !== world || state.geometry?.signature !== signature) {
    const features = world?.provinces?.filter(feature => feature.geometry && byKey.has(feature.__provKey)) || [];
    state.geometry = { world, signature, layout: features.length ? oP(features, 620, 420, { pad: 12, maxInsets: 8 }) : null,
      keys: new Map(features.map(feature => [feature.__provId, feature.__provKey])) };
  }
  const { layout, keys } = state.geometry;
  const paths = (items, width, height) => `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="Regional control and contestation">
    ${items.map(item => {
      const region = byKey.get(keys.get(item.provId));
      if (!region) return "";
      return `<path d="${b(item.d)}" fill="${colors[category(region)]}" tabindex="0" role="button"
        aria-label="${b(name(region))} · ${b(regionStatus(region))}" aria-pressed="${region === selected}" data-focus-key="history-map-${b(region.key)}"
        data-history-region="${b(region.key)}" ${region === selected ? "data-selected" : ""}>
        <title>${b(name(region))} · ${b(regionStatus(region))}</title></path>`;
    }).join("")}</svg>`;
  const labels = {
    contested: "Contested", captured: "Captured", first: authority(conflict.sides?.[0]?.[0]), second: authority(conflict.sides?.[1]?.[0]),
    other: "Other actor", unmapped: "Control unspecified",
  };
  const categories = new Set(conflict.regions.map(category));
  const regionStatus = region => {
    if (conflict.status === "occupation" && !region.occupationKey) return "Reported occupation · Exact control unknown";
    return describeControl(region) || "Exact control unknown";
  };
  const contested = selected.currentContested ?? selected.contested;
  const controllerId = selected.currentController || selected.controller;
  const controller = !contested && (selected.occupationKey || selected.controlled) &&
    (controllerId ? authority(controllerId) : selected.occupationKey && G(selected.occupationKey));
  const showLegalOwner = controller && selected.legalOwner &&
    (selected.occupationKey ? selected.occupationKey !== selected.legalOwner : selected.legalControllerId !== controllerId);
  const militaryControl = contested
    ? `<section class="gpm-history-control" aria-label="Military control breakdown" data-history-military-control>
      <b>Contested</b>${gpmHistoricalControlSummary(selected, authority, false, true)}</section>` : "";
  const overlaps = selected.overlappingConflicts || (selected.overlappingFronts || []).map(name => {
    const other = state.data?.conflicts.find(row => row.name === name);
    return { id: other?.id, name: other?.shortTitle || name, status: other?.status };
  });
  return `<section class="gpm-history-detail" aria-label="Regional control">
    <h4>Regional control</h4>
    <label class="gpm-history-region-select">Region
      <select class="k" data-authority-safe data-history-region-picker data-focus-key="history-region-picker">${conflict.regions.map(region =>
        `<option value="${b(region.key)}"${region === selected ? " selected" : ""}>${b(name(region))}</option>`).join("")}</select></label>
    <div class="sh-inset gpm-history-region">${militaryControl || (controller
      ? `<p><b>Controlled by ${b(controller)}</b>${selected.occupationKey ? " · Wartime occupation" : ""}${showLegalOwner ? ` · Legal owner ${b(G(selected.legalOwner))}` : ""}</p>`
      : `<p><b>${conflict.status === "occupation" ? "Reported occupation · " : ""}Exact control unknown</b></p>`)}
    ${selected.localOutcomes?.length ? `<p>${b([...new Set(selected.localOutcomes.map(local => local.administration || local.title).filter(Boolean))].join(", "))}</p>` : ""}
    ${overlaps.length ? `<p><b>Other conflicts here</b></p><div class="gpm-history-actions">${overlaps.map(other => other.id
      ? `<button type="button" class="k" data-authority-safe data-history-select="${b(other.id)}" data-history-keep-region data-focus-key="overlap-${b(other.id)}">${b(other.name)}${other.status ? ` · ${b(gpmHistoricalLabel(other.status))}` : ""}</button>`
      : `<span>${b(other.name)}</span>`).join("")}</div>` : ""}</div>
    ${layout ? `<div class="gpm-history-map">${paths(layout.paths, layout.W, layout.H)}${layout.insets.map(inset => paths(inset.paths, layout.box, layout.box)).join("")}
      <div class="gpm-history-map-key">${[...categories].map(key =>
        `<small><i aria-hidden="true" style="background:${colors[key]}"></i>${b(labels[key])}</small>`).join("")}</div></div>` : ""}
  </section>`;
}

function gpmHistoricalPetitionAssessment(assessment, conflictId) {
  if (!assessment) return "";
  const { support, seats, willingness, alignment, governmentChance, counterpartyChance } = assessment;
  const number = new Intl.NumberFormat(Ds(), { style: "percent", maximumFractionDigits: 1 });
  const odds = value => b(number.format(value));
  const partyReach = `Public support ${odds(support)} · Highest seat share ${odds(seats)}`;
  const influence = Math.max(support, seats);
  const panel = `petition-odds-${conflictId}`;
  return `<div class="gpm-petition-assessment" aria-label="Petition assessment">
    <div class="gpm-petition-odds">
      <div><small>Your government forwards it</small><b>${odds(governmentChance)}</b></div>
      <div><small>Other government agrees if asked</small><b>${odds(counterpartyChance)}</b></div>
    </div>
    <details class="gpm-petition-explanation" data-history-panel="${b(panel)}">
      <summary data-focus-key="${b(panel)}" data-authority-safe>What affects the odds?</summary>
      <div class="gpm-petition-factors">
        <div><b class="gpm-petition-for">Helps approval</b><ul>
          ${willingness >= .5 ? "<li>The scenario favors withdrawal talks</li>" : ""}
          ${alignment > 0 ? "<li>Good relations make agreement more likely</li>" : ""}
          ${influence > 0 ? `<li>${partyReach}</li>` : ""}
          ${willingness < .5 && alignment <= 0 && influence <= 0 ? "<li>None right now</li>" : ""}
        </ul></div>
        <div><b class="gpm-petition-against">Makes approval harder</b><ul>
          ${willingness < .5 ? "<li>The scenario gives withdrawal talks a low starting chance</li>" : ""}
          ${alignment < 0 ? "<li>Strained relations make agreement less likely</li>" : ""}
          ${influence === 0 ? `<li>${partyReach}</li>` : ""}
          ${willingness >= .5 && alignment >= 0 && influence > 0 ? "<li>None right now</li>" : ""}
        </ul></div>
      </div>
      <p>Your government weighs your public support or seat share, whichever is higher. In Party organizing, use public meetings or back an existing peaceful movement to build support.</p>
    </details>
  </div>`;
}

function gpmHistoricalOtherGroups(conflict, card, actors, focusedId) {
  const roster = new Set((card.sides || []).flatMap(side => (side.participants || []).map(participant => participant.id)));
  const participantIds = new Set([...(conflict.sides || []).flat(), ...(conflict.associatedActorIds || [])]);
  const groups = [...participantIds].filter(id => !roster.has(id) && actors.has(id));
  if (!groups.length) return "";
  const renderGroup = id => {
    const actor = actors.get(id);
    const estimate = actor.strength;
    const label = Number.isFinite(estimate?.gamePersonnel)
      ? `${estimate.gamePersonnel.toLocaleString(Ds())} personnel` : estimate?.range;
    const participant = { id, name: actor.shortName || actor.name, flagAsset: actor.identity?.flag?.asset,
      strength: label ? { label, scope: "Scenario estimate" } : null };
    return gpmHistoricalWarParticipant(participant, `related-${conflict.id}`, { actor, focused: id === focusedId, page: true });
  };
  return `<details class="gpm-history-section" data-history-panel="related-groups"${groups.includes(focusedId) ? " open" : ""}>
    <summary data-focus-key="history-related-groups">Other scenario groups</summary>
    <div class="gpm-war-roster">${groups.map(renderGroup).join("")}</div>
  </details>`;
}

function gpmHistoricalDetail(conflict, state, ui) {
  if (!conflict) return `<p>${state.pending ? "Loading conflict details…" : "Select a conflict to view its participants and regions."}</p>`;
  const actors = new Map((conflict.actors || []).map(actor => [actor.id, actor]));
  const card = conflict.warCard || gpmHistoricalWarFallback(conflict, actors);
  const pendingTerm = (conflict.options || []).find(option => option.id === state.term);
  const petitionOption = (conflict.options || []).find(option => option.id === "petition-withdrawal");
  const action = (id, label, extra = "") => `<button type="button" class="k" data-history-action="${id}" data-focus-key="history-${id}" ${extra}>${label}</button>`;
  const history = [...new Set((conflict.history || []).toReversed().map(entry => {
    const provinces = entry.gainedProvinceKeys?.map(key => conflict.regions.find(region => region.key === key)?.name || key);
    const gains = provinces?.length ? `Territorial gains in ${provinces.join(", ")}` : "";
    const outcome = entry.outcome && entry.outcome !== "implemented" ? gpmHistoricalLabel(entry.outcome) : "";
    const term = entry.term && gpmHistoricalLabel(entry.term);
    const change = [...new Set([term, outcome, gains].filter(Boolean))].join(" · ");
    return change ? `${ui.gameDate(entry.day)} · ${change}` : "";
  }).filter(Boolean))].slice(0, 3).map(change => `<li>${b(change)}</li>`).join("");
  const proposals = conflict.canNegotiate && conflict.options?.length ? (pendingTerm ? `<p><b>${b(pendingTerm.label)}</b></p>
    ${pendingTerm.description ? `<p>${b(pendingTerm.description)}</p>` : ""}${gpmHistoricalPetitionAssessment(pendingTerm.assessment, conflict.id)}
    <div class="gpm-history-actions">
    ${action("confirm", pendingTerm.id === "petition-withdrawal" ? "Submit petition" : "Submit proposal", `${pendingTerm.id === "petition-withdrawal" ? "data-authority-safe" : "data-authority-command"} ${state.busy ? "disabled" : ""}`)}
    ${action("cancel", "Cancel", `data-authority-safe data-history-cancel-term="${b(pendingTerm.id)}"`)}</div>`
    : `${petitionOption ? `<p>${b(petitionOption.description)}</p>${gpmHistoricalPetitionAssessment(petitionOption.assessment, conflict.id)}
    <p>Government review due ${b(ui.gameDate(petitionOption.reviewDay))} if you submit today.</p>` : ""}
    <div class="gpm-history-actions">${conflict.options.map(option => `<button type="button" class="k" ${option.id === "petition-withdrawal" ? "data-authority-safe" : "data-authority-command"} data-history-term="${b(option.id)}" data-focus-key="history-term-${b(option.id)}">${b(option.label)}</button>`).join("")}</div>`) : "";
  const outcome = conflict.victoryOutcome;
  const winner = outcome && actors.get(outcome.actorId);
  const victoryFlag = winner && ["national", "independence", "autonomy"].includes(outcome.scope)
    ? winner.identity?.victoryFlag || winner.identity?.administrationFlag || winner.identity?.flag : null;
  const victoryFlagUrl = gpmHistoricalAssetUrl(victoryFlag?.asset);
  const settlement = outcome?.title || (conflict.settlement && gpmHistoricalLabel(conflict.settlement));
  const administrationName = outcome?.administration || conflict.administrationName;
  const administration = administrationName !== settlement ? administrationName : null;
  const policyNames = (outcome?.regionalLaws || []).map(law => law.name).filter(Boolean);
  const postwar = settlement || administration || winner || outcome?.note
    ? `<section class="gpm-history-detail" aria-label="Outcome"><h4>Outcome</h4>
    ${settlement ? `<p><b>${b(settlement)}</b></p>` : ""}
    ${winner && (!outcome.negotiated || victoryFlag) ? `<div class="gpm-history-actor-heading">${victoryFlagUrl ? `<img class="gpm-history-flag" src="${b(victoryFlagUrl)}" alt="${b(victoryFlag.name)}">` : ""}
      <span>${b(administration || winner.shortName || winner.name)}${administration || outcome.negotiated ? "" : " won"}</span></div>` : administration ? `<p>${b(administration)}</p>` : ""}
    ${outcome?.note && conflict.petition?.status !== "accepted" ? `<p>${b(outcome.note)}</p>` : ""}
    ${policyNames.length ? `<p><b>Policies adopted</b> · ${b(policyNames.join(", "))}</p>` : ""}</section>` : "";
  const inheritedDecision = state.data?.inheritedWars?.wars?.some(war => war.conflictId === conflict.id && !war.choice);
  const nextAction = proposals || conflict.pending || conflict.actionReason || conflict.petition || conflict.theatreKey || inheritedDecision || conflict.victoryBlocked
    ? `<section class="gpm-history-detail" aria-label="What you can do"><h4>What you can do</h4>
    ${conflict.pending && conflict.petition?.status !== "forwarded" ? `<p>${b(conflict.pending.label)} proposed by ${b(G(conflict.pending.offeredBy))}. Review due ${b(ui.gameDate(conflict.pending.reviewDay))}.</p>` : ""}
    ${conflict.petition?.message ? `<p>${b(conflict.petition.message)}${Number.isFinite(conflict.decision?.reviewDay) && conflict.decision.pending ? ` Response due ${b(ui.gameDate(conflict.decision.reviewDay))}.` : ""}</p>` : ""}
    ${conflict.actionReason && !conflict.pending && !conflict.petition && !conflict.theatreKey && !inheritedDecision ? `<p>${b(conflict.actionReason)}</p>` : ""}
    ${conflict.victoryBlocked ? `<p>${b(conflict.victoryBlocked)}</p>` : ""}
    ${conflict.theatreKey || inheritedDecision ? `<div class="gpm-history-actions">
      ${inheritedDecision ? action("decisions", "Open decisions", "data-authority-safe") : ""}
      ${conflict.theatreKey ? action("theatre", "Open War Theatre", "data-authority-safe") : ""}</div>` : ""}
    ${proposals}</section>` : "";
  const ceasefireReview = conflict.status === "ceasefire" && Number.isInteger(conflict.ceasefireUntil) && conflict.ceasefireUntil > state.data?.day;
  return `<article class="gpm-history-detail" aria-label="${b(conflict.name)}">
    ${gpmHistoricalWarCard(card, "detail", { actors, actorId: state.actorId })}
    ${nextAction}${postwar}
    ${ceasefireReview ? `<p>Ceasefire review due ${b(ui.gameDate(conflict.ceasefireUntil))}.</p>` : ""}
    ${conflict.transitionReview ? "<p>The new government is reviewing this ceasefire.</p>" : ""}
    ${Number.isInteger(conflict.aidUntil) && conflict.aidUntil > state.data?.day ? `<p>Humanitarian access until ${b(ui.gameDate(conflict.aidUntil))}.</p>` : ""}
    ${gpmHistoricalRegions(conflict, actors, state, ui)}
    ${gpmHistoricalOtherGroups(conflict, card, actors, state.actorId)}
    ${history ? `<details class="gpm-history-section" data-history-panel="negotiations"><summary data-focus-key="history-negotiations">Recent changes</summary><ul>${history}</ul></details>` : ""}
  </article>`;
}

function gpmHistoricalDecisions(state, ui) {
  if (!state.data) return `<p>${state.pending ? "Loading decisions…" : "No decisions are available."}</p>`;
  const inherited = state.data.inheritedWars || { wars: [], voluntaryAid: [] };
  const button = (id, action, label, token) => `<button class="k" type="button" data-history-decision="${b(action)}"
    data-history-decision-id="${b(id)}" data-focus-key="decision-${b(id)}-${b(action)}"
    ${token ? `data-history-peace-token="${b(token)}"` : ""}
    data-authority-command${state.busy || state.pending ? " disabled" : ""}>${b(label)}</button>`;
  const details = (conflictId, key, label = "View war details") => conflictId ? `<button class="k" type="button" data-authority-safe
    data-history-select="${b(conflictId)}" data-focus-key="decision-${b(key)}-details">${b(label)}</button>` : "";
  const warRows = inherited.wars.map(war => {
    const title = `<strong>${b(war.name)}</strong>`;
    const { peace } = war;
    const offer = peace?.offer;
    const warDetails = details(war.conflictId, war.key);
    const terms = offer ? `<div class="gpm-peace-terms" aria-label="Peace terms">
      <b>${b(offer.heading)}</b>
      ${offer.counterparties?.length ? `<p>Other parties · ${b(offer.counterparties.join(", "))}</p>` : ""}
      <ul>${offer.consequences.map(consequence => `<li>${b(consequence)}</li>`).join("")}</ul>
    </div>` : "";
    const message = peace?.message;
    let body = "";
    let controls = "";
    if (war.choice) {
      const result = { leave: "Departed", stay: "Stayed in the war", peace: "Peace agreement signed" }[war.choice] || "No longer involved";
      body = `<p>${b(result)}</p>${war.choice === "peace" ? terms : ""}`;
    } else if (peace?.status === "pending") {
      const date = Number.isInteger(peace.reviewDay) ? ` Response due ${b(ui.gameDate(peace.reviewDay))}.` : "";
      body = `<p>${b(message || "The other side is reviewing your offer. The war continues.")}${date}</p>${terms}`;
      controls = warDetails;
    } else if (peace?.status === "ready" && offer) {
      const expiry = Number.isInteger(peace.expiresDay) ? `<p>Accept by ${b(ui.gameDate(peace.expiresDay))}.</p>` : "";
      body = `<p>${b(message || "The other side has agreed to these terms. Sign to put the agreement into effect.")}</p>${terms}${expiry}`;
      controls = button(war.key, "accept", "Accept peace terms", offer.token) +
        button(war.key, "decline", "Decline terms") + warDetails;
    } else {
      const review = state.decisionReview?.id === war.key ? state.decisionReview.choice : null;
      const canOffer = !!offer && !(peace.retryDay > state.data.day);
      const reviewing = review === "offer" && canOffer;
      const confirmingStay = review === "stay";
      const retry = Number.isInteger(peace?.retryDay) && peace.retryDay > state.data.day
        ? `<p>New offers available ${b(ui.gameDate(peace.retryDay))}.</p>` : "";
      const back = button(war.key, "cancel", "Back");
      if (confirmingStay) {
        body = "<p>Your country will stay in the war and close this post-uprising peace decision.</p>";
        controls = button(war.key, "stay", "Confirm keep fighting") + back;
      } else if (reviewing) {
        body = `${terms}${offer.likelihood ? `<p>${b(offer.likelihood)}</p>` : ""}<p>Your country remains in the war while the other side reviews the offer.</p>`;
        controls = button(war.key, "offer", "Send peace offer", offer.token) + back;
      } else {
        body = `${message ? `<p>${b(message)}</p>` : canOffer ? "<p>Review what ending this war would require.</p>" : ""}${retry}`;
        controls = (canOffer ? button(war.key, "review", "Seek peace") : "") + button(war.key, "reviewStay", "Keep fighting") + warDetails;
      }
    }
    return `<article class="sh-inset">${title}${body}${controls ? `<div class="gpm-history-actions">${controls}</div>` : ""}</article>`;
  });
  const aidRows = inherited.voluntaryAid.map(aid => `<article class="sh-inset"><strong>Aid to ${b(aid.recipient)}</strong>
    ${aid.warName ? `<p>${b(aid.warName)}</p>` : ""}<div class="gpm-history-actions">${button(aid.id, "endAid", "End voluntary support")}</div></article>`);
  const diplomacyRows = state.data.conflicts.filter(conflict => conflict.decision).map(conflict => {
    const { label, description, pending, message, reviewDay, assessment } = conflict.decision;
    return `<article class="sh-inset"><strong>${b(conflict.shortTitle || conflict.name)}</strong>
      ${message ? `<p>${b(message)}${pending && Number.isFinite(reviewDay) ? ` Response due ${b(ui.gameDate(reviewDay))}.` : ""}</p>` : ""}
      ${description ? `<p>${b(description)}</p>` : ""}${gpmHistoricalPetitionAssessment(assessment, conflict.id)}
      <div class="gpm-history-actions">${details(conflict.id, conflict.id, label)}</div></article>`;
  });
  const sections = (title, rows) => rows.length ? `<section><h4>${title}</h4>${rows.join("")}</section>` : "";
  return sections("Inherited wars", warRows) + sections("Voluntary support", aidRows) + sections("Occupation diplomacy", diplomacyRows)
    || "<p>No conflict decisions are available.</p>";
}

function gpmOpenHistoricalDecisions(ui, session) {
  if (Ue !== session || ui.sim !== session) return;
  ui._gpmHistoryDecisionsSelection = { session, countryKey: session.playerKey };
  if (ui.globe?._gpmHistoricalMap) ui.globe._gpmHistoricalMap.selectedWar = null;
  const host = K("content-body")?.querySelector("[data-gpm-history]");
  if (ui.activeModule === "military" && ui._subSel.military === "historical-conflicts" && host) {
    gpmHistoricalConflictsView(host, ui, session);
  } else {
    ui.openModule("military", "historical-conflicts");
  }
}

function gpmHistoricalConflictsView(host, ui, session) {
  if (!host || !session) return;
  let state = ui._gpmHistory;
  if (!state || state.session !== session) state = ui._gpmHistory = { session, panel: "wars", query: "", status: "", request: 0, pageSize: 24 };
  const decisionSelection = ui._gpmHistoryDecisionsSelection;
  const fromDecision = decisionSelection?.session === session && decisionSelection.countryKey === session.playerKey;
  if (fromDecision) {
    ui._gpmHistoryDecisionsSelection = null;
    state.panel = "decisions";
    state.decisionReview = null;
  }
  const mapSelection = ui._gpmHistoryMapSelection;
  const fromMap = mapSelection?.session === session;
  if (fromMap) {
    ui._gpmHistoryMapSelection = null;
    state.selectedId = mapSelection.id;
    state.regionKey = mapSelection.provinceKey;
    state.actorId = mapSelection.actorId;
    state.revealActor = Boolean(mapSelection.actorId);
    state.panel = "detail";
    state.filter = "";
    state.query = "";
    state.term = null;
  }
  if (state.host === host && state.playerKey === session.playerKey) {
    if (fromMap) {
      host.querySelector("[data-history-search]").value = "";
      void state.load(state.selectedId, true);
      return;
    }
    if (fromDecision) {
      void state.load(state.selectedId, true);
      return;
    }
    const changed = state.data?.day !== session.day || state.lastCommitRevision !== session.status?.commitRevision;
    if (!state.pending && !state.busy && changed && performance.now() - state.lastRequest > 1500) void state.load();
    return;
  }
  if (state.playerKey !== session.playerKey) {
    state.data = null;
    state.term = null;
    state.decisionReview = null;
    state.status = "";
  }
  state.host = host;
  state.playerKey = session.playerKey;
  const feedback = host.querySelector("[data-history-feedback]");
  const filter = host.querySelector("[data-history-filter]");
  const incidents = host.querySelector("[data-history-incidents]");
  const search = host.querySelector("[data-history-search]");
  const list = host.querySelector("[data-history-list]");
  const tools = host.querySelector("[data-history-tools]");
  const more = host.querySelector("[data-history-more]");
  const detail = host.querySelector("[data-history-detail]");
  const decisions = host.querySelector("[data-history-decisions]");
  const current = () => ui.sim === session && ui._gpmHistory === state && state.host === host && host.isConnected;
  const active = () => host.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
  const restoreFocus = key => key && host.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  const setHtml = (element, html) => {
    if (element._historyHtml === html) return;
    const key = active();
    const scroll = element.scrollTop;
    const scrollers = [];
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.scrollTop) scrollers.push([parent, parent.scrollTop]);
    }
    const panelOwner = element === decisions ? "decisions" : state.selectedId;
    const panelState = element._historyPanelOwner === panelOwner
      ? new Map([...element.querySelectorAll("[data-history-panel]")].map(panel => [panel.dataset.historyPanel, panel.open])) : new Map();
    element.innerHTML = html;
    element._historyHtml = html;
    element._historyPanelOwner = panelOwner;
    for (const panel of element.querySelectorAll("[data-history-panel]")) {
      if (panelState.has(panel.dataset.historyPanel) && !(panel.dataset.historyPanel === "negotiations" && state.term)) {
        panel.open = panelState.get(panel.dataset.historyPanel);
      }
    }
    element.scrollTop = scroll;
    for (const [scroller, position] of scrollers) scroller.scrollTop = position;
    restoreFocus(key);
  };
  const paint = () => {
    if (state.host !== host || ui._gpmHistory !== state) return;
    const data = state.data;
    const all = data?.conflicts || [];
    const wars = all.filter(conflict => !conflict.crimeReport && !conflict.strategicOnly);
    const incidentReports = all.filter(conflict => conflict.crimeReport || conflict.strategicOnly);
    const showingDetail = state.panel === "detail";
    const showingDecisions = state.panel === "decisions";
    const showingWars = !showingDetail && !showingDecisions;
    const inherited = data?.inheritedWars;
    const decisionsCount = all.filter(conflict => conflict.decision?.actionable).length +
      (inherited ? inherited.wars.filter(war => !war.choice && war.peace?.status !== "pending").length + inherited.voluntaryAid.length : 0);
    host.querySelector("[data-history-decisions-count]").textContent = decisionsCount ? String(decisionsCount) : "";
    tools.hidden = list.hidden = !showingWars;
    detail.hidden = !showingDetail;
    decisions.hidden = !showingDecisions;
    for (const tab of host.querySelectorAll("[data-history-tab]")) {
      const isDetail = tab.dataset.historyTab === "detail";
      tab.hidden = isDetail && !state.selectedId;
      tab.setAttribute("aria-pressed", String(tab.dataset.historyTab === state.panel));
    }
    const statuses = [...new Set(wars.map(conflict => conflict.status).filter(Boolean))].sort();
    if (state.filter && !statuses.includes(state.filter)) state.filter = "";
    setHtml(filter, `<option value="">All statuses</option>${statuses.map(status => `<option value="${b(status)}"${state.filter === status ? " selected" : ""}>${b(gpmHistoricalLabel(status))}</option>`).join("")}`);
    const query = kt(state.query.trim());
    const matches = conflict => !query || kt([
      conflict.name, conflict.shortTitle, ...(conflict.participantNames || []),
      gpmHistoricalLabel(conflict.kind), ...(conflict.countryKeys || []).map(key => G(key)),
    ].join(" ")).includes(query);
    const statusOrder = ["active", "occupation", "ceasefire", "suspended", "settled"];
    const order = status => statusOrder.includes(status) ? statusOrder.indexOf(status) : statusOrder.length;
    const byStatus = (a, b) => order(a.status) - order(b.status) || (a.shortTitle || a.name).localeCompare(b.shortTitle || b.name, Ds());
    const rows = wars.filter(conflict => (!state.filter || conflict.status === state.filter) && matches(conflict)).sort(byStatus);
    const incidentRows = incidentReports.filter(matches).sort(byStatus);
    const buttons = conflicts => conflicts.map(conflict => `<button type="button" class="k" data-authority-safe data-history-select="${b(conflict.id)}" data-focus-key="history-select-${b(conflict.id)}">
      <b title="${b(conflict.name)}">${b(conflict.shortTitle || conflict.name)}</b><small>${b(gpmHistoricalLabel(conflict.status))}</small></button>`).join("");
    const selected = data?.selected;
    if (showingDetail) {
      setHtml(detail, gpmHistoricalDetail(selected?.id && selected.id === state.selectedId ? selected : null, state, ui));
      if (state.revealActor && selected?.id === state.selectedId) {
        const actor = detail.querySelector("[data-history-focused-actor]");
        if (actor) {
          actor.open = true;
          const group = actor.parentElement.closest(".gpm-war-supporters, [data-history-panel=related-groups]");
          if (group) group.open = true;
        }
        state.revealActor = false;
      }
    } else if (showingDecisions) {
      setHtml(decisions, gpmHistoricalDecisions(state, ui));
    } else {
      const involved = rows.filter(conflict => conflict.warCard?.playerRole);
      const other = rows.filter(conflict => !conflict.warCard?.playerRole);
      const cards = conflicts => conflicts.map(conflict => gpmHistoricalWarCard(conflict.warCard || gpmHistoricalWarFallback(conflict), "compact")).join("");
      const shown = Math.max(involved.length, state.pageSize);
      host.querySelector("[data-history-count]").textContent = data ? `${Math.min(shown, rows.length)} of ${rows.length} wars and conflicts` : "";
      setHtml(list, rows.length ? `${involved.length ? `<h4>Involving your country</h4>${cards(involved)}` : ""}
        ${other.length && shown > involved.length ? `${involved.length ? "<h4>Other wars and conflicts</h4>" : ""}${cards(other.slice(0, shown - involved.length))}` : ""}`
        : `<p>${data ? wars.length ? "No wars match these filters." : "No wars available." : state.pending ? "Loading wars…" : "Conflict data is unavailable."}</p>`);
      more.hidden = rows.length <= shown;
      more.textContent = `Show ${Math.min(24, Math.max(0, rows.length - shown))} more wars`;
      incidents.hidden = !incidentRows.length;
      setHtml(incidents.querySelector("[data-history-incident-list]"), buttons(incidentRows));
    }
    if (!showingWars) more.hidden = incidents.hidden = true;
    feedback.textContent = state.status;
    host.setAttribute("aria-busy", String(!!state.pending || !!state.busy));
  };
  state.load = async (id = state.selectedId, force = false) => {
    if (!current() || state.busy || (state.pending && !force)) return;
    const request = ++state.request;
    const commitRevision = session.status?.commitRevision;
    state.pending = true;
    state.lastRequest = performance.now();
    paint();
    try {
      const result = await Je(session, "gpm.historicalConflicts", id ? { id } : {});
      if (!current() || state.request !== request) return;
      if (!Array.isArray(result?.conflicts)) throw new Error("Unexpected conflict data");
      state.data = result;
      state.lastCommitRevision = commitRevision;
      if (state.status === "Could not load the historical conflicts. Try Refresh.") state.status = "";
    } catch (error) {
      console.warn("[PPO] Historical Conflicts could not load", error);
      if (current() && state.request === request) state.status = "Could not load the historical conflicts. Try Refresh.";
    } finally {
      if (state.request === request) {
        state.pending = false;
        if (current()) paint();
      }
    }
  };
  search.value = state.query;
  search.oninput = () => { state.query = search.value; state.pageSize = 24; paint(); };
  filter.onchange = () => { state.filter = filter.value; state.pageSize = 24; paint(); };
  const selectConflict = (id, keepRegion = false) => {
    if (!id || state.busy) return;
    state.panel = "detail";
    state.selectedId = id;
    if (!keepRegion) state.regionKey = null;
    state.actorId = null;
    state.term = null;
    state.status = "";
    if (ui.globe?._gpmHistoricalMap) ui.globe._gpmHistoricalMap.selectedWar = id;
    void state.load(id, true);
    restoreFocus("history-tab-detail");
  };
  host.onkeydown = event => {
    if (!event.target.matches("[data-history-region]") || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    state.regionKey = event.target.dataset.historyRegion;
    paint();
  };
  host.onchange = event => {
    if (!event.target.matches("[data-history-region-picker]")) return;
    state.regionKey = event.target.value;
    paint();
  };
  host.onclick = async event => {
    if (!current()) return;
    const card = event.target.closest("[data-history-card]");
    if (card && !event.target.closest("button, details, a")) {
      selectConflict(card.dataset.historyCard);
      return;
    }
    const control = event.target.closest("[data-history-select], [data-history-region], [data-history-action], [data-history-term], [data-history-tab], [data-history-more], [data-history-decision]");
    if (!control || control.disabled || state.busy) return;
    const { historySelect, historyRegion, historyAction, historyTerm, historyTab, historyDecision, historyDecisionId, historyPeaceToken } = control.dataset;
    if (historySelect) {
      selectConflict(historySelect, control.hasAttribute("data-history-keep-region"));
      return;
    } else if (historyTab) {
      state.panel = historyTab;
      state.status = "";
      state.decisionReview = null;
      if (ui.globe?._gpmHistoricalMap) ui.globe._gpmHistoricalMap.selectedWar = historyTab === "detail" ? state.selectedId : null;
    } else if (historyDecision) {
      if (["review", "reviewStay", "cancel"].includes(historyDecision)) {
        const priorChoice = state.decisionReview?.choice;
        const choice = { review: "offer", reviewStay: "stay" }[historyDecision];
        state.decisionReview = choice ? { id: historyDecisionId, choice } : null;
        paint();
        restoreFocus(`decision-${historyDecisionId}-${choice || (priorChoice === "stay" ? "reviewStay" : "review")}`);
        return;
      }
      if (state.pending || (["offer", "stay"].includes(historyDecision) &&
        (state.decisionReview?.id !== historyDecisionId || state.decisionReview.choice !== historyDecision))) return;
      state.busy = true;
      state.status = "Applying decision…";
      paint();
      try {
        const result = await Le(session, "applyPlayerAction", [{ verb: "gpm.party.uprising.warDecision", id: historyDecisionId,
          choice: historyDecision, ...(historyPeaceToken ? { token: historyPeaceToken } : {}),
          ...gpmExpectedActor(state.data?.playerKey, state.data?.partyId, state.data) }]);
        const feedback = { offer: "Peace offer sent.", accept: "Peace agreement signed.",
          decline: "Peace terms declined. Your country is still in the war.", stay: "Your country stayed in the war.", endAid: "Voluntary support ended." };
        if (current()) state.status = result?.ok ? feedback[historyDecision] : result?.message || "That decision is no longer available. Review the latest terms.";
      } catch (error) {
        console.warn("[PPO] Inherited war decision failed", error);
        if (current()) state.status = "Check the war status before trying again.";
      } finally {
        state.busy = false;
        state.decisionReview = null;
        if (current()) await state.load(state.selectedId, true);
      }
      if (current()) restoreFocus("history-tab-decisions");
      return;
    } else if (control.hasAttribute("data-history-more")) {
      state.pageSize = Math.max(state.pageSize, Number(list.querySelectorAll("[data-history-card]").length)) + 24;
    } else if (historyRegion) state.regionKey = historyRegion;
    else if (historyTerm) state.term = historyTerm;
    else if (historyAction === "cancel") state.term = null;
    else if (historyAction === "refresh") {
      state.status = "";
      void state.load(state.selectedId, true);
    } else if (historyAction === "decisions") {
      gpmOpenHistoricalDecisions(ui, session);
      restoreFocus("history-tab-decisions");
      return;
    } else if (historyAction === "theatre") {
      const key = state.data?.selected?.theatreKey;
      if (key) ui.openWarTarget(key);
      return;
    } else if (historyAction === "confirm") {
      const conflict = state.data?.selected;
      const term = conflict?.options?.find(option => option.id === state.term);
      if (!conflict?.canNegotiate || !term || state.selectedId !== conflict.id || state.pending) return;
      state.busy = true;
      state.status = ["concede-victory", "claim-victory"].includes(term.id) ? "Implementing settlement…" : "Submitting proposal…";
      paint();
      try {
        const result = await Le(session, "applyPlayerAction", [{ verb: "gpm.historicalConflicts.negotiate", id: conflict.id, term: term.id,
          ...gpmExpectedActor(state.data.playerKey, state.data.partyId, state.data) }]);
        if (result?.ok) state.status = result.message || "Proposal recorded.";
        else state.status = result?.message || `Proposal unavailable${result?.reason ? ` · ${gpmHistoricalLabel(result.reason)}` : ""}.`;
      } catch (error) {
        console.warn("[PPO] Historical Conflicts negotiation could not be verified", error);
        state.status = "Could not verify the proposal. Refresh to check its status.";
      } finally {
        state.busy = false;
        state.term = null;
        if (current()) await state.load(state.selectedId, true);
      }
    }
    if (current()) paint();
    if (historyTerm) restoreFocus("history-confirm");
    if (historyAction === "cancel") restoreFocus("history-term-" + control.dataset.historyCancelTerm);
  };
  paint();
  // The native module may build detached content before attaching it to the panel.
  queueMicrotask(() => { if (current()) void state.load(state.selectedId, true); });
}

function gpmBuildHistoricalConflicts(container, ui, session) {
  container.innerHTML = `<section class="mcard wide gpm-history" data-gpm-history aria-label="Historical Conflicts">
    <header><h3 class="mc-title">Historical Conflicts</h3></header>
    <nav class="gpm-history-tabs" aria-label="Historical Conflicts views">
      <button type="button" class="k" data-authority-safe data-history-tab="wars" data-focus-key="history-tab-wars" aria-pressed="true">Wars</button>
      <button type="button" class="k" data-authority-safe data-history-tab="detail" data-focus-key="history-tab-detail" aria-pressed="false" hidden>War details</button>
      <button type="button" class="k" data-authority-safe data-history-tab="decisions" data-focus-key="history-tab-decisions" aria-pressed="false">Decisions<span data-history-decisions-count></span></button>
    </nav>
    <div class="gpm-history-tools" data-history-tools>
      <label>Search wars <input type="search" class="k" data-history-search data-focus-key="history-search"></label>
      <label>Status <select class="k" data-authority-safe data-history-filter data-focus-key="history-filter"></select></label>
      <button type="button" class="k" data-authority-safe data-history-action="refresh" data-focus-key="history-refresh">Refresh</button>
      <small data-history-count></small>
    </div>
    <small role="status" data-history-feedback></small>
    <div class="gpm-history-war-list" role="group" aria-label="Wars" data-history-list data-keep-scroll="historical-conflicts"></div>
    <button type="button" class="k" data-authority-safe data-history-more data-focus-key="history-more" hidden></button>
    <details class="gpm-history-section" data-history-incidents hidden><summary data-focus-key="history-incident-reports">Incident reports</summary>
      <div class="gpm-history-list" data-history-incident-list></div></details>
    <div data-history-detail hidden></div>
    <div class="gpm-history-decisions" data-history-decisions aria-label="War decisions" hidden></div>
  </section>`;
  gpmHistoricalConflictsView(container.querySelector("[data-gpm-history]"), ui, session);
}

function patchHistoricalConflictsRenderer(source, replaceOnce) {
  const rendererFunctions = [gpmHistoricalLabel, gpmHistoricalPlayerRole, gpmHistoricalWarParticipant, gpmHistoricalWarPortrait,
    gpmHistoricalWarCard, gpmHistoricalWarFallback, gpmShowNextWarAlert, gpmQueueWarAlert,
    gpmMountHistoricalInspector, gpmHistoricalFactionHeading, gpmHistoricalFactionProfile, gpmOpenHistoricalFactionInspector,
    gpmHistoricalControlSummary, gpmHistoricalControlStatus, gpmHistoricalFrontSummary, gpmHistoricalOverlayFront, gpmCloseRegionalControlBox, gpmOpenRegionalControlBox,
    gpmHistoricalRegions, gpmHistoricalPetitionAssessment, gpmHistoricalOtherGroups, gpmHistoricalDetail, gpmHistoricalDecisions, gpmOpenHistoricalDecisions, gpmHistoricalConflictsView, gpmBuildHistoricalConflicts];
  const initialize = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, initialize, "\nconst gpmHistoricalConflictsStyle = " + JSON.stringify(style) + ";\n"
    + rendererFunctions.join("\n") + initialize);
  const mountStyle = "style.textContent += gpmRegionalMapStyle + gpmForeignFundingStyle + gpmLawShortlistStyle + gpmUprisingStyle;";
  js = replaceOnce(js, mountStyle, mountStyle.replace(";", " + gpmHistoricalConflictsStyle;"));
  const translate = 'function y4e(e){\n    const officialName';
  js = replaceOnce(js, translate, 'function y4e(e){\n    if(e==="gpm.historicalConflicts.title")return "Historical Conflicts";\n    const officialName');
  const views = 'if(e==="military"){let a=j.BUDGET;';
  js = replaceOnce(js, views, 'if(e==="military"){if(t==="historical-conflicts")return [];let a=j.BUDGET;');
  const foot = 'foot:n=>this._subSel.military==="oob"?this._budgetReformFoot(n,!0):this._budgetReformFoot(n)';
  js = replaceOnce(js, foot, 'foot:n=>this._subSel.military==="historical-conflicts"?null:this._subSel.military==="oob"?this._budgetReformFoot(n,!0):this._budgetReformFoot(n)');
  const militaryTab = '{id:"command",k:"sub.military.war",rerender:!0,renderMode:"live",sig:n=>this._milNuclearSig(n),build:(n,r)=>this._bMilCommand(n,r),refresh:n=>this._rMilCommand(n),deactivate:()=>{this.deterrenceLayer?.active&&this.deterrenceLayer.set(!1)}},';
  js = replaceOnce(js, militaryTab, militaryTab + '{id:"historical-conflicts",k:"gpm.historicalConflicts.title",build:(n,r)=>gpmBuildHistoricalConflicts(n,this,r)},');
  js = replaceOnce(js, 'async openInspector(e,t,a,n=null){let r=this.inspectedKey;',
    'async openInspector(e,t,a,n=null){this._gpmFactionInspector=null;let r=this.inspectedKey;');
  js = replaceOnce(js, 'closeInspector(){this.inspectedKey=null,',
    'closeInspector(){this._gpmFactionInspector=null;this.inspectedKey=null,');
  js = replaceOnce(js, '_resetInspectorTransient(){this._inspSig=null,',
    '_resetInspectorTransient(){this._gpmFactionInspector=null;this._inspSig=null,');
  const drain = 'drain(){this._releaseHeld();let t=this.sim.drainNotifications();this.advisor.beginBatch(t);for(let a of t)this._confined(a?.event||a,()=>this._presentEnvelope(a));this.advisor.pump()}';
  js = replaceOnce(js, drain, 'drain(){this._releaseHeld();const batch=this.sim.drainNotifications();this._gpmDirectBatch=new Set(batch.map(t=>t?.event||t).filter(e=>e.type==="gpm.war_entered"&&(!Array.isArray(e.audience?.countryKeys)||e.audience.countryKeys.map(String).includes(String(this.sim.playerKey)))).map(e=>e.payload?.warId||e.payload?.id));this.advisor.beginBatch(batch);try{for(const t of batch)this._confined(t?.event||t,()=>this._presentEnvelope(t));this.advisor.pump()}finally{this._gpmDirectBatch=null}}');
  const event = 'if(Array.isArray(r)&&!r.some(d=>i.has(String(d))))return;let s=PF(a,{sim:this.sim,presentation:n}),l=';
  js = replaceOnce(js, event, 'if(Array.isArray(r)&&!r.some(d=>i.has(String(d))))return;if(a.type==="gpm.war_entered"){gpmQueueWarAlert(this,a.payload,a.id);return}if(a.type==="gpm.war_choices_available"){const session=this.sim;void gpmSyncUprisingControl(session).then(()=>{if(session.playerKey===a.payload?.countryKey)gpmOpenHistoricalDecisions(this.ui,session)}).catch(error=>console.warn("[PPO] Could not open war decisions",error));return}let s=PF(a,{sim:this.sim,presentation:n});if((a.type==="war.player_attacked"||a.type==="war.player_attacked_news")&&this._gpmDirectBatch?.has(a.payload?.warId)){if(a.type==="war.player_attacked")this.ui.recordPassiveEvent?.(s,n);return}let l=');
  const news = 'sJt=Object.freeze({"war.ai_started"';
  js = replaceOnce(js, news, 'sJt=Object.freeze({"military.support_activated":sd("war",["supportId","conflictId","donorKey","recipientKey","shippedUnits","promisedUnits","shippedAmmunitionLots","promisedAmmunitionLots"],["donorKey","recipientKey"]),"military.support_refused":sd("war",["supportId","conflictId","donorKey","recipientKey","modeId"],["donorKey","recipientKey"]),"war.ai_started"');
  const newsHeadline = 'case"war.player_declared":return o("news.war.head",{a:a(t.playerKey),b:a(t.enemyKey)});';
  js = replaceOnce(js, newsHeadline, 'case"military.support_activated":return `${a(t.donorKey)} agreed to support ${a(t.recipientKey)}`;case"military.support_refused":return t.modeId==="offer"?`${a(t.recipientKey)} declined support from ${a(t.donorKey)}`:`${a(t.donorKey)} declined a support request from ${a(t.recipientKey)}`;' + newsHeadline);
  const refresh = '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);';
  return replaceOnce(js, refresh, refresh + 'if(this.activeModule==="military"&&this._subSel.military==="historical-conflicts")gpmHistoricalConflictsView(K("content-body")?.querySelector("[data-gpm-history]"),this,this.sim);');
}

module.exports = { patchHistoricalConflictsRenderer };
