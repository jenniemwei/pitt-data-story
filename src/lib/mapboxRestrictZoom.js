/**
 * Disables scroll, pinch, double-click, keyboard, and box zoom so only explicit
 * controls (e.g. NavigationControl +/-) change zoom. Drag-pan stays on by default.
 *
 * @param {import("mapbox-gl").Map} map
 * @param {{ preserveDragPan?: boolean }} [opts]
 */
export function restrictMapboxFreeformZoom(map, opts = {}) {
  const { preserveDragPan = true } = opts;
  map.scrollZoom.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  map.dragRotate.disable();
  if (!preserveDragPan) {
    map.dragPan.disable();
  }
}
