const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function patchFrontlineWorker(source, replaceOnce) {
  const worker = ["frontline-contact.js", "frontline-terrain.js", "frontline-telemetry.js", "frontline-simulation.js"].map(file => readFileSync(join(__dirname, file), "utf8")).join("\n");
  const anchors = [
    ["registerPartyOrganizing();\nregisterPartyCongressSize();",
      worker + "\nregisterFrontlinePlans();\nregisterPartyOrganizing();\nregisterPartyCongressSize();"],
    ['(A==="gpm.partyFactionQuote"?', '(A==="gpm.frontline"?gpmFrontlineView(a,t.params||{}):A==="gpm.frontline.line"?gpmFrontlineLinePreview(a,t.params||{}):A==="gpm.frontline.route"?gpmFrontlineRoutePreview(a,t.params||{}):A==="gpm.partyFactionQuote"?'],
    ["campaign:r.campaign,frontSlots:r.frontSlots||{}", "campaign:r.campaign,gpmFrontline:r.gpmFrontline,frontSlots:r.frontSlots||{}"],
    ["commandSummary:a.commandSummary||null,frontSlots:a.frontSlots||{}", "commandSummary:a.commandSummary||null,gpmFrontline:gpmFrontlineRestore(a.gpmFrontline,e),frontSlots:a.frontSlots||{}"],
    ["function W9(e,t){let A=t?.id;if(!A)return!1;", "function W9(e,t){let A=t?.id;if(!A)return!1;gpmFrontlineClose(e,t);"],
    ['a.agreements.push(s),t.status="suspended",mSt(e,t)', 'a.agreements.push(s),t.status="suspended",gpmFrontlineSuspend(e,t),mSt(e,t)'],
    ["function PMr(e,t,A,a,r,o){", "function PMr(e,t,A,a,r,o){let gpmDestination=gpmFrontlineDestination(e,r,A);if(gpmDestination)return gpmDestination;"],
    ["let d=Xqr(i.length,u.length),E=Math.max(0,i.length-d),B=new Set;for(let m of u){for(let f of i)f.assignment?.conflictId===m.war.id&&!tI(f)&&(m.ids.push(f.id),B.add(f.id));",
      "let d=Xqr(i.length,u.length),E=Math.max(0,i.length-d),B=gpmFrontlineReserveForces(e,u,i);for(let m of u){for(let f of i)f.assignment?.conflictId===m.war.id&&!tI(f)&&!m.ids.includes(f.id)&&(m.ids.push(f.id),B.add(f.id));"],
    ["let m=t._frontSlotRegions?.[A]?.regions;for(let O of s)if(!u?.[O.id]){",
      "let m=t._frontSlotRegions?.[A]?.regions;u=gpmFrontlineSlots(e,t,A,s,o,u,a);for(let O of s)if(!u?.[O.id]){"],
    ['G=ER(O)>.3&&(U||_.has(O.id)||te)?"attack":"hold",$=e.countries.get(O.owner)',
      'G=gpmFrontlineOrderKind(e,t,O,ER(O)>.3&&(U||_.has(O.id)||te)?"attack":"hold"),$=e.countries.get(O.owner)'],
    ['reason:U?"expand_beachhead":G==="attack"?"local_opportunity":"sector_hold"',
      'reason:gpmFrontlineOrders(e,t,O)?"gpm_frontline":U?"expand_beachhead":G==="attack"?"local_opportunity":"sector_hold"'],
    ['O._frontAtSlot=!1,qca(e,t,A,O,r);continue}let T=O._sectorIntent',
      'O._frontAtSlot=!1,qca(e,t,A,O,r);gpmFrontlineRecordRoute(e,t,O,true);continue}let T=O._sectorIntent'],
    ['a._frontAtSlot=!a._frontMoving):(a._frontMoving=!1,a._frontAtSlot=!1)}var TVr=120',
      'a._frontAtSlot=!a._frontMoving):(a._frontMoving=!1,a._frontAtSlot=!1),gpmFrontlineRecordRoute(e,t,a,!c)}var TVr=120'],
    ['c._deployRouteFailure={conflictId:c.assignment.conflictId,day:e.day||0}',
      'c._deployRouteFailure={conflictId:c.assignment.conflictId,reason:u.reason||u.status||"no_route",day:e.day||0}'],
    ["for(let _ of o)_._stance=Jca(_,m,e.day||0,g(_));for(let _ of n)_._stance=Jca(_,f,e.day||0,g(_));",
      "for(let _ of o)_._stance=gpmFrontlineCombatStance(e,t,_,m,g(_));for(let _ of n)_._stance=gpmFrontlineCombatStance(e,t,_,f,g(_));"],
    ['u.set(_.id,(u.get(_.id)||0)+O),c.add(_.id),_._stance',
      'u.set(_.id,(u.get(_.id)||0)+O),c.add(_.id),gpmFrontlineRecordCombat(e,t,_,O),_._stance'],
    ['d.set(_.id,(d.get(_.id)||0)+O),c.add(_.id),_._stance',
      'd.set(_.id,(d.get(_.id)||0)+O),c.add(_.id),gpmFrontlineRecordCombat(e,t,_,O),_._stance'],
    ['R=_=>_._stance==="attack"||_._stance==="encircled",P=(_,K,O,L)',
      'R=_=>gpmFrontlineProjectsPressure(e,t,_),P=(_,K,O,L)'],
    ["At=cca(t.field,xe.pAttack,xe.eHold,xe.eAttack,xe.pHold)", "At=cca(t.field,xe.pAttack,xe.eHold,xe.eAttack,xe.pHold,gpmFrontlinePressureFilter(e,t))"],
    ['zye(e,t))}yield"field",B&&p&&puo(e,t,T,S)', 'zye(e,t))}if(gpmFrontlineCompleted(e,t).length){yield*$kt(t.field);gpmFrontlineComplete(e,t);t._commandGeometryDay=0}yield"field",B&&p&&puo(e,t,T,S)'],
    ["function cca(e,t,A,a=[],r=[]){", "function cca(e,t,A,a=[],r=[],gpmPressureFilter=null){"],
    ["u=i(r),d=(E,B,p)=>", "u=i(r),d=(E,B,p,gpmAttacking=false)=>"],
    ["C<=M*M&&(Q+=(S.pow||0)*Math.exp(-C/(R*R)))", "C<=M*M&&(!gpmAttacking||!gpmPressureFilter||gpmPressureFilter(S,B,p))&&(Q+=(S.pow||0)*Math.exp(-C/(R*R)))"],
    ["let p=d(s,E,B),Q=d(l,E,B),m=d(c,E,B),f=d(u,E,B)", "let p=d(s,E,B,true),Q=d(l,E,B),m=d(c,E,B,true),f=d(u,E,B)"],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { patchFrontlineWorker };
