(function(){
  'use strict';
  const toggle = document.getElementById('search-toggle');
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const closeBtn = document.getElementById('search-close');
  let index = [];
  
  async function loadIndex(){
    try {
      const res = await fetch('/search-index.json');
      index = await res.json();
    } catch(e){ console.warn('Search index unavailable'); }
  }
  
  function search(query){
    if(!query.trim()) { results.innerHTML=''; return; }
    const q = query.toLowerCase();
    const matches = index.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q) ||
      (item.category||[]).some(c=>c.toLowerCase().includes(q))
    ).slice(0,8);
    
    results.innerHTML = matches.length 
      ? matches.map(m=>`<li role="option"><a href="/articles/${m.slug}.html"><strong>${m.title}</strong><small>${m.category?.[0]||''} · ${m.date}</small></a></li>`).join('')
      : '<li role="option" class="no-results">No articles found</li>';
  }
  
  toggle?.addEventListener('click', ()=>{
    overlay.hidden=false;
    input.focus();
    if(!index.length) loadIndex();
  });
  
  closeBtn?.addEventListener('click', ()=>overlay.hidden=true);
  input?.addEventListener('input', e=>search(e.target.value));
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') overlay.hidden=true;
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();toggle?.click();}
  });
})();
