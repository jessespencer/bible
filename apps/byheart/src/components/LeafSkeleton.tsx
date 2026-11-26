// Word lengths in em, fixed so every page waits with the same shape rather than reshuffling on each render.
const WORDS = [
  2.2, 4.1, 1.4, 3.3, 5.2, 1.8, 2.9, 4.6, 1.2, 3.8, 2.4, 5.6, 1.6, 3.1, 2.7, 4.4, 1.3, 3.6, 2.1, 4.9, 1.9, 2.6, 3.4,
  1.5, 5.1, 2.3, 3.9, 1.7, 4.2, 2.8, 1.4, 3.5, 4.7, 2.0, 3.2, 1.6, 5.4, 2.5, 3.7, 1.3, 4.3, 2.9, 1.8, 3.0, 4.8, 2.2,
  1.5, 3.6, 5.0, 2.6, 1.9, 4.0, 3.3, 1.4, 2.7, 4.5, 2.1, 3.8, 1.7, 5.3, 2.4, 3.1, 1.6, 4.1, 2.8, 3.5, 1.2, 4.6, 2.3,
  3.9, 1.8, 2.5, 5.5, 3.0, 1.5, 4.2, 2.0, 3.4, 1.9, 4.9, 2.6, 3.7, 1.3, 2.9, 4.4, 2.2, 3.2, 1.7, 5.0, 2.7, 3.6, 1.4,
  4.0, 2.4, 3.3, 1.6, 4.7, 2.1, 3.8, 2.8,
]

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
