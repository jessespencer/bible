# 🌾 Bread Alone

> "Man shall not live by bread alone, but by every word that comes from the mouth of God." (Matthew 4:4, ESV)

Say what you're carrying, in plain words, and read three verses for it.

**▶ [Open Bread Alone](https://jessespencer.dev/bible/bread/)**

## Using it

- **Write it the way you'd say it.** The field grows as you write. Enter sends, Shift Enter starts a new line, and `/` jumps to it from anywhere.
- **See what it's hearing.** As you write, chips show the needs it hears, strongest first. Tap one to steer the answer toward it, before asking or after: the verses follow.
- **Or begin with a need.** Eighteen needs, from anxiety to money. Tap one and it begins the sentence for you ("I'm anxious about…"), to finish or send as it is. Once there's an answer they sit in a row under the field, and a tap switches the verses at once.
- **Start over.** One tap, or Back, returns to an empty page. Words that point elsewhere take over from a need you picked.
- **Read around it.** Each verse opens onto the verses either side of it in its chapter, with the one found highlighted.
- **Keep it.** Copy a verse with its reference, or share it as a typeset image: the share sheet on a phone, a download elsewhere.
- **Three more.** Draw another three for the same need, never repeating what you've seen.
- **Follow it outward.** Each verse opens in Atlas with its cross-references, and every answer has its own link: `?q=`, `?topic=`, `?tr=`.

## How it finds verses

There's no AI model and nothing leaves your browser.

1. **Reading the need.** The query loses its filler ("I'm struggling with…", "please"), and what's left is matched against 18 topics, such as anxiety, grief, forgiveness and temptation, along with an intent and an emotional tone. Words for a death count double toward grief, so "my mom passed away" isn't heard as parenting. A topic the reader steers to leads whatever the words suggested.
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
