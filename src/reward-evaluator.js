// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

const STATES = [
  { id: "welsh_use", weight: 1 },
  { id: "supported_continuation", weight: 2 },
  { id: "useful_task_completed", weight: 3 },
  { id: "language_gain", weight: 4 }
];

export function evaluateRewardState({ qualifies, supportedContinuation = false, usefulTaskCompleted = false, languageGain = false }) {
  if (!qualifies) return { id: "not_qualified", weight: 0 };
  if (languageGain) return STATES[3];
  if (usefulTaskCompleted) return STATES[2];
  if (supportedContinuation) return STATES[1];
  return STATES[0];
}

export function highestRewardState(states) {
  if (!Array.isArray(states) || states.length === 0) return { id: "not_qualified", weight: 0 };
  return states.reduce((highest, state) => state.weight > highest.weight ? state : highest, { id: "not_qualified", weight: 0 });
}
