document.addEventListener('DOMContentLoaded', function(){
  const input = document.getElementById('search');
  const results = document.getElementById('results');
  const contentEl = document.getElementById('content');
  // provide a safe fallback so old code paths won't throw when #content is absent
  const content = contentEl || { innerHTML: '', appendChild: () => {}, querySelector: () => null };
  const clearBtn = document.getElementById('clear');

  if (!input || !results) return; // nothing to do if core UI isn't present

  function highlight(text, q){
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(esc, 'ig'), m => `<span class="highlight">${m}</span>`);
  }

  input.addEventListener('input', function(){
    const q = input.value.trim().toLowerCase();
    const items = results.querySelectorAll('.result');
    items.forEach(it => {
      const titleEl = it.querySelector('strong');
      const sumEl = it.querySelector('.hc-summary');
      const title = (titleEl && titleEl.textContent || '').toLowerCase();
      const sum = (sumEl && sumEl.textContent || '').toLowerCase();
      const match = title.indexOf(q) !== -1 || sum.indexOf(q) !== -1 || q === '';
      it.style.display = match ? '' : 'none';
      // apply inline highlight in visible items
      if (match && q){
        if (titleEl) titleEl.innerHTML = highlight(titleEl.textContent, q);
        if (sumEl) sumEl.innerHTML = highlight(sumEl.textContent, q);
      } else if (match){
        // remove previous highlights
        if (titleEl) titleEl.innerHTML = titleEl.textContent;
        if (sumEl) sumEl.innerHTML = sumEl.textContent;
      }
    });
  });

  clearBtn && clearBtn.addEventListener('click', function(){ input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); });

  // Accordion: toggle panel and lazy-load content when header or link clicked
  const accordion = document.getElementById('accordion');
  async function executeScriptsFromElement(container){
    // Keep a runtime registry so we don't execute the same script more than once
    window.__helpsite_executed_scripts = window.__helpsite_executed_scripts || new Set();
    const scripts = Array.from(container.querySelectorAll('script'));
    for (const oldScript of scripts){
      try {
        const src = oldScript.src && oldScript.src.trim();
        const inlineKey = 'inline:' + (oldScript.textContent || '').trim().slice(0,200);
        const sig = src ? 'src:' + src : inlineKey;

        if (window.__helpsite_executed_scripts.has(sig)){
          // remove duplicate script node left in fragment
          oldScript.parentNode && oldScript.parentNode.removeChild(oldScript);
          continue;
        }

        if (src){
          // If an identical external script already exists on the page, wait for it (or skip)
          const existing = document.querySelector('script[src="' + src + '"]');
          if (existing){
            // if it has finished loading, mark as executed and skip insertion
            if (existing.dataset && existing.dataset.helpsiteLoaded === '1'){
              window.__helpsite_executed_scripts.add(sig);
              oldScript.parentNode && oldScript.parentNode.removeChild(oldScript);
              continue;
            }
            // otherwise attach a load listener to the existing node
            await new Promise(resolve => {
              existing.addEventListener('load', function once(){ existing.dataset.helpsiteLoaded = '1'; window.__helpsite_executed_scripts.add(sig); existing.removeEventListener('load', once); resolve(); });
              existing.addEventListener('error', function onceErr(){ existing.dataset.helpsiteLoaded = '1'; window.__helpsite_executed_scripts.add(sig); existing.removeEventListener('error', onceErr); resolve(); });
            });
            oldScript.parentNode && oldScript.parentNode.removeChild(oldScript);
            console.debug('[helpsite] external script already present, waited/marked:', src);
            continue;
          }

          // insert and wait for load
          const ns = document.createElement('script');
          if (oldScript.type) ns.type = oldScript.type;
          ns.src = src;
          ns.dataset.helpsiteLoaded = '0';
          oldScript.parentNode && oldScript.parentNode.replaceChild(ns, oldScript);
          await new Promise(resolve => { ns.onload = () => { ns.dataset.helpsiteLoaded = '1'; window.__helpsite_executed_scripts.add(sig); resolve(); }; ns.onerror = () => { ns.dataset.helpsiteLoaded = '1'; window.__helpsite_executed_scripts.add(sig); resolve(); }; });
          console.debug('[helpsite] script loaded:', src);

        } else {
          // Inline scripts: execute in isolated function scope to avoid redeclaring
          // top-level const/let names into the global scope.
          if (oldScript.type && oldScript.type !== 'text/javascript'){
            // preserve non-js types by injecting as-is
            const ns = document.createElement('script');
            ns.type = oldScript.type;
            ns.textContent = oldScript.textContent;
            oldScript.parentNode && oldScript.parentNode.replaceChild(ns, oldScript);
            window.__helpsite_executed_scripts.add(sig);
          } else {
            try {
              (new Function(oldScript.textContent))();
              window.__helpsite_executed_scripts.add(sig);
            } catch (e){
              console.error('[helpsite] inline script execution error', e);
            }
            // remove the original inline script node (we executed it)
            oldScript.parentNode && oldScript.parentNode.removeChild(oldScript);
          }
        }
      } catch (err){
        console.error('[helpsite] executeScriptsFromElement error', err);
      }
    }
  }

  function togglePanel(slug){
    const header = document.querySelector(`button.accordion-header[data-slug="${slug}"]`);
    const panel = document.getElementById(`panel-${slug}`);
    if (!header || !panel) return;
    const isOpen = header.getAttribute('aria-expanded') === 'true';
    if (isOpen){
      header.setAttribute('aria-expanded','false');
      panel.classList.remove('open');
    } else {
      header.setAttribute('aria-expanded','true');
      panel.classList.add('open');
      // lazy-load if empty
      const body = panel.querySelector('.panel-body');
      if (body && body.dataset.loaded !== '1'){
        fetch(`/help/${slug}/`).then(r => r.text()).then(html => {
          try {
            const tmp = document.createElement('div'); tmp.innerHTML = html;
            const inner = tmp.querySelector('#page-body') || tmp;
            // ensure scripts that expect an element with id 'content' can find one
            try { document.getElementById('content')?.removeAttribute('id'); } catch(e){}
            body.id = 'content';
            console.debug('[helpsite] loading fragment for', slug);
            body.innerHTML = inner.innerHTML;
            // give the browser a tick before executing scripts so DOM is attached
            executeScriptsFromElement(body).catch(err => { console.error('[helpsite] script exec error', slug, err); }).finally(()=>{
              try{
                const ev = new Event('help:fragment-loaded');
                document.dispatchEvent(ev);
                body.dispatchEvent(ev);
                // let visuals recompute sizes
                try { window.dispatchEvent(new Event('resize')); } catch(e){}
                console.debug('[helpsite] fragment loaded for', slug);
              } catch(e){}
            });
            body.dataset.loaded = '1';
          } catch (e){
            body.innerHTML = '<p>Error rendering page.</p>';
            console.error('render error', e);
          }
        }).catch(err => { body.innerHTML = '<p>Error loading page.</p>'; });
      }
    }
  }

  // click handlers: separate delegation for sidebar results and accordion headers
  // Sidebar links (results list) — links point to #panel-<slug>
  results.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (a && a.getAttribute('href') && a.getAttribute('href').startsWith('#panel-')){
      const id = a.getAttribute('href').slice(1);
      const slug = id.replace('panel-','');
      togglePanel(slug);
      e.preventDefault();
    }
  });

  // Document-level handler for accordion header buttons (they live outside the results container)
  document.addEventListener('click', function(e){
    const headerBtn = e.target.closest('button.accordion-header');
    if (headerBtn){
      const slug = headerBtn.dataset.slug;
      togglePanel(slug);
      e.preventDefault();
    }
  });

  // keyboard navigation: up/down to focus results, Enter to open
  let focused = -1;
  input.addEventListener('keydown', function(e){
    const visible = Array.from(results.querySelectorAll('.result')).filter(it => it.style.display !== 'none');
    if (e.key === 'ArrowDown'){
      focused = Math.min(focused+1, visible.length-1);
      visible.forEach((it,i)=> it.classList.toggle('focused', i===focused));
      visible[focused] && visible[focused].scrollIntoView({block:'nearest'});
      e.preventDefault();
    } else if (e.key === 'ArrowUp'){
      focused = Math.max(focused-1, 0);
      visible.forEach((it,i)=> it.classList.toggle('focused', i===focused));
      visible[focused] && visible[focused].scrollIntoView({block:'nearest'});
      e.preventDefault();
    } else if (e.key === 'Enter'){
      if (focused >=0){
        const link = visible[focused].querySelector('a');
        link && link.click();
        e.preventDefault();
      }
    }
  });
});
