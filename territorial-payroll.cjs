"use strict";

const payrollWorkers = {
  wageBillBnY: "employmentM",
  employerContributionBnY: "employmentM",
  wageBill0BnY: "employment0M",
  employerContribution0BnY: "employment0M",
};

function gpmMoveTerritorialPayroll(source, target, workers, movedWorkers) {
  if (!(movedWorkers > 0)) return;
  const share = movedWorkers / source[workers];
  for (const [field, matchedWorkers] of Object.entries(gpmTerritorialPayrollWorkers)) {
    if (matchedWorkers !== workers) continue;
    const movedPayroll = Je(source[field]) * share;
    source[field] = Je(source[field]) - movedPayroll;
    target[field] = Je(target[field]) + movedPayroll;
  }
}

function patchTerritorialPayroll(source, replaceOnce) {
  // Preserve wages and contributions per worker when productive assets and
  // employment move in different proportions. Keep the territorial share for
  // payroll records with no workers available to supply a proportion.
  source = replaceOnce(source, "function Ptt(e,t){",
    `const gpmTerritorialPayrollWorkers=${JSON.stringify(payrollWorkers)};\n${gpmMoveTerritorialPayroll}\nfunction Ptt(e,t){`);
  source = replaceOnce(source, "for(let S of nta){let P=Je(u[S])*p;u[S]=Je(u[S])-P,m[S]=Je(m[S])+P}",
    "for(let S of nta){if(Je(u[gpmTerritorialPayrollWorkers[S]])>0)continue;let P=Je(u[S])*p;u[S]=Je(u[S])-P,m[S]=Je(m[S])+P}");
  return replaceOnce(source, "u[S]=Math.max(0,Je(u[S])-P),m[S]=Math.max(0,Je(m[S])+P)}let b={requiredEmploymentM:i",
    "gpmMoveTerritorialPayroll(u,m,S,P),u[S]=Math.max(0,Je(u[S])-P),m[S]=Math.max(0,Je(m[S])+P)}let b={requiredEmploymentM:i");
}

module.exports = { patchTerritorialPayroll };
