import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  DirectionalLight,
  Box3,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeAsset, loadModelAsset } from "./asset-runtime";
import type { VisualAsset } from "./types";
/** Separate registered asset scene: the normal atlas is never replaced during loading. */
export default function AssetPreview({
  asset,
  framing,
  locked = false,
}: {
  asset: VisualAsset;
  framing?: VisualAsset["bounds"];
  locked?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState("Loading explanation asset…");
  useEffect(() => {
    if (asset.format !== "glb" || !host.current) return;
    const el = host.current,
      abort = new AbortController();
    request.current = abort;
    let disposed = false,
      model: Awaited<ReturnType<typeof loadModelAsset>> | undefined,
      renderer: WebGLRenderer | undefined,
      controls: OrbitControls | undefined,
      observer: ResizeObserver | undefined,
      raf = 0;
    setStatus("Loading explanation asset…");
    void loadModelAsset(asset, abort.signal)
      .then((root) => {
        if (disposed) {
          disposeAsset(root);
          return;
        }
        model = root;
        renderer = new WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        el.appendChild(renderer.domElement);
        const scene = new Scene();
        scene.add(root, new AmbientLight(0xffffff, 2));
        const light = new DirectionalLight(0xffffff, 3);
        light.position.set(2, 3, 5);
        scene.add(light);
        const camera = new PerspectiveCamera(40, 1, 0.001, 1000);
        const bounds = framing
            ? new Box3(new Vector3(...framing.min), new Vector3(...framing.max))
            : new Box3().setFromObject(root),
          center = bounds.getCenter(new Vector3()),
          radius = bounds.getSize(new Vector3()).length() / 2;
        camera.position.copy(center).add(new Vector3(0, 0, radius * 3));
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enabled = !locked;
        controls.update();
        observer = new ResizeObserver(() => {
          const w = el.clientWidth,
            h = 280;
          renderer!.setSize(w, h);
          camera.aspect = w / h;
          if (locked)
            camera.position
              .copy(center)
              .add(new Vector3(0, 0, (radius * 3) / Math.min(1, camera.aspect)));
          camera.updateProjectionMatrix();
          renderer!.render(scene, camera);
        });
        observer.observe(el);
        const render = () => {
          if (!disposed) renderer!.render(scene, camera);
        };
        controls.addEventListener("change", render);
        render();
        setStatus("");
      })
      .catch((error) => {
        if (model) {
          disposeAsset(model);
          model = undefined;
        }
        renderer?.dispose();
        renderer?.domElement.remove();
        if (!abort.signal.aborted)
          setStatus(`Asset unavailable. ${error instanceof Error ? error.message : "Try again."}`);
      });
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      observer?.disconnect();
      controls?.dispose();
      if (model) disposeAsset(model);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [asset, attempt, locked, JSON.stringify(framing)]);
  if (asset.format === "svg")
    return (
      <figure className="stage-diagram">
        <img
          src={asset.url}
          alt={asset.objectives.join(" ")}
          onError={() => setStatus("Diagram unavailable. The explanation remains readable.")}
        />
        <figcaption>
          {asset.status === "draft" ? "Unapproved diagram" : "Reviewed diagram"}
        </figcaption>
        {status.startsWith("Diagram") && <p role="status">{status}</p>}
      </figure>
    );
  return (
    <section className="registered-asset">
      <span className="visual-type">
        {asset.status === "draft"
          ? "Technical preview · unapproved asset"
          : asset.role === "reference"
            ? "Reference model"
            : "Affected model"}
      </span>
      <div ref={host} />
      {status && <p role="status">{status}</p>}
      {status.startsWith("Loading") && (
        <button
          onClick={() => {
            request.current?.abort();
            setStatus("Asset unavailable. Loading cancelled.");
          }}
        >
          Cancel asset loading
        </button>
      )}
      {status.startsWith("Asset unavailable") && (
        <button onClick={() => setAttempt((n) => n + 1)}>Retry asset</button>
      )}
    </section>
  );
}
