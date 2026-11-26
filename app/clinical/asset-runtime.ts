import { Box3, Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { approved } from "../study/learning.ts";
import type { VisualAsset } from "./types";
export function pairCompatible(a: VisualAsset, b: VisualAsset) {
  return (
    !!a.registration &&
    !!b.registration &&
    a.registration.space === b.registration.space &&
    a.units === b.units &&
    a.pairId === b.id &&
    b.pairId === a.id &&
    approved(a) &&
    approved(b) &&
    !!a.bounds &&
    !!b.bounds &&
    a.role !== b.role &&
    !!a.role &&
    !!b.role
  );
}
export function visibleAssets(assets: VisualAsset[], stageId: string, preview = false) {
  return assets.filter(
    (a) => (preview || approved(a)) && (!a.stageIds?.length || a.stageIds.includes(stageId)),
  );
}
export function disposeAsset(root: Group) {
  root.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for (const value of Object.values(material))
          if (
            value &&
            typeof value === "object" &&
            "isTexture" in value &&
            (value as { isTexture: boolean }).isTexture
          )
            (value as unknown as { dispose: () => void }).dispose();
        material.dispose();
      }
    }
  });
  root.removeFromParent();
}
/** Fetch is abortable; a late parse is also disposed before it can be attached. */
export async function loadModelAsset(asset: VisualAsset, signal: AbortSignal) {
  if (asset.format !== "glb" || !asset.registration || !asset.units)
    throw new Error("Model registration is missing.");
  const response = await fetch(asset.url, { signal });
  if (!response.ok) throw new Error(`Asset unavailable (${response.status}).`);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const gltf = await new GLTFLoader().parseAsync(
    bytes,
    new URL(".", new URL(asset.url, location.href)).href,
  );
  const root = gltf.scene;
  if (signal.aborted) {
    disposeAsset(root);
    signal.throwIfAborted();
  }
  root.position.fromArray(asset.registration.position);
  root.rotation.set(...asset.registration.rotation);
  root.scale.setScalar(asset.units === "mm" ? 0.001 : asset.units === "cm" ? 0.01 : 1);
  root.scale.multiply(new Vector3(...asset.registration.scale));
  root.updateMatrixWorld(true);
  if (new Box3().setFromObject(root).isEmpty()) {
    disposeAsset(root);
    throw new Error("Model has no visible geometry.");
  }
  return root;
}
