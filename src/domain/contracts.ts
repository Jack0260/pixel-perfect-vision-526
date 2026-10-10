import type { Artifact, Contract, FrameworkId, Org, Region } from "./types";

export const REGIONS: Region[] = ["eu-central", "eu-north", "us-east", "us-west", "ap-south"];
export const ARTIFACTS: Artifact[] = ["gradients", "metrics", "model", "raw", "pii", "phi"];
export const AGGREGATOR_REGION: Region = "eu-north";

export const ORGS: Org[] = [
  { id: "helios-berlin", name: "Helios Klinikum", city: "Berlin", region: "eu-central", framework: "GDPR", samples: 1400, featureShift: [0.4, -0.2, 0.1, 0.0] },
  { id: "lakeside-boston", name: "Lakeside Clinic", city: "Boston", region: "us-east", framework: "HIPAA", samples: 1000, featureShift: [-0.1, 0.5, -0.3, 0.3] },
  { id: "arogya-pune", name: "Arogya Diagnostics", city: "Pune", region: "ap-south", framework: "DPDP", samples: 1800, featureShift: [-0.5, 0.0, 0.4, -0.2] },
];

export const orgById = (id: string) => ORGS.find((o) => o.id === id);

export function defaultContract(org: Org): Contract {
  const base = {
    schema: "sovereign.contract/v1" as const,
    version: 1,
    orgId: org.id,
    framework: org.framework,
    allowedExports: ["gradients", "metrics"] as Artifact[],
    allowedAggregatorRegions: ["eu-north", "eu-central", "us-east"] as Region[],
    minAggregationSize: 2,
  };
  const byFramework: Record<FrameworkId, Contract> = {
    GDPR: { ...base, dataResidency: ["eu-central", "eu-north"], forbiddenExports: ["raw", "pii"], allowedComputeRegions: ["eu-central", "eu-north"], dpEpsilon: 6, retentionDays: 365, inferenceLocation: "on-prem" },
    HIPAA: { ...base, dataResidency: ["us-east", "us-west"], forbiddenExports: ["raw", "phi"], allowedComputeRegions: ["us-east", "us-west"], dpEpsilon: 8, minAggregationSize: 3, retentionDays: 2190, inferenceLocation: "on-prem" },
    DPDP: { ...base, dataResidency: ["ap-south"], forbiddenExports: ["raw", "pii"], allowedComputeRegions: ["ap-south"], dpEpsilon: 4, retentionDays: 180, inferenceLocation: "on-prem", allowedAggregatorRegions: ["eu-north", "ap-south"] },
  };
  return byFramework[org.framework];
}

export type Action =
  | { kind: "export"; artifact: Artifact; destRegion: Region }
  | { kind: "compute"; region: Region }
  | { kind: "inference"; location: "on-prem" | "cloud" };

export interface Decision {
  allowed: boolean;
  reasons: string[];
}

/** Policy decision point. Deny-by-default; every denial carries a reason. */
export function evaluateAction(c: Contract, a: Action): Decision {
  const reasons: string[] = [];
  if (a.kind === "export") {
    if (c.forbiddenExports.includes(a.artifact)) reasons.push(`"${a.artifact}" is explicitly forbidden`);
    else if (!c.allowedExports.includes(a.artifact)) reasons.push(`"${a.artifact}" is not in allowedExports`);
    if (!c.allowedAggregatorRegions.includes(a.destRegion)) reasons.push(`aggregator region ${a.destRegion} not permitted`);
  } else if (a.kind === "compute") {
    if (!c.allowedComputeRegions.includes(a.region)) reasons.push(`compute in ${a.region} not permitted`);
  } else if (c.inferenceLocation === "on-prem" && a.location === "cloud") {
    reasons.push("contract requires on-prem inference");
  }
  return { allowed: reasons.length === 0, reasons };
}

/** Structural validation for edited contract JSON. */
export function validateContract(raw: unknown, orgId: string): { contract?: Contract; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { errors: ["Contract must be a JSON object"] };
  const c = raw as Partial<Contract>;
  if (c.schema !== "sovereign.contract/v1") errors.push('schema must be "sovereign.contract/v1"');
  if (c.orgId !== orgId) errors.push("orgId cannot be changed");
  const regionList = (k: keyof Contract) => {
    const v = c[k];
    if (!Array.isArray(v) || !v.every((r) => REGIONS.includes(r as Region))) errors.push(`${k} must list known regions`);
  };
  regionList("dataResidency");
  regionList("allowedAggregatorRegions");
  regionList("allowedComputeRegions");
  for (const k of ["allowedExports", "forbiddenExports"] as const) {
    const v = c[k];
    if (!Array.isArray(v) || !v.every((a) => ARTIFACTS.includes(a as Artifact))) errors.push(`${k} must list known artifacts`);
  }
  if (Array.isArray(c.allowedExports) && c.allowedExports.some((a) => a === "raw")) errors.push("raw data can never be exported");
  if (typeof c.dpEpsilon !== "number" || c.dpEpsilon <= 0 || c.dpEpsilon > 20) errors.push("dpEpsilon must be in (0, 20]");
  if (typeof c.minAggregationSize !== "number" || c.minAggregationSize < 1) errors.push("minAggregationSize must be >= 1");
  if (typeof c.retentionDays !== "number" || c.retentionDays < 1) errors.push("retentionDays must be >= 1");
  if (c.inferenceLocation !== "on-prem" && c.inferenceLocation !== "cloud") errors.push('inferenceLocation must be "on-prem" or "cloud"');
  return errors.length ? { errors } : { contract: c as Contract, errors };
}
