/* Shared CAPTCHA widget. Usage: const cap = IQCaptcha.mount(el, 'api.php'); cap.values(); cap.reset(); */
(() => {
  'use strict';
  const mount = (host, api) => {
    api = api || 'api.php';
    host.classList.add('captcha');
    host.innerHTML = '<div class="cap-row"><div class="cap-img" aria-live="polite">Loading code…</div><button type="button" class="cap-r" aria-label="Get a new security code" title="New code">&#8635;</button></div>' +
      '<input class="cap-in" name="captcha_answer" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10" placeholder="Type the code shown" aria-label="Security code" required>' +
      '<button type="button" class="cap-t">Can’t read it? Use a simple question instead</button><input type="hidden" name="captcha_token">';
    const img = host.querySelector('.cap-img'), input = host.querySelector('.cap-in'), tok = host.querySelector('[name=captcha_token]'), swap = host.querySelector('.cap-t');
    let text = false, busy = false, loaded = false;
    const load = async () => {
      if (busy) return; busy = true; tok.value = ''; input.value = ''; img.textContent = 'Loading code…';
      try {
        const r = await fetch(api + '?a=captcha' + (text ? '&type=text' : ''), {cache: 'no-store', credentials: 'same-origin'});
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'failed');
        tok.value = j.token; img.textContent = '';
        if (j.image) { const i = new Image(); i.src = j.image; i.width = 200; i.height = 70; i.alt = 'Security code. Type the characters you see.'; img.appendChild(i); input.placeholder = 'Type the code shown'; }
        else { const s = document.createElement('span'); s.className = 'cap-q'; s.textContent = j.question; img.appendChild(s); input.placeholder = 'Your answer'; }
        loaded = true;
      } catch (e) { img.textContent = 'Could not load a code. Tap the refresh button.'; }
      busy = false;
    };
    host.querySelector('.cap-r').addEventListener('click', load);
    swap.addEventListener('click', () => { text = !text; swap.textContent = text ? 'Use the picture code instead' : 'Can’t read it? Use a simple question instead'; load(); });
    return { load, reset: load, ready: () => loaded, values: () => ({captcha_token: tok.value, captcha_answer: input.value.trim()}) };
  };
  window.IQCaptcha = {mount};
})();
