import { $ } from '../dom';

export function initDrawer(): void {
  const drawer = $('#drawer');
  const settingsBtn = $('#settingsBtn');
  const closeBtn = $('#closeBtn');
  const isOpen = () => drawer.classList.contains('open');

  const setOpen = (open: boolean) => {
    drawer.classList.toggle('open', open);
    drawer.inert = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
    (open ? closeBtn : settingsBtn).focus();
  };

  settingsBtn.addEventListener('click', () => setOpen(!isOpen()));
  closeBtn.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role=tab]'));
  const select = (tab: HTMLElement) => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !selected;
    }
  };
  tabs.forEach((tab, i) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', () => select(tab));
    // タブは左右キーで移動する
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
}
