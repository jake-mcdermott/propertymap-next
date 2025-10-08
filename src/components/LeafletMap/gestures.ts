import * as L from "leaflet";
import { MAP_MAX_ZOOM } from "./constants";
import { isMobileScreen } from "./helpers";

export function setupDoubleTapDragZoom(map: L.Map) {
  if (!isMobileScreen()) return () => {};
  const el = map.getContainer();

  try { map.doubleClickZoom.disable(); } catch {}

  let lastTap = 0, dragging = false, startY = 0, startZoom = map.getZoom();
  let anchor: L.LatLng | null = null, raf: number | null = null;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const toPt = (t: Touch) => {
    const r = el.getBoundingClientRect();
    return L.point(t.clientX - r.left, t.clientY - r.top);
  };

  const end = () => { dragging = false; anchor = null; try { map.dragging.enable(); } catch {} };

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) { if (dragging) end(); return; }
    const now = performance.now();
    const dt = now - lastTap; lastTap = now;
    if (dt < 300) {
      e.preventDefault(); e.stopPropagation();
      dragging = true; startY = e.touches[0].clientY; startZoom = map.getZoom();
      try { map.dragging.disable(); } catch {}
      try { anchor = map.containerPointToLatLng(toPt(e.touches[0])); } catch { anchor = null; }
    }
  };
  const onMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1 || !anchor) return;
    e.preventDefault(); e.stopPropagation();
    const dy = e.touches[0].clientY - startY;
    const next = clamp(startZoom + (-dy / 120), map.getMinZoom(), MAP_MAX_ZOOM);
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      try { map.setZoomAround(anchor as L.LatLng, next, { animate: false } as any); } catch {}
    });
  };
  const onEnd = () => { if (dragging) end(); };

  el.addEventListener("touchstart", onStart, { passive: false });
  el.addEventListener("touchmove", onMove, { passive: false });
  el.addEventListener("touchend", onEnd, { passive: false });
  el.addEventListener("touchcancel", onEnd, { passive: false });

  return () => {
    el.removeEventListener("touchstart", onStart as any);
    el.removeEventListener("touchmove", onMove as any);
    el.removeEventListener("touchend", onEnd as any);
    el.removeEventListener("touchcancel", onEnd as any);
    try { map.doubleClickZoom.enable(); } catch {}
    try { map.dragging.enable(); } catch {}
    if (raf) cancelAnimationFrame(raf);
  };
}
