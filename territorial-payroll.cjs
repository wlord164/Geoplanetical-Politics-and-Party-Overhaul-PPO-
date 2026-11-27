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
    const movedPayroll = lt(source[field]) * share;
    source[field] = lt(source[field]) - movedPayroll;
    target[field] = lt(target[field]) + movedPayroll;
  }
}

function gpmRepairLegacyOpeningPayroll(sim, metadata) {
  if (metadata?.saveVersion !== "1.1.3" || metadata.inGameDay !== 0 || sim.day !== 0) return;
  const finance = sim.finance;
  if (!finance?.companies) return;
  const linkedCountries = new Map();
  for (const { key, parentKey } of Object.values(sim.gpmHistoricalState?.openingGovernments || {})) {
    if (!linkedCountries.has(parentKey)) linkedCountries.set(parentKey, new Set());
    linkedCountries.get(parentKey).add(key);
  }
  const fields = [
    ["employmentM", "wageBillBnY", "employerContributionBnY"],
    ["employment0M", "wageBill0BnY", "employerContribution0BnY"],
  ];
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  const repairedCountries = new Set();
  let repaired = 0;
  for (const [parentKey, childKeys] of linkedCountries) {
    const keys = [parentKey, ...childKeys].sort((a, b) => a === parentKey ? -1 : b === parentKey ? 1 : a.localeCompare(b));
    const parent = sim.countries.get(parentKey);
    if (!parent?.ccyCode || keys.some(key => sim.countries.get(key)?.ccyCode !== parent.ccyCode)) continue;
    for (const sector of Object.keys(parent.firms || {}).sort()) {
      const source = finance.companies[`independent:${parentKey}:${sector}`];
      if (source?.sourceMode !== "explicit_residual" || !(source.contractWageK > 0)) continue;
      const group = keys.map(key => finance.companies[`independent:${key}:${sector}`]).filter(Boolean);
      if (group.length < 2 || group[0] !== source || group.slice(1).some(company => company.sourceMode !== "territorial_absorber") ||
          group.some(company => company.status !== "residual" || company.sectorId !== sector ||
            company.contractWageK !== source.contractWageK || !Number.isFinite(company.contractWageK))) continue;
      // The old asset-share split retained the contract but could move most of
      // a territory's payroll to the parent. Require a strong discrepancy.
      if (!group.slice(1).some(row => row.employment0M > 0 && row.wageBill0BnY >= 0 &&
              row.wageBill0BnY * 3 < row.employment0M * row.contractWageK)) continue;
      const allocations = [];
      for (const [workers, payroll, contributions] of fields) {
        const sum = field => group.reduce((total, row) => total + row[field], 0);
        const workforce = sum(workers), wageTotal = sum(payroll), contributionTotal = sum(contributions);
        if (!(workforce > 0) || !near(wageTotal, workforce * source.contractWageK) ||
            group.some(row => [workers, payroll, contributions].some(field => !Number.isFinite(row[field]) || row[field] < 0) ||
              !near(row[contributions] * wageTotal, row[payroll] * contributionTotal))) break;
        const reallocate = (field, total) => {
          const amounts = group.slice(1).map(row => total * row[workers] / workforce);
          return [field, [total - amounts.reduce((partial, amount) => partial + amount, 0), ...amounts]];
        };
        allocations.push(reallocate(payroll, wageTotal), reallocate(contributions, contributionTotal));
      }
      if (allocations.length !== fields.length * 2 || allocations.some(([, amounts]) =>
          amounts.some(amount => !Number.isFinite(amount) || amount < 0))) continue;
      for (const [field, amounts] of allocations) group.forEach((company, index) => { company[field] = amounts[index]; });
      for (const company of group) repairedCountries.add(company.headquartersCountryKey);
      repaired++;
    }
  }
  for (const key of repairedCountries) Oi(finance, sim.countries.get(key));
  if (repaired) sim.reportRuntimeRecovery?.({
    code: "finance.historical_opening_payroll", domain: "finance", repair: "redistribute-legacy-opening-payroll-by-workers",
    context: { sectors: repaired, countries: repairedCountries.size },
  });
}

function patchTerritorialPayroll(source, replaceOnce) {
  // Preserve wages and contributions per worker when productive assets and
  // employment move in different proportions. Keep the territorial share for
  // payroll records with no workers available to supply a proportion.
  source = replaceOnce(source, "function zmt(e,t){",
    `const gpmTerritorialPayrollWorkers=${JSON.stringify(payrollWorkers)};\n${gpmMoveTerritorialPayroll}\n${gpmRepairLegacyOpeningPayroll}\nfunction zmt(e,t){`);
  source = replaceOnce(source, "for(let h of j8A){let y=lt(c[h])*d;c[h]=lt(c[h])-y,E[h]=lt(E[h])+y}",
    "for(let h of j8A){if(lt(c[gpmTerritorialPayrollWorkers[h]])>0)continue;let y=lt(c[h])*d;c[h]=lt(c[h])-y,E[h]=lt(E[h])+y}");
  source = replaceOnce(source, "c[h]=Math.max(0,lt(c[h])-y),E[h]=Math.max(0,lt(E[h])+y)}let g={requiredEmploymentM:n",
    "gpmMoveTerritorialPayroll(c,E,h,y),c[h]=Math.max(0,lt(c[h])-y),E[h]=Math.max(0,lt(E[h])+y)}let g={requiredEmploymentM:n");
  const restoreBoundary = "gpmHistoricalRestoreOpeningCapitals(g)";
  return replaceOnce(source, restoreBoundary, restoreBoundary + ",gpmRepairLegacyOpeningPayroll(g,t.savePayload?.meta)");
}

module.exports = { patchTerritorialPayroll };
