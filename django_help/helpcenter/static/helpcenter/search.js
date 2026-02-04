document.addEventListener('DOMContentLoaded', function(){
  const input = document.getElementById('search');
  const results = document.getElementById('results');
  const content = document.getElementById('content');

  input.addEventListener('input', function(){
    const q = input.value.toLowerCase();
    const items = results.querySelectorAll('.result');
    items.forEach(it => {
      const text = it.textContent.toLowerCase();
      it.style.display = text.indexOf(q) !== -1 ? '' : 'none';
    });
  });

  // load page content when clicking a result link (progressive enhancement)
  results.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    fetch(href).then(r => r.text()).then(html => {
      // extract body content
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const inner = tmp.querySelector('#page-body') || tmp;
      content.innerHTML = inner.innerHTML;
      history.pushState({}, '', href);
    }).catch(err => { content.innerHTML = '<p>Error loading page.</p>'; });
  });
});
