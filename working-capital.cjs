"use strict";

function gpmWorkingCapitalAccount(finance, company) {
  return finance.accounts[company.accountIds?.operatingCredit];
}

function gpmWorkingCapitalTransfer(finance, from, to, amountBn, day, reason) {
  const oldAsset = finance.accounts[from.accountIds.loanAsset];
  const oldExpense = finance.accounts[from.accountIds.creditLossExpense];
  const newAsset = finance.accounts[to.accountIds.loanAsset];
  const newIncome = finance.accounts[to.accountIds.resolutionIncome];
  const entries = [
    { accountId: oldExpense.id, debitBn: amountBn },
    { accountId: oldAsset.id, creditBn: amountBn },
    { accountId: newAsset.id, debitBn: amountBn },
    { accountId: newIncome.id, creditBn: amountBn },
  ];
  const kind = "ppo_working_capital_creditor_transfer";
  // Recognize the mandated assignment in both banks' books at carrying value.
  // No company debt, deposits, reserves, or total bank loan principal change.
  rQa(kind, entries, id => finance.accounts[id].currencyCode);
  return { kind, day, refs: { fromBankId: from.id, toBankId: to.id, amountBn, reason }, entries };
}

function gpmTransferCurrencyWorkingCapital(finance, moves, receivingBank, day) {
  const byLender = new Map();
  for (const move of moves) {
    if (!move.relink || move.target.ownerType !== "company") continue;
    const company = finance.companies[move.target.ownerId];
    if (!company || company.cashAccountId !== move.target.id || company.bankId === receivingBank.id) continue;
    const amountBn = gpmWorkingCapitalAccount(finance, company)?.balanceBn || 0;
    if (!amountBn) continue;
    const lender = finance.banks[company.bankId];
    if (lender?.id !== move.link.bankId) throw new Error("ppo-working-capital:invalid-relink-creditor");
    byLender.set(lender, J([byLender.get(lender) || 0, amountBn]));
  }
  const transfers = Array.from(byLender, ([bank, amountBn]) =>
    gpmWorkingCapitalTransfer(finance, bank, receivingBank, amountBn, day, "currency-transition"));
  if (transfers.length) gX(finance, transfers);
}

function gpmWorkingCapitalGaps(finance) {
  const gaps = new Map();
  for (const bank of Object.values(finance.banks)) {
    const asset = finance.accounts[bank.accountIds.loanAsset];
    if (!asset || asset.closed) continue;
    let claimed = 0;
    for (const id of bank.loanInstrumentIds) {
      const loan = finance.instruments[id];
      if (loan?.active) claimed += ue(loan.quantityIssued);
    }
    gaps.set(bank.id, ue(asset.balanceBn) - claimed);
  }
  for (const company of Object.values(finance.companies)) {
    if (!gaps.has(company.bankId)) continue;
    const credit = gpmWorkingCapitalAccount(finance, company);
    if (credit && !credit.closed) gaps.set(company.bankId, gaps.get(company.bankId) - ue(credit.balanceBn));
  }
  return gaps;
}

function gpmCurrencyWorkingCapitalOrigins(finance) {
  const lenderByCashAccount = new Map();
  const kinds = new Set(["currency_exit_close", "currency_union_entry_close"]);
  for (const transaction of $1(finance, { kinds })) {
    const entries = transaction.entries;
    for (let index = 1; index < entries.length; index++) {
      const sourceDeposit = finance.accounts[entries[index - 1].accountId];
      const movedCash = finance.accounts[entries[index].accountId];
      const fromBankId = sourceDeposit?.depositClaim?.bankId;
      if (fromBankId && sourceDeposit.kind === "central_bank_fx_deposit" &&
          movedCash?.kind === "company_cash" && entries[index - 1].debitBn === entries[index].creditBn) {
        lenderByCashAccount.set(movedCash.id, { bankId: fromBankId, day: transaction.day });
      }
    }
  }
  return lenderByCashAccount;
}

function gpmRecoverCurrencyWorkingCapital(sim) {
  const finance = sim.finance;
  const gaps = gpmWorkingCapitalGaps(finance);
  if (![...gaps.values()].some(units => units < 0) || ![...gaps.values()].some(units => units > 0)) return;
  const lenderByCashAccount = gpmCurrencyWorkingCapitalOrigins(finance);
  const transitions = finance.histories.events.filter(event =>
    event.type === "currency_exit" || event.type === "currency_union_entry");
  const fxClaims = Object.values(finance.accounts).filter(account => account.kind === "central_bank_fx_deposit" &&
    account.depositClaim?.bankId);
  const companiesByBank = new Map();
  for (const company of Object.values(finance.companies)) {
    if (!(gaps.get(company.bankId) < 0) || !gpmWorkingCapitalAccount(finance, company)?.balanceBn) continue;
    if (!companiesByBank.has(company.bankId)) companiesByBank.set(company.bankId, []);
    companiesByBank.get(company.bankId).push(company);
  }
  const transfers = [];
  for (const [bankId, companies] of companiesByBank) {
    const receiver = finance.banks[bankId];
    const missing = -gaps.get(bankId);
    const transition = transitions.findLast(event => event.settlementBankId === bankId ||
      event.countryKey === receiver.countryKey && event.newCurrencyCode === receiver.currencyCode);
    if (!transition) continue;
    const origins = new Map();
    for (const company of companies) {
      const lender = lenderByCashAccount.get(company.cashAccountId);
      if (lender?.day !== transition.day || !(gaps.get(lender.bankId) > 0)) continue;
      const credit = gpmWorkingCapitalAccount(finance, company);
      origins.set(lender.bankId, (origins.get(lender.bankId) || 0) + ue(credit.balanceBn));
    }
    // A compacted journal can omit individual deposit transfers. The
    // central bank retains a native FX deposit claim against each old bank.
    // These account IDs keep the transition's original currency code after
    // later currency renaming. An exit creates a unique central bank.
    if (transition.type === "currency_exit") {
      const prefix = `central-bank-fx-deposit:${transition.newCurrencyCode}:`;
      for (const claim of fxClaims) {
        const lenderId = claim.depositClaim.bankId;
        if (claim.id !== prefix + lenderId || !(gaps.get(lenderId) > 0) || origins.has(lenderId)) continue;
        origins.set(lenderId, gaps.get(lenderId));
      }
    }
    // Surplus may be split across multiple old banks. Require the full
    // deficit to be backed by the evidenced surplus before posting anything.
    const amounts = Array.from(origins, ([id, units]) => [id, Math.min(units, gaps.get(id))]);
    if (amounts.reduce((total, [, units]) => total + units, 0) !== missing) continue;
    for (const [id, units] of amounts) {
      transfers.push(gpmWorkingCapitalTransfer(finance, finance.banks[id], receiver,
        tt(units), sim.day, "legacy-save-repair"));
      gaps.set(id, gaps.get(id) - units);
    }
    gaps.set(bankId, 0);
  }
  if (!transfers.length) return;
  gX(finance, transfers);
  for (const { refs } of transfers) sim.reportRuntimeRecovery?.({
    code: "finance.working_capital_creditor",
    domain: "finance",
    repair: "assign-working-capital-loan-asset",
    context: refs,
  });
}

function gpmRelinkFxDepositHolder(finance, account, previousHolder) {
  const claim = account.depositClaim;
  const holder = account.ownerId;
  if (account.kind !== "central_bank_fx_deposit" || account.ownerType !== "central_bank" ||
      !claim || claim.holderId !== previousHolder || holder === previousHolder ||
      !finance.centralBanks?.[holder]) return false;
  const positions = finance.positions?.[claim.instrumentId];
  const position = positions?.[holder];
  if (positions?.[previousHolder] || position?.holderId !== holder ||
      position.assetAccountId !== account.id || position.cashAccountId !== account.id ||
      position.quantity !== account.balanceBn || position.bookValueBn !== account.balanceBn) return false;
  claim.holderId = holder;
  return true;
}

function gpmRecoverFxDepositHolders(finance) {
  for (const account of Object.values(finance.accounts)) {
    const before = account?.depositClaim?.holderId;
    if (before && gpmRelinkFxDepositHolder(finance, account, before)) {
      le({ section: "sat.finance", path: `accounts.${account.id}.depositClaim.holderId`,
        rule: "ppo-fx-deposit-holder-relink", before, after: account.ownerId });
    }
  }
}

function patchWorkingCapital(source, replaceOnce) {
  const helpers = [gpmWorkingCapitalAccount, gpmWorkingCapitalTransfer, gpmTransferCurrencyWorkingCapital,
    gpmWorkingCapitalGaps, gpmCurrencyWorkingCapitalOrigins, gpmRecoverCurrencyWorkingCapital,
    gpmRelinkFxDepositHolder, gpmRecoverFxDepositHolders].join("\n");
  const relink = "function EZe(e,t,{oldCentralBank:A,centralBank:a,newCode:r,receivingBank:o}){";
  source = replaceOnce(source, relink,
    helpers + "\n" + "function EZe(e,t,{oldCentralBank:A,centralBank:a,newCode:r,receivingBank:o,day:gpmDay}){" +
    "gpmTransferCurrencyWorkingCapital(e,t.moves,o,gpmDay);");
  source = replaceOnce(source, "newCode:c,receivingBank:B||A.homeBank});",
    "newCode:c,receivingBank:B||A.homeBank,day:d});");
  source = replaceOnce(source, "newCode:A.code,receivingBank:E||a.homeBank});",
    "newCode:A.code,receivingBank:E||a.homeBank,day:u});");
  // The native rename moves the position first. A foreign deposit stays in
  // the issuing bank's currency when only its holder's currency changes.
  source = replaceOnce(source, "!B&&!p&&!Q||(E.currencyCode=a,p&&(E.ownerId=i,dX(e)),u++)",
    "!B&&!p&&!Q||((E.kind!==\"central_bank_fx_deposit\"||E.currencyCode===a)&&(E.currencyCode=a)," +
    "p&&(E.ownerId=i,gpmRelinkFxDepositHolder(e,E,i),dX(e)),u++)");
  source = replaceOnce(source, "jpa(A),Gpa(A);let a;try{return JLt(A,t),jLt(A,t)}",
    "jpa(A),Gpa(A),gpmRecoverFxDepositHolders(A);let a;try{return JLt(A,t),jLt(A,t)}");
  const restoreBoundary = "gpmHistoricalRestoreOpeningCapitals(g)";
  // Run against the restored, registered ledger before the player can advance.
  return replaceOnce(source, restoreBoundary, restoreBoundary + ",gpmRecoverCurrencyWorkingCapital(g)");
}

module.exports = { patchWorkingCapital, gpmTransferCurrencyWorkingCapital, gpmRecoverCurrencyWorkingCapital,
  gpmRelinkFxDepositHolder };

