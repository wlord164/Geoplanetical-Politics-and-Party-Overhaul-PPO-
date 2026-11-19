"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const worker = readFileSync(join(__dirname, "historical-sudan-reunification.js"), "utf8");

function patchSudanReunificationWorker(source, replaceOnce) {
  const hooks = [
    ['function gpmHistoricalStrength(sim, actorId, kind)', worker + '\nfunction gpmHistoricalStrength(sim, actorId, kind)'],
    ['let c=e.countries.get(t),u=pGe(e,l),d=PD(e,o,s,i,l);',
      'let c=e.countries.get(t),u=pGe(e,l),d=gpmHistoricalCivilWarTerms(e,o,s,i,l,undefined,"negotiated-concession");'],
    ['l=fU(e,t,i.key,s.key),c=pGe(e,l),u=PD(e,t,i.key,s.key,l);',
      'l=fU(e,t,i.key,s.key),c=pGe(e,l),u=gpmHistoricalCivilWarTerms(e,t,i.key,s.key,l);'],
    ['d=fU(e,r,l.key,c.key,u),p=pGe(e,d),m=PD(e,r,l.key,c.key,d,u);',
      'd=fU(e,r,l.key,c.key,u),p=pGe(e,d),m=gpmHistoricalCivilWarTerms(e,r,l.key,c.key,d,u,"developer-override");'],
    ['u=fU(e,o,l.key,c.key,r),d=PD(e,o,l.key,c.key,u,r);',
      'u=fU(e,o,l.key,c.key,r),d=gpmHistoricalCivilWarTerms(e,o,l.key,c.key,u,r);'],
    ['c=PD(e,t,r.winnerKey,r.loserKey,r.terms);',
      'c=gpmHistoricalCivilWarTerms(e,t,r.winnerKey,r.loserKey,r.terms);'],
    ['t.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t))&&l9t',
      't.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&l9t'],
    ['function*mVo(e,t){gpmHistoricalAdvance(e);', 'function*mVo(e,t){gpmSudanReunify(e);gpmHistoricalSettleOpeningWars(e);gpmHistoricalAdvance(e);'],
    ['gpmUprising.settle(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)',
      'gpmUprising.settle(a);gpmSudanReunify(a);gpmHistoricalSettleOpeningWars(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)'],
    ['aidUntil: row.aidUntil, settlement: row.settlement || null',
      'aidUntil: row.aidUntil, settlement: row.settlement || null, administrationName: row.administrationName || null'],
    ['function V7t(e,t,a,r){if(gpmUprising.matches(e,t)&&r?.length)',
      'function V7t(e,t,a,r){if((gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&r?.length)'],
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
