import { useState } from "react";
import AssetPreview from "./AssetPreview";
import { pairCompatible } from "./asset-runtime";
import type { VisualAsset } from "./types";
export default function AssetComparison({
  asset,
  assets,
}: {
  asset: VisualAsset;
  assets: VisualAsset[];
}) {
  const pair = assets.find((a) => a.id === asset.pairId);
  const compatible = pair && pairCompatible(asset, pair);
  const [view, setView] = useState<"affected" | "reference" | "compare">("affected");
  const reference = asset.role === "reference" ? asset : pair;
  const affected = asset.role === "reference" ? pair : asset;
  const bounds =
    compatible && asset.bounds && pair.bounds
      ? {
          min: asset.bounds.min.map((n, i) => Math.min(n, pair.bounds!.min[i])) as [
            number,
            number,
            number,
          ],
          max: asset.bounds.max.map((n, i) => Math.max(n, pair.bounds!.max[i])) as [
            number,
            number,
            number,
          ],
        }
      : undefined;
  return (
    <section className="asset-comparison">
      {compatible && (
        <nav aria-label="Model comparison">
          <button aria-pressed={view === "reference"} onClick={() => setView("reference")}>
            Reference
          </button>
          <button aria-pressed={view === "affected"} onClick={() => setView("affected")}>
            Affected
          </button>
          <button
            className="desktop-comparison"
            aria-pressed={view === "compare"}
            onClick={() => setView("compare")}
          >
            Compare
          </button>
        </nav>
      )}
      <div className={view === "compare" && compatible ? "asset-pair" : ""}>
        {view === "compare" && compatible ? (
          <>
            <AssetPreview asset={reference!} framing={bounds} locked />
            <AssetPreview asset={affected!} framing={bounds} locked />
          </>
        ) : (
          <AssetPreview
            asset={compatible ? (view === "reference" ? reference! : affected!) : asset}
            framing={bounds}
          />
        )}
      </div>
      {view === "compare" && compatible && (
        <p>Matched registration and fixed camera framing. Switch to either model to orbit.</p>
      )}
    </section>
  );
}
