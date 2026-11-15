import type { Intent, TopicDefinition } from "./types.ts";

export const topics: Record<string, TopicDefinition> = {
  anxiety: {
    label: "Anxiety / Worry / Fear",
    keywords: [
      "anxious", "anxiety", "worried", "worry", "fear", "afraid",
      "scared", "nervous", "panic", "dread", "terrified", "uneasy",
      "overwhelmed", "stress", "stressed", "fretting", "apprehensive",
    ],
    boostPhrases: [
      "do not be afraid", "fear not", "do not worry", "be not afraid",
      "cast your anxiety", "peace I leave", "not given a spirit of fear",
      "the Lord is my shepherd", "I will fear no evil",
    ],
    avoidKeywords: ["fear of the Lord", "fear God"],
    relatedTopics: ["peace", "endurance"],
    defaultIntent: "comfort",
  },

  peace: {
    label: "Peace / Calm",
    keywords: [
      "peace", "calm", "rest", "quiet", "still", "tranquil",
      "serenity", "relax", "unrest", "turmoil", "chaos",
    ],
    boostPhrases: [
      "peace of God", "be still", "peace I leave with you",
      "rest in the Lord", "quiet waters", "peace that surpasses",
    ],
    avoidKeywords: [],
    relatedTopics: ["anxiety"],
    defaultIntent: "comfort",
  },

  guidance: {
    label: "Guidance / Wisdom / Decisions",
    keywords: [
      "guidance", "guide", "wisdom", "decision", "direction", "path",
      "choose", "choice", "discern", "confused", "lost", "uncertain",
      "purpose", "plan", "calling", "career", "future", "know what to do",
      "next step", "unclear",
    ],
    boostPhrases: [
      "lamp to my feet", "trust in the Lord", "lean not on your own",
      "I will instruct you", "ask of God", "plans to prosper",
      "the way the truth", "seek first",
    ],
    avoidKeywords: [],
    relatedTopics: ["identity"],
    defaultIntent: "guidance",
  },

  anger: {
    label: "Anger / Patience",
    keywords: [
      "angry", "anger", "mad", "furious", "rage", "frustrated",
      "patience", "patient", "impatient", "bitter", "resentment",
      "irritated", "annoyed", "hostile", "wrath", "hate",
    ],
    boostPhrases: [
      "slow to anger", "be angry and do not sin", "love is patient",
      "a gentle answer", "do not let the sun go down", "vengeance is mine",
    ],
    avoidKeywords: [],
    relatedTopics: ["forgiveness"],
    defaultIntent: "wisdom",
  },

  grief: {
    label: "Grief / Loss / Sorrow",
    keywords: [
      "grief", "grieving", "loss", "lost", "died", "death", "mourn",
      "mourning", "sorrow", "heartbroken", "devastated", "miss",
      "passed away", "funeral", "bereavement", "weeping", "crying",
      "tears", "pain", "suffering", "hurt",
      "mom died", "dad died", "death of",
    ],
    boostPhrases: [
      "blessed are those who mourn", "close to the brokenhearted",
      "wipe away every tear", "comfort those who mourn",
      "he will swallow up death", "weeping may endure",
      "neither shall there be mourning",
    ],
    // Losing a job is hard, but it's work's to answer before grief's.
    avoidKeywords: ["lost my job", "lost a job", "lost his job", "lost her job"],
    relatedTopics: ["endurance", "peace"],
    defaultIntent: "comfort",
  },

  loneliness: {
    label: "Loneliness",
    keywords: [
      "lonely", "alone", "isolated", "abandoned", "forsaken",
      "no one", "nobody", "friendless", "rejected", "left out",
      "single", "by myself",
    ],
    boostPhrases: [
      "I will never leave you", "nor forsake you", "God sets the lonely",
      "I am with you always", "a friend who sticks closer",
    ],
    avoidKeywords: [],
    relatedTopics: ["identity", "grief"],
    defaultIntent: "comfort",
  },

  forgiveness: {
    label: "Forgiveness / Bitterness",
    keywords: [
      "forgive", "forgiveness", "bitter", "bitterness", "grudge",
      "resent", "resentful", "offense", "offended", "hurt by",
      "betrayed", "betrayal", "unfair", "wrong", "wronged",
    ],
    boostPhrases: [
      "forgive as the Lord forgave", "seventy times seven",
      "forgive them", "if you forgive others", "love your enemies",
      "be kind to one another",
    ],
    avoidKeywords: [],
    relatedTopics: ["anger"],
    defaultIntent: "wisdom",
  },

  temptation: {
    label: "Temptation / Addiction",
    keywords: [
      "temptation", "tempted", "lust", "porn", "pornography",
      "addiction", "addicted", "substance", "alcohol", "drunk",
      "drugs", "smoking", "gambling", "desire", "flesh",
      "sexual", "sin", "stumble", "struggle", "weakness",
      "self-control", "masturbation",
    ],
    boostPhrases: [
      "no temptation has overtaken", "way of escape", "resist the devil",
      "flee from", "the spirit is willing", "put on the full armor",
      "walk by the Spirit", "sin shall not be your master",
    ],
    avoidKeywords: [],
    relatedTopics: ["shame", "endurance"],
    defaultIntent: "correction",
  },

  shame: {
    label: "Shame / Guilt / Repentance",
    keywords: [
      "shame", "ashamed", "guilt", "guilty", "regret", "remorse",
      "repent", "repentance", "unworthy", "dirty", "stained",
      "condemned", "condemnation", "failure", "failed", "messed up",
      "worthless",
    ],
    boostPhrases: [
      "no condemnation", "washed clean", "white as snow",
      "new creation", "as far as the east is from the west",
      "if we confess our sins", "create in me a clean heart",
    ],
    avoidKeywords: [],
    relatedTopics: ["forgiveness", "identity"],
    defaultIntent: "repentance",
  },

  endurance: {
    label: "Endurance / Suffering",
    keywords: [
      "endurance", "persevere", "perseverance", "suffering", "trial",
      "hardship", "difficult", "tough", "struggle", "hard time",
      "going through", "season", "burden", "weary", "tired",
      "exhausted", "burnout", "give up", "hopeless",
    ],
    boostPhrases: [
      "count it all joy", "produces perseverance", "run the race",
      "not grow weary", "light and momentary", "come to me all who are weary",
      "I can do all things", "strength in weakness",
    ],
    avoidKeywords: [],
    relatedTopics: ["anxiety", "grief"],
    defaultIntent: "encouragement",
  },

  gratitude: {
    label: "Gratitude / Joy",
    keywords: [
      "grateful", "thankful", "thanks", "joy", "joyful", "happy",
      "blessed", "blessing", "praise", "celebrate", "rejoice",
      "good news", "wonderful", "amazing", "awesome",
    ],
    boostPhrases: [
      "give thanks", "rejoice always", "the joy of the Lord",
      "every good gift", "bless the Lord", "this is the day",
      "sing to the Lord",
    ],
    avoidKeywords: [],
    relatedTopics: ["praise"],
    defaultIntent: "praise",
  },

  identity: {
    label: "Identity / Assurance / Salvation",
    keywords: [
      "identity", "who am I", "worth", "value", "purpose", "meaning",
      "saved", "salvation", "born again", "believe", "faith",
      "assurance", "secure", "eternal", "heaven", "confident",
      "self-worth", "self-esteem", "insecure",
      "adequate", "inadequate", "inferior", "not good enough", "enough",
      "capable", "incapable",
    ],
    boostPhrases: [
      "fearfully and wonderfully made", "chosen generation",
      "child of God", "saved by grace", "nothing can separate",
      "plans to prosper", "knew you before",
    ],
    avoidKeywords: [],
    relatedTopics: ["shame", "loneliness"],
    defaultIntent: "encouragement",
  },

  justice: {
    label: "Justice / Oppression",
    keywords: [
      "justice", "injustice", "oppression", "oppressed", "rights",
      "fair", "unfair", "discrimination", "racism", "abuse",
      "exploitation", "poverty", "poor", "hungry", "needy",
      "marginalized", "victim",
    ],
    boostPhrases: [
      "justice roll down", "defend the weak", "set the oppressed free",
      "he has told you what is good", "blessed are those who hunger",
      "the Lord loves justice",
    ],
    avoidKeywords: [],
    relatedTopics: ["anger", "endurance"],
    defaultIntent: "encouragement",
  },

  marriage: {
    label: "Marriage / Spouse",
    keywords: [
      "married", "marriage", "husband", "wife", "spouse", "wedding",
      "divorce", "intimacy", "covenant", "engagement", "partner",
      "infidelity", "adultery",
    ],
    boostPhrases: [
      "love your wives", "two will become one flesh", "lead her",
      "lead my wife", "what God has joined", "love is patient love is kind",
      "husbands love your wives",
    ],
    avoidKeywords: ["child", "children", "parenting", "kids"],
    relatedTopics: ["guidance", "identity"],
    defaultIntent: "wisdom",
  },

  parenting: {
    label: "Parenting / Children",
    keywords: [
      "parent", "parenting", "child", "children", "son", "daughter",
      "mom", "dad", "mother", "father", "kids", "baby", "teenager",
      "discipline", "raise", "family",
    ],
    boostPhrases: [
      "train up a child", "honor your father", "children are a heritage",
      "fathers do not provoke",
    ],
    avoidKeywords: ["husband", "wife", "spouse", "married"],
    relatedTopics: ["guidance", "anger"],
    defaultIntent: "wisdom",
  },

  health: {
    label: "Health / Illness / Healing",
    keywords: [
      "sick", "illness", "cancer", "hospital", "healing", "pain",
      "chronic", "diagnosis", "surgery", "disability", "disease",
      "health", "medical", "doctor",
    ],
    boostPhrases: [
      "heals all your diseases", "by his wounds we are healed",
      "the prayer of faith will save", "I am the Lord who heals you",
    ],
    avoidKeywords: [],
    relatedTopics: ["endurance", "anxiety"],
    defaultIntent: "comfort",
  },

  leadership: {
    label: "Leadership / Work",
    keywords: [
      "leader", "leadership", "boss", "manager", "work", "job",
      "career", "coworker", "workplace", "business", "ambition",
      "success", "promotion", "responsibility", "authority",
      "servant", "serve", "integrity",
      "lead", "leading", "manage", "managing",
    ],
    boostPhrases: [
      "whatever you do work heartily", "servant of all",
      "faithful with little", "commit your work to the Lord",
      "the greatest among you", "plans of the diligent",
    ],
    avoidKeywords: [],
    relatedTopics: ["guidance", "identity"],
    defaultIntent: "wisdom",
  },

  money: {
    label: "Money / Provision",
    // Verse text is matched by substring, so nothing short enough to hide inside other words
    // ("owe" in "power", "rent" in "parent", "give" in "forgive").
    keywords: [
      "money", "provision", "provide", "generous", "generosity", "wealth", "riches", "rich",
      "poor", "poverty", "debt", "debts", "bills", "finances", "financial", "broke",
      "afford", "paycheck", "salary", "income", "budget", "savings", "greed", "greedy",
      "tithe", "tithing", "giving", "treasure", "possessions", "contentment", "lender",
      "borrow", "mortgage", "make rent", "pay rent", "pay the rent", "my rent", "our rent", "the rent",
      "pay the bills", "pay our bills", "make ends meet", "lost everything",
    ],
    boostPhrases: [
      "love of money", "cheerful giver", "treasures in heaven", "supply every need",
      "serve two masters", "borrower is servant to the lender", "more blessed to give",
      "honor the lord with your substance", "whole tithe", "daily bread",
      "neither poverty nor riches", "power to get wealth",
    ],
    avoidKeywords: [],
    relatedTopics: ["anxiety", "gratitude"],
    defaultIntent: "wisdom",
  },
};

export const verbToIntent: Record<string, Intent> = {
  forgive: "wisdom",
  resist: "correction",
  overcome: "encouragement",
  repent: "repentance",
  confess: "repentance",
  praise: "praise",
  thank: "praise",
  worship: "praise",
  pray: "prayer",
  trust: "encouragement",
  surrender: "guidance",
  obey: "guidance",
  serve: "guidance",
  love: "wisdom",
  endure: "encouragement",
  persevere: "encouragement",
  hope: "comfort",
  comfort: "comfort",
  heal: "comfort",
  protect: "comfort",
  lead: "guidance",
  guide: "guidance",
};
