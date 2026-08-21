"use client";

/**
 * The last resort: a failure in the root layout itself, where no dictionary,
 * no header and no styling can be relied on to have loaded.
 *
 * Both languages, plainly, because at this depth there is no way to know which
 * one the reader was in and guessing wrong would leave them with nothing.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fef7f0",
          color: "#1a1a1a",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Le site n&apos;a pas pu se charger</h1>
          <p style={{ color: "#6e6a72", marginTop: 8 }}>The site could not load.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 10,
              background: "#a3162c",
              color: "#fff",
              fontWeight: 700,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Réessayer / Retry
          </button>
        </div>
      </body>
    </html>
  );
}
