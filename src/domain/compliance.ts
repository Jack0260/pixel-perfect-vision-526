import type { AuditEntry, Contract, FrameworkId } from "./types";

export interface Requirement {
  id: string;
  citation: string;
  requirement: string;
  pass: boolean;
  evidence: string;
}

/** Regulatory bridge: maps a sovereignty contract onto framework controls. Not legal advice. */
export function assess(c: Contract, audit: AuditEntry[]): Requirement[] {
  const auditOk = audit.length > 0;
  const common: Requirement[] = [
    { id: "raw", citation: "Data minimisation", requirement: "Raw records never leave the org", pass: c.forbiddenExports.includes("raw") && !c.allowedExports.includes("raw"), evidence: `forbiddenExports = [${c.forbiddenExports.join(", ")}]` },
    { id: "audit", citation: "Accountability", requirement: "Tamper-evident audit trail exists", pass: auditOk, evidence: `${audit.length} hash-chained entries` },
  ];
  const by: Record<FrameworkId, Requirement[]> = {
    GDPR: [
      { id: "gdpr-44", citation: "GDPR Art. 44-49", requirement: "Personal data resides in the EU/EEA", pass: c.dataResidency.every((r) => r.startsWith("eu-")), evidence: `dataResidency = [${c.dataResidency.join(", ")}]` },
      { id: "gdpr-5e", citation: "GDPR Art. 5(1)(e)", requirement: "Storage limited to 365 days or less", pass: c.retentionDays <= 365, evidence: `retentionDays = ${c.retentionDays}` },
      { id: "gdpr-25", citation: "GDPR Art. 25", requirement: "Privacy by design: differential privacy epsilon of 8 or less", pass: c.dpEpsilon <= 8, evidence: `dpEpsilon = ${c.dpEpsilon}` },
    ],
    HIPAA: [
      { id: "hipaa-514", citation: "45 CFR 164.514", requirement: "PHI is never exported", pass: c.forbiddenExports.includes("phi"), evidence: `forbiddenExports = [${c.forbiddenExports.join(", ")}]` },
      { id: "hipaa-agg", citation: "45 CFR 164.514(b)", requirement: "At least 3 contributors per aggregate", pass: c.minAggregationSize >= 3, evidence: `minAggregationSize = ${c.minAggregationSize}` },
      { id: "hipaa-312", citation: "45 CFR 164.312(e)", requirement: "Inference stays on-prem", pass: c.inferenceLocation === "on-prem", evidence: `inferenceLocation = ${c.inferenceLocation}` },
    ],
    DPDP: [
      { id: "dpdp-16", citation: "DPDP Act 2023 s.16", requirement: "Data resides in India", pass: c.dataResidency.every((r) => r === "ap-south"), evidence: `dataResidency = [${c.dataResidency.join(", ")}]` },
      { id: "dpdp-87", citation: "DPDP Act 2023 s.8(7)", requirement: "Erased once the purpose is served (180 days or less)", pass: c.retentionDays <= 180, evidence: `retentionDays = ${c.retentionDays}` },
      { id: "dpdp-dp", citation: "DPDP Act 2023 s.8(5)", requirement: "Reasonable safeguards: epsilon of 4 or less", pass: c.dpEpsilon <= 4, evidence: `dpEpsilon = ${c.dpEpsilon}` },
    ],
  };
  return [...by[c.framework], ...common];
}
