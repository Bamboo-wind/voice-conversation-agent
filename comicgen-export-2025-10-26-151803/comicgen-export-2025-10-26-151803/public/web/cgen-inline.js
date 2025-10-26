(() => {
// 让按钮一定能点到：抬高层级 + 允许点击
const fixStyle = document.createElement('style');
fixStyle.textContent = `
  .cg-zfix, .generate-btn, button, .btn, [role="button"] {
    position: relative;
    z-index: 99999 !important;
    pointer-events: auto !important;
  }
  .generator, .generator-container, .features, #generator {
    position: relative !important;
    z-index: 5 !important;
  }
`;
document.head.appendChild(fixStyle);

// 额外“遮罩杀手”——常见扩展/浮层一律禁点
const killer = document.createElement('style');
killer.textContent = `
  grammarly-desktop-integration,
  #grammarly-desktop-integration,
  [class*="grammarly"],
  #immersive-translate-browser-pocket-popup,
  [id*="immersive-translate"],
  .immersion-translate-popup,
  [class*="translate__popup"],
  .gtranslate_wrapper,
  .grecaptcha-badge,
  .fixed-overlay, .modal-backdrop,
  [style*="position: fixed"][style*="z-index"] {
    pointer-events: none !important;
  }
`;
document.head.appendChild(killer);

// 工具
const API='/api'; let STOP=false;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
async function postJSON(p,b){const r=await fetch(API+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error(await r.text());return r.json();}
function digPanels(sb){const a=[];(sb.pages||[]).forEach(p=>(p.panels||[]).forEach(g=>a.push({id:g.id,desc:g.desc||''})));return a;}
async function runPool(n,t){let i=0;async function w(){for(;;){if(STOP)break;const c=i++;if(c>=t.length)break;try{await t[c]();}catch{}}}await Promise.all(Array.from({length:Math.min(n,t.length)},()=>w()));}

// 精确给按钮“打洞”——把覆盖在按钮中心点上的元素禁点
function freeButton(btn){
  if(!btn||!btn.getBoundingClientRect) return;
  const r=btn.getBoundingClientRect(), x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
  for(let k=0;k<6;k++){
    const stack=document.elementsFromPoint(x,y)||[];
    if(!stack.length || stack[0]===btn) break;
    for(const el of stack){
      if(el===btn || btn.contains(el)) continue;
      if(/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/i.test(el.tagName||'')) continue;
      el.style.pointerEvents='none';
    }
  }
}

// 风格映射（含复古民国水粉）
const STYLE_PREFIX={
  '日式漫画':'anime style, clean line art, soft lighting',
  '美式漫画':'american comic style, bold inking, halftone dots',
  '黑白线稿':'black and white manga, line art, screentone, high contrast, dramatic lighting',
  '水彩风格':'watercolor painting, soft pastel colors',
  '复古民国水粉':'Republic of China era watercolor, vintage gouache, muted warm palette, 1930s Shanghai street, illustrative brushwork'
};
function pickStyle(){
  const names=Object.keys(STYLE_PREFIX);
  const data = $$('button, .style-option').find(el=>el.hasAttribute('data-active'));
  if(data) return data.textContent.trim();
  for(const el of $$('button, .style-option')){
    const t=(el.textContent||'').trim();
    if(names.includes(t) && (el.classList.contains('active')||el.ariaPressed==='true')) return t;
  }
  return '黑白线稿';
}
// 点击样式按钮时仅打 data-active，不改你的样式
document.addEventListener('click',e=>{
  const t=e.target.closest('button, .style-option'); if(!t) return;
  const txt=(t.textContent||'').trim();
  if(Object.keys(STYLE_PREFIX).includes(txt)){ $$('button, .style-option').forEach(el=>el.removeAttribute('data-active')); t.setAttribute('data-active','1'); }
});

// 结果区域
function ensureGrid(afterEl){ let g=$('#cg-grid'); if(!g){ g=document.createElement('div'); g.id='cg-grid'; g.style.marginTop='16px'; (afterEl?.parentElement||document.body).appendChild(g);} return g;}
function ensureLog(afterEl){ let x=$('#cg-log'); if(!x){ x=document.createElement('div'); x.id='cg-log'; x.style.cssText='margin-top:10px;font:12px ui-monospace,Consolas;color:#666;white-space:pre-wrap;'; (afterEl?.parentElement||document.body).appendChild(x);} return x;}

// 业务
async function handleStoryboard(btn){
  const ta=$('textarea')||$('.input-area textarea'); const text=(ta?.value||'').trim();
  if(!text){alert('请输入小说内容');return;}
  freeButton(btn); btn.disabled=true; const ori=btn.textContent; btn.textContent='生成中...';
  try{ const rsp=await postJSON('/storyboard',{text,style:pickStyle()}); ensureLog(btn).textContent=rsp.storyboard_json||''; }
  finally{ btn.disabled=false; btn.textContent=ori; }
}
async function handleRender(btn){
  const ta=$('textarea')||$('.input-area textarea'); const text=(ta?.value||'').trim();
  if(!text){alert('请输入小说内容');return;}
  STOP=false; freeButton(btn); btn.disabled=true; const ori=btn.textContent; btn.textContent='渲染中...';
  const size='1024x1024'; const concurrency=3;

  let sb={}; try{ const r=await postJSON('/storyboard',{text,style:pickStyle()}); sb=JSON.parse(r.storyboard_json||'{}'); }catch{}
  const panels=digPanels(sb); if(!panels.length){alert('分镜为空，请换更详细文本'); btn.disabled=false; btn.textContent=ori; return;}
  const grid=ensureGrid(btn); grid.innerHTML=''; const prefix=STYLE_PREFIX[pickStyle()]||STYLE_PREFIX['黑白线稿'];

  const tasks=panels.map((p,i)=> async ()=>{
    const cell=document.createElement('div'); cell.className='cell'; cell.style.cssText='background:#f5f5f7;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.06);margin-bottom:12px;';
    cell.innerHTML=`<div class="img" id="cg-img-${i}" style="padding:8px;text-align:center">生成中...</div><div class="desc" style="padding:8px 12px;color:#555;font-size:14px">${esc(p.id??(i+1))}：${esc(p.desc)}</div>`;
    grid.appendChild(cell);
    try{
      const img=await postJSON('/image',{prompt:`${prefix} ${p.desc}`.trim(), size});
      const el=$(`#cg-img-${i}`); if(el) el.innerHTML=`<a href="${img.url}" target="_blank" style="display:block;font-size:12px;margin:4px 0">${img.url}</a><img src="${img.url}" loading="lazy" style="max-width:100%;height:auto">`;
    }catch(e){ const el=$(`#cg-img-${i}`); if(el) el.innerHTML=`<span style="color:#e11d48">失败</span> <span style="color:#6b7280;font-size:12px">${esc(e.message||'error')}</span>`; }
  });
  await runPool(concurrency,tasks);
  btn.disabled=false; btn.textContent=ori;
}
function handleStop(){ STOP=true; }
function handleCopyAll(btn){
  const urls=Array.from(document.querySelectorAll('#cg-grid a[href^="http"]')).map(a=>a.href).join('\n');
  if(!urls){ alert('暂无可复制的图片'); return; }
  navigator.clipboard.writeText(urls).then(()=>{ btn.textContent='已复制'; setTimeout(()=>btn.textContent='复制全部链接',1200); });
}

// 绑定（通过文案匹配，不改 DOM）
function bindAll(){
  const bind = (label, fn) => {
    const el = Array.from(document.querySelectorAll('button, a, .btn'))
      .find(x => (x.textContent||'').trim().includes(label));
    if(el && !el._cgBinded){
      el._cgBinded = true;
      el.classList.add('cg-zfix');
      el.addEventListener('click', (e)=>{ e.preventDefault(); fn(el); });
    }
  };
  bind('生成分镜 JSON', handleStoryboard);
  bind('开始并发渲染',   handleRender);
  bind('生成漫画',       handleRender);
  bind('开始渲染',       handleRender);
  bind('停止队列',       handleStop);
  bind('复制全部链接',   handleCopyAll);
}
bindAll();
new MutationObserver(bindAll).observe(document.documentElement,{childList:true,subtree:true});

// 提供一个全局“打洞”函数，必要时可在控制台调用：cg_unblock()
window.cg_unblock = function(){
  const labels=['开始并发渲染','生成漫画','开始渲染','生成分镜 JSON'];
  const btn = Array.from(document.querySelectorAll('button, a, .btn')).find(b=>labels.some(s=>(b.textContent||'').includes(s)));
  if(btn) freeButton(btn);
};
})();
