const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function patchFrontlineWorker(source, replaceOnce) {
  const worker = ["frontline-contact.js", "frontline-terrain.js", "frontline-telemetry.js", "frontline-simulation.js"].map(file => readFileSync(join(__dirname, file), "utf8")).join("\n");
  const anchors = [
    ["registerPartyOrganizing();\nregisterPartyCongressSize();",
      worker + "\nregisterFrontlinePlans();\nregisterPartyOrganizing();\nregisterPartyCongressSize();"],
    ['(a==="gpm.partyFactionQuote"?', '(a==="gpm.frontline"?gpmFrontlineView(r,t.params||{}):a==="gpm.frontline.line"?gpmFrontlineLinePreview(r,t.params||{}):a==="gpm.frontline.route"?gpmFrontlineRoutePreview(r,t.params||{}):a==="gpm.partyFactionQuote"?'],
    ["campaign:o.campaign,frontSlots:o.frontSlots||{}", "campaign:o.campaign,gpmFrontline:o.gpmFrontline,frontSlots:o.frontSlots||{}"],
    ["commandSummary:r.commandSummary||null,frontSlots:r.frontSlots||{}", "commandSummary:r.commandSummary||null,gpmFrontline:gpmFrontlineRestore(r.gpmFrontline,e),frontSlots:r.frontSlots||{}"],
    ["function Av(e,t){let a=t?.id;if(!a)return!1;", "function Av(e,t){let a=t?.id;if(!a)return!1;gpmFrontlineClose(e,t);"],
    ['r.agreements.push(l),t.status="suspended",Upt(e,t)', 'r.agreements.push(l),t.status="suspended",gpmFrontlineSuspend(e,t),Upt(e,t)'],
    ["function G4a(e,t,a,r,o){let n=A4a(e,o)", "function G4a(e,t,a,r,o){let gpmDestination=gpmFrontlineDestination(e,o,a);if(gpmDestination)return gpmDestination;let n=A4a(e,o)"],
    ["let p=T5o(s.length,d.length),m=Math.max(0,s.length-p),f=new Set;for(let g of d){for(let v of s)v.assignment?.conflictId===g.war.id&&!gP(v)&&(g.ids.push(v.id),f.add(v.id));",
      "let p=T5o(s.length,d.length),m=Math.max(0,s.length-p),f=gpmFrontlineReserveForces(e,d,s);for(let g of d){for(let v of s)v.assignment?.conflictId===g.war.id&&!gP(v)&&!g.ids.includes(v.id)&&(g.ids.push(v.id),f.add(v.id));"],
    ["for(let E of s)if(!u?.[E.id]){if(!MK(e,{issuer:E.owner===e.playerKey?", "u=gpmFrontlineSlots(e,t,a,s,n,u,r);for(let E of s)if(!u?.[E.id]){if(!MK(e,{issuer:E.owner===e.playerKey?"],
    ['N=sk(E)>.3&&(B||x.has(E.id)||T)?"attack":"hold",q=e.countries.get(E.owner)',
      'N=gpmFrontlineOrderKind(e,t,E,sk(E)>.3&&(B||x.has(E.id)||T)?"attack":"hold"),q=e.countries.get(E.owner)'],
    ['reason:B?"expand_beachhead":N==="attack"?"local_opportunity":"sector_hold"',
      'reason:gpmFrontlineOrders(e,t,E)?"gpm_frontline":B?"expand_beachhead":N==="attack"?"local_opportunity":"sector_hold"'],
    ['if(U<0){E._frontAtSlot=!1;continue}let F=E._sectorIntent',
      'if(U<0){E._frontAtSlot=!1;gpmFrontlineRecordRoute(e,t,E,true);continue}let F=E._sectorIntent'],
    ['r._frontAtSlot=!r._frontMoving):(r._frontMoving=!1,r._frontAtSlot=!1)}var r6o=120',
      'r._frontAtSlot=!r._frontMoving):(r._frontMoving=!1,r._frontAtSlot=!1),gpmFrontlineRecordRoute(e,t,r,!u)}var r6o=120'],
    ['d._deployRouteFailure={conflictId:d.assignment.conflictId}',
      'd._deployRouteFailure={conflictId:d.assignment.conflictId,reason:p.reason||p.status||"no_route",day:e.day||0}'],
    ["for(let E of n)E._stance=cUa(E,g,e.day||0,b(E));for(let E of i)E._stance=cUa(E,v,e.day||0,b(E));",
      "for(let E of n)E._stance=gpmFrontlineCombatStance(e,t,E,g,b(E));for(let E of i)E._stance=gpmFrontlineCombatStance(e,t,E,v,b(E));"],
    ['d.set(E.id,(d.get(E.id)||0)+G),u.add(E.id),E._stance',
      'd.set(E.id,(d.get(E.id)||0)+G),u.add(E.id),gpmFrontlineRecordCombat(e,t,E,O),E._stance'],
    ['p.set(E.id,(p.get(E.id)||0)+G),u.add(E.id),E._stance',
      'p.set(E.id,(p.get(E.id)||0)+G),u.add(E.id),gpmFrontlineRecordCombat(e,t,E,O),E._stance'],
    ['_=E=>E._stance==="attack"||E._stance==="encircled",k=(E,O,G,D)',
      '_=E=>gpmFrontlineProjectsPressure(e,t,E),k=(E,O,G,D)'],
    ["wt=wFa(t.field,nt.pAttack,nt.eHold,nt.eAttack,nt.pHold)", "wt=wFa(t.field,nt.pAttack,nt.eHold,nt.eAttack,nt.pHold,gpmFrontlinePressureFilter(e,t))"],
    ['V3e(e,t))}yield"field",f&&y&&n8o(e,t,X,M)', 'V3e(e,t))}if(gpmFrontlineCompleted(e,t).length){yield*Egt(t.field);gpmFrontlineComplete(e,t);t._commandGeometryDay=0}yield"field",f&&y&&n8o(e,t,X,M)'],
    ["function wFa(e,t,a,r=[],o=[]){", "function wFa(e,t,a,r=[],o=[],gpmPressureFilter=null){"],
    ["d=s(o),p=(m,f,y)=>", "d=s(o),p=(m,f,y,gpmAttacking=false)=>"],
    ["k<=R*R&&(h+=(M.pow||0)*Math.exp(-k/(x*x)))", "k<=R*R&&(!gpmAttacking||!gpmPressureFilter||gpmPressureFilter(M,f,y))&&(h+=(M.pow||0)*Math.exp(-k/(x*x)))"],
    ["let y=p(l,m,f),h=p(c,m,f),g=p(u,m,f),v=p(d,m,f)", "let y=p(l,m,f,true),h=p(c,m,f),g=p(u,m,f,true),v=p(d,m,f)"],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { patchFrontlineWorker };
