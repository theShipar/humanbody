import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createExplosionLayout } from "./explosion-layout";
import { decodeModelResponse } from "./model-download";
import { PointerTap } from "./pointer-tap";
import { SYSTEMS, type Atlas, type SceneState } from "./anatomy";
import { visiblePart, partOpacity, pickablePart } from "./viewer-state";
interface Props {
  atlas: Atlas;
  state: SceneState;
  onSelect: (id: string) => void;
  onFocus?: (id: string) => void;
  torchCursor?: { x: number; y: number; active: boolean };
  onZoom?: (percent: number) => void;
  onCameraInteraction?: () => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
}
export default function AnatomyScene({
  atlas,
  state,
  onSelect,
  onProgress,
  onError,
  onCameraInteraction,
  onZoom,
  onFocus,
  torchCursor,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(state),
    select = useRef(onSelect),
    progress = useRef(onProgress),
    error = useRef(onError);
  const focusCallback = useRef(onFocus);
  focusCallback.current = onFocus;
  const zoomCallback = useRef(onZoom);
  zoomCallback.current = onZoom;
  const cameraInteraction = useRef(onCameraInteraction);
  cameraInteraction.current = onCameraInteraction;
  latest.current = state;
  select.current = onSelect;
  progress.current = onProgress;
  error.current = onError;
  useEffect(() => {
    const el = host.current!;
    let disposed = false,
      frame = 0,
      dirty = true,
      ready = false,
      last: SceneState | null = null,
      amount = 0,
      lastCamera = "",
      lastCommand = -1,
      pendingFrame = 0;
    const abort = new AbortController();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      error.current("WebGL is unavailable. Lessons and clinical reading remain available.");
      return;
    }
    renderer.setClearColor(0x090d0c, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.25 : 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive anatomy. Drag to orbit, use the camera dock to pan or zoom, and select a structure.",
    );
    renderer.domElement.tabIndex = 0;
    el.appendChild(renderer.domElement);
    const world = new T.Scene(),
      camera = new T.PerspectiveCamera(32, 1, 0.005, 100),
      controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0.2, 0.9, 4);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.zoomSpeed = 1.3;
    controls.dampingFactor = 0.22;
    controls.minDistance = 0.04;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.98;
    let fitDistance = 4,
      lastZoom = 100,
      lastZoomAt = 0;
    controls.addEventListener("change", () => {
      const percent = Math.round((100 * fitDistance) / camera.position.distanceTo(controls.target));
      const now = performance.now();
      if (percent !== lastZoom && now - lastZoomAt > 70) {
        lastZoom = percent;
        lastZoomAt = now;
        zoomCallback.current?.(percent);
      }
      dirty = true;
    });
    world.add(new T.HemisphereLight(0xe9f0df, 0x52635e, 1.2));
    const key = new T.DirectionalLight(0xfff4d9, 2.1);
    key.position.set(-2, 3, 4);
    world.add(key);
    const rim = new T.DirectionalLight(0xa5c8b7, 1.8);
    rim.position.set(3, 1, -2);
    world.add(rim);
    const fill = new T.DirectionalLight(0xffffff, 1);
    fill.position.set(2, 0.8, 3);
    world.add(fill);
    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length),
      transforms = new Float32Array(width * 4),
      flags = new Uint8Array(width * 4);
    const transformTexture = new T.DataTexture(transforms, width, 1, T.RGBAFormat, T.FloatType),
      flagTexture = new T.DataTexture(flags, width, 1);
    transformTexture.needsUpdate = true;
    flagTexture.needsUpdate = true;
    const geometries: T.BufferGeometry[] = [],
      materials: T.Material[] = [],
      pickers: (T.Mesh | undefined)[] = [],
      batches: T.Mesh[] = [],
      wires: T.LineSegments[] = [];
    const bounds = atlas.parts.map(
        (p) =>
          new T.Box3(
            new T.Vector3().fromArray(p.bounds[0]),
            new T.Vector3().fromArray(p.bounds[1]),
          ),
      ),
      centers = bounds.map((b) => b.getCenter(new T.Vector3()));
    const indexById = new Map(atlas.parts.map((p, i) => [p.id, i]));
    const uniforms = {
      partState: { value: transformTexture },
      partFlags: { value: flagTexture },
      stateWidth: { value: width },
      xray: { value: 0 },
      torchMode: { value: 0 },
      torchCircle: { value: new T.Vector3() },
    };
    const vertexHeader =
      "attribute float partIndex; uniform sampler2D partState; uniform sampler2D partFlags; uniform float stateWidth; varying vec4 stateFlags; varying float enabled;\n";
    const vertexState =
      "vec2 uvPart=vec2((partIndex+0.5)/stateWidth,0.5); vec4 part=texture2D(partState,uvPart); stateFlags=texture2D(partFlags,uvPart); enabled=part.w;";
    const materialFor = (system: string) => {
      const m = new T.MeshStandardMaterial({
        color: system === "skeletal" ? "#e5e0ca" : SYSTEMS.find((s) => s.id === system)?.color,
        metalness: 0.12,
        roughness: 0.45,
        side: T.DoubleSide,
      });
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms, {
          torchSystem: {
            value:
              system === "skeletal" ? 1 : system === "venous" ? 2 : system === "arterial" ? 3 : 0,
          },
        });
        shader.vertexShader = vertexHeader + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${vertexState} transformed+=part.xyz;`,
        );
        shader.fragmentShader =
          "varying vec4 stateFlags; varying float enabled; uniform float xray; uniform float torchMode; uniform float torchSystem; uniform vec3 torchCircle;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>\nbool inTorch= torchMode>0.5 && distance(gl_FragCoord.xy,torchCircle.xy)<torchCircle.z; if(enabled<0.5 || stateFlags.g<0.005)discard; if(inTorch){if(abs(torchSystem-(torchMode>3.5?1.0:torchMode))>0.1)discard;}else if(stateFlags.a<0.5)discard;\nif(xray<0.5){float screenDoor=fract(dot(floor(gl_FragCoord.xy),vec2(0.75487766,0.56984029)));if(screenDoor>stateFlags.g)discard;}`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nvec3 highlight=mix(vec3(0.18,1.0,0.035),vec3(1.0,0.43,0.27),stateFlags.b);diffuseColor.rgb=mix(diffuseColor.rgb,highlight,stateFlags.r*0.96);if(xray>0.5){diffuseColor.rgb=mix(vec3(0.58,0.75,0.72),highlight,stateFlags.r);diffuseColor.a=mix(stateFlags.g*0.085,0.85,stateFlags.r);} if(inTorch && torchMode>3.5){diffuseColor.rgb=vec3(0.035,0.42,0.75);diffuseColor.a=0.24;}",
        );
      };
      const compile = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        compile.call(m, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "float selectionRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0); outgoingLight+=vec3(0.18,1.0,0.035)*(0.12+selectionRim*0.75)*stateFlags.r;\n#include <opaque_fragment>",
        );
      };
      materials.push(m);
      return m;
    };
    const mats = new Map(SYSTEMS.map((s) => [s.id, materialFor(s.id)]));
    function createWires() {
      if (wires.length) return;
      const stride = Math.max(
        1,
        Math.ceil(atlas.triangles / (el.clientWidth < 768 ? 22000 : 65000)),
      );
      const wm = new T.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        vertexShader:
          vertexHeader +
          `void main(){${vertexState} gl_Position=projectionMatrix*modelViewMatrix*vec4(position+part.xyz,1.);}`,
        fragmentShader:
          "varying vec4 stateFlags; varying float enabled; void main(){if(enabled<0.5)discard;vec3 tint=mix(vec3(.48,.61,.57),mix(vec3(.18,1.,.035),vec3(1.,.45,.3),stateFlags.b),stateFlags.r);gl_FragColor=vec4(tint,mix(.10,.95,stateFlags.r));}",
      });
      materials.push(wm);
      for (const batch of batches) {
        const g = batch.geometry,
          p = g.getAttribute("position"),
          pi = g.getAttribute("partIndex"),
          ix = g.index!;
        const pts: number[] = [],
          ids: number[] = [];
        for (let t = 0; t < ix.count; t += 3 * stride) {
          for (const [a, b] of [
            [0, 1],
            [1, 2],
            [2, 0],
          ]) {
            for (const v of [a, b]) {
              const i = ix.getX(t + v);
              pts.push(p.getX(i), p.getY(i), p.getZ(i));
              ids.push(pi.getX(i));
            }
          }
        }
        const wg = new T.BufferGeometry();
        wg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
        wg.setAttribute("partIndex", new T.Float32BufferAttribute(ids, 1));
        geometries.push(wg);
        const line = new T.LineSegments(wg, wm);
        line.frustumCulled = false;
        world.add(line);
        wires.push(line);
      }
    }
    let loaded = 0;
    async function loadChunk(ci: number) {
      const chunk = atlas.chunks[ci],
        compressed = !!chunk.gzip && typeof DecompressionStream !== "undefined";
      const response = await fetch(compressed ? chunk.gzip! : chunk.url, { signal: abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed) return;
      const groups = new Map<string, T.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3),
        );
        g.setAttribute(
          "normal",
          new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true),
        );
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.setAttribute(
          "partIndex",
          new T.Float32BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1),
        );
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const picker = new T.Mesh(g);
        picker.matrixAutoUpdate = false;
        pickers[i] = picker;
        geometries.push(g);
        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const g = mergeGeometries(gs, false);
        if (!g) throw new Error("Unable to assemble anatomy.");
        geometries.push(g);
        const mesh = new T.Mesh(g, mats.get(system as never));
        mesh.frustumCulled = false;
        batches.push(mesh);
        world.add(mesh);
      });
      loaded++;
      progress.current(Math.round((loaded / atlas.chunks.length) * 100));
      last = null;
      dirty = true;
    }
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (cursor < atlas.chunks.length) await loadChunk(cursor++);
          }),
        );
        if (!disposed) {
          ready = true;
          last = null;
          dirty = true;
        }
      } catch (e) {
        if (!disposed) error.current(e instanceof Error ? e.message : "Could not load anatomy.");
      }
    })();
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2(),
      tap = new PointerTap(),
      testBox = new T.Box3(),
      point = new T.Vector3();
    let flight: {
      start: number;
      duration: number;
      from: T.Vector3;
      to: T.Vector3;
      fromTarget: T.Vector3;
      toTarget: T.Vector3;
    } | null = null;
    let zoomDistance = 0;
    controls.addEventListener("start", () => {
      pendingFrame = 0;
      cameraInteraction.current?.();
      flight = null;
      zoomDistance = 0;
    });
    function flyTo(target: T.Vector3, position: T.Vector3, immediate = false, duration = 18) {
      zoomDistance = 0;
      if (immediate || reduce.matches) {
        controls.target.copy(target);
        camera.position.copy(position);
        controls.update();
        flight = null;
      } else
        flight = {
          start: performance.now(),
          duration,
          from: camera.position.clone(),
          to: position,
          fromTarget: controls.target.clone(),
          toTarget: target,
        };
      dirty = true;
    }
    /** Aim the camera distance; the frame loop chases it so input applies on the next frame. */
    function zoomTo(distance: number) {
      flight = null;
      zoomDistance = T.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
      dirty = true;
    }
    function wheelZoom(event: WheelEvent) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el!.clientHeight : 1);
      const distance = camera.position.distanceTo(controls.target);
      zoomTo(distance * Math.exp(T.MathUtils.clamp(delta * 0.0078, -1, 1)));
    }
    renderer.domElement.addEventListener("wheel", wheelZoom, { capture: true, passive: false });
    function frameSelection(immediate = false) {
      const s = latest.current;
      const chosen = s.focusParts?.length
        ? new Set(s.focusParts)
        : s.isolate
          ? new Set(s.selected)
          : null;
      const box = new T.Box3();
      atlas.parts.forEach((p, i) => {
        if (visiblePart(p, s) && (!chosen || chosen.has(p.id)))
          box.union(
            bounds[i]
              .clone()
              .translate(
                new T.Vector3(transforms[i * 4], transforms[i * 4 + 1], transforms[i * 4 + 2]),
              ),
          );
      });
      if (box.isEmpty()) return;
      const size = box.getSize(new T.Vector3()),
        center = box.getCenter(new T.Vector3()),
        inset = s.insets ?? { left: 20, right: 20, top: 30, bottom: 30 };
      const w = el.clientWidth,
        h = el.clientHeight,
        aw = Math.max(100, w - inset.left - inset.right),
        ah = Math.max(100, h - inset.top - inset.bottom);
      camera.setViewOffset(
        w,
        h,
        (inset.right - inset.left) / 2,
        (inset.bottom - inset.top) / 2,
        w,
        h,
      );
      const distance =
        Math.max(
          0.08,
          Math.max((size.y * h) / ah, (size.x * w) / aw / camera.aspect) /
            (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) +
            size.z * 0.35,
        ) * 1.07;
      fitDistance = distance;
      const direction =
        s.view === "front"
          ? new T.Vector3(0, 0, 1)
          : s.view === "back"
            ? new T.Vector3(0, 0, -1)
            : s.view === "side"
              ? new T.Vector3(1, 0, 0)
              : new T.Vector3(0.28, 0.05, 1).normalize();
      flyTo(center, center.clone().addScaledVector(direction, distance), immediate);
    }
    function pickAt(x: number, y: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, (-(y - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity,
        found = -1;
      pickers.forEach((mesh, i) => {
        if (!mesh || !pickablePart(atlas.parts[i], latest.current)) return;
        testBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(testBox, point)) return;
        const hit = raycaster.intersectObject(mesh, false)[0];
        if (hit && hit.distance < nearest) {
          nearest = hit.distance;
          found = i;
        }
      });
      return found;
    }
    const hover = document.createElement("div");
    hover.className = "part-hover";
    hover.role = "tooltip";
    hover.hidden = true;
    el.appendChild(hover);
    let hoverAt = 0;
    const down = (e: PointerEvent) => {
      flight = null;
      zoomDistance = 0;
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
    };
    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (
        latest.current.torch ||
        latest.current.labelsVisible === false ||
        e.buttons ||
        e.pointerType === "touch"
      ) {
        hover.hidden = true;
        return;
      }
      if (performance.now() - hoverAt < 90) return;
      hoverAt = performance.now();
      const i = pickAt(e.clientX, e.clientY);
      hover.hidden = i < 0;
      if (i >= 0) {
        hover.textContent = atlas.parts[i].name;
        const r = el.getBoundingClientRect();
        hover.style.left = `${Math.min(el.clientWidth - 220, Math.max(8, e.clientX - r.left + 14))}px`;
        hover.style.top = `${Math.max(8, e.clientY - r.top - 35)}px`;
      }
    };
    let lastTap = { id: "", time: 0, x: 0, y: 0 };
    const up = (e: PointerEvent) => {
      if (latest.current.torch) return;
      if (!tap.up(e.pointerId, e.clientX, e.clientY) || !ready) return;
      const i = pickAt(e.clientX, e.clientY);
      if (i >= 0) {
        const id = atlas.parts[i].id,
          now = performance.now();
        if (
          focusCallback.current &&
          lastTap.id === id &&
          now - lastTap.time < 340 &&
          Math.hypot(lastTap.x - e.clientX, lastTap.y - e.clientY) < 24
        ) {
          focusCallback.current(id);
          lastTap.time = 0;
        } else {
          select.current(id);
          lastTap = { id, time: now, x: e.clientX, y: e.clientY };
        }
      }
    };
    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const keydown = (e: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "0"].includes(e.key))
        return;
      e.preventDefault();
      e.stopPropagation();
      flight = null;
      zoomDistance = 0;
      const v = camera.position.clone().sub(controls.target);
      if (e.key === "+" || e.key === "-") v.multiplyScalar(e.key === "+" ? 0.85 : 1.18);
      else if (e.key === "0") {
        frameSelection();
        return;
      } else {
        const sph = new T.Spherical().setFromVector3(v);
        sph.theta += e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
        sph.phi = T.MathUtils.clamp(
          sph.phi + (e.key === "ArrowUp" ? -0.1 : e.key === "ArrowDown" ? 0.1 : 0),
          0.05,
          Math.PI - 0.05,
        );
        v.setFromSpherical(sph);
      }
      camera.position.copy(controls.target).add(v);
      controls.update();
      dirty = true;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("keydown", keydown);
    const labelLayer = document.createElement("div");
    labelLayer.className = "anatomy-labels";
    el.appendChild(labelLayer);
    let labelKey = "";
    const labels: { node: HTMLDivElement; index: number; pinned: boolean }[] = [];
    function syncLabels(s: SceneState) {
      const annotations =
        s.labelsVisible === false
          ? []
          : s.annotations?.length
            ? s.annotations.slice(0, 3)
            : s.selected.slice(0, 1).map((partId) => ({
                partId,
                label: atlas.parts[indexById.get(partId) ?? -1]?.name ?? "",
                pinned: false,
              }));
      const next = JSON.stringify(annotations);
      if (next === labelKey) return;
      labelKey = next;
      labelLayer.replaceChildren();
      labels.length = 0;
      for (const a of annotations) {
        const i = indexById.get(a.partId);
        if (i === undefined) continue;
        const node = document.createElement("div");
        node.className = "anatomy-label" + ("clinical" in a && a.clinical ? " clinical" : "");
        node.textContent = a.label;
        labelLayer.appendChild(node);
        labels.push({ node, index: i, pinned: !!a.pinned });
      }
    }
    function positionLabels() {
      const used: { x: number; y: number }[] = [];
      const inset = latest.current.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
      for (const l of labels) {
        const p = centers[l.index]
          .clone()
          .add(
            new T.Vector3(
              transforms[l.index * 4],
              transforms[l.index * 4 + 1],
              transforms[l.index * 4 + 2],
            ),
          );
        const screen = p.clone().project(camera);
        let hide =
          !visiblePart(atlas.parts[l.index], latest.current) || screen.z > 1 || screen.z < -1;
        const x = ((screen.x + 1) * el.clientWidth) / 2,
          y = ((1 - screen.y) * el.clientHeight) / 2;
        if (
          latest.current.exclusions?.some(
            (r) =>
              x + 210 > r.x && x - 40 < r.x + r.width && y + 48 > r.y && y - 12 < r.y + r.height,
          )
        )
          hide = true;
        if (!l.pinned && !hide) {
          raycaster.set(camera.position, p.clone().sub(camera.position).normalize());
          const targetDistance = camera.position.distanceTo(p);
          for (let i = 0; i < pickers.length; i++) {
            const mesh = pickers[i];
            if (
              !mesh ||
              i === l.index ||
              !pickablePart(atlas.parts[i], latest.current) ||
              partOpacity(atlas.parts[i], latest.current) < 0.4
            )
              continue;
            testBox.copy(bounds[i]).translate(mesh.position);
            if (!raycaster.ray.intersectBox(testBox, point)) continue;
            const hit = raycaster.intersectObject(mesh, false)[0];
            if (hit && hit.distance < targetDistance - 0.015) {
              hide = true;
              break;
            }
          }
        }
        let ly = y;
        for (const prev of used)
          if (Math.abs(prev.y - ly) < 42 && Math.abs(prev.x - x) < 220) ly = prev.y + 44;
        if (
          x < inset.left ||
          x > el.clientWidth - inset.right - 180 ||
          ly < inset.top ||
          ly > el.clientHeight - inset.bottom - 32
        )
          hide = true;
        l.node.hidden = hide;
        if (!hide) {
          l.node.style.transform = `translate(${x}px,${ly}px)`;
          used.push({ x, y: ly });
        }
      }
    }
    const resize = () => {
      const oldAspect = camera.aspect;
      renderer.setPixelRatio(Math.min(devicePixelRatio, el.clientWidth < 768 ? 1.25 : 1.75));
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      if (Math.abs(oldAspect - camera.aspect) > 0.01) pendingFrame = 3;
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    let lastTime = performance.now();
    let cursorKey = "";
    let drawCount = 0,
      drawMs = 0;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const now = performance.now(),
        dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const s = latest.current;
      if (s.labelsVisible === false) hover.hidden = true;
      const moving = Math.abs(amount - s.explode) > 0.001;
      if (moving) amount = reduce.matches ? s.explode : T.MathUtils.damp(amount, s.explode, 10, dt);
      if (last !== s || moving) {
        const visible = atlas.parts.filter((p) => visiblePart(p, s));
        const layout = amount > 0.001 ? createExplosionLayout(visible, camera.aspect) : null;
        const clinical = new Set(s.annotations?.filter((a) => a.clinical).map((a) => a.partId));
        atlas.parts.forEach((p, i) => {
          const c = centers[i],
            cell = layout?.cells.get(p.id);
          const offset = cell
            ? new T.Vector3(cell.x - c.x, cell.y + 0.85 - c.y, -c.z).multiplyScalar(amount)
            : new T.Vector3();
          const torchPart =
            !!s.torch &&
            p.system === (s.torch.mode === "xray" ? "skeletal" : s.torch.mode) &&
            (!s.regionParts || s.regionParts.includes(p.id)) &&
            !s.hidden?.includes(p.id);
          transforms.set(
            [offset.x, offset.y, offset.z, visiblePart(p, s) || torchPart ? 1 : 0],
            i * 4,
          );
          flags.set(
            [
              s.selected.includes(p.id) ? 255 : 0,
              Math.round((torchPart ? 1 : partOpacity(p, s)) * 255),
              clinical.has(p.id) ? 255 : 0,
              visiblePart(p, s) ? 255 : 0,
            ],
            i * 4,
          );
          const picker = pickers[i];
          if (picker) {
            picker.position.copy(offset);
            picker.updateMatrix();
            picker.updateMatrixWorld(true);
          }
        });
        transformTexture.needsUpdate = true;
        flagTexture.needsUpdate = true;
        const xray = s.renderMode === "xray";
        uniforms.xray.value = xray ? 1 : 0;
        uniforms.torchMode.value = s.torch
          ? { skeletal: 1, venous: 2, arterial: 3, xray: 4 }[s.torch.mode]
          : 0;
        for (const [system, m] of mats) {
          const translucent = xray || (s.torch?.mode === "xray" && system === "skeletal");
          m.depthWrite = !xray;
          m.blending = xray ? T.AdditiveBlending : T.NormalBlending;
          if (m.transparent !== translucent) {
            m.transparent = translucent;
            m.depthWrite = !xray;
            m.blending = xray ? T.AdditiveBlending : T.NormalBlending;
            m.needsUpdate = true;
          }
        }
        if (s.renderMode === "wireframe" && ready) createWires();
        wires.forEach((w) => (w.visible = s.renderMode === "wireframe"));
        syncLabels(s);
        last = s;
        dirty = true;
      }
      const cameraKey = [s.reset, s.view, s.focusParts?.join(",")].join(":");
      if (cameraKey !== lastCamera) {
        pendingFrame = 3;
        lastCamera = cameraKey;
      }
      if (pendingFrame > 0 && --pendingFrame === 0) frameSelection();
      if (s.cameraCommand && s.cameraCommand.id !== lastCommand) {
        lastCommand = s.cameraCommand.id;
        if (s.cameraCommand.type === "frame") frameSelection();
        else
          zoomTo(
            camera.position.distanceTo(controls.target) *
              (s.cameraCommand.type === "zoom-in" ? 1 / 2.46 : 2.46),
          );
      }
      if (moving) frameSelection(true);
      if (flight) {
        const t = Math.min(1, (now - flight.start) / flight.duration),
          ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(flight.from, flight.to, ease);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
        if (t === 1) flight = null;
        dirty = true;
      }
      if (zoomDistance > 0 && !flight) {
        const offset = camera.position.clone().sub(controls.target),
          current = offset.length(),
          next = T.MathUtils.damp(current, zoomDistance, 504, dt),
          settled = Math.abs(next - zoomDistance) < Math.max(0.0008, zoomDistance * 0.004);
        camera.position.copy(controls.target).add(offset.setLength(settled ? zoomDistance : next));
        if (settled) {
          zoomDistance = 0;
          const percent = Math.round(
            (100 * fitDistance) / camera.position.distanceTo(controls.target),
          );
          if (percent !== lastZoom) {
            lastZoom = percent;
            zoomCallback.current?.(percent);
          }
        }
        dirty = true;
      }
      controls.enableRotate = s.interaction !== "pan";
      controls.enablePan = true;
      controls.mouseButtons.LEFT = s.interaction === "pan" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
      controls.touches.ONE = s.interaction === "pan" ? T.TOUCH.PAN : T.TOUCH.ROTATE;
      controls.autoRotate = !!s.rotate && !reduce.matches;
      controls.autoRotateSpeed = 0.6;
      controls.update();
      if (controls.autoRotate) dirty = true;
      if (s.torch && torchCursor) {
        const next = `${torchCursor.x}:${torchCursor.y}:${torchCursor.active}:${s.torch.radius}`;
        if (next !== cursorKey) {
          cursorKey = next;
          dirty = true;
        }
        uniforms.torchMode.value = torchCursor.active
          ? { skeletal: 1, venous: 2, arterial: 3, xray: 4 }[s.torch.mode]
          : 0;
      }
      if (dirty) {
        const start = performance.now();
        if (s.torch) {
          const ratio = renderer.getPixelRatio();
          uniforms.torchCircle.value.set(
            (torchCursor?.x ?? s.torch.x) * el.clientWidth * ratio,
            (1 - (torchCursor?.y ?? s.torch.y)) * el.clientHeight * ratio,
            Math.min(s.torch.radius ?? 110, el.clientWidth * 0.35) * ratio,
          );
        }
        renderer.render(world, camera);
        positionLabels();
        drawMs += performance.now() - start;
        drawCount++;
        if (drawCount % 60 === 0) {
          renderer.domElement.dataset.renderMs = (drawMs / drawCount).toFixed(2);
          renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
          renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
        }
        dirty = false;
      }
    };
    animate();
    const lost = (e: Event) => {
      e.preventDefault();
      error.current("The graphics session was lost. Reload the page to restore 3D.");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      transformTexture.dispose();
      flagTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      renderer.domElement.removeEventListener("wheel", wheelZoom, true);
      hover.remove();
      labelLayer.remove();
    };
  }, [atlas]);
  return <div className="scene" ref={host} />;
}
