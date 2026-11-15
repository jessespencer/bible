export type Intent =
  | "comfort"
  | "guidance"
  | "correction"
  | "encouragement"
  | "repentance"
  | "prayer"
  | "wisdom"
  | "praise";

export type EmotionalTone =
  | "distressed"
  | "anxious"
  | "angry"
  | "grieving"
  | "confused"
  | "hopeful"
  | "grateful"
  | "neutral";

export interface TopicDefinition {
  label: string;
  /** How a sentence about this need might begin; tapping the need on the first page writes it. */
  starter: string;
  keywords: string[];
  boostPhrases: string[];
  avoidKeywords: string[];
  relatedTopics: string[];
  defaultIntent: Intent;
}

/** What a query is asking for: its topics, intent and tone, and the words to search with. */
export interface NeedProfile {
  originalQuery: string;
  cleanedQuery: string;
  primaryTopic: string;
  secondaryTopics: string[];
  intent: Intent;
  emotionalTone: EmotionalTone;
  searchTerms: string[];
}
