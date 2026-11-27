"use strict";

const data = require("./opening-register-data.json");
const { openingIdeology } = require("./opening-register-ideology.cjs");

function gpmOpeningNonparty(party) {
  return ["aggregate", "unaffiliated", "affiliation-unverified"].includes(party?.kind ?? party?.nameDesc?.gpmOpeningKind);
}

function gpmOpeningBallotEligible(party) {
  const descriptor = party?.nameDesc;
  const kind = descriptor?.gpmOpeningKind;
  if (kind === "unaffiliated") {
    return gpmOpeningIndependentCandidates.has(JSON.stringify([party.id, descriptor.gpmOpeningName]));
  }
  return kind !== "aggregate" && kind !== "affiliation-unverified";
}

function gpmOpeningBallotShares(parties, shares) {
  let ballot = null;
  for (const party of parties || []) {
    if (gpmOpeningBallotEligible(party) || !Object.hasOwn(shares, party.id)) continue;
    ballot ??= { ...shares };
    delete ballot[party.id];
  }
  if (!ballot) return shares;
  const total = Object.values(ballot).reduce((sum, share) => sum + Math.max(0, share), 0);
  if (total > 0) for (const id of Object.keys(ballot)) ballot[id] /= total;
  return ballot;
}

function gpmOpeningGoverningParties(parties) {
  const eligible = parties.filter(party => !gpmOpeningNonparty(party));
  return eligible.length ? eligible : parties;
}

function gpmRegisteredOpeningParty(base, row) {
  const { id, name, tag, kind, ideologyMatch } = row;
  const party = {
    ...base,
    id,
    ideology: ideologyMatch?.scores || base.ideology || { econ: 0, social: 0, gov: 0, nat: 0 },
    nameDesc: {
      ...base.nameDesc,
      gpmOpeningName: name,
      gpmOpeningTag: tag || null,
      gpmOpeningKind: kind || null,
      gpmOpeningIdeology: ideologyMatch?.preset || null,
      gpmOpeningIdeologySource: ideologyMatch?.scope || (base.ideology ? "game-model" : null),
    },
  };
  if (ideologyMatch) delete party.family;
  return party;
}

function gpmOpeningRegisterPreset(countryKey, preset, createPolity, options) {
  const opening = gpmOpeningCountries[countryKey];
  if (!opening || !preset?.parties?.length) return preset;
  const hasRegisteredChamber = Object.keys(opening.chambers).length > 0;
  const needsStockAllocation = hasRegisteredChamber && preset.chambers?.some(chamber =>
    !opening.chambers[chamber.id] && !Object.keys(chamber.composition || {}).length);
  const stockChambers = needsStockAllocation ? createPolity(preset, options).chambers : [];
  if (opening.stockParties) {
    preset.parties = preset.parties.map(party => {
      const row = opening.stockParties[party.id];
      return row ? gpmRegisteredOpeningParty(party, row) : party;
    });
  }
  if (!preset.chambers?.length || !hasRegisteredChamber) return preset;

  const registeredParties = new Map();
  const unchangedPartyIds = new Set();
  const firstChamber = preset.chambers[0];
  const governingSeats = new Map(opening.chambers[firstChamber.id]?.rows
    .map(row => [row.id, row.seats]) || Object.entries(firstChamber.composition || {}));
  let registeredSeats = 0;
  const chambers = [];
  for (const chamber of preset.chambers) {
    const source = opening.chambers[chamber.id];
    if (!source) {
      const composition = stockChambers.find(stock => stock.id === chamber.id)?.composition || chamber.composition;
      for (const id of Object.keys(composition || {})) unchangedPartyIds.add(id);
      chambers.push(composition === chamber.composition ? chamber : { ...chamber, composition });
      continue;
    }

    chambers.push({
      ...chamber,
      customName: source.name,
      seats: source.statutorySeats,
      seatsBasis: source.openingStatus === "dissolved" ? "opening-register-dissolved" :
        source.openingStatus === "inactive" ? "opening-register-inactive" : "opening-register",
      composition: Object.fromEntries(source.rows.filter(row => row.seats > 0).map(row => [row.id, row.seats])),
    });
    for (const row of source.rows) {
      if (row.kind === "vacancy") continue;
      if (!registeredParties.has(row.id)) registeredParties.set(row.id, { ...row, seats: 0 });
      registeredParties.get(row.id).seats += row.seats;
      registeredSeats += row.seats;
    }
  }

  if (![...registeredParties.values()].some(row => row.seats > 0 && !gpmOpeningNonparty(row))) {
    const existingParties = new Set(preset.parties.map(party => party.id));
    for (const row of registeredParties.values()) {
      if (!existingParties.has(row.id)) preset.parties.push({ ...gpmRegisteredOpeningParty({}, row), support: 0 });
    }
    preset.chambers = chambers;
    return preset;
  }
  const previous = new Map(preset.parties.map(party => [party.id, party]));
  const parties = [];
  for (const row of registeredParties.values()) {
    const base = previous.get(row.id) || previous.get(row.stockBasis) || {};
    parties.push({
      ...gpmRegisteredOpeningParty(base, row),
      support: row.seats / registeredSeats,
    });
  }
  for (const party of previous.values()) {
    if (unchangedPartyIds.has(party.id) && !registeredParties.has(party.id)) parties.push(party);
  }

  const eligible = gpmOpeningGoverningParties(parties);
  const valid = new Set(eligible.map(party => party.id));
  const largest = eligible.reduce((best, party) => {
    const seats = governingSeats.get(party.id) || 0;
    const bestSeats = governingSeats.get(best?.id) || 0;
    return !best || seats > bestSeats || (seats === bestSeats && party.support > best.support) ? party : best;
  }, null);
  const lead = valid.has(opening.governmentPartyId) ? opening.governmentPartyId :
    valid.has(preset.rulingPartyId) ? preset.rulingPartyId : (largest || parties[0]).id;
  preset.chambers = chambers;
  preset.parties = parties;
  preset.rulingPartyId = lead;
  preset.coalition = [...new Set([lead, ...(preset.coalition || []).filter(id => valid.has(id))])];
  return preset;
}

function gpmOpeningVacancyHtml(chamber) {
  const vacancies = chamber?.composition?.["gpm-vacant"] || 0;
  if (!vacancies) return "";
  if (vacancies === chamber.seats && chamber.seatsBasis === "opening-register-dissolved") {
    return '<p class="empty-note">Chamber dissolved at the January 1 opening</p>';
  }
  if (vacancies === chamber.seats && chamber.seatsBasis === "opening-register-inactive") {
    return '<p class="empty-note">No sitting lawmakers at the January 1 opening</p>';
  }
  return '<p class="empty-note">' + vacancies + " vacant " + (vacancies === 1 ? "seat" : "seats") + "</p>";
}

function gpmAssemblyPartyName(party) {
  if (!party || gpmOpeningNonparty(party)) return "";
  const name = Sa(party);
  return /^(?:other(?: parties)?|others|miscellaneous|independents?|non[- ]affiliated)$/i.test(name.trim()) ? "" : name;
}

function gpmOpenAssemblyParty(event, assembly) {
  const partyId = event.target.closest?.("[data-gpm-assembly-party]")?.dataset.gpmAssemblyParty;
  if (!partyId) return;
  const details = [...assembly.querySelectorAll("details[data-pa-party]")].find(row => row.dataset.paParty === partyId);
  if (!details) return;
  details.open = true;
  details.querySelector("summary")?.focus({ preventScroll: true });
  details.scrollIntoView({ block: "nearest" });
}

function seedDeclaration() {
  const countries = Object.fromEntries(Object.entries(data.countries).map(([key, entry]) => [
    key, {
      governmentPartyId: entry.governmentPartyId,
      chambers: Object.fromEntries(Object.entries(entry.chambers || {}).map(([id, chamber]) => [id, {
        ...chamber, rows: chamber.rows.map(row => ({ ...row, ideologyMatch: openingIdeology(key, row) })),
      }])),
      stockParties: entry.stockParties ? Object.fromEntries(Object.entries(entry.stockParties).map(([id, row]) => [
        id, { id, kind: "party", ...row, ideologyMatch: openingIdeology(key, { id }) },
      ])) : undefined,
    },
  ]));
  return "const gpmOpeningCountries=" + JSON.stringify(countries) + ";\n" + gpmOpeningNonparty + "\n" +
    gpmOpeningGoverningParties + "\n" + gpmRegisteredOpeningParty + "\n" + gpmOpeningRegisterPreset + "\n";
}

function patchOpeningRegisterRenderer(source, replaceOnce) {
  const setup = "function Cpe(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "T$t(a,i),CFe(i,NFe(a))",
    "T$t(a,i),CFe(i,NFe(a)),gpmOpeningRegisterPreset(a,i,EFe,{culture:t0(a),baseSeed:Bf(a)})");
  js = replaceOnce(js, "if(e?.nameDesc?.customName)return e.nameDesc.customName;let a=t&&e?.id?XS(",
    "if(e?.nameDesc?.customName)return e.nameDesc.customName;if(e?.nameDesc?.gpmOpeningName)return e.nameDesc.gpmOpeningName;let a=t&&e?.id?XS(");
  js = replaceOnce(js, "gpmTag:i?XS(", "gpmTag:r.nameDesc?.gpmOpeningTag||(i?XS(");
  js = replaceOnce(js, "?.tag:null);s&&n.add(s)", "?.tag:null));s&&n.add(s)");
  js = replaceOnce(js, "gpmTag:s?.tag)||pNt(l,n)", "gpmTag:r.nameDesc?.gpmOpeningTag||s?.tag)||pNt(l,n)");
  const chooseParty = "u=c.filter(d=>!d.isGovernmentLead).sort(";
  js = replaceOnce(js, chooseParty, "u=c.filter(d=>!d.isGovernmentLead&&!gpmOpeningNonparty(d)).sort(");
  const coalition = "i=Object.entries(n).sort((h,f)=>f[1]-h[1]),s=a&&n[a]?a:i.length?i[0][0]:mV(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "i=Object.entries(n).filter(([id])=>gpmIds.has(id)).sort((h,f)=>f[1]-h[1]),s=a&&n[a]&&gpmIds.has(a)?a:i.length?i[0][0]:mV(e)");
  js = replaceOnce(js, "p=e.parties.filter(h=>h.id!==s&&(n[h.id]||0)>0)", "p=gpmEligible.filter(h=>h.id!==s&&(n[h.id]||0)>0)");
  const partyGrid = "function WQe(e,t){";
  js = replaceOnce(js, partyGrid, gpmOpeningVacancyHtml + "\n" + gpmAssemblyPartyName + "\n" + gpmOpenAssemblyParty + "\n" + partyGrid);
  js = replaceOnce(js, "coalition:c||[],held:u",
    "coalition:c||[],held:u,assemblyNamesOnly:true,showCoalition:!!c||u!=null");
  js = replaceOnce(js,
    '${o("pol.absoluteMajority")} : <b>${d}</b> \\xB7 ${o("pol.coalition")} : <b>${p}</b>',
    '${o("pol.absoluteMajority")} : <b>${d}</b>${a.showCoalition===false?"":` · ${o("pol.coalition")} : <b>${p}</b>`}');
  // The new chart draws a single native SVG path per party, including at large seat counts.
  js = replaceOnce(js, 'let u=iN(c.map(f=>({id:f,seats:e[f],color:ol(i(f)),label:`${s(f)} \\xB7 ${o("pol.seats.n",{n:e[f]})}`})))',
    'let u=iN(c.map(f=>{const name=a.assemblyNamesOnly?gpmAssemblyPartyName(i(f)):"";return{id:f,seats:e[f],color:a.assemblyNamesOnly&&!name?"#657383":ol(i(f)),assemblyParty:!!name,label:a.assemblyNamesOnly?name:`${s(f)} \\xB7 ${o("pol.seats.n",{n:e[f]})}`}}))');
  js = replaceOnce(js, 'data-pty="${b(h.id)}" stroke-width=',
    'data-pty="${b(h.id)}"${h.assemblyParty?` data-gpm-assembly-party="${b(h.id)}"`:""} stroke-width=');
  js = replaceOnce(js, "let m=c.slice().sort((f,g)=>e[g]-e[f]).map(", 'let m=a.assemblyNamesOnly?"":c.slice().sort((f,g)=>e[g]-e[f]).map(');
  js = replaceOnce(js, '<div class="hc-legend">${m}</div></div>', '${a.assemblyNamesOnly?"":`<div class="hc-legend">${m}</div>`}</div>');
  js = replaceOnce(js, 'this._wireHemicycle(e),e.querySelector("[data-snap-seats]").addEventListener',
    'this._wireHemicycle(e),e.querySelector(".pa-panel")?.addEventListener("click",event=>gpmOpenAssemblyParty(event,e)),e.querySelector("[data-snap-seats]").addEventListener');
  js = replaceOnce(js, "n=a.parties.filter(i=>i.legal!==!1).sort(", "n=a.parties.filter(i=>i.legal!==!1&&gpmAssemblyPartyName(i)).sort(");
  js = replaceOnce(js, "u=t[i.id]||0,d=Number.isFinite(i.support)?",
    "gpmChambers=a.chambers.filter(chamber=>chamber.composition?.[i.id]>0)," +
    "u=t[i.id]||gpmChambers.reduce((sum,chamber)=>sum+chamber.composition[i.id],0),d=Number.isFinite(i.support)?");
  js = replaceOnce(js, '<span class="pa-number"><b>${u}</b><small>${o("pol.seats")}</small></span>',
    '<span class="pa-number"${gpmChambers.length?` data-tip="${b(gpmChambers.map(chamber=>so(chamber)+" "+chamber.composition[i.id]).join(" · "))}"`:""}><b>${u}</b><small>${o("pol.seats")}</small></span>');
  js = replaceOnce(js, '<summary><span class="sh-idline pa-identity"><span class="pa-party-tag"',
    '<summary style="grid-template-columns:minmax(0,1fr) 54px auto"><span class="sh-idline pa-identity"><span class="pa-party-tag"');
  js = replaceOnce(js, '<span class="pa-party-tag" style="--pa-color:${s}">${b(y||"")}</span>',
    '<span aria-hidden="true" style="width:.65em;height:.65em;flex:0 0 .65em;border-radius:50%;background:${s}"></span>');
  js = replaceOnce(js, '<span><b>${b(Sa(i))}</b><small data-tip="${b(o("pol.party.roleTip."+l))}">${o("pol.role."+l)}</small></span>',
    '<span><b>${b(gpmAssemblyPartyName(i))}</b></span>');
  js = replaceOnce(js, '<span class="pa-number"><b>${d}</b><small>${o("pol.party.support")}</small></span>',
    "");
  js = replaceOnce(js, '${h}</summary>\n      <div class="pa-party-body">', '</summary>\n      <div class="pa-party-body">${h}');
  return replaceOnce(js, '>${s.seats} ${IE(s)}</span></h3>${d}</section>',
    '>${s.seats} ${IE(s)}</span></h3>${d}${gpmOpeningVacancyHtml(s)}</section>');
}

function patchOpeningRegisterWorker(source, replaceOnce) {
  const setup = "function lEa(e,t=2026){";
  const independents = Object.values(data.countries).flatMap(country =>
    Object.values(country.chambers || {}).flatMap(chamber =>
      chamber.rows.filter(row => row.kind === "unaffiliated" && row.independentCandidate)
        .map(row => JSON.stringify([row.id, row.name]))));
  let js = replaceOnce(source, setup,
    seedDeclaration() + "const gpmOpeningIndependentCandidates=new Set(" + JSON.stringify(independents) + ");\n" +
      gpmOpeningBallotEligible + "\n" + gpmOpeningBallotShares + "\n" + setup);
  js = replaceOnce(js, "p$r(A,o),zFA(o,Lse(A))",
    "p$r(A,o),zFA(o,Lse(A)),gpmOpeningRegisterPreset(A,o,VFA,{culture:bs(A),baseSeed:qA(A)})");
  js = replaceOnce(js, 'n.seatsBasis==="reform"||oc(n)?.seats!=null',
    '(n.seatsBasis==="reform"||n.seatsBasis==="opening-register")||oc(n)?.seats!=null');
  js = replaceOnce(js, "parties:Object.freeze((A.pol?.parties||[]).map(n=>{let i=A.key===a.countryKey",
    "parties:Object.freeze((A.pol?.parties||[]).filter(n=>gpmOpeningBallotEligible(n)||(A.key===a.countryKey&&n.id===a.partyId)).map(n=>{let i=A.key===a.countryKey");
  js = replaceOnce(js, 'if(!r||r.gpmUprisingShell||r.gpmUprisingExcluded)return{ok:!1,reason:"party"};let o=Qo(e)',
    'if(!r||r.gpmUprisingShell||r.gpmUprisingExcluded||!gpmOpeningBallotEligible(r))return{ok:!1,reason:"party"};let o=Qo(e)');
  // Seat-ledger buckets can finish their current terms without entering a later ballot.
  js = replaceOnce(js, "for(let o of t.pol.parties){let n=o.campaigns[r];",
    "for(let o of t.pol.parties){if(!gpmOpeningBallotEligible(o))continue;let n=o.campaigns[r];");
  js = replaceOnce(js, "for(let a of t.pol.parties){if(a.campaigns[A.id]?.electionDay===A.nextDay)",
    "for(let a of t.pol.parties){if(!gpmOpeningBallotEligible(a)||a.campaigns[A.id]?.electionDay===A.nextDay)");
  js = replaceOnce(js, "function OI(e,t,A,a=null){return Object.values(t?.campaigns||{})",
    "function OI(e,t,A,a=null){if(!gpmOpeningBallotEligible(t))return null;return Object.values(t?.campaigns||{})");
  js = replaceOnce(js, "for(let s of t.pol.parties){let l=r?s.campaigns?.[r]||null:OI(t,s,0)",
    "for(let s of t.pol.parties){if(!gpmOpeningBallotEligible(s))continue;let l=r?s.campaigns?.[r]||null:OI(t,s,0)");
  js = replaceOnce(js, "for(let n of t.pol?.parties||[]){let i=Math.max(0,A?.[n.id]||0)",
    "for(let n of t.pol?.parties||[]){if(!gpmOpeningBallotEligible(n))continue;let i=Math.max(0,A?.[n.id]||0)");
  js = replaceOnce(js, "n-i.day<ZYr)return i;let l=up(",
    "n-i.day<ZYr&&!t.pol.parties.some(p=>!gpmOpeningBallotEligible(p)&&Object.hasOwn(i.values||{},p.id)))return i;let l=up(");
  js = replaceOnce(js, "c=t.pol.parties.map(E=>{let B=OI(",
    "c=t.pol.parties.filter(gpmOpeningBallotEligible).map(E=>{let B=OI(");
  // Regional allocation falls back to current support for omitted IDs. Restrict that electorate too.
  js = replaceOnce(js, "shares:PFA(e.parties,E,{rulingIds:r,perf:o,sigma:n,partyPerf:i})",
    "shares:PFA(a?e.parties.filter(gpmOpeningBallotEligible):e.parties,E,{rulingIds:r,perf:o,sigma:n,partyPerf:i})");
  js = replaceOnce(js, "{rulingId:a,integrity:r=1,polity:o=null,electoralMap:n=null}={}){let i=SFA(e);",
    "{rulingId:a,integrity:r=1,polity:o=null,electoralMap:n=null}={}){" +
      'if(o&&e.selectMode!=="appointed"&&e.selectMode!=="hereditary"){' +
        "t=gpmOpeningBallotShares(o.parties,t);if(a&&o.parties.some(p=>p.id===a&&!gpmOpeningBallotEligible(p)))a=null;" +
      "}let i=SFA(e);");
  // An election with no eligible party candidate must leave the existing officeholder in place.
  js = replaceOnce(js, 'R,P;if(u==="electoral-college"){let te=PXr(e,t,w);',
    'R,P;if(!M.length)return{ok:!1,reason:"winner_party_required"};' +
    'if(u==="electoral-college"){let te=PXr(e,t,w,M.some(te=>te.id===s)?s:M[0].id);');
  js = replaceOnce(js, "function PXr(e,t,A){", "function PXr(e,t,A,gpmFallback=Ut(t)){");
  js = replaceOnce(js, "f=m?m.lead:Ut(t);l[Q.__provId]", "f=m?.lead??gpmFallback;l[Q.__provId]");
  js = replaceOnce(js, "u[0].id:B.id:Ut(t),evByParty:c", "u[0].id:B.id:gpmFallback,evByParty:c");
  js = replaceOnce(js, "L={};for(let te of a.parties){let G=O(te.id);",
    "L={};for(let te of a.parties){if(!gpmOpeningBallotEligible(te))continue;let G=O(te.id);");
  const coalition = "o=Object.entries(a).sort((E,B)=>B[1]-E[1]),n=A&&a[A]?A:o.length?o[0][0]:hk(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "o=Object.entries(a).filter(([id])=>gpmIds.has(id)).sort((E,B)=>B[1]-E[1]),n=A&&a[A]&&gpmIds.has(A)?A:o.length?o[0][0]:hk(e)");
  js = replaceOnce(js, "u=e.parties.filter(E=>E.id!==n&&(a[E.id]||0)>0)", "u=gpmEligible.filter(E=>E.id!==n&&(a[E.id]||0)>0)");
  return replaceOnce(js, "gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:",
    "gpmTag:e.nameDesc.gpmTag||null,gpmOpeningName:e.nameDesc.gpmOpeningName||null,gpmOpeningTag:e.nameDesc.gpmOpeningTag||null,gpmOpeningKind:e.nameDesc.gpmOpeningKind||null,gpmOpeningIdeology:e.nameDesc.gpmOpeningIdeology||null,gpmOpeningIdeologySource:e.nameDesc.gpmOpeningIdeologySource||null,gpmIdeologyPreset:");
}

module.exports = { data, patchOpeningRegisterRenderer, patchOpeningRegisterWorker };

