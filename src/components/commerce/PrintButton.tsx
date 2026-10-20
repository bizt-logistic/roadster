"use client";

export function PrintButton() {
  return (
    <button type="button" className="cta cta--ghost" onClick={() => window.print()}>
      Print / save PDF
    </button>
  );
}
