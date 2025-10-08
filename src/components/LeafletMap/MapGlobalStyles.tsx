export default function MapGlobalStyles() {
  return (
    <style jsx global>{`
      :root {
        --pm-brand-1: #01677c;
        --pm-brand-2: #01677c;
        --pm-on-dark: #eef2ff;
        --pm-border: rgba(255,255,255,0.22);
        --pm-border-soft: rgba(255,255,255,0.14);
        --pm-zoom-ms: 300ms;
      }

      .leaflet-container { background: #05080f; outline: none; }
      .leaflet-pane.leaflet-marker-pane { z-index: 9998 !important; }
      .leaflet-pane.leaflet-popup-pane { z-index: 9999 !important; }

      .leaflet-control-zoom.leaflet-bar {
        border: 1px solid rgba(255,255,255,0.15) !important;
        background: rgba(0,0,0,0.60) !important;
        backdrop-filter: blur(6px);
        border-radius: 12px !important;
        overflow: hidden;
        box-shadow: 0 10px 28px rgba(0,0,0,0.45);
        z-index: 12100;
      }
      .leaflet-control-zoom.leaflet-bar a {
        width: 38px; height: 38px; line-height: 38px;
        font-size: 18px; font-weight: 800; color: #fff !important;
        background: transparent !important; border: 0 !important; text-align: center;
        cursor: pointer; transition: transform 120ms ease, background-color 120ms ease, opacity 120ms ease;
      }
      .leaflet-control-zoom.leaflet-bar a:hover { background: rgba(255,255,255,0.10) !important; }
      .leaflet-control-zoom.leaflet-bar a:active { transform: scale(0.98); }

      .pm-icon.pm-marker { background: transparent; border: 0; }
      .pm-marker-box { position: relative; }
      .pm-marker-pill {
        position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 8px; height: 24px; border-radius: 9999px; color: #fff; white-space: nowrap;
        background: linear-gradient(180deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.06) 100%),
                    linear-gradient(135deg, var(--pm-brand-1) 0%, var(--pm-brand-2) 100%);
        border: 1px solid var(--pm-border); backdrop-filter: blur(2px);
        box-shadow: 0 8px 18px rgba(0,0,0,.35);
      }
      .pm-marker-price { font-weight: 900; font-size: 12.5px; letter-spacing: .15px; }
      .pm-marker-pill.is-highlighted {
        background: linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%) !important;
        border-color: rgba(251,146,60,.95); color: #fff;
        box-shadow: 0 0 0 2px rgba(251,146,60,.35), 0 10px 22px rgba(0,0,0,.45);
        transform: translateX(-50%) scale(1.06);
      }

      .pm-cluster { background: transparent; border: 0; padding: 0; }
      .pm-cluster-outer { transform: translate(-50%, -100%); }
      .pm-cluster-pill {
        display: inline-flex; align-items: center; justify-content: center;
        height: 28px; padding: 0 12px; border-radius: 9999px;
        border: 1px solid var(--pm-border); color: #eef2ff;
        font-weight: 800; font-size: 13px; letter-spacing: .15px;
        background: radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,.18), rgba(255,255,255,0) 60%),
                    linear-gradient(135deg, var(--pm-brand-1) 0%, var(--pm-brand-2) 100%);
        box-shadow: 0 8px 18px rgba(0,0,0,.35);
      }
      .pm-cluster-outer.is-highlighted .pm-cluster-pill {
        background: linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%) !important;
        border-color: rgba(251,146,60,.95); color: #fff;
        box-shadow: 0 0 0 2px rgba(251,146,60,.35), 0 10px 22px rgba(0,0,0,.45);
      }

      .pm-popup .leaflet-popup-content { margin: 0 !important; padding: 0 !important; }
      .pm-popup .leaflet-popup-content-wrapper {
        background: radial-gradient(90% 100% at 100% 0%, rgba(124,58,237,.12), rgba(124,58,237,0) 70%), #0b1220;
        color: #e5eaf6; border: 1px solid var(--pm-border-soft); backdrop-filter: blur(6px);
        border-radius: 12px; box-shadow: 0 14px 34px rgba(2,4,8,.6); overflow: hidden;
      }
      .pm-popup .leaflet-popup-tip { background: #0b1220; border: 1px solid var(--pm-border-soft); }

      @media (max-width: 767px) {
        .leaflet-container .leaflet-popup,
        .leaflet-container .leaflet-popup-pane {
          display: none !important;
          visibility: hidden !important;
        }
      }
    `}</style>
  );
}
