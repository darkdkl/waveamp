export function createDropdown(btn: HTMLButtonElement, menu: HTMLElement, wrap: HTMLElement) {
  function setOpen(open: boolean) {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("is-active", open);
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(Boolean(menu.hidden));
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !wrap.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setOpen(false);
  });
  return setOpen;
}
