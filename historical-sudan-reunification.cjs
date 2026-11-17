"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const worker = readFileSync(join(__dirname, "historical-sudan-reunification.js"), "utf8");

function patchSudanReunificationWorker(source, replaceOnce) {
  const hooks = [
    ['function gpmHistoricalStrength(sim, actorId, kind)', worker + '\nfunction gpmHistoricalStrength(sim, actorId, kind)'],
    ['let c=e.countries.get(t),u=iNe(e,l),d=tD(e,o,s,i,l);',
      'let c=e.countries.get(t),u=iNe(e,l),d=gpmHistoricalCivilWarTerms(e,o,s,i,l,undefined,"negotiated-concession");'],
    ['l=zF(e,t,i.key,s.key),c=iNe(e,l),u=tD(e,t,i.key,s.key,l);',
      'l=zF(e,t,i.key,s.key),c=iNe(e,l),u=gpmHistoricalCivilWarTerms(e,t,i.key,s.key,l);'],
    ['d=zF(e,r,l.key,c.key,u),p=iNe(e,d),m=tD(e,r,l.key,c.key,d,u);',
      'd=zF(e,r,l.key,c.key,u),p=iNe(e,d),m=gpmHistoricalCivilWarTerms(e,r,l.key,c.key,d,u,"developer-override");'],
    ['u=zF(e,o,l.key,c.key,r),d=tD(e,o,l.key,c.key,u,r);',
      'u=zF(e,o,l.key,c.key,r),d=gpmHistoricalCivilWarTerms(e,o,l.key,c.key,u,r);'],
    ['c=tD(e,t,r.winnerKey,r.loserKey,r.terms);',
      'c=gpmHistoricalCivilWarTerms(e,t,r.winnerKey,r.loserKey,r.terms);'],
    ['t.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t))&&U8t',
      't.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&U8t'],
    ['function*sHo(e,t){gpmHistoricalAdvance(e);', 'function*sHo(e,t){gpmSudanReunify(e);gpmHistoricalSettleOpeningWars(e);gpmHistoricalAdvance(e);'],
    ['gpmUprising.settle(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)',
      'gpmUprising.settle(a);gpmSudanReunify(a);gpmHistoricalSettleOpeningWars(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)'],
    ['aidUntil: row.aidUntil, settlement: row.settlement || null',
      'aidUntil: row.aidUntil, settlement: row.settlement || null, administrationName: row.administrationName || null'],
    ['function R8t(e,t,a,r){if(gpmUprising.matches(e,t)&&r?.length)',
      'function R8t(e,t,a,r){if((gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&r?.length)'],
  ];
  return hooks.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

function patchSudanReunificationRenderer(source, replaceOnce) {
  const changes = [
    ['(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-"))',
      '(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-") || previous === "gpm-historical-sdn-rsf" || key === "gpm-historical-sdn-rsf")'],
    ['"native-settlement": "War settlement",',
      '"native-settlement": "War settlement", "tasis-reunification": "Reunification under Tasis", "saf-reunification": "Reunification under the Sudanese government",'],
  ];
  return changes.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

module.exports = { patchSudanReunificationWorker, patchSudanReunificationRenderer };
