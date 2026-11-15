import type { EmotionalTone, Intent, NeedProfile } from "./types.ts";
import { topics, verbToIntent } from "./topics.ts";

const BOILERPLATE_PATTERNS = [
  /^(i need help with|help me with|i('m| am) struggling with|what does the bible say about|bible verses? (about|for|on)|can you help me with|i('m| am) looking for|i('m| am) dealing with|i have (a |an )?problem with)\s*/i,
  /^(please |could you |would you )\s*/i,
  /\s*(please|thanks|thank you)\.?\s*$/i,
];

function cleanQuery(raw: string): string {
  let cleaned = raw.trim();
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim() || raw.trim();
}

// Lightweight suffix-stripper with irregulars map
const STEM_IRREGULARS: Record<string, string> = {
  married: "marri",
  marriage: "marri",
  marrying: "marri",
  dying: "die",
  died: "die",
  lies: "lie",
  lying: "lie",
  tying: "tie",
  tied: "tie",
  children: "child",
  wives: "wife",
  leaves: "leav",
  leaving: "leav",
};

function simpleStem(word: string): string {
  const lower = word.toLowerCase();
  if (STEM_IRREGULARS[lower]) return STEM_IRREGULARS[lower];
  if (lower.length <= 3) return lower;

  // Order matters: longer suffixes first
  const suffixes: [string, number][] = [
    ["fulness", 7], ["ousness", 7], ["iveness", 7],
    ["ation", 5], ["ition", 5], ["ement", 5], ["iment", 5],
    ["ement", 5], ["ness", 4], ["ment", 4], ["ence", 4],
    ["ance", 4], ["tion", 4], ["sion", 4], ["ible", 4],
    ["able", 4], ["ious", 4], ["eous", 4],
    ["ing", 3], ["ied", 3], ["ies", 3],
    ["ful", 3], ["ous", 3], ["ive", 3],
    ["ity", 3], ["ism", 3], ["ist", 3],
    ["ed", 2], ["er", 2], ["ly", 2], ["al", 2],
  ];

  for (const [suffix, len] of suffixes) {
    if (lower.endsWith(suffix) && lower.length - len >= 3) {
      return lower.slice(0, -len);
    }
  }

  // Trailing 's' (but not 'ss')
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
    return lower.slice(0, -1);
  }

  return lower;
}

const STOP_WORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself",
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves",
  "what", "which", "who", "whom", "this", "that", "these", "those",
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing",
  "a", "an", "the", "and", "but", "if", "or", "because", "as",
  "until", "while", "of", "at", "by", "for", "with", "about",
  "against", "between", "through", "during", "before", "after",
  "above", "below", "to", "from", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once",
  "here", "there", "when", "where", "why", "how", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "don't", "should", "now", "im", "ive",
  "dont", "cant", "wont", "really", "much", "also", "get", "got",
  "like", "know", "think", "want", "need", "feel", "keep", "going",
  "been", "would", "could",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function contentTokenize(text: string): string[] {
  return tokenize(text).filter((w) => !STOP_WORDS.has(w));
}

// Words heavy enough that their topic should lead, whatever else the query mentions.
const WEIGHTY: Record<string, string[]> = {
  grief: [
    "passed away", "passed on", "died", "dying", "death", "funeral", "miscarr", "killed", "stillborn",
    // "Lost my" alone would make a lost job a bereavement.
    ...["mom", "mother", "dad", "father", "wife", "husband", "son", "daughter", "child", "baby", "brother", "sister", "friend", "grand"]
      .map((who) => `lost my ${who}`),
  ],
};

// Tone-to-topic affinity map for tie-breaking
const TONE_TOPIC_AFFINITY: Partial<Record<EmotionalTone, string>> = {
  grieving: "grief",
  anxious: "anxiety",
  angry: "anger",
  confused: "guidance",
  hopeful: "gratitude",
  grateful: "gratitude",
};

interface TopicScore {
  topic: string;
  score: number;
}

function detectTopics(
  cleaned: string,
  emotionalTone: EmotionalTone
): { primary: string; secondary: string[]; scores: TopicScore[] } {
  const lower = cleaned.toLowerCase();
  const tokens = tokenize(cleaned);
  const stemmedTokens = tokens.map(simpleStem);
  const scores: TopicScore[] = [];

  for (const [topicKey, def] of Object.entries(topics)) {
    let score = 0;

    for (const kw of def.keywords) {
      if (kw.includes(" ")) {
        // Multi-word: check substring
        if (lower.includes(kw)) score += 1;
      } else {
        // Single-word: compare stems
        const kwStem = simpleStem(kw);
        if (stemmedTokens.includes(kwStem)) score += 1;
      }
    }

    for (const phrase of def.boostPhrases) {
      if (lower.includes(phrase.toLowerCase())) score += 2;
    }

    for (const avoid of def.avoidKeywords) {
      if (lower.includes(avoid.toLowerCase())) score -= 0.5;
    }

    // A death outweighs whoever else is named: "my mom passed away" is grief before it's parenting.
    if (WEIGHTY[topicKey]?.some((phrase) => lower.includes(phrase))) score += 2;

    if (score > 0) {
      scores.push({ topic: topicKey, score });
    }
  }

  // Multi-factor sort: score desc → tone affinity → alphabetical
  const affinityTopic = TONE_TOPIC_AFFINITY[emotionalTone];
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tone affinity tie-breaker
    if (affinityTopic) {
      const aAffinity = a.topic === affinityTopic ? 1 : 0;
      const bAffinity = b.topic === affinityTopic ? 1 : 0;
      if (bAffinity !== aAffinity) return bAffinity - aAffinity;
    }
    // Alphabetical for determinism
    return a.topic.localeCompare(b.topic);
  });

  if (scores.length === 0) {
    return { primary: "general", secondary: [], scores: [] };
  }

  const primary = scores[0]!.topic;
  const secondary = scores
    .slice(1, 3)
    .filter((s) => s.score > 0)
    .map((s) => s.topic);

  return { primary, secondary, scores };
}

function detectIntent(cleaned: string, primaryTopic: string): Intent {
  const tokens = tokenize(cleaned);

  for (const token of tokens) {
    if (token in verbToIntent) {
      return verbToIntent[token]!;
    }
  }

  if (primaryTopic === "general") return "encouragement";
  return topics[primaryTopic]?.defaultIntent ?? "encouragement";
}

const TONE_MAP: Record<string, EmotionalTone> = {
  desperate: "distressed",
  helpless: "distressed",
  "can't take": "distressed",
  "falling apart": "distressed",
  breaking: "distressed",

  anxious: "anxious",
  worried: "anxious",
  nervous: "anxious",
  stressed: "anxious",
  overwhelmed: "anxious",
  panic: "anxious",

  angry: "angry",
  furious: "angry",
  mad: "angry",
  rage: "angry",
  hate: "angry",

  grief: "grieving",
  mourning: "grieving",
  died: "grieving",
  death: "grieving",
  loss: "grieving",
  lost: "grieving",

  confused: "confused",
  uncertain: "confused",
  unsure: "confused",
  "don't know": "confused",
  "don't understand": "confused",

  hopeful: "hopeful",
  optimistic: "hopeful",
  encouraged: "hopeful",
  excited: "hopeful",

  grateful: "grateful",
  thankful: "grateful",
  blessed: "grateful",
  joyful: "grateful",
};

function detectEmotionalTone(cleaned: string): EmotionalTone {
  const lower = cleaned.toLowerCase();

  for (const [phrase, tone] of Object.entries(TONE_MAP)) {
    if (lower.includes(phrase)) return tone;
  }

  return "neutral";
}

function expandSearchTerms(
  cleaned: string,
  primaryTopic: string,
  secondaryTopics: string[],
  topicScores: TopicScore[]
): string[] {
  const tokens = contentTokenize(cleaned);
  const terms = new Set(tokens);

  // Always add primary topic keywords (single-word only)
  const primaryDef = topics[primaryTopic];
  if (primaryDef) {
    for (const kw of primaryDef.keywords.slice(0, 5)) {
      if (!kw.includes(" ")) terms.add(kw);
    }
  }

  // Only inject secondary topic keywords when score >= 1.5
  // (at least 2 keyword hits or a boost phrase)
  const scoreMap = new Map(topicScores.map((s) => [s.topic, s.score]));
  for (const sec of secondaryTopics) {
    const secScore = scoreMap.get(sec) ?? 0;
    if (secScore < 1.5) continue;
    const def = topics[sec];
    if (def) {
      for (const kw of def.keywords.slice(0, 2)) {
        if (!kw.includes(" ")) terms.add(kw);
      }
    }
  }

  return Array.from(terms);
}

/**
 * What a query asks for. `topic` steers it: the reader picked a topic from the chips or the list,
 * so it leads whatever the words suggested, and the other topics heard stay behind it.
 */
export function parseNeedProfile(rawQuery: string, topic?: string): NeedProfile {
  const cleanedQuery = cleanQuery(rawQuery);
  const emotionalTone = detectEmotionalTone(cleanedQuery);
  const detected = detectTopics(cleanedQuery, emotionalTone);
  const steered = topic !== undefined && topic in topics && topic !== detected.primary;
  const primary = steered ? topic : detected.primary;
  const secondary = steered
    ? [detected.primary, ...detected.secondary].filter((t) => t !== topic && t !== "general").slice(0, 2)
    : detected.secondary;
  const intent = detectIntent(cleanedQuery, primary);
  const searchTerms = expandSearchTerms(cleanedQuery, primary, secondary, detected.scores);

  return {
    originalQuery: rawQuery,
    cleanedQuery,
    primaryTopic: primary,
    secondaryTopics: secondary,
    intent,
    emotionalTone,
    searchTerms,
  };
}

/** Every topic heard in a query, strongest first, for the chips under the composer. */
export function hearTopics(rawQuery: string): string[] {
  const cleanedQuery = cleanQuery(rawQuery);
  const { scores } = detectTopics(cleanedQuery, detectEmotionalTone(cleanedQuery));
  return scores.map((s) => s.topic);
}
