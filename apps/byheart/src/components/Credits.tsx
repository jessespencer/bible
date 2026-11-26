import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Translation } from "../lib/bible";

/** The rights holder's short line and links, quiet beside the text: "ESV® Bible © Crossway · esv.org". */
export const CreditLinks = ({ translation }: { translation: Translation }) => (
  <>
    {translation.line ?? translation.name}
    {translation.links?.map((link) => (
      <span key={link.url}>
        {" · "}
        <a className="quiet" href={link.url} target="_blank" rel="noreferrer">
          {link.label}
        </a>
      </span>
    ))}
  </>
);

/**
 * A Credits button and the dialog it opens, which stands as the app's copyright page: the full
 * notices live here rather than under every chapter.
 */
export const Credits = ({ children }: { children: ReactNode }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="link quiet"
        onClick={() => dialog.current?.showModal?.()}
      >
        Credits
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="credits"
          aria-labelledby="credits-title"
          // A tap on the backdrop lands on the dialog itself.
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <form method="dialog">
            <button className="credits-close" aria-label="Close">
              ×
            </button>
          </form>
          <h2 id="credits-title">Credits</h2>
          {children}
        </dialog>,
        // On the body, so the dialog's headings and paragraphs never sit inside the line's <p>.
        document.body,
      )}
    </>
  );
};
