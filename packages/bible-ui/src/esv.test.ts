import { afterEach, describe, expect, it, vi } from "vitest";
import { refToVerseIndex } from "./bible";
import { esvBookLimit, esvQuery, heldEsv, loadEsv, parseEsvPassage } from "./esv";

const at = (ref: string) => refToVerseIndex(ref)!;

describe("esvQuery", () => {
  it("joins verses into one run per chapter", () => {
    const verses = [at("John.3.16"), at("John.3.17"), at("John.3.18"), at("Rom.8.28")];
    expect(esvQuery(verses)).toBe("John 3:16-18;Romans 8:28");
  });

  it("starts a new run where a chapter turns", () => {
    expect(esvQuery([at("John.3.36"), at("John.4.1")])).toBe("John 3:36;John 4:1");
  });

  it("leaves the chapter out of one-chapter books, where it would read as a verse", () => {
    expect(esvQuery([at("Jude.1.3"), at("Jude.1.4")])).toBe("Jude 3-4");
  });
});

describe("parseEsvPassage", () => {
  it("maps each numbered verse to its index and drops the (ESV) tag", () => {
    const verses = parseEsvPassage("[16] “For God so loved the world,\n  [17] For God did not send (ESV)", 43003016);
    expect(verses.get(at("John.3.16"))).toBe("“For God so loved the world,");
    expect(verses.get(at("John.3.17"))).toBe("For God did not send");
  });

  it("follows a passage into the next chapter", () => {
    const verses = parseEsvPassage("[36] Whoever believes [4:1] Now when Jesus learned", 43003036);
    expect(verses.get(at("John.4.1"))).toBe("Now when Jesus learned");
  });
});

describe("esvBookLimit", () => {
  it("allows half a book, even a one-chapter book", () => {
    expect(esvBookLimit(at("Jude.1.1"))).toBe(12);
    expect(esvBookLimit(at("Ruth.2.1"))).toBe(42);
  });

  it("allows no more than 500 verses of a long book", () => {
    expect(esvBookLimit(at("Ps.119.1"))).toBe(500);
  });
});

/** A fake Crossway that returns "verse N" for every verse asked for. */
const fakeCrossway = () =>
  vi.fn(async (url: string) => {
    const q = new URL(url).searchParams.get("q")!;
    const parts = q.split(";").map((part) => part.match(/^(.+?) (?:(\d+):)?(\d+)(?:-(\d+))?$/)!);
    const ids: Record<string, number> = { Jude: 65 };
    return new Response(
      JSON.stringify({
        passages: parts.map(([, , , a, b]) => {
          let text = "";
          for (let v = Number(a); v <= Number(b ?? a); v++) text += `[${v}] verse ${v} `;
          return text;
        }),
        parsed: parts.map(([, book, chapter, a]) => [ids[book!]! * 1_000_000 + Number(chapter ?? 1) * 1000 + Number(a), 0]),
      }),
    );
  });

describe("loadEsv", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never holds more than half a book, keeping the first-listed verses", async () => {
    localStorage.setItem("bui-esv-key", "test-key");
    vi.stubGlobal("fetch", fakeCrossway());
    const jude = Array.from({ length: 25 }, (_, i) => at(`Jude.1.${i + 1}`));
    await loadEsv([at("Jude.1.20"), ...jude]);
    const held = jude.filter((verse) => heldEsv(verse) !== undefined);
    expect(held).toHaveLength(12);
    expect(heldEsv(at("Jude.1.20"))).toBe("verse 20");
    expect(heldEsv(at("Jude.1.25"))).toBeUndefined();
  });

  it("holds a verse the ESV leaves out as empty, so it isn't asked for again", async () => {
    localStorage.setItem("bui-esv-key", "test-key");
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ passages: ["[20] He said to them, “Because of your little faith."], parsed: [[40017020, 40017020]] })),
    );
    vi.stubGlobal("fetch", fetch);
    await loadEsv([at("Matt.17.20"), at("Matt.17.21")]);
    await loadEsv([at("Matt.17.21")]);
    expect(heldEsv(at("Matt.17.20"))).toBe("He said to them, “Because of your little faith.");
    expect(heldEsv(at("Matt.17.21"))).toBe("");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
