// "AI provider" interface for plain-words scripts.
// Today the default provider is the offline rule-based translator (free, no keys).
// To plug in a real model later, implement { name, translate(text, context) }
// returning { program, preview, unknown } and call setScriptTranslator().
// The model's JSON program is ALWAYS passed through validateProgram(), so it
// can only use the same safe, sandboxed actions (no arbitrary code).
import { translate as ruleTranslate, validateProgram, describe } from './nlscript.js';

export const LocalRuleTranslator = {
  name: 'Offline rules (free)',
  async translate(text) { return ruleTranslate(text); },
  translateSync(text) { return ruleTranslate(text); },
};

// Example skeleton for a future model-backed provider (not enabled):
// export const RemoteModelTranslator = {
//   name: 'AI model',
//   async translate(text, context) {
//     const res = await fetch('/api/script-translate', { method: 'POST', body: JSON.stringify({ text, context }) });
//     const { program } = await res.json();
//     const safe = validateProgram(program);
//     return { program: safe, preview: describe(safe), unknown: [] };
//   },
// };

let current = LocalRuleTranslator;
export const getScriptTranslator = () => current;
export function setScriptTranslator(provider) { if (provider?.translate) current = provider; }
export { validateProgram, describe };
