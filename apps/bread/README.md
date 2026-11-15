# 🌾 Bread Alone

> "Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God." (Matthew 4:4)

Say what you're carrying, in plain words, and read three verses for it.

**▶ [Open Bread Alone](https://jessespencer.dev/bible/bread/)**

## How it finds verses

There's no AI model and nothing leaves your browser.

1. **Reading the need.** The query loses its filler ("I'm struggling with…", "please"), and what's left is matched against 17 topics, such as anxiety, grief, forgiveness and temptation, along with an intent and an emotional tone.
2. **Searching.** [MiniSearch](https://github.com/lucaong/minisearch) looks through the World English Bible for the query's words and the topic's keywords.
3. **Ranking.** Verses gain for the topic's keywords and phrases, and a lot for being one of the topic's hand-picked anchor verses. A match with nothing of the topic in it is pushed down as likely noise.
4. **Three, from three chapters.** The top three, never two from one chapter. **Show me others** draws three more from the top 30, weighted by score, without repeating any you've seen.

A need outside every topic falls back to a general set of verses. That's the weakest part, and the next thing to improve.

## Data

The search reads Atlas's World English Bible, the translation the topics were tuned on. Results show in whichever bundled translation you pick, shared with Atlas and Lineage. Every verse is numbered as in Atlas, so each result opens there with its cross-references.

The topics, anchors and query parsing come from the earlier standalone `bread-alone` app.

## Development

```bash
pnpm dev:bread    # http://localhost:5176/bible/bread/
pnpm test:bread
```
