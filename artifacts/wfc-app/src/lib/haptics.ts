export function hapticLight() {
  try { navigator.vibrate?.(12); } catch { /* unsupported */ }
}

export function hapticMedium() {
  try { navigator.vibrate?.(30); } catch { /* unsupported */ }
}

export function hapticHeavy() {
  try { navigator.vibrate?.(60); } catch { /* unsupported */ }
}

export function hapticSuccess() {
  try { navigator.vibrate?.([40, 30, 80]); } catch { /* unsupported */ }
}

export function hapticWheelSpin() {
  try { navigator.vibrate?.([20, 15, 20, 15, 20, 15, 40, 30, 100]); } catch { /* unsupported */ }
}
