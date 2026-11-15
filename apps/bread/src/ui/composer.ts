/**
 * The composer: one field that grows with what you write. Under it, what the app is hearing,
 * as chips: a reader who means something else picks another topic before asking, or after.
 */

import { hearTopics } from "../search/needProfile.ts";
import { topics } from "../search/topics.ts";
import { el, icon, iconButton, prefersStillness } from "./dom.ts";

/** "Anxiety / Worry / Fear" reads as "Anxiety" on a chip. */
export const topicName = (key: string): string => topics[key]?.label.split(" / ")[0] ?? key;

// What people actually say, cycled through the empty field.
const EXAMPLES = [
  "I'm anxious about my job interview tomorrow",
  "My dad died last month and I can't stop crying",
  "I keep losing my temper with my kids",
  "I can't forgive my brother for what he said",
  "I feel invisible at my new church",
  "We just found out about the diagnosis",
  "I don't know whether to take the new job",
  "I'm so tired of fighting the same temptation",
  "We can't make rent this month",
];

const STARTERS = ["I'm anxious about", "I'm grieving", "I can't forgive", "I feel alone since", "I need wisdom about", "I'm thankful for"];

const MAX_LENGTH = 500;

export interface ComposerHandle {
  element: HTMLElement;
  value: () => string;
  steer: () => string | undefined;
  /** `fromNeed`: picked from the list of needs, so words pointing elsewhere take over. */
  set: (text: string, steer?: string, fromNeed?: boolean) => void;
  focus: () => void;
  setBusy: (busy: boolean) => void;
}

export const createComposer = (
  onSubmit: (text: string, steer: string | undefined) => void,
  /** The reader changed the topic with a chip. */
  onSteer: (steer: string | undefined) => void = () => {},
): ComposerHandle => {
  let steered: string | undefined;
  // A need picked from the list is a starting point; a chip picked after writing is a decision.
  let steeredFromNeed = false;

  const form = el("form", "composer");
  form.setAttribute("role", "search");
  form.noValidate = true;

  const label = el("label", "composer__label", form);
  label.htmlFor = "need";
  label.textContent = "What are you carrying today?";

  const box = el("div", "composer__box", form);
  const field = el("textarea", "composer__field", box);
  field.id = "need";
  field.rows = 1;
  field.maxLength = MAX_LENGTH;
  field.enterKeyHint = "send";
  field.autocomplete = "off";
  field.spellcheck = true;
  field.setAttribute("aria-describedby", "need-hint");

  // A placeholder that changes: its own element, so it can fade between examples.
  const ghost = el("div", "composer__ghost", box);
  ghost.setAttribute("aria-hidden", "true");

  const clear = iconButton("x", "Clear", "composer__clear", true);
  const send = el("button", "composer__send", box);
  send.type = "submit";
  send.setAttribute("aria-label", "Find verses");
  send.append(icon("arrowUp"));
  box.append(clear, send);

  const hearing = el("div", "composer__hearing", form);
  hearing.setAttribute("aria-live", "polite");

  const hint = el("p", "composer__hint", form);
  hint.id = "need-hint";
  hint.innerHTML = "<kbd>Enter</kbd> to find verses · <kbd>Shift</kbd> <kbd>Enter</kbd> for a new line";

  const starters = el("div", "composer__starters", form);
  for (const starter of STARTERS) {
    const chip = el("button", "starter", starters);
    chip.type = "button";
    chip.textContent = `${starter}…`;
    chip.addEventListener("click", () => {
      field.value = `${starter} `;
      update();
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  // ─── Behaviour ────────────────────────────────────────────────

  const grow = () => {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };

  let example = 0;
  // With a need already picked, the field invites words about that need instead of examples.
  const showExample = () => {
    ghost.textContent = steered
      ? `Add a few words about ${topicName(steered).toLowerCase()}, or send as it is`
      : EXAMPLES[example % EXAMPLES.length]!;
  };
  showExample();
  // Cycles only while the field is empty and the page in view, and never with reduced motion.
  window.setInterval(() => {
    if (field.value || steered || document.hidden || prefersStillness()) return;
    ghost.classList.add("composer__ghost--out");
    window.setTimeout(() => {
      example++;
      showExample();
      ghost.classList.remove("composer__ghost--out");
    }, 260);
  }, 4200);

  const chip = (topic: string, kind: "heard" | "steered") => {
    const button = el("button", `topic-chip topic-chip--${kind}`, hearing);
    button.type = "button";
    button.setAttribute("aria-pressed", String(kind === "steered"));
    if (kind === "steered") button.append(icon("check"));
    button.append(topicName(topic));
    if (kind === "steered") button.append(icon("x", "icon icon--end"));
    button.title = kind === "steered" ? "Let the words decide again" : `Ask about ${topicName(topic).toLowerCase()}`;
    button.addEventListener("click", () => {
      steered = kind === "steered" ? undefined : topic;
      steeredFromNeed = false;
      update();
      renderHearing();
      onSteer(steered);
    });
  };

  const renderHearing = () => {
    hearing.replaceChildren();
    const text = field.value.trim();
    const heard = text ? hearTopics(text).slice(0, 3) : [];
    // Words that clearly mean something else outrank a need picked from the list.
    if (steered && steeredFromNeed && heard.length && !heard.includes(steered)) {
      steered = undefined;
      steeredFromNeed = false;
      showExample();
    }
    // A need with no words is shown by the list of needs and the field's invitation.
    if (!text) return;
    el("span", "composer__hearing-label", hearing).textContent = heard.length || steered ? "Hearing" : "Listening…";
    const lead = steered ?? heard[0];
    if (lead) chip(lead, steered ? "steered" : "heard");
    for (const topic of heard) if (topic !== lead) chip(topic, "heard");
    if (!lead) el("span", "composer__hearing-note", hearing).textContent = "say a little more, or pick a need below";
  };

  let hearTimer = 0;
  const update = () => {
    grow();
    showExample();
    const filled = field.value.trim().length > 0;
    box.classList.toggle("composer__box--filled", filled || field.value.length > 0);
    send.disabled = !filled && !steered;
    clearTimeout(hearTimer);
    hearTimer = window.setTimeout(renderHearing, 90);
  };

  field.addEventListener("input", update);
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
    if (event.key === "Escape") field.blur();
  });
  clear.addEventListener("click", () => {
    field.value = "";
    steered = undefined;
    steeredFromNeed = false;
    update();
    renderHearing();
    field.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = field.value.trim().slice(0, MAX_LENGTH);
    if (!text && !steered) return field.focus();
    onSubmit(text, steered);
  });

  // "/" from anywhere on the page goes to the composer, as in most search-led apps.
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (event.key !== "/" || event.metaKey || event.ctrlKey || target.closest("input, textarea, [contenteditable]")) return;
    event.preventDefault();
    field.focus();
  });

  update();

  return {
    element: form,
    value: () => field.value.trim(),
    steer: () => steered,
    set: (text, steer, fromNeed = false) => {
      field.value = text;
      steered = steer;
      steeredFromNeed = fromNeed && Boolean(steer);
      update();
      renderHearing();
    },
    focus: () => field.focus(),
    setBusy: (busy) => {
      form.classList.toggle("composer--busy", busy);
      send.disabled = busy || (!field.value.trim() && !steered);
    },
  };
};
