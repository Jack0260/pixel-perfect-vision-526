import { describe, expect, it } from "vitest";
import { ORGS, defaultContract, evaluateAction, validateContract } from "@/domain/contracts";
import { generateProof, verifyProof } from "@/domain/crypto";
import { scheduleCompute, DEFAULT_OFFERS } from "@/domain/economics";
import { zeroWeights } from "@/domain/federation";

const org = ORGS[0]!;

describe("proof layer", () => {
  it("rejects an update whose norm exceeds the bound", async () => {
    const pre = zeroWeights();
    const post = [8, 0, 0, 0, 0];
    const proof = await generateProof({ orgId: org.id, round: 1, dataRoot: "r", pre, post });
    const checks = await verifyProof(proof, pre, post, 1.25);
    expect(checks.every((c) => c.ok)).toBe(false);
  });
  it("rejects weights that differ from the committed hash", async () => {
    const pre = zeroWeights();
    const proof = await generateProof({ orgId: org.id, round: 1, dataRoot: "r", pre, post: [0.1, 0, 0, 0, 0] });
    const checks = await verifyProof(proof, pre, [0.2, 0, 0, 0, 0], 1.25);
    expect(checks[0]!.ok).toBe(false);
  });
});

describe("data contracts", () => {
  it("denies raw data export", () => {
    expect(evaluateAction(defaultContract(org), { kind: "export", artifact: "raw", destRegion: "eu-north" }).allowed).toBe(false);
  });
  it("rejects a contract that allows raw export", () => {
    const c = { ...defaultContract(org), allowedExports: ["gradients", "raw"] };
    expect(validateContract(c, org.id).contract).toBeUndefined();
  });
  it("only schedules compute inside allowed regions", () => {
    const s = scheduleCompute(DEFAULT_OFFERS, ["ap-south"], "ap-south", "carbon", 1);
    expect(s?.pick.o.region).toBe("ap-south");
  });
});
