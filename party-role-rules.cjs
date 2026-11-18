"use strict";

const gpmPartyRoles = Object.freeze([
  "membership", "delegate", "factionLeadership", "partyCouncil", "candidacy",
  "legislativeSeat", "cabinetAppointment", "executiveOffice", "clericalOffice",
]);

const afghanistan = {
  organizationId: "ucdp-actor-130", jurisdictionKey: "004", authorityId: "afghanistan-de-facto-authorities",
  kind: "observedRoster", effectiveFrom: "2024-01-01", effectiveUntil: "2025-09-01", confidence: "high",
  source: "https://knowledge.unwomen.org/sites/default/files/2025-08/afghanistan-gender-alert-2025-08-en.pdf",
  corroboration: "https://knowledge.unwomen.org/sites/default/files/2025-06/gender-index-2024-afghanistan-en.pdf",
};
const jamaat = {
  organizationId: "jamaat-e-islami-pakistan", jurisdictionKey: "586", authorityId: "jamaat-e-islami-charter",
  kind: "partyCharter", effectiveFrom: "2021-07-01", confidence: "high",
  source: "https://beta.jamaat.org/en/posts/dastoor-e-jamaat",
};
const greens = {
  organizationId: "bundnis-90-die-grunen", jurisdictionKey: "276", authorityId: "german-greens-charter",
  kind: "partyCharter", effectiveFrom: "2019-11-16", confidence: "high",
  source: "https://cms.gruene.de/uploads/documents/191121-Frauenstatut.pdf",
  corroboration: "https://www.bundeswahlleiterin.de/dam/jcr/d2c68367-3bec-452a-98f4-114d5e51e79b/gruene.pdf",
};

const gpmSourcedRoleRules = Object.freeze([
  { ...afghanistan, id: "afghan-2024-25-cabinet", role: "cabinetAppointment", positionId: "cabinet",
    provision: "UN Women, August 2025, p. 40. Afghanistan Gender Index 2024, p. 44.", composition: { women: 0 },
    description: "No women held posts in the documented de facto cabinet." },
  { ...afghanistan, id: "afghan-2024-25-provincial", role: "executiveOffice", positionId: "provincial-governance",
    provision: "UN Women, August 2025, p. 40. Afghanistan Gender Index 2024, p. 44.", composition: { women: 0 },
    description: "No women held the documented formal subnational governing posts." },
  { ...jamaat, id: "jamaat-membership-covenant", role: "membership", positionId: "member",
    provision: "Arts 6, 7 and 10", requiredAttestations: ["creed", "mission", "discipline", "admission-approved"],
    description: "Mature applicants may qualify through the stated declarations and authorized review. The charter admits both women and men." },
  { ...jamaat, id: "jamaat-associates", role: "membership", positionId: "associate",
    provision: "Art 88", description: "The organizational structure includes women associates and members separately from the corresponding men's organization." },
  { ...jamaat, id: "jamaat-council-men", role: "partyCouncil", positionId: "central-council", slotKind: "men",
    provision: "Art 21(1)(a–b)", genderIdentities: ["man"], memberStatus: "member", slotCount: 70,
    description: "Seventy elected seats are filled by male members under the male electorate and provincial allocation." },
  { ...jamaat, id: "jamaat-council-women", role: "partyCouncil", positionId: "central-council", slotKind: "women",
    provision: "Arts 21(1)(a–b) and 88(2a)", genderIdentities: ["woman"], memberStatus: "member", slotCount: 10,
    description: "Ten elected seats are filled by female members under the female electorate and provincial allocation. Appendix 5 records adoption on 3 October 2015." },
  { ...jamaat, id: "jamaat-womens-wing-secretary", role: "partyCouncil", positionId: "central-council", slotKind: "womens-wing-secretary",
    provision: "Arts 21(3)(d) and 88(1, 2a)", memberStatus: "member", requiredPosition: "womens-wing-secretary", slotCount: 1,
    description: "The sitting Women's Wing Secretary holds an additional ex officio seat. The party president appoints the secretary for three years after considering women members' views." },
  { ...jamaat, id: "jamaat-womens-wing-appointment", role: "partyCouncil", positionId: "womens-wing-secretary",
    provision: "Art 88(1)", genderIdentities: ["woman"], memberStatus: "member",
    description: "The party president appoints a woman member as Women's Wing Secretary for three years after considering the views of women members." },
  { ...greens, id: "greens-council-reservation", role: "partyCouncil", positionId: "party-body", slotKind: "women",
    provision: "Federal statutes § 3 and Women's Statute §§ 1 and 3", genderIdentities: ["woman"], alternateReserve: true,
    description: "At least half the members of covered bodies are women. Select women-reserved and open places separately. Leave a reserved place vacant if no eligible candidate is chosen." },
  { ...greens, id: "greens-list-reservation", role: "candidacy", positionId: "party-election-list", slotKind: "women",
    provision: "Federal statutes § 3 and Women's Statute §§ 1 and 3", genderIdentities: ["woman"], alternateReserve: true,
    exception: "release-election-list-place",
    description: "Reserve odd list places for women. The assembly can release a reserved election list place following its authorized procedure, subject to the women's veto." },
]);

function gpmRoleDateInEffect(record, date) {
  if (!record.effectiveFrom && !record.effectiveUntil) return true;
  return !!date && (!record.effectiveFrom || record.effectiveFrom <= date) &&
    (!record.effectiveUntil || date < record.effectiveUntil);
}

function gpmRoleRuleApplies(rule, context) {
  return rule?.role === context.role && rule.organizationId === context.organizationId &&
    rule.jurisdictionKey === context.jurisdictionKey && rule.authorityId === context.authorityId &&
    (!rule.positionId || rule.positionId === context.positionId) &&
    (!rule.slotKind || rule.slotKind === context.slotKind) &&
    !!rule.source && gpmRoleDateInEffect(rule, context.date);
}

function gpmRoleRuleException(rule, context) {
  if (!rule.exception || !context.slotId || !Array.isArray(context.approvals)) return false;
  return context.approvals.some(approval => approval?.exception === rule.exception && approval.slotId === context.slotId &&
    approval.organizationId === context.organizationId && approval.jurisdictionKey === context.jurisdictionKey &&
    approval.role === context.role && approval.positionId === context.positionId && approval.authorityId === context.authorityId &&
    approval.source && approval.granted === true && approval.vetoed === false && gpmRoleDateInEffect(approval, context.date));
}

function gpmRoleRuleFailure(rule, context) {
  const { person, age } = context;
  if (rule.disallowed) return "position_excluded";
  if (rule.minimumAge != null && !Number.isFinite(age)) return "qualification_unknown";
  if (rule.minimumAge != null && age < rule.minimumAge) return "minimum_age";
  if (rule.allowedGenders && !rule.allowedGenders.includes(person?.g)) return "role_gender";
  if (rule.genderIdentities && !person?.genderIdentity) return "qualification_unknown";
  if (rule.genderIdentities && !rule.genderIdentities.includes(person.genderIdentity)) return "reserved_position";
  if (rule.requiredReligion && person?.religion !== rule.requiredReligion) return "role_religion";
  if (rule.memberStatus && context.memberStatus !== rule.memberStatus) return "membership_status";
  if (rule.requiredPosition && !context.heldPositions?.includes(rule.requiredPosition)) return "ex_officio";
  if (rule.requiredAttestations?.some(id => !context.attestations?.includes(id))) return "charter_attestations";
  return null;
}

function gpmRoleRuleSummary(rule) {
  const { id, authorityId, source, corroboration, provision, description, composition, slotKind, slotCount, alternateReserve, exception,
    kind = "scenarioCharter", effectiveFrom = null, effectiveUntil = null, confidence = "unknown" } = rule;
  return { id, authorityId, source, corroboration, provision, description, composition, slotKind, slotCount, alternateReserve, exception,
    kind, effectiveFrom, effectiveUntil, confidence };
}

function gpmResolveRoleEligibility(context) {
  const { role, nativeAllowed, nativeReason, rules } = context;
  if (!gpmPartyRoles.includes(role)) return { eligible: false, reason: "unknown_role", rules: [], observations: [] };
  const applicable = (Array.isArray(rules) ? rules : []).filter(rule => gpmRoleRuleApplies(rule, context));
  const evidence = applicable.filter(rule => !["observedRoster", "observedPractice"].includes(rule.kind));
  const decision = { rules: evidence.map(gpmRoleRuleSummary), observations: applicable.filter(rule => !evidence.includes(rule)).map(gpmRoleRuleSummary) };
  if (!nativeAllowed) return { ...decision, eligible: false, reason: nativeReason || "ordinary_eligibility" };
  for (const rule of evidence) {
    if (gpmRoleRuleException(rule, context)) continue;
    const failure = gpmRoleRuleFailure(rule, context);
    if (failure) return { ...decision, eligible: false, reason: "role_rule", detail: failure, ruleId: rule.id };
  }
  return { ...decision, eligible: true, reason: evidence.length ? "role_rules_met" : "ordinary_eligibility" };
}

function gpmRoleSlots(context, count) {
  const relevant = (context.rules || []).filter(rule => rule.slotKind &&
    gpmRoleRuleApplies(rule, { ...context, slotKind: rule.slotKind }));
  const fixed = relevant.filter(rule => Number.isSafeInteger(rule.slotCount) && rule.slotCount > 0);
  const alternate = relevant.find(rule => rule.alternateReserve);
  const placements = fixed.length ? fixed.flatMap(rule => Array.from({ length: rule.slotCount }, () =>
    ({ slotKind: rule.slotKind, exOfficio: !!rule.requiredPosition }))) :
    Array.from({ length: count }, (_, index) => ({ slotKind: alternate && index % 2 === 0 ? alternate.slotKind : "open" }));
  return placements.map((slot, index) => {
    const id = `${context.positionId}:${index + 1}`;
    const restriction = relevant.find(rule => rule.slotKind === slot.slotKind && rule.exception);
    const released = !!restriction && gpmRoleRuleException(restriction, { ...context, slotId: id });
    return { ...slot, id, released };
  });
}

function gpmRoleSlate(context, candidates, count) {
  const used = new Set();
  const slots = gpmRoleSlots(context, count);
  const open = slot => slot.slotKind === "open" || slot.released;
  const available = slots.map((slot, index) => ({ ...slot, index })).sort((a, b) =>
    Number(!!b.exOfficio) - Number(!!a.exOfficio) || Number(open(a)) - Number(open(b)) || a.index - b.index);
  const result = [];
  for (const slot of available) {
    const candidate = candidates.find(({ person, age, nativeAllowed, memberStatus, heldPositions, attestations }) =>
      !used.has(person.id) && gpmResolveRoleEligibility({ ...context, person, age, nativeAllowed,
        memberStatus, heldPositions, attestations, slotId: slot.id, slotKind: slot.slotKind }).eligible);
    if (candidate) used.add(candidate.person.id);
    result[slot.index] = { id: slot.id, kind: open(slot) ? "open" : slot.slotKind, personId: candidate?.person.id ?? null };
  }
  return result;
}

function gpmPartyRoleBinding(country, party) {
  const charter = party?.gpmCharter;
  const jurisdictionKey = String(country.key);
  if (charter?.roleOrganizationId && charter?.roleAuthorityId) {
    return { organizationId: charter.roleOrganizationId, authorityId: charter.roleAuthorityId, jurisdictionKey };
  }
  if (jurisdictionKey === "276" && party?.id === "GRU" && !party.nameDesc?.gpmFounded) {
    return { organizationId: "bundnis-90-die-grunen", authorityId: "german-greens-charter", jurisdictionKey };
  }
  return { organizationId: party?.id, authorityId: "party-charter", jurisdictionKey };
}

function gpmPartyRoleRules(country, party) {
  const binding = gpmPartyRoleBinding(country, party);
  const authored = Array.isArray(party?.gpmCharter?.roleRules) ? party.gpmCharter.roleRules : [];
  return [...gpmSourcedRoleRules.filter(rule => rule.organizationId === binding.organizationId &&
    rule.authorityId === binding.authorityId && rule.jurisdictionKey === binding.jurisdictionKey), ...authored];
}

function gpmPartyRolePolicyView(sim, country, party) {
  const date = sim.date?.toISOString?.().slice(0, 10);
  const rules = gpmPartyRoleRules(country, party).filter(rule => gpmRoleDateInEffect(rule, date));
  const historicalObservations = gpmSourcedRoleRules.filter(rule => rule.jurisdictionKey === String(country.key) && rule.kind === "observedRoster")
    .map(rule => ({ ...gpmRoleRuleSummary(rule), role: rule.role, positionId: rule.positionId,
      appliesOnDate: gpmRoleDateInEffect(rule, date), authorityId: rule.authorityId }));
  return { date, ...gpmPartyRoleBinding(country, party), historicalObservations, roles: gpmPartyRoles.map(role => {
    const evidence = rules.filter(rule => rule.role === role).map(rule => ({ ...gpmRoleRuleSummary(rule), positionId: rule.positionId }));
    return { role, confidence: evidence.length ? "sourced" : "ordinary_eligibility", evidence };
  }) };
}

module.exports = { gpmPartyRoles, gpmSourcedRoleRules, gpmResolveRoleEligibility, gpmRoleSlots, gpmRoleSlate, workerFunctions: [
  `const gpmPartyRoles = Object.freeze(${JSON.stringify(gpmPartyRoles)});`,
  `const gpmSourcedRoleRules = Object.freeze(${JSON.stringify(gpmSourcedRoleRules)});`,
  gpmRoleDateInEffect, gpmRoleRuleApplies, gpmRoleRuleException, gpmRoleRuleFailure, gpmRoleRuleSummary,
  gpmResolveRoleEligibility, gpmPartyRoleBinding, gpmPartyRoleRules, gpmPartyRolePolicyView,
] };
