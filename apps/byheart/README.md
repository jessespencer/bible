# By Heart

A typographic app for memorizing Scripture, up to whole books. The chapter is printed as a page: unlearned verses are grey, and they darken as you learn them. A first visit asks which book and translation to begin with.

From the repo root:

```bash
pnpm install
pnpm dev:byheart      # http://localhost:5175/bible/byheart/
pnpm test:byheart
```

## Getting around

Press `b` for the contents and `t` for translations. In the contents, type to narrow the books (`eph`, `mk`, `1 cor`), or add a chapter to go straight there (`rom 8`), then press Enter. Number keys pick a translation.

## Reciting as a test

Reciting a chapter, the book, a selection of verses or a section of the structure map is a test. Choose how to recite it first: said aloud (where the browser can listen), typed word by word, or typed by first letters. A bar with a clock and a Stop button floats at the foot of the screen while it runs; in a spoken test it also shows a meter that moves with your voice, so you can see the microphone hearing you.

Stop wherever you like. A verse is scored once you reach three quarters of it, and verses you did not reach are left as they were, so reciting Ephesians 1:1–20 out of chapter 1 needs no setup. The score counts the words you recalled without help, verse by verse, and prints the verses that slipped with the missed words marked. It also shows your best and last score for the same passage recited the same way.

A spoken test is scored once it is over, by lining the whole transcript up against the text, so a skipped phrase costs only its own words. Typing whole words ignores case and punctuation and allows one slip in a word of five letters or more, marked on the score but not counted against you. Tests grade verses for review the same way a recital always has.

Every typed stage takes whole words by default; any of them can switch to first letters instead, and the choice carries across stages and tests.

## Structure map

Books with an outline get a one-page map, reached from the main page. Each section shows its name, its verses and how well they are known. Tap one to recite it, even across a chapter break, and quiz yourself on what comes next and on where a passage belongs. Ephesians has an outline so far; add others in `src/lib/outline.ts`.

Quiz recall is scheduled like verses but kept in its own store, apart from verse progress and shared across translations.

## Where is it?

Once three verses of a book are begun, the main page offers a drill in the other direction: a random verse from those you have begun, shown whole, and you find its chapter and verse. Tap or type the numbers. Answers are tallied for the round only and do not change when a verse is next due.

## Translations

BSB, WEB, NET, LEB, KJV, ASV and the Geneva Bible load from the free [Bible API](https://bible.helloao.org) and are cached in the browser. NET and LEB are copyrighted, so the app shows their required credits and links.

The ESV needs a free key from [api.esv.org](https://api.esv.org/account/create-application/), which you paste into the app. Crossway's [conditions](https://api.esv.org/#conditions) let no page show, and no app store, more than 500 verses or half of any book, whichever is less, so:

- ESV text is never written to disk. In memory the app holds at most two chapters, and never more than that limit of any one book, letting go of the older chapter first (Jonah 1 and 2 together would pass half of Jonah).
- A chapter longer than half its book is printed in parts of even length, which you turn between under the chapter numbers or from the foot of the page. Recitals and Where is it? load one part at a time too. Only Obadiah, Haggai 2, Philemon, 2 and 3 John and Jude need this; the exemption for one- and two-chapter books covers a single request, not what is shown.
- Every screen with ESV text carries a short credit and a link to www.esv.org. The full notice, with the Greek tags' credits, is in the colophon's Credits dialog, the app's copyright page. The text on the page and in Where is it? ends with "(ESV)".

NIV, NKJV and NLT come through [API.Bible](https://api.bible), which needs a free key and allows only non-commercial use on its free plan. Like the ESV, this text stays in memory, two chapters at most, and each view is reported through API.Bible's FUMS tracker. Their footnotes appear under the text.

In development, put keys in `.env.local` at the repo root as `VITE_ESV_KEY` and `VITE_API_BIBLE_KEY` so they apply on every port and in every app. They are never included in a production build.

Progress is stored per translation in `localStorage`. Browsers can clear it, Safari after a week away unless the app is on the home screen, so the page's colophon saves and restores a JSON backup of progress, structure recall, test scores, settings, place and theme. Keys and Bible text are never included. Once there is progress, the app also asks the browser to keep its storage.

## The Greek behind the ESV

Reading Ephesians in the ESV, turn on **Greek** above the page and tap a dotted word. A marginal note gives the Greek word, a transliteration, a short gloss, its grammar and the other verses in Ephesians where it appears. Practice stages never show it, since it could give answers away. The ESV text itself is not stored or changed: the bundled data holds word positions and Greek only.

Only words of meaning are tappable (nouns, verbs, adjectives, adverbs). Three safeguards keep a wrong gloss off the page:

- If a verse's word count differs from the edition the tags were checked against, that verse shows no Greek, and the colophon says so.
- Where a verse has the word in more than one form, the note gives the dictionary form and lists them, because the tags name a word, not an occurrence.
- Tags that could not be confirmed against the ESV wording were dropped, not guessed.

### Sources and licences

| Data | Used for | Source | Licence |
| --- | --- | --- | --- |
| TTESV | ESV word position to Strong's number | Tyndale House, Cambridge ([TyndaleHouse.com](https://www.TyndaleHouse.com)) and [STEP Bible](https://www.STEPBible.org), from [STEPBible-Data](https://STEPBible.github.io/STEPBible-Data/) | CC BY-NC 4.0 |
| TAGNT | Greek text, transliteration, word-for-word English, lemma, grammar codes | [STEP Bible](https://www.STEPBible.org), based on work at Tyndale House | CC BY 4.0 |
| TBESG | Transliteration of dictionary forms | [STEP Bible](https://www.STEPBible.org) | CC BY 4.0 |
| TEGMC | Grammar codes spelled out | [STEP Bible](https://www.STEPBible.org) | CC BY 4.0 |

TTESV's licence covers free software and free publications. Anything sold would need permission from STEP Bible first. It also says the ESV words themselves must come from Crossway, which is why the app reads them from your own API key.

### Changes to the source data

`scripts/build-greek.mjs` rebuilds `src/data/greek-ephesians.json` from a pinned STEPBible-Data commit and lists every change in full. In summary:

- Kept only Ephesians, the Nestle-Aland words of TAGNT, and tags that reach a noun, verb, adjective or adverb, leaving out εἰμί.
- Normalized Greek to Unicode NFC, and mapped three older Strong's numbers to TAGNT's (1492, 3117, 3440).
- At 1:5, moved positions to fit the current ESV wording ("to himself" came after the tags were made).
- Moved tags that sat on the wrong word at 1:5, 2:15, 4:8, 4:16 and 6:12, and dropped nine loose ones.

Please send corrections upstream to STEPBibleATgmail.com, not here.
