/**
 * Svelte action attaching progressive-enhancement light-dismiss fallback (when `closedBy`
 * is missing from HTMLDialogElement.prototype) and resetting `dialog.returnValue = ''`
 * on close per modern-web-guidance (`dialog` + `light-dismiss-a-dialog`).
 */
export function enhanceModalDialog(dialog: HTMLDialogElement) {
  let pressedOutside = false;

  const isOutside = (ev: PointerEvent): boolean => {
    const r = dialog.getBoundingClientRect();
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
  };

  const hasNativeClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

  const onPointerDown = (ev: PointerEvent) => {
    if (!hasNativeClosedBy && dialog.getAttribute('closedby') === 'any') {
      pressedOutside = isOutside(ev);
    }
  };

  const onPointerUp = (ev: PointerEvent) => {
    if (!hasNativeClosedBy && dialog.getAttribute('closedby') === 'any' && pressedOutside) {
      pressedOutside = false;
      if (isOutside(ev)) {
        dialog.close('backdrop');
      }
    } else {
      pressedOutside = false;
    }
  };

  const onClose = () => {
    dialog.returnValue = '';
  };

  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('pointerup', onPointerUp);
  dialog.addEventListener('close', onClose);

  return {
    destroy() {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
      dialog.removeEventListener('close', onClose);
    },
  };
}
