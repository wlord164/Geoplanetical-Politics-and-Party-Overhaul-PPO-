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
  const name = ba(party);
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
  const setup = "function Sse(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "t_t(a,i),xIe(i,CIe(a))",
    "t_t(a,i),xIe(i,CIe(a)),gpmOpeningRegisterPreset(a,i,RIe,{culture:ld(a),baseSeed:_h(a)})");
  js = replaceOnce(js, "if(e?.nameDesc?.customName)return e.nameDesc.customName;let a=t&&e?.id?N9(",
    "if(e?.nameDesc?.customName)return e.nameDesc.customName;if(e?.nameDesc?.gpmOpeningName)return e.nameDesc.gpmOpeningName;let a=t&&e?.id?N9(");
  js = replaceOnce(js, "gpmTag:i?N9(", "gpmTag:r.nameDesc?.gpmOpeningTag||(i?N9(");
  js = replaceOnce(js, "?.tag:null);s&&n.add(s)", "?.tag:null));s&&n.add(s)");
  js = replaceOnce(js, "gpmTag:s?.tag)||Obt(l,n)", "gpmTag:r.nameDesc?.gpmOpeningTag||s?.tag)||Obt(l,n)");
  const chooseParty = "u=c.filter(d=>!d.isGovernmentLead).sort(";
  js = replaceOnce(js, chooseParty, "u=c.filter(d=>!d.isGovernmentLead&&!gpmOpeningNonparty(d)).sort(");
  const coalition = "i=Object.entries(n).sort((h,f)=>f[1]-h[1]),s=a&&n[a]?a:i.length?i[0][0]:Wj(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "i=Object.entries(n).filter(([id])=>gpmIds.has(id)).sort((h,f)=>f[1]-h[1]),s=a&&n[a]&&gpmIds.has(a)?a:i.length?i[0][0]:Wj(e)");
  js = replaceOnce(js, "p=e.parties.filter(h=>h.id!==s&&(n[h.id]||0)>0)", "p=gpmEligible.filter(h=>h.id!==s&&(n[h.id]||0)>0)");
  const partyGrid = "function fFe(e,t){";
  js = replaceOnce(js, partyGrid, gpmOpeningVacancyHtml + "\n" + gpmAssemblyPartyName + "\n" + gpmOpenAssemblyParty + "\n" + partyGrid);
  js = replaceOnce(js, "coalition:c||[],held:u",
    "coalition:c||[],held:u,assemblyNamesOnly:true,showCoalition:!!c||u!=null");
  js = replaceOnce(js,
    '${o("pol.absoluteMajority")} : <b>${R}</b> \\xB7 ${o("pol.coalition")} : <b>${M}</b>',
    '${o("pol.absoluteMajority")} : <b>${R}</b>${a.showCoalition===false?"":` · ${o("pol.coalition")} : <b>${M}</b>`}');
  js = replaceOnce(js, 'for(let L of c){let I=Pl(i(L)),A=r.has(L)?" gov":"";',
    'for(let L of c){let gpmName=a.assemblyNamesOnly?gpmAssemblyPartyName(i(L)):"",I=a.assemblyNamesOnly&&!gpmName?"#657383":Pl(i(L)),A=r.has(L)?" gov":"";');
  js = replaceOnce(js, 'r="${k.toFixed(1)}" fill="${I}"/>',
    'r="${k.toFixed(1)}" fill="${I}"${gpmName?` data-gpm-assembly-party="${b(L)}" style="cursor:pointer"`:""}>${gpmName?`<title>${b(gpmName)}</title>`:""}</circle>');
  js = replaceOnce(js, "let C=c.slice().sort((L,I)=>e[I]-e[L]).map(", 'let C=a.assemblyNamesOnly?"":c.slice().sort((L,I)=>e[I]-e[L]).map(');
  js = replaceOnce(js, '<div class="hc-legend">${C}</div>${E}</div>', '${a.assemblyNamesOnly?"":`<div class="hc-legend">${C}</div>`}${E}</div>');
  js = replaceOnce(js, 'this._wireHemicycle(e),this._wireParl(e),',
    'this._wireHemicycle(e),e.querySelector(".pa-panel")?.addEventListener("click",event=>gpmOpenAssemblyParty(event,e)),this._wireParl(e),');
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
  js = replaceOnce(js, '<span><b>${b(ba(i))}</b><small data-tip="${b(o("pol.party.roleTip."+l))}">${o("pol.role."+l)}</small></span>',
    '<span><b>${b(gpmAssemblyPartyName(i))}</b></span>');
  js = replaceOnce(js, '<span class="pa-number"><b>${d}</b><small>${o("pol.party.support")}</small></span>',
    "");
  js = replaceOnce(js, '${h}</summary>\n      <div class="pa-party-body">', '</summary>\n      <div class="pa-party-body">${h}');
  return replaceOnce(js, '>${s.seats} ${$C(s)}</span></h3>${d}</section>',
    '>${s.seats} ${$C(s)}</span></h3>${d}${gpmOpeningVacancyHtml(s)}</section>');
}

function patchOpeningRegisterWorker(source, replaceOnce) {
  const setup = "function gFa(e,t=2026){";
  const independents = Object.values(data.countries).flatMap(country =>
    Object.values(country.chambers || {}).flatMap(chamber =>
      chamber.rows.filter(row => row.kind === "unaffiliated" && row.independentCandidate)
        .map(row => JSON.stringify([row.id, row.name]))));
  let js = replaceOnce(source, setup,
    seedDeclaration() + "const gpmOpeningIndependentCandidates=new Set(" + JSON.stringify(independents) + ");\n" +
      gpmOpeningBallotEligible + "\n" + gpmOpeningBallotShares + "\n" + setup);
  js = replaceOnce(js, "Xho(a,n),lga(n,yte(a))",
    "Xho(a,n),lga(n,yte(a)),gpmOpeningRegisterPreset(a,n,cga,{culture:Js(a),baseSeed:Ma(a)})");
  js = replaceOnce(js, 'i.seatsBasis==="reform"||K0(i)?.seats!=null',
    '(i.seatsBasis==="reform"||i.seatsBasis==="opening-register")||K0(i)?.seats!=null');
  js = replaceOnce(js, "parties:Object.freeze((a.pol?.parties||[]).map(i=>{let s=a.key===r.countryKey",
    "parties:Object.freeze((a.pol?.parties||[]).filter(i=>gpmOpeningBallotEligible(i)||(a.key===r.countryKey&&i.id===r.partyId)).map(i=>{let s=a.key===r.countryKey");
  js = replaceOnce(js, 'if(!o||o.gpmUprisingShell||o.gpmUprisingExcluded)return{ok:!1,reason:"party"};let n=Ho(e)',
    'if(!o||o.gpmUprisingShell||o.gpmUprisingExcluded||!gpmOpeningBallotEligible(o))return{ok:!1,reason:"party"};let n=Ho(e)');
  // Seat-ledger buckets can finish their current terms without entering a later ballot.
  js = replaceOnce(js, "for(let n of t.pol.parties){let i=n.campaigns[o];",
    "for(let n of t.pol.parties){if(!gpmOpeningBallotEligible(n))continue;let i=n.campaigns[o];");
  js = replaceOnce(js, "for(let r of t.pol.parties){if(r.campaigns[a.id]?.electionDay===a.nextDay)",
    "for(let r of t.pol.parties){if(!gpmOpeningBallotEligible(r)||r.campaigns[a.id]?.electionDay===a.nextDay)");
  js = replaceOnce(js, "function WO(e,t,a,r=null){return Object.values(t?.campaigns||{})",
    "function WO(e,t,a,r=null){if(!gpmOpeningBallotEligible(t))return null;return Object.values(t?.campaigns||{})");
  js = replaceOnce(js, "for(let l of t.pol.parties){let c=o?l.campaigns?.[o]||null:WO(t,l,0)",
    "for(let l of t.pol.parties){if(!gpmOpeningBallotEligible(l))continue;let c=o?l.campaigns?.[o]||null:WO(t,l,0)");
  js = replaceOnce(js, "for(let i of t.pol?.parties||[]){let s=Math.max(0,a?.[i.id]||0)",
    "for(let i of t.pol?.parties||[]){if(!gpmOpeningBallotEligible(i))continue;let s=Math.max(0,a?.[i.id]||0)");
  js = replaceOnce(js, "i-s.day<Y4o)return s;let c=g5(",
    "i-s.day<Y4o&&!t.pol.parties.some(p=>!gpmOpeningBallotEligible(p)&&Object.hasOwn(s.values||{},p.id)))return s;let c=g5(");
  js = replaceOnce(js, "u=t.pol.parties.map(m=>{let f=WO(",
    "u=t.pol.parties.filter(gpmOpeningBallotEligible).map(m=>{let f=WO(");
  // Regional allocation falls back to current support for omitted IDs. Restrict that electorate too.
  js = replaceOnce(js, "shares:U6a(e.parties,m,{rulingIds:o,perf:n,sigma:i,partyPerf:s})",
    "shares:U6a(a?e.parties.filter(gpmOpeningBallotEligible):e.parties,m,{rulingIds:o,perf:n,sigma:i,partyPerf:s})");
  js = replaceOnce(js, "{rulingId:r,integrity:o=1,polity:n=null,electoralMap:i=null}={}){let s=G6a(e);",
    "{rulingId:r,integrity:o=1,polity:n=null,electoralMap:i=null}={}){" +
      'if(n&&e.selectMode!=="appointed"&&e.selectMode!=="hereditary"){' +
        "t=gpmOpeningBallotShares(n.parties,t);if(r&&n.parties.some(p=>p.id===r&&!gpmOpeningBallotEligible(p)))r=null;" +
      "}let s=G6a(e);");
  // An election with no eligible party candidate must leave the existing officeholder in place.
  js = replaceOnce(js, 'x,R;if(d==="electoral-college"){let ee=mho(e,t,C);',
    'x,R;if(!M.length)return{ok:!1,reason:"winner_party_required"};' +
    'if(d==="electoral-college"){let ee=mho(e,t,C,M.some(ee=>ee.id===s)?s:M[0].id);');
  js = replaceOnce(js, "function mho(e,t,a){", "function mho(e,t,a,gpmFallback=Kt(t)){");
  js = replaceOnce(js, "v=g?g.lead:Kt(t);c[h.__provId]", "v=g?.lead??gpmFallback;c[h.__provId]");
  js = replaceOnce(js, "d[0].id:f.id:Kt(t),evByParty:u", "d[0].id:f.id:gpmFallback,evByParty:u");
  js = replaceOnce(js, "F={};for(let ee of r.parties){let J=U(ee.id);",
    "F={};for(let ee of r.parties){if(!gpmOpeningBallotEligible(ee))continue;let J=U(ee.id);");
  const coalition = "n=Object.entries(r).sort((m,f)=>f[1]-m[1]),i=a&&r[a]?a:n.length?n[0][0]:SC(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "n=Object.entries(r).filter(([id])=>gpmIds.has(id)).sort((m,f)=>f[1]-m[1]),i=a&&r[a]&&gpmIds.has(a)?a:n.length?n[0][0]:SC(e)");
  js = replaceOnce(js, "d=e.parties.filter(m=>m.id!==i&&(r[m.id]||0)>0)", "d=gpmEligible.filter(m=>m.id!==i&&(r[m.id]||0)>0)");
  return replaceOnce(js, "gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:",
    "gpmTag:e.nameDesc.gpmTag||null,gpmOpeningName:e.nameDesc.gpmOpeningName||null,gpmOpeningTag:e.nameDesc.gpmOpeningTag||null,gpmOpeningKind:e.nameDesc.gpmOpeningKind||null,gpmOpeningIdeology:e.nameDesc.gpmOpeningIdeology||null,gpmOpeningIdeologySource:e.nameDesc.gpmOpeningIdeologySource||null,gpmIdeologyPreset:");
}

module.exports = { data, patchOpeningRegisterRenderer, patchOpeningRegisterWorker };

