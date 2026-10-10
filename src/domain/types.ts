export type FrameworkId = "GDPR" | "HIPAA" | "DPDP";
export type Region = "eu-central" | "eu-north" | "us-east" | "us-west" | "ap-south";
export type Artifact = "gradients" | "metrics" | "model" | "raw" | "pii" | "phi";
export type Weights = number[];

export interface Org {
  id: string;
  name: string;
  city: string;
  region: Region;
  framework: FrameworkId;
  samples: number;
  featureShift: number[];
}

/** Sovereignty contract v1: the JSON each org signs before joining the grid. */
export interface Contract {
  schema: "sovereign.contract/v1";
  version: number;
  orgId: string;
  framework: FrameworkId;
  dataResidency: Region[];
  allowedExports: Artifact[];
  forbiddenExports: Artifact[];
  allowedAggregatorRegions: Region[];
  allowedComputeRegions: Region[];
  dpEpsilon: number;
  minAggregationSize: number;
  retentionDays: number;
  inferenceLocation: "on-prem" | "cloud";
}

export interface Offer {
  id: string;
  provider: string;
  region: Region;
  chip: string;
  pricePerHr: number;
  kw: number;
  gco2PerKwh: number;
  seller?: string;
}

export interface ProofCheck {
  name: string;
  ok: boolean;
}

export interface TrainingProof {
  orgId: string;
  round: number;
  dataRoot: string;
  preHash: string;
  postHash: string;
  deltaNorm: number;
  nonce: string;
  enclaveQuote: string;
  commitment: string;
}

export interface ProofRecord extends TrainingProof {
  checks: ProofCheck[];
  accepted: boolean;
}

export interface AuditEntry {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export interface ModelVersion {
  version: string;
  round: number;
  weights: Weights;
  weightsHash: string;
  parentHash: string | null;
  proofsRoot: string;
  signature: string;
  accuracy: number;
  contributors: string[];
  createdAt: string;
}

export interface LedgerEntry {
  round: number;
  orgId: string;
  offerId: string;
  gpuHours: number;
  samples: number;
  cost: number;
  baselineCost: number;
  carbonG: number;
  baselineCarbonG: number;
}

export interface RoundSummary {
  round: number;
  accuracy: number;
  loss: number;
  perOrg: Record<string, number>;
  accepted: string[];
  rejected: string[];
  blocked: string[];
  aggregated: boolean;
}

export interface PendingChange {
  id: string;
  orgId: string;
  proposed: Contract;
  approvals: string[];
  status: "pending" | "applied" | "rejected";
  createdAt: string;
}
