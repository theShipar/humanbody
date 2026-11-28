import { useEffect, useRef } from "react";
import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SYSTEMS, type Atlas, type Part } from "../anatomy";

// All cards share one renderer; mounting the drawer never creates more WebGL contexts.
let renderer: T.WebGLRenderer | undefined;
const buffers = new Map<string, Promise<ArrayBuffer>>();
const models = new Map<string, Promise<T.Group>>();
const users = new Map<string, number>();
const jobs = new Set<(time: number) => void>();
let frame = 0;
function tick(time: number) {
  jobs.forEach((draw) => draw(time));
  frame = jobs.size ? requestAnimationFrame(tick) : 0;
}
async function model(atlas: Atlas, parts: Part[], key: string) {
  if (!models.has(key))
    models.set(
      key,
      (async () => {
        const groups = new Map<string, T.BufferGeometry[]>();
        await Promise.all(
          [...new Set(parts.map((p) => p.chunk))].map(async (ci) => {
            const url = atlas.chunks[ci].url;
            if (!buffers.has(url))
              buffers.set(
                url,
                fetch(url).then((r) => {
                  if (!r.ok) throw Error("Preview unavailable");
                  return r.arrayBuffer();
                }),
              );
            const buffer = await buffers.get(url)!;
            for (const p of parts.filter((p) => p.chunk === ci)) {
              const g = new T.BufferGeometry();
              g.setAttribute(
                "position",
                new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3),
              );
              g.setAttribute(
                "normal",
                new T.BufferAttribute(
                  new Int16Array(buffer, p.normals, p.vertexCount * 3),
                  3,
                  true,
                ),
              );
              g.setIndex(
                new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1),
              );
              const list = groups.get(p.system) ?? [];
              list.push(g);
              groups.set(p.system, list);
            }
          }),
        );
        const group = new T.Group();
        for (const [system, geometries] of groups) {
          const geometry = mergeGeometries(geometries)!;
          geometries.forEach((g) => g.dispose());
          group.add(
            new T.Mesh(
              geometry,
              new T.MeshStandardMaterial({
                color:
                  system === "skeletal" ? "#e5e0ca" : SYSTEMS.find((s) => s.id === system)?.color,
                roughness: 0.48,
                metalness: 0.05,
                side: T.DoubleSide,
              }),
            ),
          );
        }
        const bounds = new T.Box3().setFromObject(group);
        const center = bounds.getCenter(new T.Vector3());
        group.children.forEach((child) => child.position.sub(center));
        return group;
      })(),
    );
  return models.get(key)!;
}
export default function AnatomyPreview({
  atlas,
  parts,
  spinning = false,
  label,
  speed = 1,
}: {
  atlas: Atlas;
  parts: Part[];
  spinning?: boolean;
  label: string;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = parts.map((p) => p.id).join(",");
  useEffect(() => {
    const canvas = ref.current!;
    users.set(key, (users.get(key) ?? 0) + 1);
    let cancelled = false,
      visible = true;
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    observer.observe(canvas);
    let draw: ((time: number) => void) | undefined;
    model(atlas, parts, key)
      .then((source) => {
        if (cancelled) return;
        renderer ??= new T.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0, 0);
        const world = new T.Scene(),
          group = source.clone();
        world.add(group, new T.HemisphereLight(0xffffff, 0x55504a, 2));
        const light = new T.DirectionalLight(0xfff5e4, 3);
        light.position.set(-2, 3, 4);
        world.add(light);
        const fill = new T.DirectionalLight(0xddeaff, 1);
        fill.position.set(3, 1, -2);
        world.add(fill);
        const box = new T.Box3().setFromObject(group),
          size = box.getSize(new T.Vector3());
        const camera = new T.PerspectiveCamera(32, 1, 0.001, 100);
        const context = canvas.getContext("2d")!;
        const reduce = matchMedia("(prefers-reduced-motion: reduce)");
        let last = -Infinity,
          painted = false,
          oldWidth = 0;
        draw = (time) => {
          if (!visible || document.hidden || time - last < (spinning ? 33 : 50)) return;
          const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(Math.max(devicePixelRatio, 2), 3)));
          const height = Math.max(
            1,
            Math.round(canvas.clientHeight * Math.min(Math.max(devicePixelRatio, 2), 3)),
          );
          if (painted && (!spinning || reduce.matches) && oldWidth === width) return;
          last = time;
          oldWidth = width;
          painted = true;
          canvas.width = width;
          canvas.height = height;
          camera.aspect = width / height;
          const horizontal = spinning ? Math.hypot(size.x, size.z) : size.x;
          const fit =
            (Math.max(size.y, horizontal / camera.aspect) * (label === "Rotating skull" ? 0.52 : 0.62)) /
            Math.tan(T.MathUtils.degToRad(16));
          camera.position.set(0, 0, fit + size.z / 2);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
          group.rotation.y = spinning && !reduce.matches ? time * 0.00022 * speed : -0.28;
          renderer!.setSize(width, height, false);
          renderer!.render(world, camera);
          context.clearRect(0, 0, width, height);
          context.drawImage(renderer!.domElement, 0, 0);
        };
        jobs.add(draw);
        if (!frame) frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancelled) canvas.setAttribute("aria-label", `${label} preview unavailable`);
      });
    return () => {
      cancelled = true;
      observer.disconnect();
      if (draw) jobs.delete(draw);
      users.set(key, (users.get(key) ?? 1) - 1);
      // Release merged geometry when no mounted preview uses it.
      if (!users.get(key)) {
        users.delete(key);
        const unused = models.get(key);
        models.delete(key);
        unused
          ?.then((group) =>
            group.children.forEach((child) => {
              const mesh = child as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
              mesh.geometry.dispose();
              mesh.material.dispose();
            }),
          )
          .catch(() => {});
      }
    };
  }, [atlas, key, spinning, speed]);
  return <canvas ref={ref} className="anatomy-preview" role="img" aria-label={label} />;
}
