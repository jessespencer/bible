import { skeletonWidths } from '@jessespencer/bible-ui/skeleton'

// A page's worth of words, in the same shapes Atlas, Lineage and Bread Alone wait with.
const WORDS = skeletonWidths(101)

/** The shape of a page of text, held in faint ink while the real words are fetched. */
export const LeafSkeleton = ({ drop }: { drop?: string }) => (
  <article className="leaf leaf-skeleton" aria-busy="true">
    <span className="sr-only">Opening the book…</span>
    {drop && (
      <span className="drop" aria-hidden="true">
        {drop}
      </span>
    )}
    <span aria-hidden="true">
      {WORDS.map((width, i) => (
        <span key={i}>
          <span className="skeleton-word" style={{ width: `${width}em`, animationDelay: `${(i % 23) * 40}ms` }} />{' '}
        </span>
      ))}
    </span>
  </article>
)
