export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function sleep(ms: number) {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise<void>((r) => setTimeout(r, ms));
}

function asEl(node: string | Element | null | undefined): HTMLElement | null {
  if (!node) return null;
  if (typeof node === "string") return document.getElementById(node);
  return node as HTMLElement;
}

export function floatText(el: Element | null, text: string, kind: "good" | "bad") {
  if (!el || !text) return;
  const r = el.getBoundingClientRect();
  const node = document.createElement("div");
  node.className = `fx-float ${kind}`;
  node.textContent = text;
  node.style.left = `${r.left + r.width / 2}px`;
  node.style.top = `${r.top + r.height * 0.2}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 900);
}

export function flashEl(el: Element | null, cls: "fx-flash-red" | "fx-flash-green") {
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 450);
}

export function unitEl(iid: string | undefined | null) {
  if (!iid) return null;
  return document.querySelector(`[data-iid="${CSS.escape(iid)}"]`);
}

export function faceEl(side: "player" | "ai") {
  return document.querySelector(`[data-drop="${side === "ai" ? "face" : "hero"}"]`);
}

export async function lunge(atkEl: Element | null, tgtEl: Element | null, dmg = 0, taken = 0, kill = false) {
  if (!atkEl) return;
  if (prefersReducedMotion()) {
    flashEl(tgtEl, "fx-flash-red");
    if (dmg) floatText(tgtEl || atkEl, `-${dmg}`, "bad");
    return;
  }
  const a = atkEl.getBoundingClientRect();
  const t = (tgtEl || atkEl).getBoundingClientRect();
  const dx = t.left + t.width / 2 - (a.left + a.width / 2);
  const dy = t.top + t.height / 2 - (a.top + a.height / 2);
  const el = atkEl as HTMLElement;
  el.classList.add("lunging");
  el.style.transition = "transform 0.28s cubic-bezier(.2,.85,.2,1)";
  el.style.zIndex = "24";
  el.style.transform = `translate(${dx * 0.72}px, ${dy * 0.72}px) scale(1.08)`;
  await sleep(280);
  flashEl(tgtEl, "fx-flash-red");
  flashEl(atkEl, "fx-flash-red");
  if (dmg) floatText(tgtEl || atkEl, `-${dmg}`, "bad");
  if (taken) floatText(atkEl, `-${taken}`, "bad");
  if (kill && tgtEl) tgtEl.classList.add("dying");
  await sleep(160);
  el.style.transform = "";
  await sleep(220);
  el.style.transition = "";
  el.style.zIndex = "";
  el.classList.remove("lunging");
}

export async function flyFromHand(from: string | Element | null, to: string | Element | null) {
  const src = asEl(from);
  const dest = asEl(to);
  if (!src || !dest || prefersReducedMotion()) {
    flashEl(dest, "fx-flash-green");
    return;
  }
  const origin = src.getBoundingClientRect();
  const target = dest.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "fly-ghost";
  ghost.style.left = `${origin.left}px`;
  ghost.style.top = `${origin.top}px`;
  ghost.style.width = `${Math.max(72, origin.width)}px`;
  ghost.style.height = `${Math.max(100, origin.height)}px`;
  const clone = src.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.width = "100%";
  ghost.appendChild(clone);
  document.body.appendChild(ghost);
  const dx = target.left + target.width / 2 - origin.left - origin.width / 2;
  const dy = target.top + target.height / 2 - origin.top - origin.height / 2;
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.62)`;
    ghost.style.opacity = "0.15";
  });
  await sleep(440);
  ghost.remove();
  flashEl(dest, "fx-flash-green");
}
