'use strict';
/* Investment Compass — zero external JS dependencies, localStorage persistence. */
const KEY='investment_compass_local_v1';
const CORE=['IBKR','DBS SRS / POEMS'];
const COLORS={stock:'#397fba',bond:'#258f84',other:'#ad9b7f',cash:'#d6a45a',us:'#356ca9',dev:'#7c9ec9',em:'#229b87',sg:'#d2a059'};
const GOALS={overview:['投资总览','追踪本金、估值及长期资产配置'],holdings:['持仓管理','记录真实份额、成本和可查询报价'],activity:['交易与资金','把外部入金与资产买卖分开记录'],allocation:['配置与再平衡','用规则计算下一笔资金的优先方向'],settings:['设置与备份','市场行情、本金完整性、本地备份']};
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'_'+Math.random().toString(36).slice(2);
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const today=()=>new Date().toLocaleDateString('en-CA');
const money=(x,d=0)=>x===null||x===undefined||!Number.isFinite(x)?'—':'S$'+x.toLocaleString('en-SG',{minimumFractionDigits:d,maximumFractionDigits:d});
const val=(x,d=2)=>x===null||x===undefined||!Number.isFinite(x)?'—':x.toLocaleString('en-SG',{maximumFractionDigits:d});
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const el=id=>document.getElementById(id);
const coreAccount=account=>CORE.includes(account);
function seed(){return {
 version:1,created:new Date().toISOString().slice(0,10),
 assets:[],
 cash:{'IBKR':{amount:0,verified:false},'DBS SRS / POEMS':{amount:0,verified:false},'OCBC 任务':{amount:0,verified:false},'DBS 任务':{amount:0,verified:false}},
 flows:[], trades:[],
 complete:{IBKR:false,'DBS SRS / POEMS':false,'OCBC 任务':false,'DBS 任务':false},
 targets:{stock:90,regions:{us:60,dev:20,em:12,sg:8}},
 fx:{USD:{rate:1.27887,date:'2026-10-30',source:'示例参考，需更新'},HKD:{rate:0.1644,date:'2026-10-30',source:'参考，需更新'}},
 snapshots:[],lastFetch:'',completedSetup:false
};}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)); if(x&&x.version===1&&Array.isArray(x.assets))return x;}catch(_){}return seed();}
let S=load(), serverEnabled=false, tab='overview', showTask=false;
function save(){localStorage.setItem(KEY,JSON.stringify(S));}
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3500);}
function fxOf(currency){if(currency==='SGD')return 1;return n(S.fx[currency]?.rate)||null;}
function isRecent(date,maxDays=3){if(!date)return false;const t=new Date(date).getTime();return Number.isFinite(t)&&(Date.now()-t)<maxDays*86400000;}
function quote(a){let p=null,at='',label='';if(a.source==='auto'&&n(a.livePrice)>0){p=n(a.livePrice);at=a.liveAt;label='在线行情';}else if(n(a.manualPrice)>0){p=n(a.manualPrice);at=a.manualDate;label='手动/缓存';}return {price:p,at,label,stale:!isRecent(at,3)};}
function positionValue(a){const q=quote(a);const f=fxOf(a.currency);return n(a.units)>0&&q.price!==null&&f!==null?n(a.units)*q.price*f:n(a.units)===0?0:null;}
function counted(a){return coreAccount(a.account)||showTask;}
function positions(includeTasks=false){return S.assets.filter(a=>(includeTasks||coreAccount(a.account))&&n(a.units)>0);}
function cashItems(includeTasks=false){return Object.entries(S.cash).filter(([acct])=>includeTasks||coreAccount(acct));}
function totals(includeTasks=false){let holdings=0,knownCost=0,knownMV=0,missingValue=0,missingCost=0;
 for(const a of positions(includeTasks)){const mv=positionValue(a);if(mv===null)missingValue++;else holdings+=mv;
 if(a.costSgd===null||a.costSgd===''||a.costSgd===undefined){missingCost++;}else if(mv!==null){knownCost+=n(a.costSgd);knownMV+=mv;}}
 let cash=0;for(const [,c] of cashItems(includeTasks))cash+=n(c.amount);
 const net=Object.entries(S.complete).filter(([account,flag])=>flag&&(includeTasks||coreAccount(account))).reduce((sum,[account])=>sum+S.flows.filter(f=>f.account===account&&(f.type==='deposit'||f.type==='withdraw')).reduce((v,f)=>v+(f.type==='deposit'?1:-1)*n(f.amount),0),0);
 const incomplete=Object.entries(S.complete).filter(([account])=>includeTasks||coreAccount(account)).some(([,flag])=>!flag);
 const unknownCash=cashItems(includeTasks).filter(([,c])=>!c.verified).map(([acct])=>acct);
 return {holdings,cash,total:holdings+cash,knownCost,knownMV,missingValue,missingCost,net,incomplete,unknownCash};}
function exposure(){let stock=0,bond=0,other=0,unvalued=0,r={us:0,dev:0,em:0,sg:0};for(const a of positions()){
 const mv=positionValue(a);if(mv===null){unvalued++;continue;}if(a.assetClass==='stock'){stock+=mv;for(const k in r)r[k]+=mv*n(a.weights?.[k])/100;}else if(a.assetClass==='bond'){bond+=mv;}else other+=mv;}
 return {stock,bond,other,unvalued,regions:r,invested:stock+bond+other};}
function netFlows(account){return S.flows.filter(x=>x.account===account).reduce((s,x)=>s+(x.type==='deposit'?n(x.amount):x.type==='withdraw'?-n(x.amount):0),0);}
function accountValue(account){return S.assets.filter(a=>a.account===account).reduce((z,a)=>{const v=positionValue(a);return z+(v||0)},0)+n(S.cash[account]?.amount);}
function heading(name,subtitle){el('pageTitle').textContent=name;el('pageSubtitle').textContent=subtitle;}
function setTab(id){tab=id;document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));heading(...GOALS[id]);render();window.scrollTo(0,0);}
function msgBadge(message){return `<span class="pill ${message.includes('待')||message.includes('旧')?'warn':''}">${esc(message)}</span>`;}
function notice(){const t=totals();const arr=[];
 if(t.incomplete)arr.push('IBKR 等账户的历史入金尚未补齐，无法准确计算整个组合的累计总收益率；请先补充所有外部入金和提款。');
 if(t.unknownCash.length)arr.push('账户现金仍待核实：'+t.unknownCash.join('、')+'。请核对各券商交易结算及实际余额。');
 if(t.missingCost)arr.push(`${t.missingCost} 项持仓未填写完整成本，盈亏仅展示已知部分。`);
 el('alerts').innerHTML=arr.length?`<div class="warning">⚠ ${esc(arr.slice(0,2).join(' '))}</div>`:'';
}
function legend(items){return `<div class="bar-track">${items.map(v=>`<div title="${esc(v.name)} ${val(v.pct,1)}%" style="width:${Math.max(0,v.pct)}%;background:${v.color}"></div>`).join('')}</div><div class="legend">${items.map(v=>`<div class="legend-item"><span class="legend-left"><i class="swatch" style="background:${v.color}"></i>${esc(v.name)}</span><b>${val(v.pct,1)}%</b></div>`).join('')}</div>`;}
function renderOverview(){const t=totals(),ex=exposure();const profit=t.knownMV-t.knownCost;const fullyVerified=!t.incomplete&&!t.missingValue&&!t.unknownCash.length;const accountProfit=fullyVerified?t.total-t.net:null;
 el('kpis').innerHTML=[
 ['记录资产总额',money(t.total),'持仓 + 账户现金；请核对余额'],
 ['可核实净投入本金',money(t.net)+(t.incomplete?' +':''),t.incomplete?'IBKR 历史入金尚待补齐':'已记录完整外部入金与提款'],
 ['累计账户盈亏',fullyVerified?money(accountProfit):'待补齐数据',fullyVerified?`总资产 − 净入金；${val(100*accountProfit/Math.max(1,t.net),2)}%`:'核对所有现金余额及入金后显示'],
 ['已知持仓浮盈亏',t.missingCost===positions().length?'待补成本':money(profit),t.missingCost?`仅 ${Math.max(0,positions().length-t.missingCost)} 项成本完整`:`${val(100*profit/Math.max(1,t.knownCost),2)}% · 不含已实现盈亏`]
 ].map(([name,value,detail])=>`<div class="kpi"><div class="name">${name}</div><div class="value">${esc(value)}</div><div class="detail">${esc(detail)}</div></div>`).join('');
 const split=ex.invested?[["股票",ex.stock,COLORS.stock],["债券",ex.bond,COLORS.bond],["其他",ex.other,COLORS.other]].map(([name,amt,color])=>({name,pct:100*amt/ex.invested,color})):[];
 el('allocationPlot').innerHTML=ex.invested?`<div class="stats-grid">${legend(split)}<div class="helper">当前已估值的长期投资：${money(ex.invested)}。资产配置比例 <strong>不含闲置 SRS / IBKR 现金</strong>。待投资现金：${money(t.cash)}。</div></div>`:`<div class="empty">尚未录入可估值的已投资份额</div>`;
 el('nextSuggestion').innerHTML=adviceHtml(ex,500,'total');
 const rows=S.assets.filter(a=>coreAccount(a.account)).sort((a,b)=>n(b.units)-n(a.units)).map(a=>{const mv=positionValue(a),q=quote(a),pnl=a.costSgd===null||mv===null||n(a.units)===0?null:mv-n(a.costSgd);return `<tr><td><span class="main-name">${esc(a.name)}</span><span class="minor">${esc(a.account)}</span></td><td class="num">${val(n(a.units),4)}</td><td class="num">${q.price===null?'—':val(q.price,4)} ${esc(a.currency)} ${q.stale?msgBadge('旧报价'):''}</td><td class="num">${money(mv)}</td><td class="num ${pnl===null?'':pnl>=0?'positive':'negative'}">${money(pnl)}</td></tr>`;}).join('');
 el('overviewHoldings').innerHTML=table(['产品','份额','报价','当前市值','浮动盈亏'],rows);
}
function table(headers,rows){return `<div class="table-scroll"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">暂无记录</td></tr>`}</tbody></table></div>`;}
function renderHoldings(){el('showTask').checked=showTask;
 const rows=S.assets.filter(a=>counted(a)).map(a=>{const mv=positionValue(a),q=quote(a),f=fxOf(a.currency),pnl=a.costSgd===null||mv===null||!n(a.units)?null:mv-n(a.costSgd);
 return `<tr><td><span class="main-name">${esc(a.name)}</span><span class="minor">${esc(a.account)} · ${esc(a.assetClass==='stock'?'股票':a.assetClass==='bond'?'债券':'其他')}</span></td><td class="num">${val(n(a.units),4)}</td><td class="num">${q.price===null?'—':val(q.price,4)} ${esc(a.currency)}<span class="minor">${esc(q.label)} ${esc(q.at?.slice(0,10)||'无日期')}${q.stale?' · 已过期':''}</span></td><td class="num">${money(a.costSgd)}</td><td class="num">${money(mv)}</td><td class="num ${pnl===null?'':pnl>=0?'positive':'negative'}">${money(pnl)}</td><td><button class="mini-btn" data-edit="${esc(a.id)}">编辑</button> <button class="mini-btn" data-del="${esc(a.id)}">删除</button></td></tr>`;}).join('');
 el('holdingsTable').innerHTML=table(['持仓','份额','最新可用价','累计成本 SGD','市值 SGD','浮盈亏','操作'],rows);
}
function assetDialog(a){el('assetForm').reset();const isEdit=!!a;el('modalTitle').textContent=isEdit?'编辑持仓':'新增基金或债券';el('assetId').value=a?.id||'';let fields={assetName:a?.name||'',assetAccount:a?.account||'IBKR',assetClass:a?.assetClass||'stock',assetCurrency:a?.currency||'USD',assetUnits:a?.units??0,assetCost:a?.costSgd??'',assetTicker:a?.ticker||'',assetPrice:a?.manualPrice??'',assetPriceDate:a?.manualDate||today(),assetSource:a?.source||'auto',assetNote:a?.note||'',wUs:a?.weights?.us??0,wDev:a?.weights?.dev??0,wEm:a?.weights?.em??0,wSg:a?.weights?.sg??0};for(const [id,v]of Object.entries(fields))el(id).value=v;el('assetDialog').showModal();}
function saveAsset(ev){ev.preventDefault();const id=el('assetId').value||uid();const old=S.assets.find(x=>x.id===id);
 let a={id,name:el('assetName').value.trim(),account:el('assetAccount').value,assetClass:el('assetClass').value,currency:el('assetCurrency').value,units:n(el('assetUnits').value),costSgd:el('assetCost').value.trim()===''?null:n(el('assetCost').value),ticker:el('assetTicker').value.trim().toUpperCase(),manualPrice:el('assetPrice').value.trim()===''?null:n(el('assetPrice').value),manualDate:el('assetPriceDate').value,source:el('assetSource').value,note:el('assetNote').value,weights:{us:n(el('wUs').value),dev:n(el('wDev').value),em:n(el('wEm').value),sg:n(el('wSg').value)},livePrice:old?.livePrice??null,liveAt:old?.liveAt||''};
 const total=Object.values(a.weights).reduce((x,y)=>x+y,0);if(a.assetClass==='stock'&&a.units>0&&Math.abs(total-100)>0.25){toast('股票基金的四个地区权重需要合计 100%');return;}
 if(a.source==='auto'&&!a.ticker)toast('缺少 Yahoo 代码，将暂时使用手动报价');
 if(old)S.assets[S.assets.findIndex(x=>x.id===id)]=a;else S.assets.push(a);save();el('assetDialog').close();render();toast('持仓已保存');}
function renderTradeForm(){el('tradeAsset').innerHTML=S.assets.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.account)}</option>`).join('');}
function handleTrade(ev){ev.preventDefault();const a=S.assets.find(x=>x.id===el('tradeAsset').value);if(!a)return;
 const side=el('tradeSide').value,units=n(el('tradeUnits').value),amount=n(el('tradeAmount').value),fee=n(el('tradeFee').value),date=el('tradeDate').value;
 if(units<=0||amount<=0)return toast('请填写大于零的份额与交易金额');
 if(side==='sell'&&units>n(a.units)+1e-8)return toast('卖出的份额不能超过当前持有份额');
 const cash=S.cash[a.account]||(S.cash[a.account]={amount:0,verified:false});const impact=side==='buy'?-amount-fee:amount-fee;
 let realized=null;
 if(side==='buy'){if(n(a.units)===0||a.costSgd!==null)a.costSgd=n(a.costSgd)+amount+fee;else a.costSgd=null;a.units=n(a.units)+units;}
 else{if(a.costSgd!==null&&n(a.units)>0){const reduced=n(a.costSgd)*(units/n(a.units));realized=amount-fee-reduced;a.costSgd=Math.max(0,n(a.costSgd)-reduced);}a.units=Math.max(0,n(a.units)-units);}
 if(el('tradeCash').checked){cash.amount=n(cash.amount)+impact;cash.verified=true;}
 S.trades.push({id:uid(),date,assetId:a.id,assetName:a.name,account:a.account,side,units,amount,fee,realized});save();render();toast('交易已记录；请核对实际账户现金余额');el('tradeForm').reset();el('tradeDate').value=today();}
function handleFlow(ev){ev.preventDefault();const account=el('flowAccount').value,type=el('flowType').value,amount=n(el('flowAmount').value),date=el('flowDate').value,note=el('flowNote').value;if(amount<=0)return toast('金额应大于零');
 S.flows.push({id:uid(),date,account,type,amount,note});if(el('flowCash').checked){const c=S.cash[account]||(S.cash[account]={amount:0,verified:false});c.amount+=type==='withdraw'||type==='fee'?-amount:amount;c.verified=true;}save();render();el('flowForm').reset();el('flowDate').value=today();toast('流水已记录');}
function renderActivity(){renderTradeForm();el('cashCards').innerHTML=`<div class="cash-grid">${Object.entries(S.cash).map(([a,c])=>`<div class="cash-box"><strong>${esc(a)} ${!c.verified?msgBadge('待核实'):msgBadge('已确认')}</strong><div class="val">${money(n(c.amount),2)}</div><label>实际余额（SGD）</label><input type="number" step="0.01" data-cash="${esc(a)}" value="${n(c.amount)}"/><button class="mini-btn" data-save-cash="${esc(a)}">保存</button></div>`).join('')}</div>`;
 const tx=[...S.flows.map(f=>({date:f.date,name:f.account,kind:({deposit:'入金',withdraw:'提款',income:'股息/利息',fee:'费用'}[f.type]),amount:(f.type==='withdraw'||f.type==='fee'?-1:1)*n(f.amount),note:f.note})),...S.trades.map(t=>({date:t.date,name:t.assetName,kind:t.side==='buy'?'买入':'卖出',amount:t.side==='buy'?-n(t.amount)-n(t.fee):n(t.amount)-n(t.fee),note:`${val(t.units,6)} units${t.realized!==null?' · 已实现盈亏 '+money(t.realized):''}`}))].sort((a,b)=>String(b.date).localeCompare(a.date));
 el('activityTable').innerHTML=table(['日期','账户 / 产品','类型','金额（SGD）','备注'],tx.slice(0,60).map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(t.name)}</td><td>${esc(t.kind)}</td><td class="num ${t.amount>=0?'positive':'negative'}">${money(t.amount,2)}</td><td>${esc(t.note)}</td></tr>`).join(''));
}
function getAllocation(){const ex=exposure(),invested=ex.stock+ex.bond+ex.other;return {ex,invested,stockPct:invested?100*ex.stock/invested:0,bondPct:invested?100*ex.bond/invested:0};}
function adviceHtml(ex,amt,mode){if(ex.unvalued)return `<div class="advice"><strong>请先补齐价格</strong>部分持仓无可用单价，配置建议可能不准确。</div>`;
 if(ex.invested<1)return `<div class="advice"><strong>先记录实际基金份额</strong>你目前的计划订单尚不等于已经成交的持仓。</div>`;
 let message='';const invested=ex.stock+ex.bond+ex.other, bondPct=100*ex.bond/invested,targetBond=100-S.targets.stock;
 if(mode==='total'){
 const stockDiff=S.targets.stock-(100*ex.stock/invested),bondDiff=targetBond-bondPct;
 if(bondDiff>4){message=`当前债券约 ${val(bondPct,1)}%，低于目标 ${val(targetBond,0)}%。下一笔约 ${money(amt)} 可以优先研究低波动 SGD 国债（例如合资格 SRS 的 SSB），无需为了凑比例立即下单。`;
 }else if(stockDiff>4){message=`当前股票约 ${val(100*ex.stock/invested,1)}%，低于目标 ${val(S.targets.stock,0)}%。下一笔可优先增加全球股票指数基金（例如 VWRA / MSCI World）。`;
 }else message=`当前股票和债券都在目标附近。下一笔 ${money(amt)} 可正常按既定计划投入；不必为小于 5 个百分点的偏差卖出现有持仓。`;
 }else{
 const goals=S.targets.regions,weights=ex.regions;
 const pairs=Object.entries(goals).map(([k,t])=>({k,t,actual:ex.stock?100*n(weights[k])/ex.stock:0})).sort((a,b)=>(a.actual-a.t)-(b.actual-b.t));
 const p=pairs[0],nm={us:'美国',dev:'其他发达市场',em:'新兴市场',sg:'新加坡'}[p.k];
 message=`股票内部最明显低配的是${nm}：约 ${val(p.actual,1)}%，目标 ${val(p.t,1)}%。可以优先增加对应市场敞口，但请考虑基金重叠及 POEMS 的 SRS 购买限制。`;
 }
 return `<div class="advice"><strong>下一笔 ${money(amt)} · 优先补低配，不预测涨跌</strong><p>${esc(message)}</p></div><p class="subtle" style="margin-top:12px">只根据你设置的比例和已记录市值生成，不是行情预测；不考虑个人税务、流动性或持仓集中度等全部条件。</p>`;
}
function renderAllocation(){const a=getAllocation(),ex=a.ex;el('stockTarget').value=S.targets.stock;el('stockLabel').textContent=S.targets.stock+'%';el('bondLabel').textContent=(100-S.targets.stock)+'%';
 el('targetCompare').innerHTML=`<div class="target-row"><span>股票</span><b>${val(a.stockPct,1)}% 实际 / ${S.targets.stock}% 目标</b></div><div class="target-row"><span>债券</span><b>${val(a.bondPct,1)}% 实际 / ${100-S.targets.stock}% 目标</b></div><p class="subtle">已投入市值：${money(a.invested)}；待投资现金单独记录，不算成债券。</p>`;
 el('regionInputs').innerHTML=Object.entries(S.targets.regions).map(([k,v])=>`<label class="region-row"><span>${{us:'美国',dev:'其他发达市场',em:'新兴市场',sg:'新加坡'}[k]}</span><span><input type="number" min="0" max="100" step="0.5" data-region="${k}" value="${v}"/> %</span></label>`).join('')+`<button class="mini-btn" id="saveRegions">保存地区目标</button>`;
 el('regionCompare').innerHTML=Object.entries(S.targets.regions).map(([k,v])=>{let pct=ex.stock?100*n(ex.regions[k])/ex.stock:0;return `<div class="target-row"><span>${{us:'美国',dev:'其他发达',em:'新兴市场',sg:'新加坡'}[k]}</span><b>${val(pct,1)}% / ${val(v,1)}%</b></div>`;}).join('');
 el('allocationAdvice').innerHTML=adviceHtml(ex,n(el('nextAmount').value)||500,el('adviceMode').value);
 const rows=S.assets.filter(x=>x.assetClass==='stock').map(x=>`<tr><td>${esc(x.name)}</td>${['us','dev','em','sg'].map(k=>`<td class="num">${val(n(x.weights?.[k]),1)}%</td>`).join('')}<td><button class="mini-btn" data-edit="${esc(x.id)}">编辑</button></td></tr>`).join('');
 el('weightsTable').innerHTML=table(['基金','美国','其他发达','新兴市场','新加坡','修改'],rows);
}
function renderSettings(){el('fxManual').value=n(S.fx.USD?.rate)||1.27887;el('quoteUrl').value=S.quoteApiUrl||'';el('marketStatus').innerHTML=`<div class="market-line"><span>在线行情代理</span><b>${serverEnabled?'已连接':'未启动（手动模式）'}</b></div><div class="market-line"><span>USD / SGD 最近使用汇率</span><b>${val(n(S.fx.USD?.rate),5)} · ${esc(S.fx.USD?.date||'')}</b></div><div class="market-line"><span>上次自动更新</span><b>${esc(S.lastFetch?.replace('T',' ').slice(0,19)||'尚未更新')}</b></div>`;
 el('completionSettings').innerHTML=Object.entries(S.complete).map(([account,flag])=>`<label><span>${esc(account)} <span class="minor">累计入金：${money(netFlows(account))}</span></span><span><input type="checkbox" data-complete="${esc(account)}" ${flag?'checked':''}/> 历史流水完整</span></label>`).join('');}
function render(){notice();if(tab==='overview')renderOverview();if(tab==='holdings')renderHoldings();if(tab==='activity')renderActivity();if(tab==='allocation')renderAllocation();if(tab==='settings')renderSettings();}
function bindDelegation(){document.addEventListener('click',ev=>{let btn=ev.target.closest('[data-edit]');if(btn){const a=S.assets.find(x=>x.id===btn.dataset.edit);if(a)assetDialog(a);return;}btn=ev.target.closest('[data-del]');if(btn){const a=S.assets.find(x=>x.id===btn.dataset.del);if(a&&confirm(`确定删除「${a.name}」？这只删除持仓，不会撤销历史流水。`)){S.assets=S.assets.filter(x=>x.id!==a.id);save();render();}return;}
 btn=ev.target.closest('[data-save-cash]');if(btn){const account=btn.dataset.saveCash;const input=[...document.querySelectorAll('input[data-cash]')].find(x=>x.dataset.cash===account);if(input){S.cash[account]={amount:n(input.value),verified:true};save();render();toast('现金余额已更新');}return;}
 btn=ev.target.closest('[data-go]');if(btn)setTab(btn.dataset.go);
 });document.addEventListener('change',ev=>{if(ev.target.matches('[data-complete]')){S.complete[ev.target.dataset.complete]=ev.target.checked;save();render();}});}
function initEvents(){document.querySelectorAll('.nav').forEach(x=>x.addEventListener('click',()=>setTab(x.dataset.tab)));el('showTask').addEventListener('change',e=>{showTask=e.target.checked;render();});
 for(const id of ['quickAddBtn','holdingsAddBtn'])el(id).addEventListener('click',()=>assetDialog(null));
 el('closeAsset').addEventListener('click',()=>el('assetDialog').close());el('cancelAsset').addEventListener('click',()=>el('assetDialog').close());el('assetForm').addEventListener('submit',saveAsset);
 el('tradeForm').addEventListener('submit',handleTrade);el('flowForm').addEventListener('submit',handleFlow);
 el('stockTarget').addEventListener('input',e=>{S.targets.stock=n(e.target.value);save();renderAllocation();});
 el('nextAmount').addEventListener('input',()=>el('allocationAdvice').innerHTML=adviceHtml(exposure(),n(el('nextAmount').value)||0,el('adviceMode').value));
 el('adviceMode').addEventListener('change',()=>el('allocationAdvice').innerHTML=adviceHtml(exposure(),n(el('nextAmount').value)||0,el('adviceMode').value));
 document.addEventListener('click',e=>{if(e.target.id==='saveRegions'){let newGoal={};document.querySelectorAll('[data-region]').forEach(x=>newGoal[x.dataset.region]=n(x.value));if(Math.abs(Object.values(newGoal).reduce((a,b)=>a+b,0)-100)>0.1){toast('地区目标之和必须等于 100%');return;}S.targets.regions=newGoal;save();render();toast('地区目标已更新');}});
 el('saveQuoteBtn').addEventListener('click',async()=>{const v=el('quoteUrl').value.trim().replace(/\/+$/,'');if(v&&(!/^https:\/\//i.test(v)||v.length>250)){toast('行情代理必须是 HTTPS 地址');return;}S.quoteApiUrl=v;save();await detectServer();renderSettings();toast(serverEnabled?'行情连接成功':'已保存地址；当前尚未连接行情服务');});
 el('saveFxBtn').addEventListener('click',()=>{const rate=n(el('fxManual').value);if(rate<.5||rate>3)return toast('请检查汇率是否正确');S.fx.USD={rate,date:today(),source:'手动输入'};save();render();toast('美元汇率已更新');});
 el('exportBtn').addEventListener('click',()=>download('investment-compass-backup-'+today()+'.json',JSON.stringify(S,null,2),'application/json'));
 el('exportCsvBtn').addEventListener('click',()=>{const rows=[['name','account','ticker','class','currency','units','cost_basis_sgd','price','market_value_sgd','quoted_at'],...S.assets.map(a=>{const q=quote(a);return [a.name,a.account,a.ticker,a.assetClass,a.currency,a.units,a.costSgd??'',q.price??'',positionValue(a)??'',q.at||''];})];download('investment-holdings-'+today()+'.csv','\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv;charset=utf-8');});
 el('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj.version!==1||!Array.isArray(obj.assets)||!obj.cash||!obj.targets)throw Error('格式不正确');if(!confirm('导入会覆盖当前本地记录，确定继续？'))return;S=obj;save();render();toast('备份已恢复');}catch(error){toast('导入失败：'+error.message);}finally{e.target.value='';}});
 el('resetBtn').addEventListener('click',()=>{if(confirm('确定恢复空白初始状态？当前记录会丢失，建议先导出备份。')){S=seed();save();render();toast('已恢复空白初始状态');}});
 el('refreshBtn').addEventListener('click',refreshPrices);
 el('tradeDate').value=today();el('flowDate').value=today();}
function download(filename,contents,type){const url=URL.createObjectURL(new Blob([contents],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function quoteBase(){return (S.quoteApiUrl||'').trim().replace(/\/+$/,'');}
async function detectServer(){serverEnabled=false;try{const controller=new AbortController();const t=setTimeout(()=>controller.abort(),1600);const res=await fetch(quoteBase()+'/api/status',{signal:controller.signal,cache:'no-store'});clearTimeout(t);const obj=await res.json();serverEnabled=!!obj.ok;}catch(_){serverEnabled=false;}el('serverBadge').textContent=serverEnabled?'● 联网报价可用':'○ 离线手动行情';el('refreshBtn').disabled=!serverEnabled;if(serverEnabled&&navigator.onLine)refreshPrices(false);}
async function refreshPrices(announce=true){if(!serverEnabled){toast('请在设置中配置 HTTPS 行情服务，或手动更新基金价格');return;}const btn=el('refreshBtn');btn.disabled=true;btn.textContent='⟳ 获取行情中…';
 const targets=[...new Set([...S.assets.filter(a=>a.source==='auto'&&a.ticker).map(a=>a.ticker),'SGD=X'])];let ok=0,fail=[];
 await Promise.all(targets.map(async symbol=>{try{const res=await fetch(quoteBase()+'/api/quote?ticker='+encodeURIComponent(symbol),{cache:'no-store'});const data=await res.json();if(!data.ok)throw Error(data.error);
 if(symbol==='SGD=X'){if(data.currency&&data.currency!=='SGD')throw Error('汇率货币异常');S.fx.USD={rate:n(data.price),date:String(data.asof||today()).slice(0,10),source:'Yahoo Finance'};}
 else{for(const a of S.assets.filter(x=>x.ticker===symbol)){
 // Never silently assign a quote in a different currency to a position.
 if(data.currency&&data.currency!==a.currency){fail.push(symbol+' 报价币种与持仓不符');continue;}
 a.livePrice=n(data.price);a.liveAt=data.asof;
 }}ok++;
 }catch(_){fail.push(symbol);}}));S.lastFetch=new Date().toISOString();save();btn.disabled=false;btn.textContent='⟳ 更新报价';render();if(announce)toast(`已更新 ${ok} 个报价${fail.length?'；失败：'+fail.join('、')+'（保留旧价）':''}`);}
initEvents();bindDelegation();render();detectServer();
// When this local page remains open, refresh public quotes every 15 minutes.
setInterval(()=>{if(serverEnabled&&navigator.onLine)refreshPrices(false);},15*60*1000);
