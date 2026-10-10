export function renderSwitch(button: HTMLButtonElement, on: boolean): void {
  button.classList.toggle("is-active", on);
  button.setAttribute("aria-checked", String(on));
}
