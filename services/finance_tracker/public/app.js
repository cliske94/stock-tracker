const e = React.createElement;
const { useState, useEffect } = React;

let wasmClient = null;
import('./wasm/client_budget.js').then(m=>{ wasmClient = m; return m.default ? m.default() : null; }).catch(()=>{ wasmClient = null; });

// Simple toast helper
function showToast(msg, timeout=3000){
  try{
    let container = document.getElementById('toast-container');
    if(!container){ container = document.createElement('div'); container.id='toast-container'; container.style.position='fixed'; container.style.right='16px'; container.style.top='16px'; container.style.zIndex=9999; document.body.appendChild(container); }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.background = 'rgba(0,0,0,0.85)'; el.style.color='#fff'; el.style.padding='8px 12px'; el.style.marginTop='8px'; el.style.borderRadius='6px'; el.style.boxShadow='0 6px 18px rgba(0,0,0,.12)';
    container.appendChild(el);
    setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.remove(),300); }, timeout);
  }catch(e){ console.log('toast',msg); }
}

function api(path, opts={}){
  opts.credentials = 'include';
  opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
  // If a bearer token is stored (used by GUI apps), send it on API requests.
  try {
    const tk = localStorage.getItem('ft_token');
    if (tk) opts.headers['Authorization'] = 'Bearer ' + tk;
  } catch(e){}
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  return fetch(path, opts).then(async r => {
    const text = await r.text();
    try{ return { status: r.status, json: JSON.parse(text)} }catch(e){ return { status: r.status, text } }
  });
}

function Header({user,onNav,active}){
  return e('header',{className:'site-header'},
    e('div',{className:'site-brand'},'Finance Tracker'),
    e('nav',{className:'site-nav'},
      e('a',{href:'#',className:active==='dashboard'?'active':'',onClick:e=>{e.preventDefault(); onNav('dashboard')}},'Dashboard'),
      e('a',{href:'#',className:active==='budgets'?'active':'',onClick:e=>{e.preventDefault(); onNav('budgets')}},'Budgets'),
      e('a',{href:'#',className:active==='reports'?'active':'',onClick:e=>{e.preventDefault(); onNav('reports')}},'Reports'),
      e('a',{href:'#',className:active==='settings'?'active':'',onClick:e=>{e.preventDefault(); onNav('settings')}},'Settings')
    ),
    e('div',null, user && e('button',{className:'btn secondary', onClick:async()=>{ try{ localStorage.removeItem('ft_token'); }catch(e){}; await api('/api/auth/logout',{method:'POST'}); location.reload(); }},'Logout'))
  );
}

function Footer(){ return e('footer',{className:'site-footer'}, '© ' + (new Date()).getFullYear() + ' Finance Tracker — demo UI') }

function AuthForm({onAuth}){
  const [mode,setMode] = useState('login');
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  async function submit(eve){
    eve.preventDefault();
    const path = mode==='login'?'/api/auth/login':'/api/auth/register';
    const bodyPayload = mode === 'login' ? { username, password } : { username, email, password };
    const res = await api(path,{method:'POST', body: bodyPayload});
    if(res.status>=200 && res.status<300) {
      const token = res.json && res.json.token;
      try{ if (token) localStorage.setItem('ft_token', token); } catch(e){}
      onAuth(res.json || res.text);
    }
    else showToast('Auth failed: '+(res.json?.error || JSON.stringify(res)));
  }
  return e('div',{className:'auth container'},
    e('h2',null, mode==='login'?'Login':'Register'),
    e('form',{onSubmit:submit},
      e('input',{placeholder:'username',value:username,onChange:e=>setUsername(e.target.value)}),
      mode==='register' && e('input',{placeholder:'email',value:email,onChange:e=>setEmail(e.target.value)}),
      e('input',{placeholder:'password',type:'password',value:password,onChange:e=>setPassword(e.target.value)}),
      e('div',{style:{display:'flex',gap:8}},
        e('button',{type:'submit',className:'btn'}, mode==='login'?'Login':'Register'),
        e('button',{type:'button',className:'btn secondary',onClick:()=>setMode(mode==='login'?'register':'login')}, mode==='login'?'Switch to register':'Switch to login')
      )
    )
  );
}

function BudgetForm({onCreate}){
  const [name,setName]=useState('');
  const [target,setTarget]=useState('');
  const [currency,setCurrency]=useState('USD');
  async function submit(e){
    e.preventDefault();
    const res = await api('/api/budgets',{method:'POST', body:{name,targetAmount:parseFloat(target)||0,currency}});
    if(res.status===201){ setName(''); setTarget(''); onCreate(res.json.budget); showToast('Budget created'); }
    else showToast('Create failed');
  }
  return e('form',{onSubmit:submit,className:'row'},
    e('div',{className:'col'}, e('input',{placeholder:'Budget name',value:name,onChange:e=>setName(e.target.value)})),
    e('div',{style:{width:140}}, e('input',{placeholder:'Target amount',value:target,onChange:e=>setTarget(e.target.value)})),
    e('div',{style:{width:100}}, e('select',{value:currency,onChange:e=>setCurrency(e.target.value)}, e('option',null,'USD'), e('option',null,'EUR'), e('option',null,'GBP'))),
    e('div',null, e('button',{type:'submit',className:'btn'},'Create'))
  );
}

function BudgetItem({b, onUpdated, onDeleted}){
  const [editing,setEditing]=useState(false);
  const [current,setCurrent]=useState(b.currentAmount||0);
  async function save(){
    const res = await api('/api/budgets/'+b._id,{method:'PUT', body:{currentAmount:parseFloat(current)||0}});
    if(res.status===200){ onUpdated(res.json.budget); setEditing(false); showToast('Budget updated'); }
    else showToast('Update failed');
  }
  async function remove(){ if(confirm('Delete budget?')){ const r=await api('/api/budgets/'+b._id,{method:'DELETE'}); if(r.status===200){ onDeleted(b._id); showToast('Deleted'); } else showToast('Delete failed'); }}
  async function convert(){ const r = await api('/api/budgets/'+b._id+'/convert?to=EUR'); if(r.status===200) showToast('Converted: '+r.json.converted+' '+r.json.currency); else showToast('Conversion failed: '+JSON.stringify(r)); }
  async function showRemainingWasm(){
    if(!wasmClient || !wasmClient.remaining_budget) return showToast('client wasm not available');
    const rem = wasmClient.remaining_budget(Number(b.targetAmount||0), Number(b.currentAmount||0));
    showToast('Remaining (wasm): '+rem);
  }
  return e('div',{className:'budget'},
    e('div',null, e('strong',null,b.name),' ',e('span',{className:'small'},b.currency,' target:',b.targetAmount)),
    e('div',null, editing ? e('div',null, e('input',{value:current,onChange:e=>setCurrent(e.target.value)}), e('div',{className:'toolbar'}, e('button',{className:'btn',onClick:save},'Save'), e('button',{className:'btn secondary',onClick:()=>setEditing(false)},'Cancel'))) : e('div',null,'Current: ', b.currentAmount || 0)),
    e('div',{style:{display:'flex',gap:8,marginTop:8}}, e('button',{className:'btn',onClick:()=>setEditing(true)},'Edit'), e('button',{className:'btn secondary',onClick:remove},'Delete'), e('button',{className:'btn',onClick:convert},'Convert→EUR'), e('button',{className:'btn secondary',onClick:showRemainingWasm},'Remaining (wasm)'))
  );
}

function BudgetsView(){
  const [list,setList]=useState([]);
  async function load(){
    const r = await api('/api/budgets');
    if(r.status===200) setList(r.json.budgets||[]);
  }
  useEffect(()=>{ load(); },[]);
  return e('div',null,
    e(BudgetForm,{onCreate:b=>setList([b,...list])}),
    e('div',{className:'budgets'}, list.map(b=> e(BudgetItem,{key:b._id,b,onUpdated:ub=>setList(list.map(x=>x._id===ub._id?ub:x)),onDeleted:id=>setList(list.filter(x=>x._id!==id))})))
  );
}

function StatsView(){
  const [stats,setStats]=useState(null);
  async function load(){ const r = await api('/api/budgets/_user_stats'); if(r.status===200) setStats(r.json); }
  useEffect(()=>{ load(); },[]);
  return e('div',null, e('h3',null,'User Stats'), stats? e('pre',null,JSON.stringify(stats,null,2)) : e('div',null,'Loading...'))
}

function ReportsView(){
  return e('div',null, e('h2',null,'Reports'), e(StatsView));
}

function SettingsView(){
  return e('div',null, e('h2',null,'Settings'), e('p',null,'Demo settings for the finance tracker.'))
}

function Dashboard(){
  return e('div',null, e('h2',null,'Dashboard'), e('p',null,'Overview cards and quick actions will appear here.'))
}

function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState('dashboard');
  useEffect(()=>{ api('/api/auth/me').then(r=>{ if(r.status===200) setUser(r.json.user); }); },[]);
  if(!user) return e(AuthForm,{onAuth:()=>{ api('/api/auth/me').then(r=> r.status===200 && setUser(r.json.user)); }});
  return e('div',null,
    e(Header,{user,onNav:setPage,active:page}),
    e('div',{className:'container'}, page==='dashboard' && e(Dashboard), page==='budgets' && e(BudgetsView), page==='reports' && e(ReportsView), page==='settings' && e(SettingsView)),
    e(Footer)
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));
