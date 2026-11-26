import type { Stage } from "./types";
/** Original schematic illustrations, never atlas geometry or a patient image. */
export default function StageDiagram({ stage }: { stage: Stage }) {
  const diagram = stage.diagram;
  if (!diagram) return null;
  const changed = diagram.phase !== "reference";
  return (
    <figure className="stage-diagram">
      <svg
        viewBox="0 0 240 150"
        role="img"
        aria-label={`${stage.title}: illustrative ${diagram.kind} schematic, not to scale`}
      >
        {diagram.kind === "bone" ? (
          <>
            <path d="M20 55 Q5 45 10 70 Q5 95 25 85 L108 85 L108 55 Z" fill="#e9edd7" />
            <path
              d="M132 55 L213 55 Q235 45 230 70 Q238 95 214 85 L132 85 Z"
              fill="#e9edd7"
              transform={diagram.phase === "fracture" ? "rotate(8 132 70)" : ""}
            />
            {!changed && <rect x="106" y="55" width="28" height="30" fill="#e9edd7" />}
            {changed && (
              <path
                d="M114 54 L124 65 L116 76 L125 87"
                fill="none"
                stroke="#eeab84"
                strokeWidth="3"
              />
            )}
            {diagram.phase === "fixation" && (
              <>
                <rect x="75" y="46" width="90" height="10" rx="4" fill="#93bbc6" />
                {[85, 103, 139, 157].map((x) => (
                  <path key={x} d={`M${x} 45v42`} stroke="#93bbc6" strokeWidth="4" />
                ))}
              </>
            )}
            {diagram.phase === "support" && (
              <rect
                x="62"
                y="36"
                width="115"
                height="65"
                rx="10"
                fill="#a8c2ba55"
                stroke="#a8c2ba"
              />
            )}
            {diagram.phase === "healing" && (
              <ellipse cx="120" cy="70" rx="22" ry="25" fill="#d3e99b66" stroke="#d3e99b" />
            )}
          </>
        ) : (
          <>
            <path
              d="M70 28 Q90 12 120 28 Q150 12 170 28 Q181 49 159 92 L147 132 Q138 143 132 117 L120 85 L108 117 Q102 143 93 132 L81 92 Q59 49 70 28"
              fill="#eef0df"
              stroke="#d3dbc9"
              strokeWidth="2"
            />
            <path
              d="M83 38 Q101 29 120 40 Q139 29 157 38 L143 84 L132 105 L120 72 L108 105 L97 84Z"
              fill="#d1b889"
            />
            <path d="M106 49 Q120 40 134 49 L129 78 L120 66 L111 78Z" fill="#dba49a" />
            {diagram.phase === "mineral-loss" && (
              <ellipse
                cx="150"
                cy="30"
                rx="13"
                ry="5"
                fill="#fff"
                stroke="#ecb577"
                strokeWidth="2"
              />
            )}
            {diagram.phase === "cavity" && (
              <path d="M138 23 L159 24 L154 49 L143 44 Z" fill="#40352c" stroke="#eead83" />
            )}
            {diagram.phase === "filling" && (
              <path d="M138 23 L159 24 L154 49 L143 44 Z" fill="#92c9d1" stroke="#c1e4e8" />
            )}
            {diagram.phase === "early-care" && (
              <path d="M138 25 L159 26" stroke="#b5dd83" strokeWidth="6" />
            )}
          </>
        )}
        <text x="120" y="147" textAnchor="middle" fill="#a8b7a4" fontSize="10">
          SCHEMATIC · NOT TO SCALE
        </text>
      </svg>
      <figcaption>{stage.title} · Diagram draft</figcaption>
    </figure>
  );
}
