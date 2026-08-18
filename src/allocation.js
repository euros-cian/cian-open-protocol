// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
const PPM = 1_000_000n;

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`${name} must be a safe integer >= ${minimum}`);
  return BigInt(value);
}

export function recognisedCapacity(commitment) {
  let result = integer(commitment.nominal_capacity, "nominal_capacity", 1);
  for (const field of ["assurance_ppm", "availability_ppm", "reserve_ppm"]) {
    const factor = integer(commitment[field], field);
    if (factor > PPM) throw new RangeError(`${field} must not exceed 1000000`);
    result = (result * factor) / PPM;
  }
  return Number(result);
}

export function epochBudget(commitments, computeUnitsPerEntitlement = 1) {
  const denominator = integer(computeUnitsPerEntitlement, "computeUnitsPerEntitlement", 1);
  const capacity = commitments.reduce((sum, item) => sum + BigInt(recognisedCapacity(item)), 0n);
  return Number(capacity / denominator);
}

export function allocateProRata(proofs, budget) {
  integer(budget, "budget");
  const eligible = proofs.map((proof, index) => ({ ...proof, index, weight: Number(integer(proof.weight, "weight", 1)) }));
  const totalWeight = eligible.reduce((sum, proof) => sum + BigInt(proof.weight), 0n);
  if (totalWeight === 0n || budget === 0) return eligible.map(({ proof_id, recipient_agent_id }) => ({ proof_id, recipient_agent_id, amount: 0 }));

  const rows = eligible.map(proof => {
    const numerator = BigInt(budget) * BigInt(proof.weight);
    return { ...proof, amount: Number(numerator / totalWeight), remainder: numerator % totalWeight };
  });
  let remaining = budget - rows.reduce((sum, row) => sum + row.amount, 0);
  rows.sort((a, b) => a.remainder === b.remainder ? a.proof_id.localeCompare(b.proof_id) : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < remaining; i += 1) rows[i].amount += 1;
  rows.sort((a, b) => a.index - b.index);
  return rows.map(({ proof_id, recipient_agent_id, amount }) => ({ proof_id, recipient_agent_id, amount }));
}
