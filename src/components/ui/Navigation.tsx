"use client";

import { NAV_ITEMS, type SceneName } from "@/components/animation/AnimationTimeline";

export function Navigation({ onNavigate, onCredits }: { onNavigate: (s: SceneName) => void; onCredits: () => void }) {
  return (
    <header className="nav" data-s="nav">
      <a
        className="nav__brand"
        href="#top"
        data-s="nav-item"
        aria-label="Roadster fan concept — back to start"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("intro");
        }}
      >
        ROADSTER
      </a>
      <nav aria-label="Chapters">
        <ul className="nav__links">
          {NAV_ITEMS.map((item) => (
            <li key={item.scene} data-s="nav-item">
              <button type="button" className="nav__link" onClick={() => onNavigate(item.scene)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav__actions" data-s="nav-item">
        <button type="button" className="nav__link nav__credits" onClick={onCredits} aria-haspopup="dialog">
          Credits
        </button>
        <a className="nav__link nav__credits" href="/gallery">
          Gallery
        </a>
        <a className="nav__cta" href="/reserve">
          Reserve
        </a>
      </div>
    </header>
  );
}
