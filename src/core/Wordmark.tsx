/**
 * The Refill wordmark. The i's dot is the orange dot from the logo (where a Zap
 * line is being drawn). With `fill`, the word fills up from the bottom like a
 * refilled cup and the dot drops on last: the splash screen uses it.
 */
const word = (dot: boolean) => (
  <>
    Ref
    <span className="wm-i">
      ı{dot && <span className="wm-dot" />}
    </span>
    ll
  </>
);

export function Wordmark({ fill = false, className = "" }: { fill?: boolean; className?: string }) {
  return (
    <span className={`wordmark ${fill ? "filling" : ""} ${className}`} role="img" aria-label="Refill">
      <span className="wm-base" aria-hidden>
        {word(true)}
      </span>
      {fill && (
        <span className="wm-fill" aria-hidden>
          {word(false)}
        </span>
      )}
    </span>
  );
}
