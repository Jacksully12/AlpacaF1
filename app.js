
const state={products:[]};
const el=(t,o={},...c)=>{const n=document.createElement(t);Object.entries(o).forEach(([k,v])=>{if(k==='class')n.className=v;else if(k==='html')n.innerHTML=v;else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.substring(2),v);else if(k in n)n[k]=v;else n.setAttribute(k,v)});for(const ch of c){if(ch==null)continue;n.append(typeof ch==='string'?document.createTextNode(ch):ch)}return n};
async function loadProducts(){state.products=(window.DEFAULT_PRODUCTS&&window.DEFAULT_PRODUCTS.length)?window.DEFAULT_PRODUCTS:[];try{const r=await fetch('products.json',{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d)&&d.length)state.products=d}}catch(e){}}
function formatPrice(p,c='INR'){return new Intl.NumberFormat('en-IN',{style:'currency',currency:c,maximumFractionDigits:0}).format(p)}
function sizeSet(all){const s=new Set();for(const p of all){(p.sizes||[]).forEach(x=>s.add(x));}return Array.from(s);}
function sizeWeight(sz){const m={'XS':1,'S':2,'M':3,'L':4,'XL':5,'2XL':6,'3XL':7,'4XL':8};return m[(sz||'').toUpperCase()]||999;}
function collectionView(){
  const a=document.getElementById('app');a.innerHTML='';
  const search=el('input',{class:'search',placeholder:'Search jackets...'});
  const sizes= sizeSet(state.products).sort((a,b)=>sizeWeight(a)-sizeWeight(b));
  const sizeSel=el('select',{class:'select'}); sizeSel.append(el('option',{value:''},'Sizes')); sizes.forEach(x=>sizeSel.append(el('option',{value:x},x)));
  const sortSel=el('select',{class:'select'},...['Featured','Price: Low to High','Price: High to Low','Name'].map(x=>el('option',{value:x},x)));
  a.append(el('div',{class:'filters'},search,sizeSel,sortSel));
  const grid=el('div',{class:'grid'});a.append(grid);
  function render(){
    const q=(search.value||'').toLowerCase();const sz=sizeSel.value;
    let items=state.products.filter(p=>p.name.toLowerCase().includes(q));
    if(sz) items=items.filter(p=>(p.sizes||[]).includes(sz));
    switch(sortSel.value){case'Price: Low to High':items.sort((a,b)=>a.price-b.price);break;case'Price: High to Low':items.sort((a,b)=>b.price-a.price);break;case'Name':items.sort((a,b)=>a.name.localeCompare(b.name));break;default:break;}
    grid.innerHTML='';
    for(const p of items){const card=el('a',{class:'card',href:`products/${p.id}.html`,'aria-label':p.name});
      const img=el('img',{src:p.images?.[0]||'',alt:p.name});
      card.append(el('div',{class:'card-media'},img));
      card.append(el('div',{class:'card-body'},
        el('div',{class:'card-title'},p.name),
        el('div',{class:'card-sub'},'Sizes: '+(p.sizes||[]).join(' · ')),
        el('div',{class:'price'},formatPrice(p.price,p.currency)),
        el('div',{}, el('span',{class:'badge'}, (p.badge || (/print/i.test(p.name)?'Print':'Premium Embroidery')) ))
      ));
      grid.append(card);
    }
  }
  search.addEventListener('input',render);sizeSel.addEventListener('change',render);sortSel.addEventListener('change',render);render();
}
window.addEventListener('DOMContentLoaded',async()=>{await loadProducts();collectionView();});
