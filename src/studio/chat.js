// Studio corner-chat engine. Offline by default (free, no keys, no network).
// To plug in a paid provider later, implement { name, reply(text, context) }
// returning the same shape as handleChat(), then call setChatProvider().
//
// TODO: Later, players will pay for a paid AI provider with Birg Bucks
// (not real money). Do not enable a paid API or sign up for anything here.
import { classifyIntent, EXAMPLE_PHRASES } from './chatIntent.js';
import { planBuild, applyBuild } from './builder.js';
import { translate } from './nlscript.js';
import { checkScript } from './scriptCheck.js';

export const LocalChatProvider = {
  name: 'Offline rules (free)',
  async reply(text, context = {}) { return handleChat(text, context); },
  replySync(text, context = {}) { return handleChat(text, context); },
};

// Example skeleton for a future Birg-Bucks-paid provider (not enabled):
// export const RemoteChatProvider = {
//   name: 'Paid AI',
//   async reply(text, context) {
//     const res = await fetch('/api/studio-chat', { method: 'POST', body: JSON.stringify({ text, context }) });
//     return res.json();
//   },
// };

let current = LocalChatProvider;
export const getChatProvider = () => current;
export function setChatProvider(provider) { if (provider?.reply) current = provider; }

function partNames(ctx) {
  return (ctx.names && ctx.names.length ? ctx.names : (ctx.doc?.instances || []).map((i) => i.name).filter(Boolean));
}

function findTarget(ed, intent, ctx) {
  const instances = ctx.doc?.instances || ed?.doc?.instances || [];
  const selId = ed?.selectedId || (ed?.selection || ctx.selection || []).slice(-1)[0];
  const sel = selId ? instances.find((i) => i.id === selId) : null;
  const t = intent.target || {};
  if (t.name) {
    const hit = instances.find((i) => i.name && i.name.toLowerCase() === t.name.toLowerCase());
    if (hit) return hit;
  }
  if (t.color) {
    const colorHits = instances.filter((i) => (i.color || '').toLowerCase() === t.color.toLowerCase() && i.type !== 'group');
    if (colorHits.length === 1) return colorHits[0];
    if (colorHits.length > 1 && sel && colorHits.some((i) => i.id === sel.id)) return sel;
    if (colorHits.length > 1) return colorHits[0];
  }
  if (sel && sel.type !== 'group') return sel;
  if (sel && sel.type === 'group') {
    const child = instances.find((i) => i.parent === sel.id && i.type !== 'group');
    if (child) return child;
  }
  return null;
}

function scriptTextFor(intent) {
  const text = intent.text || '';
  const t = text.trim();
  // "make the red part kill players" → a phrase the translator already knows
  const m = t.match(/\bmake\s+(?:the\s+|this\s+|my\s+)?.+?\s+(kill[s]?(?:\s+\w+)*)\b/i);
  if (/\bkill\b/i.test(t) && !/\bwhen\b/i.test(t)) return 'When touched, kill them';
  if (/\b(this is|when |whenever |spin|teleport|give |heal|hurt|bounce|checkpoint)\b/i.test(t)) return t;
  if (m) return t;
  return t;
}

function describeScript(translation) {
  const preview = (translation.preview || []).filter(Boolean);
  if (preview.length) return preview.join(' ');
  const n = (translation.program?.rules || []).length;
  const c = (translation.program?.continuous || []).length;
  if (n || c) return `a script with ${n} rule${n === 1 ? '' : 's'}${c ? ` and ${c} motion${c === 1 ? '' : 's'}` : ''}`;
  return 'a script';
}

function unknownReply(intent) {
  const examples = (intent.suggestions || EXAMPLE_PHRASES).slice(0, 3);
  return {
    kind: 'unknown',
    role: 'assistant',
    text: `I didn't understand that. I'm the offline helper — I can script parts, build simple things, check a script, or add on-screen GUI. Try: ${examples.map((e) => `"${e}"`).join(', ')}.`,
    suggestions: examples,
    applied: false,
  };
}

/**
 * Pure reply (no editor mutation). `applyChat()` performs the edit.
 * context: { doc, names, selection, origin }
 */
export function handleChat(text, ctx = {}) {
  const names = partNames(ctx);
  const intent = classifyIntent(text, { names });

  if (intent.kind === 'unknown') return unknownReply(intent);

  if (intent.kind === 'help') {
    return { kind: 'help', role: 'assistant', intent, text: '', applied: false, needsApply: true };
  }

  if (intent.kind === 'build') {
    const plan = planBuild(intent, { origin: ctx.origin || [0, 0, 0] });
    if (!plan.ok) return unknownReply({ suggestions: EXAMPLE_PHRASES.slice(0, 3) });
    return {
      kind: 'build',
      role: 'assistant',
      intent,
      plan,
      text: `Built ${plan.summary}. That's one undo if you want it gone.`,
      applied: false,
      needsApply: true,
    };
  }

  if (intent.kind === 'script') {
    const translation = intent.translation || translate(scriptTextFor(intent), { names });
    const has = (translation.program?.rules || []).length + (translation.program?.continuous || []).length > 0;
    if (!has) return unknownReply({ suggestions: translation.suggestions || EXAMPLE_PHRASES.slice(0, 3) });
    return {
      kind: 'script',
      role: 'assistant',
      intent: { ...intent, translation },
      scriptText: scriptTextFor(intent),
      translation,
      text: `I'll apply ${describeScript(translation)} to the selected or named part.`,
      applied: false,
      needsApply: true,
    };
  }

  if (intent.kind === 'gui') {
    return {
      kind: 'gui',
      role: 'assistant',
      intent,
      text: intent.togglesPanel
        ? `I'll add a "${intent.text}" button and a panel it can open.`
        : `I'll add a ${intent.type === 'bar' ? intent.text + ' bar' : intent.type}${intent.anchor ? ` at the ${intent.anchor.replace('-', ' ')}` : ''}.`,
      applied: false,
      needsApply: true,
    };
  }

  if (intent.kind === 'setting') {
    const word = intent.value === 'toggle' ? 'toggle first-person camera' : intent.value ? 'turn on first-person camera' : 'turn off first-person camera';
    return {
      kind: 'setting',
      role: 'assistant',
      intent,
      text: `I'll ${word} for this game.`,
      applied: false,
      needsApply: true,
    };
  }

  return unknownReply(intent);
}

function helpReply(ed, ctx) {
  const instances = ed?.doc?.instances || ctx.doc?.instances || [];
  const names = instances.map((i) => i.name).filter(Boolean);
  const selId = ed?.selectedId || (ed?.selection || ctx.selection || []).slice(-1)[0];
  const targets = [];
  if (selId) {
    const inst = instances.find((i) => i.id === selId);
    if (inst?.type === 'group') targets.push(...instances.filter((i) => i.parent === inst.id && (i.scripts || []).length));
    else if (inst) targets.push(inst);
  }
  if (!targets.length) {
    // fall back to parts whose script or name mentions door, or any scripted part
    const doors = instances.filter((i) => /door/i.test(i.name || '') || (i.scripts || []).some((s) => /door/i.test(s.text || '')));
    targets.push(...(doors.length ? doors : instances.filter((i) => (i.scripts || []).length)));
  }
  if (!targets.length) {
    return { kind: 'help', role: 'assistant', applied: false, text: "Select a part first, then ask me to check it. You can also say \"my door doesn't work\" after selecting the door." };
  }
  const placeScripts = instances.flatMap((i) => (i.scripts || []).map((s) => ({ text: s.text, program: s.program, label: `${i.name} · ${s.name || 'Script'}` })));
  const lines = [];
  for (const inst of targets) {
    const scripts = inst.scripts || [];
    if (!scripts.length) {
      lines.push(`${inst.name} has no script yet. Try: "when the button is pressed, open the door called Gate".`);
      continue;
    }
    for (const s of scripts) {
      const r = s.program ? { program: s.program, unknown: [], suggestions: [] } : translate(s.text || '', { names });
      const issues = checkScript({
        text: s.text || '',
        program: r.program || s.program,
        unknown: r.unknown || [],
        suggestions: r.suggestions || [],
        names,
        placeScripts,
      });
      if (!issues.length) lines.push(`${inst.name}: "${s.text}" looks ready to test.`);
      else {
        for (const iss of issues) {
          lines.push(`${inst.name}: ${iss.message}${iss.suggestion ? ` ${iss.suggestion}` : ''}`);
        }
      }
    }
  }
  return { kind: 'help', role: 'assistant', applied: false, text: lines.slice(0, 6).join(' ') };
}

function applyScript(ed, result, ctx) {
  const inst = findTarget(ed, result.intent, ctx);
  if (!inst) {
    return {
      ...result,
      applied: false,
      text: 'I understood the script, but I need a part to put it on. Select a part (or name it, like "make the red part kill players") and try again.',
    };
  }
  const text = result.scriptText || result.intent.text;
  const sid = ed.addScript(inst.id, text);
  if (!sid) {
    return { ...result, applied: false, text: `I couldn't add a script to ${inst.name}.` };
  }
  const translation = result.translation || translate(text, { names: partNames({ doc: ed.doc }) });
  const extra = (translation.unknown || []).length
    ? ` I wasn't sure about ${translation.unknown.map((u) => `"${u}"`).join(', ')}.`
    : '';
  return {
    ...result,
    applied: true,
    targetId: inst.id,
    scriptId: sid,
    text: `Applied to ${inst.name}: ${describeScript(translation)}.${extra}`,
  };
}

/**
 * Apply a handleChat() result to the editor (mutations + one undo step per action).
 */
export function applyChat(ed, result, ctx = {}) {
  if (!result || !ed) return result;
  if (result.kind === 'help') return helpReply(ed, { ...ctx, doc: ed.doc });
  if (result.kind === 'build') {
    const origin = (typeof ed.placementPoint === 'function' ? ed.placementPoint([1, 1, 1]) : ctx.origin) || [0, 0, 0];
    const plan = planBuild(result.intent, { origin });
    const out = applyBuild(ed, plan);
    return {
      ...result,
      plan,
      applied: !!out.ok,
      ids: out.ids,
      groupId: out.groupId,
      text: out.ok ? `Built ${plan.summary}. That's one undo if you want it gone.` : 'I planned the build but could not add the parts.',
    };
  }
  if (result.kind === 'script') return applyScript(ed, result, { ...ctx, doc: ed.doc });
  if (result.kind === 'gui') {
    if (typeof ed.addGui === 'function') {
      const made = ed.addGui(result.intent);
      const n = made?.ids?.length || (made?.id ? 1 : 0);
      return {
        ...result,
        applied: n > 0,
        guiIds: made?.ids || (made?.id ? [made.id] : []),
        text: n ? `${result.text.replace(/^I'll add/, 'Added')}` : 'I could not add that GUI element.',
      };
    }
    return { ...result, applied: false, text: 'The GUI builder is not available in this editor yet.' };
  }
  if (result.kind === 'setting' && result.intent.setting === 'firstPerson') {
    if (typeof ed.setGameProp === 'function') ed.setGameProp('firstPerson', result.intent.value);
    else {
      ed.checkpoint?.();
      const cur = !!ed.doc.firstPerson;
      ed.doc.firstPerson = result.intent.value === 'toggle' ? !cur : !!result.intent.value;
    }
    const on = !!ed.doc.firstPerson;
    return { ...result, applied: true, text: on ? 'First-person camera is on for this game. Players will see through their eyes in Test and Play.' : 'First-person camera is off. Players use the usual third-person camera.' };
  }
  return result;
}

/** Classify + apply in one step. */
export async function sendChat(text, ed, ctx = {}) {
  const origin = (typeof ed?.placementPoint === 'function' ? ed.placementPoint([1, 1, 1]) : ctx.origin) || [0, 0, 0];
  const result = await getChatProvider().reply(text, { ...ctx, doc: ed?.doc, origin, names: partNames({ doc: ed?.doc, names: ctx.names }) });
  if (result.needsApply && ed) return applyChat(ed, result, ctx);
  return result;
}

export { findTarget, scriptTextFor, EXAMPLE_PHRASES };
