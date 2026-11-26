import type { NerveDiagram } from "./types";
export default function NerveMap({
  nerves,
  active,
  onSelect,
}: {
  nerves: NerveDiagram[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="nerve-map" aria-label="Linked nerve diagram">
      <div className="section-kicker">RELATIONSHIP MAP · NOT TO SCALE</div>
      <h3>From nerve to muscle</h3>
      <p>
        This conceptual map links nerve supply to modeled structures. It does not show nerve course
        or branching geometry.
      </p>
      <svg
        viewBox="0 0 400 250"
        role="img"
        aria-label="Conceptual upper-limb nerve relationship diagram; use the buttons below to explore"
      >
        <path
          d="M35 30V220M35 40H110M35 80H110M35 120H110M35 160H110M35 200H110"
          fill="none"
          stroke="#c28b46"
          strokeWidth="3"
        />
        {nerves.map((n, i) => (
          <g key={n.id}>
            <path
              d={`M110 ${40 + i * 40} H350`}
              stroke={active === n.id ? "#157767" : "#d5deda"}
              strokeWidth="2"
            />
            <circle
              cx="110"
              cy={40 + i * 40}
              r="7"
              fill={active === n.id ? "#157767" : "#c28b46"}
            />
            <text x="128" y={35 + i * 40} fill="#253c3b" fontSize="12">
              {n.title}
            </text>
          </g>
        ))}
      </svg>
      <div className="nerve-buttons">
        {nerves.map((n) => (
          <button key={n.id} aria-pressed={active === n.id} onClick={() => onSelect(n.id)}>
            {n.title}
          </button>
        ))}
      </div>
      {nerves.find((n) => n.id === active) && (
        <p className="callout">{nerves.find((n) => n.id === active)?.description}</p>
      )}
    </section>
  );
}
