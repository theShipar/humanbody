import { useMemo, useState } from "react";
import { Search, ChevronDown, ArrowUpRight, Layers3 } from "lucide-react";
import { SYSTEMS, type Atlas, type Concept, type SceneState } from "../anatomy";
import { REGIONS, type RegionId } from "../study/types";
export default function ExplorePanel({
  atlas,
  state,
  onSelect,
  update,
  onRegion,
  onFullBody,
}: {
  atlas: Atlas | null;
  state: SceneState;
  onSelect: (c: Concept) => void;
  update: (s: Partial<SceneState>) => void;
  onRegion: (r: RegionId) => void;
  onFullBody: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      !query.trim()
        ? []
        : (atlas?.concepts
            .filter(
              (c) =>
                c.name.toLowerCase().includes(query.toLowerCase()) ||
                c.id.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 35) ?? []),
    [query, atlas],
  );
  return (
    <div className="explore-panel">
      <div className="panel-title">
        <div>
          <span className="section-kicker">ANATOMICAL ATLAS</span>
          <h2>Explore the body</h2>
        </div>
        <Layers3 size={20} />
      </div>
      <label className="atlas-search">
        <Search size={16} />
        <input
          aria-label="Search all anatomy"
          placeholder="Find a structure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      {query && (
        <div className="atlas-results">
          {results.length ? (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  setQuery("");
                }}
              >
                {c.name}
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <p>No matching structures.</p>
          )}
        </div>
      )}
      <button className="full-body-option" onClick={onFullBody}>
        Full body <span>Adult male reference</span>
        <ArrowUpRight size={15} />
      </button>
      <details open>
        <summary>
          Regional focus <ChevronDown size={15} />
        </summary>
        <div className="explore-regions">
          {REGIONS.map((r, i) => (
            <button key={r.id} onClick={() => onRegion(r.id)}>
              <span>0{i + 1}</span>
              {r.title}
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>
          System layers <span>{SYSTEMS.length}</span>
        </summary>
        <div className="dark-system-list">
          {SYSTEMS.map((s) => (
            <label key={s.id}>
              <span className="layer-dot" style={{ background: s.color }} />
              {s.name}
              <input
                type="checkbox"
                role="switch"
                aria-label={`Show ${s.name.toLowerCase()}`}
                checked={state.renderMode === "skeleton" ? s.id === "skeletal" && state.visible.includes(s.id) : state.visible.includes(s.id)}
                onChange={() =>
                  update({
                    renderMode: "anatomy",
                    visible: state.renderMode === "skeleton" ? (s.id === "skeletal" ? [] : ["skeletal", s.id]) : state.visible.includes(s.id)
                      ? state.visible.filter((x) => x !== s.id)
                      : [...state.visible, s.id],
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
      <div className="coverage-note">
        <span className="live-dot" />
        2,234 modeled pieces
        <p>BodyParts3D reference anatomy. Some structures and variations are not represented.</p>
        <a href="/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          Source & attribution ↗
        </a>
      </div>
    </div>
  );
}
