import './credits.css';
import { CAR_CREDITS, CAR_IDS, CAR_INFO, carName, type CarId } from '@gamergang/shared';
import { useEffect, type ReactNode } from 'react';
import { CREDIT_SECTIONS, type Credit } from './credits';

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function CarCreditEntry({ id }: { id: CarId }) {
  const credit = CAR_CREDITS[id];
  const info = CAR_INFO[id];
  return (
    <li className="credits-entry">
      <h3>
        {carName(id)}{' '}
        <small>
          {info.body}, {info.drive}
        </small>
      </h3>
      <p>
        Based on <Link href={credit.sourceUrl}>“{credit.title}”</Link> by {credit.author},{' '}
        {credit.licence === 'CC0 1.0' ? (
          <>
            dedicated to the public domain (<Link href={credit.licenceUrl}>{credit.licence}</Link>),
            credited as a courtesy
          </>
        ) : (
          <>
            licensed under <Link href={credit.licenceUrl}>{credit.licence}</Link>
          </>
        )}
      </p>
      <p className="credits-muted">Modified: {credit.modified}</p>
    </li>
  );
}

function CreditEntry({ credit, compact }: { credit: Credit; compact: boolean }) {
  const licence = credit.licenceUrl ? (
    <Link href={credit.licenceUrl}>{credit.licence}</Link>
  ) : (
    credit.licence
  );
  if (compact) {
    // The TV has one screen for everything: one line per credit, no notes.
    return (
      <li className="credits-entry">
        <p>
          <strong>{credit.name}</strong>
          {credit.author === 'Gamer Gang project' ? '' : ` · ${credit.author}`} · {licence}
        </p>
      </li>
    );
  }
  return (
    <li className="credits-entry">
      <h3>{credit.url ? <Link href={credit.url}>{credit.name}</Link> : credit.name}</h3>
      <p>
        {credit.author}
        {credit.source === credit.author ? '' : ` · ${credit.source}`}
      </p>
      <p>
        {licence}
        {credit.note ? <span className="credits-muted"> · {credit.note}</span> : null}
      </p>
    </li>
  );
}

function CreditsBody({ compact }: { compact: boolean }) {
  return (
    <div className="credits-sections">
      <section className="credits-section credits-section--cars">
        <h2>Cars</h2>
        <p className="credits-muted credits-intro">
          Every make and model is fictional. CC BY grants no trademark rights; the source models
          were debranded.
        </p>
        <ul>
          {CAR_IDS.map((id) => (
            <CarCreditEntry key={id} id={id} />
          ))}
        </ul>
      </section>
      {CREDIT_SECTIONS.map((section) => (
        <section key={section.title} className="credits-section">
          <h2>{section.title}</h2>
          <ul>
            {section.credits.map((credit) => (
              <CreditEntry key={credit.name} credit={credit} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The /credits page: readable on a phone and on a laptop, links open the sources. */
export default function CreditsPage() {
  useEffect(() => {
    document.title = 'Gamer Gang · Credits';
  }, []);
  return (
    <main className="credits credits--page">
      <header className="credits-header">
        <h1 className="wordmark">Credits</h1>
        <a className="credits-back" href="/">
          Gamer Gang
        </a>
      </header>
      <CreditsBody compact={false} />
      <p className="credits-muted credits-footnote">
        Our modifications are (C) 2026 the Gamer Gang project; the original works stay under their
        licences.
      </p>
    </main>
  );
}

/** Full-screen credits on the TV (key C in the lobby). Sized to read from the sofa. */
export function TvCredits() {
  return (
    <div className="credits credits--tv" role="dialog" aria-label="Credits">
      <header className="credits-header">
        <h1 className="wordmark">Credits</h1>
        <span className="credits-close">
          <kbd>C</kbd> or <kbd>Esc</kbd> close · full list at /credits
        </span>
      </header>
      <CreditsBody compact />
    </div>
  );
}
