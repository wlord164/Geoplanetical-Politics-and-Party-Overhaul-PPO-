"use strict";

const style = [
  ".gpm-uprising { display: grid; gap: var(--gap-2); min-width: 0; }",
  ".gpm-uprising :is(p, dl, dd) { margin: 0; }",
  ".gpm-uprising [data-gpm-uprising-content] { display: grid; gap: var(--gap-2); }",
  ".gpm-uprising [data-gpm-uprising-status]:empty { display: none; }",
  ".gpm-uprising-details { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--gap-1) var(--gap-2); }",
  ".gpm-uprising-details dd { overflow-wrap: anywhere; }",
  ".gpm-uprising-outcomes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--gap-2); }",
  ".gpm-uprising-outcomes > div { display: grid; align-content: start; gap: var(--gap-1); padding: var(--gap-2); }",
  ".gpm-uprising-charter { display: grid; gap: var(--gap-1); margin: 0; padding-inline-start: var(--gap-3, 1.25rem); }",
  ".gpm-uprising-actions { display: flex; flex-wrap: wrap; gap: var(--gap-2); align-items: center; }",
  ".gpm-uprising [data-gpm-uprising-action='declare'] { border-color: var(--mark-late, #edc583); }",
].join("\n");

function gpmRenderUprising() {
  return '<section class="mcard wide gpm-uprising" aria-label="Uprising">'
    + '<h3 class="mc-title">Uprising</h3>'
    + '<div data-gpm-uprising-content></div>'
    + '<small role="status" data-gpm-uprising-status></small></section>';
}

function gpmUprisingReason(reason) {
  return ({
    scope: "Uprisings require a sovereign country with its own government and legislature.",
    constitution: "This country cannot adopt the proposed constitution.",
    name: "Select one of the available breakaway names.",
    case_exists: "An uprising has already taken place in this campaign.",
    founder_control: "Switch to the legal founding party to review an uprising.",
    unsupported_party_roles: "Your party must hold no government offices or assembly seats.",
    existing_war: "The current conflict must end before an uprising can begin.",
    territory: "The country needs an unoccupied region outside its capital with a land border to the rest of the country.",
    stale: "The declaration terms changed. Review the updated proposal before confirming.",
    result: "A decisive war result is required for reunification.",
    conflict_mismatch: "The uprising no longer matches the active conflict.",
  })[reason] || "The uprising is unavailable in the current situation.";
}

function gpmUprisingPanel(state) {
  const data = state.data;
  const button = (action, label, disabled = false) =>
    '<button class="k" type="button" data-gpm-uprising-action="' + action + '"'
    + (disabled || state.busy ? " disabled" : "") + ">" + label + "</button>";
  const actions = (...buttons) => '<div class="gpm-uprising-actions">' + buttons.join("") + "</div>";
  if (!data) return state.loading ? "" : actions(button("refresh", "Load uprising"));
  const party = data.partyName || state.partyName || "Your party";
  const region = data.provinceKey ? Gt(data.provinceKey, data.regionName) : data.regionName;
  const seatOutcome = data.singleParty ? " and holds every seat in the assembly" : " under the new constitution";
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 });
  const before = Number.isFinite(data.nationalSupport) ? percent.format(data.nationalSupport) : "—";
  const after = Number.isFinite(data.victorySupport) ? percent.format(data.victorySupport) : "—";
  const lawChanges = Array.isArray(data.charterLaws) ? data.charterLaws : [];
  const charter = lawChanges.length
    ? '<details data-gpm-uprising-charter><summary>' + lawChanges.length
      + (lawChanges.length === 1 ? " law change" : " law changes")
      + '</summary><ul class="gpm-uprising-charter">' + lawChanges.map(law =>
        "<li>" + b(law.name || tr(law.lawId)) + " · " + b(law.option || (pl(law.lawId) ? go(pl(law.lawId), law.value, null) : law.choiceId)) + "</li>").join("") + "</ul></details>"
    : "<small>The policy review found no law changes.</small>";
  if (data.phase === "active") {
    const note = data.warStatus === "suspended"
      ? "Hostilities are suspended. The uprising remains unresolved."
      : "The decisive result will determine which side governs the reunited country.";
    const summary = data.warStatus === "suspended"
      ? b(data.breakawayName) + " and " + b(data.parentName)
      : b(data.breakawayName) + " is at war with " + b(data.parentName);
    const restoration = data.restoresOriginalName ? "<p>Breakaway victory restores <strong>"
      + b(data.victoryName) + "</strong>.</p>" : "";
    return "<p><strong>" + summary + "</strong></p><p>" + note + "</p>" + restoration
      + actions(button("war", "Open War Theatre"));
  }
  if (data.phase === "settled") {
    const victory = data.result === "breakaway";
    if (data.result === "breakaway" || data.result === "government") {
      return victory
        ? "<p><strong>Breakaway victory.</strong> " + b(party) + " governs the reunited " + b(data.victoryName || data.breakawayName)
          + seatOutcome + ".</p><p>" + b(data.government) + ". The founding laws are in effect.</p>" + charter
          + (Number.isFinite(data.victorySupport) ? "<p>Base national support at reunification was " + b(after) + ".</p>" : "")
        : "<p><strong>Government victory.</strong> " + b(data.parentName) + " is reunited. " + b(party) + " is banned.</p>";
    }
    return "<p><strong>Conflict ended without a decisive result.</strong> The two governments remain separate.</p>";
  }
  if (!data.available || data.phase !== "ready" || typeof data.quoteId !== "string") {
    return "<p>" + b(gpmUprisingReason(data.reason)) + "</p>" + actions(button("refresh", "Refresh", state.loading));
  }
  const name = data.restoresOriginalName ? data.breakawayName : state.selectedName || data.breakawayName;
  const options = (data.names || []).map(option => '<option' + (option === name ? " selected" : "")
    + ">" + b(option) + "</option>").join("");
  const nameField = !data.restoresOriginalName && !state.confirm && data.names?.length > 1
    ? '<select aria-label="Breakaway name" data-gpm-uprising-name>' + options + "</select>"
    : b(name);
  const victorySeats = data.singleParty ? " and holds every seat in its single-party assembly."
    : " under the new constitution. The reunited assembly keeps its sitting members until an election.";
  const nameOutcome = data.restoresOriginalName ? "Victory restores <strong>" + b(data.victoryName) + "</strong>."
    : "The reunited country keeps the breakaway name.";
  const heading = state.confirm ? "Confirm declaration" : "Declaration preview";
  const controls = state.confirm
    ? actions(button("cancel", "Cancel"), button("declare", "Declare Uprising", state.loading))
    : actions(button("review", "Review Declaration", state.loading), button("refresh", "Refresh", state.loading));
  return "<p><strong>" + heading + "</strong></p>"
    + '<dl class="gpm-uprising-details"><dt>Party</dt><dd>' + b(party)
    + "</dd><dt>" + (data.restoresOriginalName ? "Wartime name" : "Breakaway") + "</dt><dd>" + nameField
    + "</dd><dt>Government</dt><dd>" + b(data.government)
    + "</dd><dt>Starting region</dt><dd>" + b(region)
    + "</dd><dt>Current base national support</dt><dd>" + b(before) + "</dd></dl>"
    + "<p>Declaring transfers your control to the breakaway government in " + b(region)
    + " and starts a civil war with " + b(data.parentName) + ".</p>"
    + '<div class="gpm-uprising-outcomes">'
    + '<div class="sh-inset"><strong>Breakaway victory</strong><p>Your party takes executive control of the reunited country'
    + victorySeats + "</p><p>" + nameOutcome + " The founding charter takes effect nationwide.</p>"
    + charter + "<p>Base national support rises from " + b(before) + " to " + b(after) + " at reunification.</p></div>"
    + '<div class="sh-inset"><strong>Government victory</strong><p>The incumbent reunites the country and bans your party. '
    + "The campaign continues with the incumbent.</p></div></div>"
    + controls;
}

async function gpmSyncUprisingControl(session) {
  if (ze !== session || !session.playerKey) return;
  const key = session.playerKey;
  if (session._gpmUprisingPresentedKey === key) return;
  session._gpmUprisingPresentedKey = key;
  try {
    await KRt({ current: { countryKey: key } });
  } catch (error) {
    console.warn("[PPO] Uprising player control presentation failed", error);
  }
}

function gpmWatchUprisingControl(session) {
  const key = session?.playerKey;
  if (!key) return;
  const previous = session._gpmUprisingObservedKey;
  session._gpmUprisingObservedKey = key;
  if (previous && previous !== key && (previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-"))) {
    void gpmSyncUprisingControl(session);
  }
}

function gpmBindUprising(profile, view, ui) {
  const panel = profile.querySelector(".gpm-uprising");
  const session = ui._mpSession;
  if (!panel || !session) return;
  const countryKey = view.player?.key;
  const partyId = view.party?.dashboard?.partyId ?? view.party?.parliament?.partyId;
  let state = ui._gpmUprisingUi;
  if (!state || state.session !== session || state.countryKey !== countryKey || state.partyId !== partyId) {
    state = ui._gpmUprisingUi = { session, countryKey, partyId, loading: false, busy: false, confirm: false, status: "" };
  }

  const content = panel.querySelector("[data-gpm-uprising-content]");
  const status = panel.querySelector("[data-gpm-uprising-status]");
  const isCurrent = () => ui._mpSession === session && ui._gpmUprisingUi === state;
  const focus = action => content.querySelector('[data-gpm-uprising-action="' + action + '"]')?.focus({ preventScroll: true });

  const paint = () => {
    if (!panel.isConnected) return;
    const html = gpmUprisingPanel(state);
    if (content._gpmUprisingHtml !== html) {
      const active = content.contains(document.activeElement) && document.activeElement.dataset.gpmUprisingAction;
      const expanded = content.querySelector("[data-gpm-uprising-charter]")?.open;
      content.innerHTML = html;
      content._gpmUprisingHtml = html;
      const details = content.querySelector("[data-gpm-uprising-charter]");
      if (details && expanded) details.open = true;
      if (active) focus(active);
    }
    status.textContent = state.loading ? "Checking the current declaration terms…" : state.status;
  };
  const currentParty = view.player?.pol?.parties?.find(party => party.id === partyId);
  state.partyName = currentParty ? Sa(currentParty, countryKey) : null;
  state.paint = paint;

  const load = async () => {
    if (state.loading || state.busy || !isCurrent()) return;
    state.loading = true;
    state.requestDay = view.day;
    state.paint();
    try {
      const data = await et(session, "gpm.uprising", {});
      if (!isCurrent()) return;
      if (!data || data.countryKey !== countryKey || (partyId != null && data.partyId !== partyId)) {
        state.data = null;
        state.status = "The uprising details are unavailable for this party.";
        return;
      }
      if (state.data?.quoteId !== data.quoteId && state.confirm) {
        state.confirm = false;
        state.status = gpmUprisingReason("stale");
      }
      if (!data.names?.includes(state.selectedName)) state.selectedName = data.breakawayName;
      state.data = data;
    } catch (error) {
      console.warn("[PPO] Uprising details failed", error);
      if (isCurrent()) state.status = "Could not load the uprising details. Try refreshing.";
    } finally {
      state.loading = false;
      if (isCurrent()) state.paint();
    }
  };

  const declare = async () => {
    if (state.loading || state.busy || !state.confirm || !state.data?.available || !isCurrent()) return;
    state.busy = true;
    state.status = "Declaring the uprising…";
    const { quoteId, restoresOriginalName, breakawayName } = state.data;
    const name = restoresOriginalName ? breakawayName : state.selectedName;
    state.paint();
    let result;
    try {
      result = await Te(session, "applyPlayerAction", [{ verb: "gpm.party.uprising.declare", quoteId, name }]);
      if (result?.ok) {
        if (ze === session) {
          await gpmSyncUprisingControl(session);
          if (ze === session) await ui.openMilitaryMode?.();
        }
        return;
      }
      if (isCurrent()) {
        state.confirm = false;
        state.status = gpmUprisingReason(result?.reason);
      }
    } catch (error) {
      console.warn("[PPO] Uprising action or view refresh failed", error);
      if (isCurrent()) {
        state.confirm = false;
        state.status = result?.ok ? "The uprising began. Open the War Theatre to continue."
          : "Could not verify the declaration. Refresh to check the current status.";
      }
    } finally {
      state.busy = false;
      if (isCurrent() && !result?.ok) {
        state.paint();
        await load();
      }
    }
  };

  content.onchange = event => {
    if (event.target.matches("[data-gpm-uprising-name]")) state.selectedName = event.target.value;
  };
  content.onclick = event => {
    const button = event.target.closest("[data-gpm-uprising-action]");
    if (!button || button.disabled || state.busy || !isCurrent()) return;
    const action = button.dataset.gpmUprisingAction;
    if (action === "refresh") {
      state.status = "";
      void load();
    } else if (action === "review" || action === "cancel") {
      state.confirm = action === "review";
      state.status = "";
      state.paint();
      focus(state.confirm ? "cancel" : "review");
    } else if (action === "declare") {
      void declare();
    } else if (action === "war") {
      void ui.openMilitaryMode?.();
    }
  };
  state.paint();
  if (state.requestDay !== view.day) void load();
}

const rendererFunctions = [gpmRenderUprising, gpmUprisingReason, gpmUprisingPanel, gpmSyncUprisingControl,
  gpmWatchUprisingControl, gpmBindUprising];

function patchUprisingRenderer(source) {
  const asBuffer = Buffer.isBuffer(source);
  let js = asBuffer ? source.toString("utf8") : source;
  function replaceOnce(before, after) {
    const index = js.indexOf(before);
    if (index < 0 || js.indexOf(before, index + before.length) >= 0) {
      throw new Error("Unexpected renderer code near " + before);
    }
    js = js.slice(0, index) + after + js.slice(index + before.length);
  }

  const tab = 'tabs.push(["laws", "Law Shortlist", gpmRenderPartyLaws()]);';
  replaceOnce(tab, tab + '\n  tabs.push(["uprising", "Uprising", gpmRenderUprising()]);');
  const bind = 'if (tab.id === "gpm-tab-laws") gpmBindPartyLaws(profile, view, ui);';
  replaceOnce(bind, bind + '\n    if (tab.id === "gpm-tab-uprising") gpmBindUprising(profile, view, ui);');
  const styleMount = "style.textContent += gpmRegionalMapStyle + gpmForeignFundingStyle + gpmLawShortlistStyle;";
  replaceOnce(styleMount, styleMount.replace(";", " + gpmUprisingStyle;"));
  const initialize = "\nmountPartyButtons();\n";
  replaceOnce(initialize, "\nconst gpmUprisingStyle = " + JSON.stringify(style) + ";\n"
    + rendererFunctions.join("\n") + initialize);
  const frame = "function bFe(){let e=ze.consumeViewDelta";
  replaceOnce(frame, "function bFe(){gpmWatchUprisingControl(ze);let e=ze.consumeViewDelta");
  return asBuffer ? Buffer.from(js) : js;
}

module.exports = { patchUprisingRenderer };