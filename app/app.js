(function(){

  // ---- данные: читаем сохранённую базу с диска, при первом запуске — демо-данные ----
  var stored = window.crm ? window.crm.load() : null;
  var db = stored || JSON.parse(JSON.stringify(window.CRM_DEMO_DATA));
  var managers = db.managers;
  var bases = db.bases;
  var companies = db.companies;
  var deals = db.deals;

  var saveTimer = null;
  function saveNow(){
    clearTimeout(saveTimer); saveTimer = null;
    if (window.crm) window.crm.save({ version: 1, managers: managers, bases: bases, companies: companies, deals: deals });
  }
  function persist(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  window.addEventListener('beforeunload', function(){ if (saveTimer) saveNow(); });

  var callResults = ["В проработке","Дубль","Занято","Зарегистрирован на вебинар","Ликвидирована","Назначена встреча",
    "Не обслуживается, тел выключен","Не соединил секретарь","Неверный номер","Недозвон","Неинтересно",
    "Обсуждаем возможность встречи","Отправлено письмо для регистрации","Передан в другой офис","Перезвонить",
    "Подтвержден на вебинар","Пригласить в другой раз","Прогрев текущего","Сброс звонка IVR","Создан прелид"];

  var emptyDirs = ['ЕРП','КЭДО','Медицина','МП'];

  // ---- presale funnel: stages match the real board (screenshot) 1:1 ----
  var STAGES = [
    {id:'presale',   name:'Пресейл',                                 color:'#d99a1f'},
    {id:'discuss',   name:'Обсуждаем встречу',                       color:'#2ea3ad'},
    {id:'scheduled', name:'Встреча назначена',                       color:'#d99a1f'},
    {id:'met',       name:'Встреча проведена / Проект в разработке', color:'#2ea3ad'},
    {id:'push',      name:'Дожим',                                   color:'#d6579e'},
    {id:'invoiced',  name:'Счёт выставлен',                          color:'#7f9c3c'},
    {id:'won',       name:'Успех',                                   color:'#4a8f4f'},
    {id:'lost',      name:'Неудача',                                 color:'#af3327'},
    {id:'onhold',    name:'Проект отложен',                          color:'#726c72'},
    {id:'handed',    name:'Передачи',                                color:'#c9509a', done:true}
  ];
  var TERMINAL_STAGES = ['won','lost','onhold','handed'];
  var AUTO_DEAL_TRIGGERS = { 'Обсуждаем возможность встречи':'discuss', 'Назначена встреча':'scheduled' };

  var state = { baseId: 'all', manager: '', result: '', onlyCallback: false, selected: {}, search: '', tab: 'companies', presaleStage: '' };

  function fmtBaseLabel(b){ return b.date + ' — ' + b.name.replace(/^[\d.]+\s*/, ''); }

  function lastCall(c){ return c.calls.length ? c.calls[c.calls.length-1] : null; }

  function webinarChip(c){
    if (!c.statusWebinar) return '<span class="chip neutral"><span class="chip-dot"></span>—</span>';
    var cls = c.statusWebinar === 'Пришёл' ? 'good' : 'bad';
    var mini = [c.statusReg, c.statusConfirm].filter(Boolean).join(' · ');
    return '<span class="chip '+cls+'"><span class="chip-dot"></span>'+esc(c.statusWebinar)+'</span>' +
      (mini ? '<div class="webinar-mini">'+esc(mini)+'</div>' : '');
  }

  var NEG_RESULTS = ['Неинтересно','Недозвон','Неверный номер','Занято','Не обслуживается, тел выключен','Ликвидирована','Дубль','Не соединил секретарь','Сброс звонка IVR'];
  var POS_RESULTS = ['Подтвержден на вебинар','Зарегистрирован на вебинар','Обсуждаем возможность встречи','Назначена встреча','Создан прелид'];

  function resultClass(result){
    if (NEG_RESULTS.indexOf(result) > -1) return 'bad';
    if (POS_RESULTS.indexOf(result) > -1) return 'good';
    return 'neutral';
  }

  function resultChip(c){
    var lc = lastCall(c);
    if (!lc) return '<span class="chip neutral"><span class="chip-dot"></span>Без звонков</span>';
    return '<span class="chip '+resultClass(lc.result)+'"><span class="chip-dot"></span>'+esc(lc.result || '—')+'</span>';
  }

  var BADGE_PALETTE = [
    {bg:'#fbe1ee', fg:'#c2005f'}, {bg:'#dcefe7', fg:'#166348'}, {bg:'#eceaec', fg:'#4a4a50'},
    {bg:'#f3e2dc', fg:'#8a3a24'}, {bg:'#e1e8f5', fg:'#2f4f8f'}, {bg:'#efe3f5', fg:'#6c3a91'}
  ];
  function initials(name){
    var parts = name.replace(/["«»]/g,'').split(' ').filter(Boolean);
    return ((parts[0]||'')[0]||'') + ((parts[1]||'')[0]||'');
  }
  function nameHash(name){ var h=0; for (var i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0; return h; }
  function managerBadge(name){
    var p = BADGE_PALETTE[nameHash(name) % BADGE_PALETTE.length];
    return '<span class="mgr-badge" style="background:'+p.bg+'; color:'+p.fg+';">'+esc(initials(name).toUpperCase())+'</span>';
  }

  function esc(s){ return (s||'').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function visibleCompanies(){
    return companies.filter(function(c){
      if (state.baseId !== 'all' && c.baseId !== state.baseId) return false;
      if (state.manager && c.manager !== state.manager) return false;
      if (state.result === '__none__') {
        if (lastCall(c)) return false;
      } else if (state.result) {
        var lc = lastCall(c);
        if (!lc || lc.result !== state.result) return false;
      }
      if (state.onlyCallback) { var lcb = lastCall(c); if (!(lcb && lcb.callback)) return false; }
      if (state.search) {
        var q = state.search.toLowerCase();
        if (c.name.toLowerCase().indexOf(q) === -1 && c.inn.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // ---- filters bar (отбор): база с группировкой по направлениям + менеджер + результат + перезвон ----
  function renderFilterStaticOptions(){
    var mgrSel = document.getElementById('fltManager');
    mgrSel.innerHTML = '<option value="">Все менеджеры</option>' + managers.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');
    var resSel = document.getElementById('fltResult');
    resSel.innerHTML = '<option value="">Любой результат</option><option value="__none__">Без звонков</option>' +
      callResults.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('');
  }

  function renderFilters(){
    var baseSel = document.getElementById('fltBase');
    var byYear = {};
    bases.forEach(function(b){ (byYear[b.year] = byYear[b.year] || []).push(b); });
    var html = '<option value="all"'+(state.baseId==='all'?' selected':'')+'>Все базы ('+companies.length+')</option>';
    Object.keys(byYear).forEach(function(year){
      var byDir = {};
      byYear[year].forEach(function(b){ (byDir[b.direction] = byDir[b.direction] || []).push(b); });
      Object.keys(byDir).forEach(function(dir){
        html += '<optgroup label="'+esc(year+' · '+dir)+'">';
        byDir[dir].forEach(function(b){
          var cnt = companies.filter(function(c){return c.baseId===b.id;}).length;
          html += '<option value="'+b.id+'"'+(state.baseId===b.id?' selected':'')+'>'+esc(fmtBaseLabel(b))+' ('+cnt+')</option>';
        });
        html += '</optgroup>';
      });
      emptyDirs.forEach(function(dir){
        html += '<optgroup label="'+esc(year+' · '+dir)+'"><option disabled>нет активных вебинаров</option></optgroup>';
      });
    });
    baseSel.innerHTML = html;
    document.getElementById('fltManager').value = state.manager;
    document.getElementById('fltResult').value = state.result;
    document.getElementById('fltCallback').checked = state.onlyCallback;
  }

  function renderTable(){
    var list = visibleCompanies();
    var tbody = document.getElementById('tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:28px; color:var(--ink-faint);">Нет компаний по этому фильтру</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function(c){
      var lc = lastCall(c);
      var comment = lc && lc.comment ? lc.comment : '';
      return '<tr class="row" data-id="'+c.id+'">' +
        '<td onclick="event.stopPropagation()"><input type="checkbox" class="rowCheck" data-id="'+c.id+'" '+(state.selected[c.id]?'checked':'')+'></td>' +
        '<td><div class="company-name">'+esc(c.name)+'</div><div class="company-inn copyable" data-copy="'+esc(c.inn)+'" title="Нажмите, чтобы скопировать ИНН">'+esc(c.inn)+'<span class="copy-hint">⧉</span></div></td>' +
        '<td class="k7-cell'+(c.k7?' copyable':'')+'"'+(c.k7?' data-copy="'+esc(c.k7)+'" title="Нажмите, чтобы скопировать"':'')+'>'+(c.k7 ? esc(c.k7)+'<span class="copy-hint">⧉</span>' : '—')+'</td>' +
        '<td>'+webinarChip(c)+'</td>' +
        '<td>'+esc(c.manager)+'</td>' +
        '<td>'+resultChip(c)+'</td>' +
        '<td>'+(comment ? '<span class="comment-cell" title="'+esc(comment)+'">'+esc(comment)+'</span>' : '<span style="color:var(--ink-faint);">—</span>')+'</td>' +
        '<td>'+(lc && lc.callback ? '<span class="mono" style="font-size:12px;">'+esc(lc.callback)+'</span>' : '<span style="color:var(--ink-faint);">—</span>')+'</td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('tr.row').forEach(function(tr){
      tr.addEventListener('click', function(){ openQuickCall(tr.getAttribute('data-id')); });
    });
    tbody.querySelectorAll('.rowCheck').forEach(function(cb){
      cb.addEventListener('change', function(){
        state.selected[cb.getAttribute('data-id')] = cb.checked;
        renderToolbar();
      });
    });
    tbody.querySelectorAll('.k7-cell.copyable, .company-inn.copyable').forEach(function(cell){
      cell.addEventListener('click', function(e){
        e.stopPropagation();
        copyText(cell.getAttribute('data-copy'));
      });
    });
  }

  function copyText(text){
    if (!text) return;
    if (window.crm) {
      window.crm.copyText(text).then(function(){ showToast('Код скопирован: '+text); }).catch(function(){ fallbackCopy(text); });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ showToast('Код скопирован: '+text); }).catch(function(){ fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Код скопирован: '+text); }
    catch(e){ showToast('Не удалось скопировать — выделите вручную'); }
    document.body.removeChild(ta);
  }

  function renderToolbar(){
    var ids = Object.keys(state.selected).filter(function(k){return state.selected[k];});
    document.getElementById('selCount').textContent = ids.length ? ('выбрано: '+ids.length) : '';
    document.getElementById('btnAssign').disabled = !(ids.length && document.getElementById('bulkManager').value);
  }

  function renderManagerOptions(){
    var sel = document.getElementById('bulkManager');
    sel.innerHTML = '<option value="">Назначить на…</option>' + managers.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');
  }

  var drillRegistry = {};

  function lastResultOf(c){ var lc = lastCall(c); return lc ? (lc.result || '—') : 'Без звонков'; }

  function registerDrill(key, title, subtitle, items){
    drillRegistry[key] = { title: title, subtitle: subtitle, items: items };
    return key;
  }

  function renderFunnel(){
    var list = visibleCompanies();
    drillRegistry = {};

    // ---- compact stat strip (was 4 heavy KPI tiles) ----
    var kpiDefs = [
      { key: 'kpi-all', label: 'компаний в выборке', items: list, sub: 'Все компании текущего фильтра' },
      { key: 'kpi-nocalls', label: 'без звонка', items: list.filter(function(c){return !c.calls.length;}), sub: 'Ещё не начинали прозванивать' },
      { key: 'kpi-callback', label: 'назначен перезвон', items: list.filter(function(c){ var lc = lastCall(c); return lc && lc.callback; }), sub: 'Есть дата следующего звонка' },
      { key: 'kpi-came', label: 'пришли на вебинар', items: list.filter(function(c){return c.statusWebinar==='Пришёл';}), sub: 'Статус вебинара: Пришёл' }
    ];
    document.getElementById('funnelSummary').innerHTML = '<div class="stat-strip">' + kpiDefs.map(function(d, i){
      registerDrill(d.key, d.label, d.sub, d.items);
      var pct = list.length ? Math.round(d.items.length/list.length*100) : 0;
      var pctHtml = d.key === 'kpi-all' ? '' : '<i>'+pct+'%</i>';
      var sep = i ? '<span class="stat-sep">·</span>' : '';
      return sep + '<span class="stat-chip clickable" data-drill="'+d.key+'"><b>'+d.items.length+'</b><span>'+esc(d.label)+'</span>'+pctHtml+'</span>';
    }).join('') + '</div>';

    if (!list.length){
      document.getElementById('funnelWrap').innerHTML = '<div style="color:var(--ink-faint);">Нет данных по этому фильтру</div>';
      bindDrillHandlers();
      return;
    }

    // ---- aggregate by result, across all managers: labeled column chart ----
    var byResult = {};
    list.forEach(function(c){ var r = lastResultOf(c); (byResult[r] = byResult[r] || []).push(c); });
    var resultKeys = Object.keys(byResult).sort(function(a,b){return byResult[b].length - byResult[a].length;});
    var maxCount = resultKeys.reduce(function(m,r){ return Math.max(m, byResult[r].length); }, 1);
    var MAX_BAR_PX = 108;
    var cols = resultKeys.map(function(r, i){
      var items = byResult[r];
      var pct = Math.round(items.length/list.length*100);
      var key = registerDrill('result-'+i, r, 'Все менеджеры · результат «'+r+'»', items);
      var cls = r === 'Без звонков' ? 'neutral' : resultClass(r);
      var barPx = Math.max(Math.round(items.length/maxCount*MAX_BAR_PX), 6);
      return '<div class="colchart-col clickable" data-drill="'+key+'" title="'+esc(r)+' · '+items.length+' ('+pct+'%)">' +
        '<div class="colchart-barwrap">' +
          '<div class="colchart-val">'+items.length+'<span class="p">'+pct+'%</span></div>' +
          '<div class="colchart-bar '+cls+'" style="height:'+barPx+'px"></div>' +
        '</div>' +
        '<div class="colchart-label">'+esc(r)+'</div>' +
      '</div>';
    }).join('');
    var resultRows = '<div class="colchart-wrap"><div class="colchart">'+cols+'</div></div>';

    // ---- by manager ----
    var byManager = {};
    list.forEach(function(c){ (byManager[c.manager] = byManager[c.manager] || []).push(c); });
    var mgrs = Object.keys(byManager).sort(function(a,b){return byManager[b].length - byManager[a].length;});
    var managerHtml = mgrs.map(function(m){
      var mList = byManager[m];
      var byMR = {};
      mList.forEach(function(c){ var r = lastResultOf(c); (byMR[r] = byMR[r] || []).push(c); });
      var rows = Object.keys(byMR).sort(function(a,b){return byMR[b].length - byMR[a].length;}).map(function(r, i){
        var items = byMR[r];
        var pct = Math.round(items.length/mList.length*100);
        var key = registerDrill('mgr-'+esc(m)+'-'+i, r, m+' · результат «'+r+'»', items);
        var cls = r === 'Без звонков' ? '' : resultClass(r);
        return '<div class="funnel-row clickable" data-drill="'+key+'"><div class="rlabel">'+esc(r)+'</div>' +
          '<div class="bar-track"><div class="bar-fill '+cls+'" style="width:'+Math.max(pct,3)+'%"></div></div>' +
          '<div class="rcount"><span class="n">'+items.length+'</span><span class="p">'+pct+'%</span></div></div>';
      }).join('');
      var mKey = registerDrill('mgr-all-'+esc(m), m, 'Все компании менеджера', mList);
      return '<div class="funnel-manager"><div class="funnel-manager-head clickable" data-drill="'+mKey+'">'+managerBadge(m)+
        '<span class="name">'+esc(m)+'</span><span class="total">всего: '+mList.length+'</span></div>' +
        '<div class="funnel-rows">'+rows+'</div></div>';
    }).join('');

    document.getElementById('funnelWrap').innerHTML =
      '<div class="funnel-section"><div class="section-title">По результату звонка <span class="cnt">· все менеджеры, '+list.length+'</span></div>' +
        '<div class="funnel-manager" style="padding:16px;">'+resultRows+'</div></div>' +
      '<div class="funnel-section"><div class="section-title">По менеджерам <span class="cnt">· '+mgrs.length+'</span></div>' +
        '<div class="manager-grid">'+managerHtml+'</div></div>';

    bindDrillHandlers();
  }

  function bindDrillHandlers(){
    document.querySelectorAll('#view-funnel [data-drill]').forEach(function(el){
      el.addEventListener('click', function(){
        var d = drillRegistry[el.getAttribute('data-drill')];
        if (d) openDrillDown(d.title, d.subtitle, d.items);
      });
    });
  }

  function openDrillDown(title, subtitle, items){
    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var rows = items.length ? items.map(function(c){
      var lc = lastCall(c);
      return '<tr class="row" data-id="'+c.id+'">' +
        '<td><div class="company-name">'+esc(c.name)+'</div><div class="company-inn">'+esc(c.inn)+'</div></td>' +
        '<td>'+esc(c.manager)+'</td>' +
        '<td>'+resultChip(c)+'</td>' +
        '<td>'+(lc && lc.callback ? '<span class="mono" style="font-size:12px;">'+esc(lc.callback)+'</span>' : '<span style="color:var(--ink-faint);">—</span>')+'</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--ink-faint);">Пусто</td></tr>';

    var d = document.createElement('div'); d.className = 'drilldown'; d.id = 'drawer';
    d.innerHTML =
      '<div class="drilldown-head"><div><h3>'+esc(title)+'</h3><div class="sub">'+esc(subtitle||'')+' · '+items.length+' запис'+wordEnd(items.length)+'</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="drilldown-body"><table class="grid"><thead><tr><th>Компания</th><th>В работе у</th><th>Последний результат</th><th>Перезвон</th></tr></thead>' +
      '<tbody>'+rows+'</tbody></table></div>' +
      '<div class="drilldown-foot"><button class="btn" id="drillClose">Закрыть</button></div>';
    document.body.appendChild(d);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('drillClose').addEventListener('click', closePanel);
    d.querySelectorAll('tr.row').forEach(function(tr){
      tr.addEventListener('click', function(){ var id = tr.getAttribute('data-id'); closePanel(); openDrawer(id); });
    });
  }

  function wordEnd(n){
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'ь';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'и';
    return 'ей';
  }

  function renderAll(){
    persist();
    renderFilters(); renderTable(); renderToolbar(); renderFunnel(); renderPresale();
  }

  // ---- drawer ----
  var currentCompanyId = null;

  function openDrawer(id){
    currentCompanyId = id;
    var c = companies.filter(function(x){return x.id===id;})[0];
    if (!c) return;
    var base = bases.filter(function(b){return b.id===c.baseId;})[0];

    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var d = document.createElement('div'); d.className = 'center-modal'; d.id = 'drawer';
    d.innerHTML =
      '<div class="drawer-head"><div><h3>'+esc(c.name)+'</h3><div class="sub">'+esc(base ? fmtBaseLabel(base) : '')+'</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="drawer-body">' +
        '<div class="field-grid">' +
          copyableField('ИНН', c.inn) +
          copyableField('Код К7 прелида', c.k7) +
          field('Контактное лицо', c.contact) +
          field('Должность', c.position) +
          field('Телефон', c.phone) +
          copyableField('Email', c.email) +
          field('Статус вебинара', c.statusWebinar) +
          field('Статус регистрации', c.statusReg) +
          field('Статус подтверждения', c.statusConfirm) +
          managerField(c) +
        '</div>' +
        '<div class="journal"><h4>Журнал звонков</h4>' + journalHtml(c) + '</div>' +
        '<div class="add-call-form">' +
          '<h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint);">Добавить звонок</h4>' +
          '<select class="field" id="fResult"><option value="">Результат…</option>' + callResults.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('') + '</select>' +
          '<textarea class="field" id="fComment" placeholder="Комментарий…"></textarea>' +
          '<div class="row2">' +
            '<div><label style="font-size:11px;color:var(--ink-faint);">Когда перезвонить</label><input class="field" type="date" id="fCallback"></div>' +
            '<div><label style="font-size:11px;color:var(--ink-faint);">Кто звонил</label><select class="field" id="fWho">' + managers.map(function(m){return '<option '+(m===c.manager?'selected':'')+' value="'+esc(m)+'">'+esc(m)+'</option>';}).join('') + '</select></div>' +
          '</div>' +
          '<button class="btn primary" id="fSubmit" style="align-self:flex-start;">Сохранить звонок</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('fSubmit').addEventListener('click', function(){ submitCall(c.id); });
    d.querySelectorAll('.val.copyable').forEach(function(el){
      el.addEventListener('click', function(){ copyText(el.getAttribute('data-copy')); });
    });
  }

  function openQuickCall(id){
    currentCompanyId = id;
    var c = companies.filter(function(x){return x.id===id;})[0];
    if (!c) return;

    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var prior = c.calls.slice().reverse().slice(0, 2);
    var priorHtml = prior.length
      ? '<div class="prior-calls"><span class="lbl">Предыдущие звонки</span>' +
          prior.map(function(call){
            return '<div class="prior-call-mini"><span class="d">'+esc(call.date)+'</span><span>'+esc(call.result || '—')+(call.comment ? ' — '+esc(call.comment) : '')+'</span></div>';
          }).join('') +
        '</div>'
      : '';

    var m = document.createElement('div'); m.className = 'quickcall'; m.id = 'quickcall';
    m.innerHTML =
      '<div class="quickcall-head"><div><h3>'+esc(c.name)+'</h3><div class="sub">'+esc(c.manager)+webinarSuffix(c)+'</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="quickcall-body">' +
        priorHtml +
        '<div><span class="field-label">Результат звонка</span>' +
          '<select class="field" id="fResult"><option value="">Выберите результат…</option>' + callResults.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('') + '</select></div>' +
        '<div><span class="field-label">Комментарий</span><textarea class="field" id="fComment" placeholder="Комментарий к звонку…"></textarea></div>' +
        '<div class="row2">' +
          '<div><span class="field-label">Когда перезвонить</span><input class="field" type="date" id="fCallback"></div>' +
          '<div><span class="field-label">Кто звонил</span><select class="field" id="fWho">' + managers.map(function(mg){return '<option '+(mg===c.manager?'selected':'')+' value="'+esc(mg)+'">'+esc(mg)+'</option>';}).join('') + '</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="quickcall-foot">' +
        '<button class="btn ghost" id="openFullCard">Открыть карточку целиком</button>' +
        '<div class="spacer"></div>' +
        '<button class="btn primary" id="fSubmit">Сохранить</button>' +
      '</div>';
    document.body.appendChild(m);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('fSubmit').addEventListener('click', function(){ submitCall(c.id); });
    document.getElementById('openFullCard').addEventListener('click', function(){ closePanel(); openDrawer(c.id); });
    var sel = document.getElementById('fResult'); if (sel) sel.focus();
  }

  function webinarSuffix(c){
    return c.statusWebinar ? ' · вебинар: '+esc(c.statusWebinar) : '';
  }

  function field(label, val){
    return '<div class="field-item"><label>'+esc(label)+'</label><div class="val'+(val?'':' empty')+'">'+(val? esc(val) : 'не заполнено')+'</div></div>';
  }
  function copyableField(label, val){
    if (!val) return field(label, val);
    return '<div class="field-item"><label>'+esc(label)+'</label>' +
      '<div class="val copyable" data-copy="'+esc(val)+'" title="Нажмите, чтобы скопировать">'+esc(val)+'<span class="copy-hint">⧉</span></div></div>';
  }
  function editField(label, id, val, placeholder){
    return '<div class="field-item"><label>'+esc(label)+'</label>' +
      '<input class="field" id="'+id+'" value="'+esc(val||'')+'"'+(placeholder?' placeholder="'+esc(placeholder)+'"':'')+'></div>';
  }
  function editCopyField(label, id, val, placeholder){
    return '<div class="field-item"><label>'+esc(label)+'</label>' +
      '<div class="field-copy"><input class="field" id="'+id+'" value="'+esc(val||'')+'"'+(placeholder?' placeholder="'+esc(placeholder)+'"':'')+'>' +
      '<button type="button" class="field-copy-btn" data-copy-input="'+id+'" title="Скопировать">⧉</button></div></div>';
  }
  function managerField(c){
    return '<div class="field-item"><label>В работе у</label><select class="field" id="fManager" style="padding:4px 8px;">' +
      managers.map(function(m){return '<option '+(m===c.manager?'selected':'')+' value="'+esc(m)+'">'+esc(m)+'</option>';}).join('') +
      '</select></div>';
  }
  function journalHtml(c){
    if (!c.calls.length) return '<div class="empty-journal">Звонков ещё не было</div>';
    return c.calls.slice().reverse().map(function(call){
      return '<div class="call-row">' +
        '<div class="top"><span class="mono">'+esc(call.date)+'</span><span>'+esc(call.who)+'</span></div>' +
        '<div class="result">'+esc(call.result || '—')+'</div>' +
        (call.comment ? '<div class="comment">'+esc(call.comment)+'</div>' : '') +
        (call.callback ? '<div class="callback">перезвонить: '+esc(call.callback)+'</div>' : '') +
        '</div>';
    }).join('');
  }

  function submitCall(id){
    var result = document.getElementById('fResult').value;
    if (!result) { document.getElementById('fResult').style.borderColor = 'var(--bad)'; return; }
    var c = companies.filter(function(x){return x.id===id;})[0];
    var now = new Date();
    var dateStr = pad(now.getDate())+'.'+pad(now.getMonth()+1)+'.'+now.getFullYear()+' '+pad(now.getHours())+':'+pad(now.getMinutes());
    var cbRaw = document.getElementById('fCallback').value;
    var cb = cbRaw ? cbRaw.split('-').reverse().join('.') : '';
    var commentVal = document.getElementById('fComment').value;
    // симулируем длительность звонка, как будто её прислала телефония БИТ.Аналитики
    var simDuration = commentVal.trim()
      ? Math.min(60 + Math.floor(Math.random()*180) + commentVal.length, 480)
      : 8 + Math.floor(Math.random()*35);
    c.calls.push({ date: dateStr, who: document.getElementById('fWho').value, result: result, comment: commentVal, callback: cb, duration: simDuration });
    var mgrField = document.getElementById('fManager');
    if (mgrField) c.manager = mgrField.value;
    var dealNote = maybeAutoCreateDeal(c, result);
    closePanel();
    renderAll();
    showToast('Звонок сохранён · '+result + (dealNote ? ' · '+dealNote : ''));
  }
  function pad(n){ return (n<10?'0':'')+n; }

  function closePanel(){
    var d = document.getElementById('drawer'); if (d) d.remove();
    var q = document.getElementById('quickcall'); if (q) q.remove();
    var im = document.getElementById('importModal'); if (im) im.remove();
    var s = document.getElementById('scrim'); if (s) s.remove();
    currentCompanyId = null;
  }

  function showToast(msg){
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  // ---- presale funnel: helpers ----
  function pluralRu(n, one, few, many){
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }
  function stageMeta(id){ return STAGES.filter(function(s){return s.id===id;})[0]; }
  function stageName(id){ var s = stageMeta(id); return s ? s.name : id; }
  function companyOf(id){ return id ? companies.filter(function(c){return c.id===id;})[0] : null; }
  function dealTitle(d){ var c = companyOf(d.companyId); return c ? c.name : (d.adhocName || '(без названия)'); }
  function dealContact(d){ var c = companyOf(d.companyId); return (c && c.contact) || d.adhocContact || ''; }
  function dealPhone(d){ var c = companyOf(d.companyId); return (c && c.phone) || d.adhocPhone || ''; }
  function fmtMoney(n){ return (Number(n)||0).toLocaleString('ru-RU') + ' ₽'; }
  function fmtDate(iso){ return iso ? iso.split('-').reverse().join('.') : ''; }
  function nowStr(){ var now = new Date(); return pad(now.getDate())+'.'+pad(now.getMonth()+1)+'.'+now.getFullYear()+' '+pad(now.getHours())+':'+pad(now.getMinutes()); }

  // ---- report modal: imitates a report pulled in from БИТ.Аналитика ----
  function fmtDuration(sec){
    sec = Math.max(0, Math.round(sec||0));
    var m = Math.floor(sec/60), s = sec % 60;
    return m + ':' + pad(s);
  }
  function computeReportData(){
    var base = bases.filter(function(b){return b.id===state.baseId;})[0];
    var scopeLabel = base ? fmtBaseLabel(base) : 'Все базы';
    var reportCompanies = state.baseId === 'all' ? companies : companies.filter(function(c){ return c.baseId === state.baseId; });
    var worked = reportCompanies.filter(function(c){ return c.calls.length > 0; });
    var allCalls = [];
    reportCompanies.forEach(function(c){ c.calls.forEach(function(call){ allCalls.push(call); }); });
    var totalDurationSec = allCalls.reduce(function(s,call){ return s + (Number(call.duration)||0); }, 0);
    var avgDurationSec = allCalls.length ? totalDurationSec/allCalls.length : 0;
    var totalMinutes = Math.round(totalDurationSec/60);
    var workedPct = reportCompanies.length ? Math.round(worked.length/reportCompanies.length*100) : 0;

    var byResult = {};
    worked.forEach(function(c){ var r = lastResultOf(c); (byResult[r] = byResult[r] || []).push(c); });
    var resultKeys = Object.keys(byResult).sort(function(a,b){return byResult[b].length - byResult[a].length;});

    return {
      scopeLabel: scopeLabel, reportCompanies: reportCompanies, worked: worked, workedPct: workedPct,
      allCalls: allCalls, totalMinutes: totalMinutes, avgDurationSec: avgDurationSec,
      byResult: byResult, resultKeys: resultKeys
    };
  }

  function openReportModal(){
    var rd = computeReportData();
    var resultRowsHtml = rd.resultKeys.length ? rd.resultKeys.map(function(r){
      var n = rd.byResult[r].length;
      var pct = rd.worked.length ? Math.round(n/rd.worked.length*100) : 0;
      return '<tr><td>'+esc(r)+'</td><td class="mono" style="text-align:right;">'+n+'</td><td class="mono" style="text-align:right; color:var(--ink-faint);">'+pct+'%</td></tr>';
    }).join('') : '<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--ink-faint);">Нет проработанных карточек</td></tr>';

    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var d = document.createElement('div'); d.className = 'drilldown'; d.id = 'drawer';
    d.innerHTML =
      '<div class="drilldown-head"><div><h3>Отчёт по прозвону базы</h3>' +
        '<div class="sub">«'+esc(rd.scopeLabel)+'» · сформирован '+esc(nowStr())+' · <span class="badge">БИТ.Аналитика</span></div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="drilldown-body" style="padding:18px 20px; display:flex; flex-direction:column; gap:20px;">' +
        '<div class="stat-strip">' +
          '<span class="stat-chip"><b>'+rd.reportCompanies.length+'</b><span>карточек в базе</span></span>' +
          '<span class="stat-sep">·</span>' +
          '<span class="stat-chip"><b>'+rd.worked.length+'</b><span>проработано</span><i>'+rd.workedPct+'%</i></span>' +
          '<span class="stat-sep">·</span>' +
          '<span class="stat-chip"><b>'+rd.allCalls.length+'</b><span>звонков</span></span>' +
          '<span class="stat-sep">·</span>' +
          '<span class="stat-chip"><b>'+rd.totalMinutes+'</b><span>мин исходящих</span></span>' +
          '<span class="stat-sep">·</span>' +
          '<span class="stat-chip"><b>'+fmtDuration(rd.avgDurationSec)+'</b><span>ср. время разговора</span></span>' +
        '</div>' +
        '<div>' +
          '<div class="section-title" style="margin-bottom:10px;">Сводный результат по проработанным карточкам</div>' +
          '<table class="grid"><thead><tr><th>Результат</th><th style="text-align:right;">Карточек</th><th style="text-align:right;">Доля</th></tr></thead><tbody>'+resultRowsHtml+'</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="drilldown-foot">' +
        '<button class="btn" id="btnCopyTelegram">📋 Скопировать для Telegram</button>' +
        '<button class="btn" id="drillClose">Закрыть</button>' +
      '</div>';
    document.body.appendChild(d);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('drillClose').addEventListener('click', closePanel);
    document.getElementById('btnCopyTelegram').addEventListener('click', function(){ copyReportAsImage(rd); });
  }

  function buildShareCardHtml(rd){
    var resultRows = rd.resultKeys.length ? rd.resultKeys.map(function(r){
      var n = rd.byResult[r].length;
      var pct = rd.worked.length ? Math.round(n/rd.worked.length*100) : 0;
      return '<tr><td>'+esc(r)+'</td><td>'+n+'</td><td>'+pct+'%</td></tr>';
    }).join('') : '<tr><td colspan="3" style="text-align:center; color:#a89ea3; padding:14px 0;">Нет проработанных карточек</td></tr>';

    var tiles = [
      { n: rd.reportCompanies.length, l: 'карточек в базе' },
      { n: rd.worked.length + ' ('+rd.workedPct+'%)', l: 'проработано' },
      { n: rd.allCalls.length, l: 'звонков' },
      { n: rd.totalMinutes, l: 'мин исходящих' },
      { n: fmtDuration(rd.avgDurationSec), l: 'ср. время разговора' }
    ];
    var tilesHtml = tiles.map(function(t){ return '<div class="sc-tile"><div class="n">'+t.n+'</div><div class="l">'+esc(t.l)+'</div></div>'; }).join('');

    return '<div class="sc-head"><div><div class="sc-title">Отчёт по прозвону базы</div>' +
        '<div class="sc-sub">«'+esc(rd.scopeLabel)+'» · сформирован '+esc(nowStr())+'</div></div>' +
        '<span class="sc-badge">БИТ.Аналитика</span></div>' +
      '<div class="sc-stats">'+tilesHtml+'</div>' +
      '<div class="sc-section-title">Сводный результат по проработанным карточкам</div>' +
      '<table><thead><tr><th>Результат</th><th>Карточек</th><th>Доля</th></tr></thead><tbody>'+resultRows+'</tbody></table>' +
      '<div class="sc-foot"><span>CRM «Прозвон» · Первый БИТ</span><span>'+esc(nowStr())+'</span></div>';
  }

  function copyReportAsImage(rd){
    if (typeof html2canvas === 'undefined') { showToast('Не удалось загрузить модуль для скриншота — нет сети'); return; }
    var host = document.createElement('div');
    host.className = 'share-card-host';
    host.innerHTML = '<div class="share-card" id="shareCardEl">'+buildShareCardHtml(rd)+'</div>';
    document.body.appendChild(host);

    html2canvas(document.getElementById('shareCardEl'), { scale: 2, backgroundColor: '#ffffff' }).then(function(canvas){
      canvas.toBlob(function(blob){
        document.body.removeChild(host);
        if (!blob) { showToast('Не удалось собрать картинку'); return; }
        if (window.crm) {
          window.crm.copyImage(canvas.toDataURL('image/png'))
            .then(function(){ showToast('Отчёт скопирован картинкой — вставьте в Telegram (Ctrl/Cmd+V)'); })
            .catch(function(){ downloadImageFallback(blob); });
        } else if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ])
            .then(function(){ showToast('Отчёт скопирован картинкой — вставьте в Telegram (Ctrl/Cmd+V)'); })
            .catch(function(){ downloadImageFallback(blob); });
        } else {
          downloadImageFallback(blob);
        }
      });
    }).catch(function(){
      if (document.body.contains(host)) document.body.removeChild(host);
      showToast('Не удалось собрать картинку отчёта');
    });
  }

  function downloadImageFallback(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'otchet-prozvon.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    showToast('Скопировать в буфер не удалось — картинка скачана, прикрепите файлом');
  }
  function probClass(p){ p = Number(p); if (p >= 70) return 'good'; if (p >= 35) return 'neutral'; return 'bad'; }
  function countOpenTasksForStage(stageId){
    var n = 0;
    deals.forEach(function(d){ d.tasks.forEach(function(t){ if (!t.done && t.stage === stageId) n++; }); });
    return n;
  }

  function maybeAutoCreateDeal(c, result){
    var targetStage = AUTO_DEAL_TRIGGERS[result];
    if (!targetStage) return null;
    var openDeal = deals.filter(function(d){ return d.companyId === c.id && TERMINAL_STAGES.indexOf(d.stage) === -1; })[0];
    if (openDeal) {
      if (openDeal.stage !== targetStage) { openDeal.stage = targetStage; return 'сделка перемещена на этап «'+stageName(targetStage)+'»'; }
      return null;
    }
    deals.push({ id:'deal'+Date.now()+Math.floor(Math.random()*999), companyId:c.id, adhocName:'', stage:targetStage,
      amount:0, probability:20, expectedDate:'', owner:c.manager || managers[0], comments:[], tasks:[] });
    return 'добавлена в воронку пресейла · '+stageName(targetStage);
  }

  function renderPresaleSummary(){
    var openDeals = deals.filter(function(d){ return TERMINAL_STAGES.indexOf(d.stage) === -1; });
    var wonDeals = deals.filter(function(d){ return d.stage === 'won'; });
    var sumOpen = openDeals.reduce(function(s,d){ return s + (Number(d.amount)||0); }, 0);
    var avgProb = openDeals.length ? Math.round(openDeals.reduce(function(s,d){ return s + (Number(d.probability)||0); }, 0) / openDeals.length) : 0;
    var tiles = [
      {n: openDeals.length, l: 'сделок в работе'},
      {n: fmtMoney(sumOpen), l: 'сумма в воронке'},
      {n: avgProb + '%', l: 'средняя вероятность'},
      {n: wonDeals.length, l: 'успешных сделок'}
    ];
    document.getElementById('presaleSummary').innerHTML = tiles.map(function(t){
      return '<div class="summary-tile"><div class="num">'+t.n+'</div><div class="lbl">'+t.l+'</div></div>';
    }).join('');
  }

  function dealCardHtml(d){
    var doneT = d.tasks.filter(function(t){return t.done;}).length;
    var contact = dealContact(d);
    return '<div class="deal-card" draggable="true" data-deal="'+d.id+'">' +
      '<div class="deal-name">'+esc(dealTitle(d))+'</div>' +
      (companyOf(d.companyId) ? '<div class="deal-inn mono">'+esc(companyOf(d.companyId).inn)+'</div>' : '') +
      '<div class="deal-amount">'+fmtMoney(d.amount)+'</div>' +
      '<div class="deal-meta">' +
        '<span class="chip sm '+probClass(d.probability)+'">'+d.probability+'%</span>' +
        (d.expectedDate ? '<span class="deal-date mono">до '+esc(fmtDate(d.expectedDate))+'</span>' : '') +
      '</div>' +
      (contact ? '<div class="deal-owner">👤 '+esc(contact)+'</div>' : '') +
      '<div class="deal-owner">'+esc(d.owner || '')+'</div>' +
      ((d.tasks.length || d.comments.length) ? '<div class="deal-foot">' +
        (d.tasks.length ? '<span class="deal-chip">☑ '+doneT+'/'+d.tasks.length+'</span>' : '') +
        (d.comments.length ? '<span class="deal-chip">💬 '+d.comments.length+'</span>' : '') +
      '</div>' : '') +
    '</div>';
  }

  // stages collapsed by default — secondary/off-path ones; any stage (including these)
  // can be collapsed or expanded by clicking its row
  var collapsedCols = { onhold: true, handed: true };

  function renderPresaleStageFilter(){
    var sel = document.getElementById('fltPresaleStage');
    var html = '<option value="">Все статусы</option>';
    html += STAGES.map(function(st){
      var cnt = deals.filter(function(d){ return d.stage === st.id; }).length;
      return '<option value="'+st.id+'"'+(state.presaleStage===st.id?' selected':'')+'>'+esc(st.name)+' ('+cnt+')</option>';
    }).join('');
    sel.innerHTML = html;
    sel.value = state.presaleStage;
  }

  function renderPresale(){
    persist();
    renderPresaleSummary();
    renderPresaleStageFilter();
    var board = document.getElementById('presaleBoard');
    var stagesToShow = state.presaleStage ? STAGES.filter(function(st){ return st.id === state.presaleStage; }) : STAGES;
    board.innerHTML = stagesToShow.map(function(st){
      var stageDeals = deals.filter(function(d){ return d.stage === st.id; });
      var openTasks = countOpenTasksForStage(st.id);
      var isCollapsed = state.presaleStage ? false : !!collapsedCols[st.id];

      var bodyHtml = '';
      if (!isCollapsed) {
        var cardsHtml = stageDeals.length
          ? '<div class="ptree-cards">'+stageDeals.map(dealCardHtml).join('')+'</div>'
          : '<div class="deal-empty">Пусто — перетащите сюда карточку сделки</div>';
        bodyHtml = '<div class="ptree-body">' +
          '<button class="pcol-add" data-addtask-stage="'+st.id+'" '+(stageDeals.length?'':'disabled title="Сначала добавьте сюда сделку"')+'>+ Создать задачу</button>' +
          cardsHtml +
        '</div>';
      }

      return '<div class="ptree-stage" data-stage="'+st.id+'">' +
        '<div class="ptree-head" style="background:'+st.color+';" data-toggle-stage="'+st.id+'" data-dropzone="'+st.id+'" title="'+(state.presaleStage?'Сбросьте отбор, чтобы сворачивать статусы':(isCollapsed?'Развернуть':'Свернуть'))+'">' +
          '<span class="ptree-chevron">'+(isCollapsed ? '▸' : '▾')+'</span>' +
          '<span class="ptree-name">'+(st.done ? '✓ ' : '')+esc(st.name)+'</span>' +
          '<span class="ptree-dealcount">'+stageDeals.length+' '+pluralRu(stageDeals.length,'сделка','сделки','сделок')+'</span>' +
          '<span class="ptree-count">'+openTasks+' '+pluralRu(openTasks,'задача','задачи','задач')+'</span>' +
        '</div>' +
        bodyHtml +
      '</div>';
    }).join('');
    bindPresaleHandlers();
  }

  function bindPresaleHandlers(){
    document.querySelectorAll('.deal-card').forEach(function(card){
      card.addEventListener('click', function(){ openDealDrawer(card.getAttribute('data-deal')); });
      card.addEventListener('dragstart', function(e){
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.getAttribute('data-deal'));
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function(){ card.classList.remove('dragging'); });
    });
    document.querySelectorAll('[data-dropzone]').forEach(function(zone){
      zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', function(){ zone.classList.remove('dragover'); });
      zone.addEventListener('drop', function(e){
        e.preventDefault(); zone.classList.remove('dragover');
        var dealId = e.dataTransfer.getData('text/plain');
        var d = deals.filter(function(x){return x.id===dealId;})[0];
        if (!d) return;
        var newStage = zone.getAttribute('data-dropzone');
        if (d.stage !== newStage) { d.stage = newStage; renderAll(); showToast('Сделка перемещена: '+stageName(newStage)); }
      });
    });
    document.querySelectorAll('.pcol-add').forEach(function(btn){
      if (btn.disabled) return;
      btn.addEventListener('click', function(){ openColumnTaskModal(btn.getAttribute('data-addtask-stage')); });
    });
    document.querySelectorAll('[data-toggle-stage]').forEach(function(h){
      h.addEventListener('click', function(){
        if (state.presaleStage) return; // single-stage filter is active — row stays pinned open
        var sid = h.getAttribute('data-toggle-stage');
        collapsedCols[sid] = !collapsedCols[sid];
        renderPresale();
      });
    });
  }

  // ---- deal drawer ----
  function tasksHtml(d){
    if (!d.tasks.length) return '<div class="empty-journal">Задач пока нет</div>';
    return d.tasks.slice().reverse().map(function(t){
      var sm = stageMeta(t.stage);
      return '<div class="task-row'+(t.done?' done':'')+'">' +
        '<input type="checkbox" class="task-check" data-task="'+t.id+'" '+(t.done?'checked':'')+'>' +
        '<div class="task-body">' +
          '<div class="task-text">'+esc(t.text)+'</div>' +
          '<div class="task-meta">' +
            (t.assignee ? '<span>'+esc(t.assignee)+'</span>' : '') +
            (t.due ? '<span class="mono">до '+esc(fmtDate(t.due))+'</span>' : '') +
            (sm ? '<span class="task-stage-tag" style="background:'+sm.color+';">'+esc(sm.name)+'</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  function commentsHtml(d){
    if (!d.comments.length) return '<div class="empty-journal">Комментариев пока нет</div>';
    return d.comments.slice().reverse().map(function(cm){
      return '<div class="call-row"><div class="top"><span class="mono">'+esc(cm.date)+'</span><span>'+esc(cm.who)+'</span></div><div class="comment">'+esc(cm.text)+'</div></div>';
    }).join('');
  }

  function openDealDrawer(dealId){
    var d = deals.filter(function(x){return x.id===dealId;})[0];
    if (!d) return;
    var c = companyOf(d.companyId);

    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var el = document.createElement('div'); el.className = 'center-modal'; el.id = 'drawer';
    el.innerHTML =
      '<div class="drawer-head"><div><h3>'+esc(dealTitle(d))+'</h3>' +
        '<div class="sub">'+(c ? 'из базы прозвона' : 'сделка добавлена вручную, вне базы')+'</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="drawer-body">' +
        '<div class="field-grid">' +
          (c ? copyableField('ИНН', c.inn) : '') +
          editField('Контактное лицо', 'dContact', c ? c.contact : d.adhocContact) +
          editField('Должность', 'dPosition', c ? c.position : d.adhocPosition) +
          editCopyField('Телефон', 'dPhone', c ? c.phone : d.adhocPhone, '+7 …') +
          editCopyField('Email', 'dEmail', c ? c.email : d.adhocEmail, 'name@company.ru') +
          '<div class="field-item"><label>Стадия</label><select class="field" id="dStage" style="padding:4px 8px;">' +
            STAGES.map(function(s){return '<option value="'+s.id+'"'+(s.id===d.stage?' selected':'')+'>'+esc(s.name)+'</option>';}).join('') +
          '</select></div>' +
          '<div class="field-item"><label>Ответственный</label><select class="field" id="dOwner" style="padding:4px 8px;">' +
            managers.map(function(m){return '<option value="'+esc(m)+'"'+(m===d.owner?' selected':'')+'>'+esc(m)+'</option>';}).join('') +
          '</select></div>' +
          '<div class="field-item"><label>Сумма сделки</label><input class="field" type="number" min="0" step="1000" id="dAmount" value="'+(Number(d.amount)||0)+'"></div>' +
          '<div class="field-item"><label>Вероятность оплаты, %</label><input class="field" type="number" min="0" max="100" id="dProb" value="'+(Number(d.probability)||0)+'"></div>' +
          '<div class="field-item"><label>Ожидаемая дата оплаты</label><input class="field" type="date" id="dDate" value="'+esc(d.expectedDate||'')+'"></div>' +
        '</div>' +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<button class="btn" id="btnProjectRequest">📄 Сформировать проектный запрос</button>' +
          '<button class="btn" id="btnNaryadText">📝 Сформировать текст для наряда</button>' +
        '</div>' +
        '<div class="journal"><h4>Комментарии</h4>' + commentsHtml(d) + '</div>' +
        '<div class="add-comment-form">' +
          '<textarea class="field" id="cText" placeholder="Комментарий…"></textarea>' +
          '<div><span class="field-label">Кто оставил</span><select class="field" id="cWho" style="max-width:260px;">' +
            managers.map(function(m){return '<option value="'+esc(m)+'"'+(m===d.owner?' selected':'')+'>'+esc(m)+'</option>';}).join('') +
          '</select></div>' +
          '<button class="btn" id="cSubmit" style="align-self:flex-start;">Добавить комментарий</button>' +
        '</div>' +
        '<div class="journal"><h4>Задачи</h4>' + tasksHtml(d) + '</div>' +
        '<div class="add-task-form">' +
          '<input class="field" id="tText" placeholder="Текст задачи…">' +
          '<div class="row3">' +
            '<select class="field" id="tAssignee">' + managers.map(function(m){return '<option value="'+esc(m)+'"'+(m===d.owner?' selected':'')+'>'+esc(m)+'</option>';}).join('') + '</select>' +
            '<input class="field" type="date" id="tDue">' +
            '<select class="field" id="tStage">' + STAGES.map(function(s){return '<option value="'+s.id+'"'+(s.id===d.stage?' selected':'')+'>'+esc(s.name)+'</option>';}).join('') + '</select>' +
          '</div>' +
          '<button class="btn" id="tSubmit" style="align-self:flex-start;">Добавить задачу</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    el.querySelectorAll('.val.copyable').forEach(function(cel){
      cel.addEventListener('click', function(){ copyText(cel.getAttribute('data-copy')); });
    });
    el.querySelectorAll('[data-copy-input]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var inp = document.getElementById(btn.getAttribute('data-copy-input'));
        if (inp) copyText(inp.value);
      });
    });
    document.getElementById('dContact').addEventListener('change', function(e){
      if (c) { c.contact = e.target.value; } else { d.adhocContact = e.target.value; }
      renderAll();
    });
    document.getElementById('dPosition').addEventListener('change', function(e){
      if (c) { c.position = e.target.value; } else { d.adhocPosition = e.target.value; }
      renderAll();
    });
    document.getElementById('dPhone').addEventListener('change', function(e){
      if (c) { c.phone = e.target.value; } else { d.adhocPhone = e.target.value; }
      renderAll();
    });
    document.getElementById('dEmail').addEventListener('change', function(e){
      if (c) { c.email = e.target.value; } else { d.adhocEmail = e.target.value; }
      renderAll();
    });

    document.getElementById('dStage').addEventListener('change', function(e){ d.stage = e.target.value; renderPresale(); showToast('Стадия изменена: '+stageName(d.stage)); });
    document.getElementById('dOwner').addEventListener('change', function(e){ d.owner = e.target.value; renderPresale(); });
    document.getElementById('dAmount').addEventListener('change', function(e){ d.amount = Number(e.target.value)||0; renderPresale(); });
    document.getElementById('dProb').addEventListener('change', function(e){ var v = Math.max(0,Math.min(100, Number(e.target.value)||0)); e.target.value = v; d.probability = v; renderPresale(); });
    document.getElementById('dDate').addEventListener('change', function(e){ d.expectedDate = e.target.value; renderPresale(); });
    document.getElementById('btnProjectRequest').addEventListener('click', function(){ showToast('Формирование проектного запроса — функция в разработке'); });
    document.getElementById('btnNaryadText').addEventListener('click', function(){ showToast('Формирование текста для наряда — функция в разработке'); });

    document.getElementById('cSubmit').addEventListener('click', function(){
      var text = document.getElementById('cText').value.trim();
      if (!text) return;
      d.comments.push({ date: nowStr(), who: document.getElementById('cWho').value, text: text });
      refreshDealDrawer(d.id);
      renderPresale();
      showToast('Комментарий добавлен');
    });

    document.getElementById('tSubmit').addEventListener('click', function(){
      var text = document.getElementById('tText').value.trim();
      if (!text) { document.getElementById('tText').style.borderColor = 'var(--bad)'; return; }
      d.tasks.push({ id:'t'+Date.now()+Math.floor(Math.random()*999), text:text,
        assignee: document.getElementById('tAssignee').value, due: document.getElementById('tDue').value,
        stage: document.getElementById('tStage').value, done:false });
      refreshDealDrawer(d.id);
      renderPresale();
      showToast('Задача добавлена');
    });

    el.querySelectorAll('.task-check').forEach(function(cb){
      cb.addEventListener('change', function(){
        var t = d.tasks.filter(function(x){return x.id===cb.getAttribute('data-task');})[0];
        if (t) t.done = cb.checked;
        cb.closest('.task-row').classList.toggle('done', cb.checked);
        renderPresale();
      });
    });
  }

  function refreshDealDrawer(id){
    var old = document.getElementById('drawer'); if (old) old.remove();
    var s = document.getElementById('scrim'); if (s) s.remove();
    openDealDrawer(id);
  }

  function openAddDealModal(){
    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var m = document.createElement('div'); m.className = 'quickcall'; m.id = 'quickcall';
    m.innerHTML =
      '<div class="quickcall-head"><div><h3>Добавить сделку в пресейл</h3><div class="sub">Вручную, без звонка</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="quickcall-body">' +
        '<div><span class="field-label">Компания</span><select class="field" id="nCompany"><option value="">— вписать вручную —</option>' +
          companies.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+' · '+esc(c.inn)+'</option>';}).join('') +
        '</select></div>' +
        '<div id="nAdhocWrap">' +
          '<span class="field-label">Название (если компании нет в базе)</span><input class="field" id="nAdhocName" placeholder="Например, ООО «Ромашка»" style="margin-bottom:8px;">' +
          '<div class="row2">' +
            '<div><span class="field-label">Контактное лицо</span><input class="field" id="nContact" placeholder="Имя"></div>' +
            '<div><span class="field-label">Должность</span><input class="field" id="nPosition" placeholder="Например, директор"></div>' +
          '</div>' +
          '<div class="row2" style="margin-top:8px;">' +
            '<div><span class="field-label">Телефон</span><input class="field" id="nPhone" placeholder="+7 …"></div>' +
            '<div><span class="field-label">Email</span><input class="field" id="nEmail" placeholder="name@company.ru"></div>' +
          '</div>' +
        '</div>' +
        '<div><span class="field-label">Стадия</span><select class="field" id="nStage">' +
          STAGES.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>';}).join('') +
        '</select></div>' +
        '<div class="row2">' +
          '<div><span class="field-label">Сумма сделки</span><input class="field" type="number" min="0" step="1000" id="nAmount" value="0"></div>' +
          '<div><span class="field-label">Вероятность, %</span><input class="field" type="number" min="0" max="100" id="nProb" value="20"></div>' +
        '</div>' +
        '<div><span class="field-label">Ожидаемая дата оплаты</span><input class="field" type="date" id="nDate"></div>' +
        '<div><span class="field-label">Ответственный</span><select class="field" id="nOwner">' + managers.map(function(mg){return '<option value="'+esc(mg)+'">'+esc(mg)+'</option>';}).join('') + '</select></div>' +
      '</div>' +
      '<div class="quickcall-foot"><div class="spacer"></div><button class="btn primary" id="nSubmit">Добавить</button></div>';
    document.body.appendChild(m);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    var companySel = document.getElementById('nCompany');
    var adhocWrap = document.getElementById('nAdhocWrap');
    companySel.addEventListener('change', function(){ adhocWrap.style.display = companySel.value ? 'none' : ''; });

    document.getElementById('nSubmit').addEventListener('click', function(){
      var companyId = companySel.value;
      var adhoc = document.getElementById('nAdhocName').value.trim();
      if (!companyId && !adhoc) { document.getElementById('nAdhocName').style.borderColor = 'var(--bad)'; return; }
      deals.push({
        id:'deal'+Date.now()+Math.floor(Math.random()*999),
        companyId: companyId || null, adhocName: companyId ? '' : adhoc,
        adhocContact: companyId ? '' : document.getElementById('nContact').value.trim(),
        adhocPosition: companyId ? '' : document.getElementById('nPosition').value.trim(),
        adhocPhone: companyId ? '' : document.getElementById('nPhone').value.trim(),
        adhocEmail: companyId ? '' : document.getElementById('nEmail').value.trim(),
        stage: document.getElementById('nStage').value,
        amount: Number(document.getElementById('nAmount').value)||0,
        probability: Math.max(0,Math.min(100, Number(document.getElementById('nProb').value)||0)),
        expectedDate: document.getElementById('nDate').value,
        owner: document.getElementById('nOwner').value,
        comments: [], tasks: []
      });
      closePanel();
      renderAll();
      showToast('Сделка добавлена в воронку пресейла');
    });
  }

  function openColumnTaskModal(stageId){
    var stageDeals = deals.filter(function(d){ return d.stage === stageId; });
    if (!stageDeals.length) return;

    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var m = document.createElement('div'); m.className = 'quickcall'; m.id = 'quickcall';
    m.innerHTML =
      '<div class="quickcall-head"><div><h3>Новая задача · '+esc(stageName(stageId))+'</h3><div class="sub">Выберите сделку в этой колонке</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="quickcall-body">' +
        '<div><span class="field-label">Сделка</span><select class="field" id="qDeal">' +
          stageDeals.map(function(d){return '<option value="'+d.id+'">'+esc(dealTitle(d))+'</option>';}).join('') +
        '</select></div>' +
        '<div><span class="field-label">Текст задачи</span><input class="field" id="qText" placeholder="Что нужно сделать…"></div>' +
        '<div class="row2">' +
          '<div><span class="field-label">Исполнитель</span><select class="field" id="qAssignee">' + managers.map(function(mg){return '<option value="'+esc(mg)+'">'+esc(mg)+'</option>';}).join('') + '</select></div>' +
          '<div><span class="field-label">Срок</span><input class="field" type="date" id="qDue"></div>' +
        '</div>' +
      '</div>' +
      '<div class="quickcall-foot"><div class="spacer"></div><button class="btn primary" id="qSubmit">Добавить задачу</button></div>';
    document.body.appendChild(m);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('qSubmit').addEventListener('click', function(){
      var text = document.getElementById('qText').value.trim();
      if (!text) { document.getElementById('qText').style.borderColor = 'var(--bad)'; return; }
      var d = deals.filter(function(x){return x.id===document.getElementById('qDeal').value;})[0];
      if (!d) return;
      d.tasks.push({ id:'t'+Date.now()+Math.floor(Math.random()*999), text:text,
        assignee: document.getElementById('qAssignee').value, due: document.getElementById('qDue').value, stage: stageId, done:false });
      closePanel();
      renderAll();
      showToast('Задача добавлена · '+dealTitle(d));
    });
  }

  // ---- excel-style import: a real pasteable grid, like «Администрирование ПреЛидов» ----
  var IMPORT_COLUMNS = ['name','inn','statusWebinar','contact','phone','k7','manager'];
  var IMPORT_LABELS = {name:'Наименование', inn:'ИНН', statusWebinar:'Статус вебинара', contact:'Контактное лицо',
    phone:'Телефон', k7:'Код К7 прелида', manager:'Менеджер'};
  var DIFF_FIELDS = ['name','statusWebinar','contact','phone','k7','manager'];
  var SAMPLE_ROWS = [
    ['ООО «Ventra Logistics»','7810099234','Пришёл','Елена Морозова','+7 (911) 220-84-16','099/00041207','Олег Копылевич'],
    ['ООО «Шанс Трейд»','6312045871','Пришёл','Денис Карпов','+7 (903) 512-90-04','099/00038679','Олег Копылевич'],
    ['АО «Отисифарм»','7702235123','','','','','Аня Сулейманова'],
    ['','','','','','','']
  ];

  var importState = { preview: [] };

  function gridRowHtml(values, rowIndex){
    return '<tr>' + IMPORT_COLUMNS.map(function(key, colIndex){
      return '<td class="grid-cell" contenteditable="true" data-row="'+rowIndex+'" data-col="'+colIndex+'">'+esc(values && values[colIndex] || '')+'</td>';
    }).join('') + '</tr>';
  }

  function readGridData(){
    var rows = [];
    document.querySelectorAll('#pasteGridBody tr').forEach(function(tr){
      var cells = tr.querySelectorAll('td');
      var obj = {}; var hasData = false;
      IMPORT_COLUMNS.forEach(function(key, i){
        var v = (cells[i] ? cells[i].textContent : '').trim();
        obj[key] = v; if (v) hasData = true;
      });
      if (hasData) rows.push(obj);
    });
    return rows;
  }

  function buildImportPreview(rows){
    return rows.map(function(r){
      var existing = r.inn ? companies.filter(function(c){return c.inn === r.inn;})[0] : null;
      var diffs = [];
      if (existing) {
        DIFF_FIELDS.forEach(function(f){
          var next = r[f];
          if (!next) return;
          if (next !== existing[f]) diffs.push({ field: f, old: existing[f], next: next });
        });
      }
      return { row: r, existing: existing, diffs: diffs, isNew: !existing };
    });
  }

  function diffCell(row, existing, field){
    var next = row[field];
    if (!existing) return next ? esc(next) : '<span style="color:var(--ink-faint);">—</span>';
    var old = existing[field];
    if (next && next !== old) return (old ? '<span class="old">'+esc(old)+'</span><br>' : '') + '<span class="next">'+esc(next)+'</span>';
    return esc(old || next || '') || '<span style="color:var(--ink-faint);">—</span>';
  }

  function renderImportPreview(){
    var wrap = document.getElementById('importPreviewWrap');
    var rows = readGridData();
    var preview = buildImportPreview(rows);
    importState.preview = preview;
    var newCount = preview.filter(function(p){return p.isNew;}).length;
    var updCount = preview.filter(function(p){return !p.isNew && p.diffs.length;}).length;

    if (!preview.length){
      wrap.innerHTML = '<div style="color:var(--ink-faint); font-size:12.5px; padding:8px 2px;">Введите или вставьте данные в таблицу выше</div>';
    } else {
      var bodyRows = preview.map(function(p){
        var badge = p.isNew ? '<span class="import-badge isnew">НОВАЯ</span>' : (p.diffs.length ? '<span class="import-badge update">ОБНОВЛЕНИЕ</span>' : '<span class="import-badge" style="background:var(--surface-3); color:var(--ink-faint);">БЕЗ ИЗМЕНЕНИЙ</span>');
        return '<tr>' +
          '<td>'+badge+'</td>' +
          IMPORT_COLUMNS.map(function(f){ return '<td>'+diffCell(p.row, p.existing, f)+'</td>'; }).join('') +
        '</tr>';
      }).join('');
      wrap.innerHTML =
        '<div class="import-preview-head">Разобрано строк: <b>'+preview.length+'</b> · новых: <b>'+newCount+'</b> · обновлений: <b>'+updCount+'</b> · совпадение по ИНН</div>' +
        '<div class="grid-scroll"><table class="import-compare"><thead><tr><th>Совпало по базе</th>' +
          IMPORT_COLUMNS.map(function(k){return '<th>'+esc(IMPORT_LABELS[k])+'</th>';}).join('') +
        '</tr></thead><tbody>'+bodyRows+'</tbody></table></div>';
    }

    document.getElementById('importAddNew').disabled = newCount === 0;
    document.getElementById('importAddNew').textContent = 'Добавить новые ('+newCount+')';
    document.getElementById('importUpdate').disabled = updCount === 0;
    document.getElementById('importUpdate').textContent = 'Обновить прелиды ('+updCount+')';
  }

  function distributePaste(text, startRow, startCol){
    var lines = text.replace(/\r/g,'').split('\n').filter(function(l, i, arr){ return l.length || i < arr.length - 1; });
    lines.forEach(function(line, li){
      var rowIndex = startRow + li;
      var tbody = document.getElementById('pasteGridBody');
      var tr = tbody.querySelectorAll('tr')[rowIndex];
      if (!tr) { tbody.insertAdjacentHTML('beforeend', gridRowHtml(null, rowIndex)); tr = tbody.querySelectorAll('tr')[rowIndex]; }
      var cells = line.split('\t');
      var tds = tr.querySelectorAll('td');
      cells.forEach(function(val, ci){
        var col = startCol + ci;
        if (tds[col]) tds[col].textContent = val.trim();
      });
    });
  }

  function openImportModal(){
    var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    scrim.addEventListener('click', closePanel);
    document.body.appendChild(scrim);

    var defaultBase = state.baseId !== 'all' ? state.baseId : (bases[0] ? bases[0].id : '');
    var m = document.createElement('div'); m.className = 'import-modal'; m.id = 'importModal';
    m.innerHTML =
      '<div class="import-head"><div><h3>Загрузка базы из Excel</h3>' +
        '<div class="sub">Названия колонок менять местами нельзя. Скопируйте диапазон в Excel и вставьте прямо в таблицу — как в «Администрировании ПреЛидов»</div></div>' +
        '<button class="close-btn" id="closePanelBtn">×</button></div>' +
      '<div class="import-body">' +
        '<div><span class="field-label">База прозвона</span><select class="field" id="importBase" style="max-width:420px;">' +
          bases.map(function(b){return '<option '+(b.id===defaultBase?'selected':'')+' value="'+b.id+'">'+esc(fmtBaseLabel(b))+'</option>';}).join('') +
        '</select></div>' +
        '<div class="grid-scroll"><table class="paste-grid" id="pasteGrid">' +
          '<thead><tr>' + IMPORT_COLUMNS.map(function(k){return '<th>'+esc(IMPORT_LABELS[k])+'</th>';}).join('') + '</tr></thead>' +
          '<tbody id="pasteGridBody">' + SAMPLE_ROWS.map(function(r,i){return gridRowHtml(r,i);}).join('') + '</tbody>' +
        '</table></div>' +
        '<button class="btn btn-sm" id="addRowBtn" style="align-self:flex-start;">+ Добавить строку</button>' +
        '<div id="importPreviewWrap"></div>' +
      '</div>' +
      '<div class="import-foot">' +
        '<button class="btn ghost" id="importCancel">Отмена</button>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="importAddNew">Добавить новые</button>' +
        '<button class="btn primary" id="importUpdate">Обновить прелиды</button>' +
      '</div>';
    document.body.appendChild(m);

    document.getElementById('closePanelBtn').addEventListener('click', closePanel);
    document.getElementById('importCancel').addEventListener('click', closePanel);
    document.getElementById('addRowBtn').addEventListener('click', function(){
      var tbody = document.getElementById('pasteGridBody');
      tbody.insertAdjacentHTML('beforeend', gridRowHtml(null, tbody.querySelectorAll('tr').length));
    });
    document.getElementById('importAddNew').addEventListener('click', function(){ applyImportNew(document.getElementById('importBase').value); });
    document.getElementById('importUpdate').addEventListener('click', applyImportUpdate);

    var gridBody = document.getElementById('pasteGridBody');
    gridBody.addEventListener('input', renderImportPreview);
    gridBody.addEventListener('paste', function(e){
      var td = e.target.closest('td.grid-cell');
      if (!td) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text');
      distributePaste(text, parseInt(td.getAttribute('data-row'), 10), parseInt(td.getAttribute('data-col'), 10));
      renderImportPreview();
    });

    renderImportPreview();
  }

  function applyImportNew(baseId){
    var newOnes = importState.preview.filter(function(p){return p.isNew;});
    if (!newOnes.length) return;
    newOnes.forEach(function(p){
      companies.push({
        id: 'c' + Date.now() + Math.floor(Math.random()*1000),
        baseId: baseId, name: p.row.name || '(без названия)', inn: p.row.inn,
        contact: p.row.contact, phone: p.row.phone, k7: p.row.k7,
        statusWebinar: p.row.statusWebinar, statusReg: '', statusConfirm: '',
        manager: p.row.manager || managers[0], calls: []
      });
    });
    closePanel();
    renderAll();
    showToast('Добавлено новых компаний: '+newOnes.length);
  }

  function applyImportUpdate(){
    var updates = importState.preview.filter(function(p){return !p.isNew && p.diffs.length;});
    if (!updates.length) return;
    updates.forEach(function(p){ p.diffs.forEach(function(d){ p.existing[d.field] = d.next; }); });
    closePanel();
    renderAll();
    showToast('Обновлено прелидов: '+updates.length);
  }

  // ---- events ----
  document.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('view-companies').hidden = tab !== 'companies';
      document.getElementById('view-funnel').hidden = tab !== 'funnel';
      document.getElementById('view-presale').hidden = tab !== 'presale';
      document.getElementById('filtersBar').hidden = tab === 'presale';
      if (tab === 'funnel') renderFunnel();
      if (tab === 'presale') renderPresale();
    });
  });

  document.getElementById('search').addEventListener('input', function(e){ state.search = e.target.value; renderTable(); });

  document.getElementById('checkAll').addEventListener('change', function(e){
    visibleCompanies().forEach(function(c){ state.selected[c.id] = e.target.checked; });
    renderTable(); renderToolbar();
  });

  document.getElementById('bulkManager').addEventListener('change', renderToolbar);

  document.getElementById('btnAssign').addEventListener('click', function(){
    var mgr = document.getElementById('bulkManager').value;
    var ids = Object.keys(state.selected).filter(function(k){return state.selected[k];});
    companies.forEach(function(c){ if (ids.indexOf(c.id) > -1) c.manager = mgr; });
    state.selected = {};
    document.getElementById('bulkManager').value = '';
    renderAll();
    showToast('Назначено на '+mgr+' · '+ids.length+' комп.');
  });

  document.getElementById('btnImport').addEventListener('click', openImportModal);

  document.getElementById('btnMatch').addEventListener('click', function(){
    var candidates = visibleCompanies().filter(function(c){ return !c.statusWebinar || !c.k7; });
    if (!candidates.length) { showToast('Нет записей для сопоставления по коду К7'); return; }
    var n = Math.min(2, candidates.length);
    for (var i=0;i<n;i++){
      var c = candidates[i];
      if (!c.k7) c.k7 = '099/000' + Math.floor(30000+Math.random()*9000);
      c.statusReg = c.statusReg || 'Зарегистрирован';
      c.statusConfirm = c.statusConfirm || 'Подтвердил';
      c.statusWebinar = c.statusWebinar || (Math.random() > 0.5 ? 'Пришёл' : 'Не пришёл');
    }
    renderAll();
    showToast('Сопоставлено по коду К7: '+n+' запис'+(n===1?'ь':'и')+' · статусы обновлены автоматически');
  });

  document.getElementById('btnReport').addEventListener('click', openReportModal);

  document.getElementById('btnAddDeal').addEventListener('click', openAddDealModal);
  document.getElementById('fltPresaleStage').addEventListener('change', function(e){ state.presaleStage = e.target.value; renderPresale(); });

  document.getElementById('fltBase').addEventListener('change', function(e){ state.baseId = e.target.value; state.selected = {}; renderAll(); });
  document.getElementById('fltManager').addEventListener('change', function(e){ state.manager = e.target.value; renderAll(); });
  document.getElementById('fltResult').addEventListener('change', function(e){ state.result = e.target.value; renderAll(); });
  document.getElementById('fltCallback').addEventListener('change', function(e){ state.onlyCallback = e.target.checked; renderAll(); });
  document.getElementById('fltReset').addEventListener('click', function(){
    state.baseId = 'all'; state.manager = ''; state.result = ''; state.onlyCallback = false; state.search = ''; state.selected = {};
    document.getElementById('search').value = '';
    renderAll();
    showToast('Отбор сброшен');
  });

  renderManagerOptions();
  renderFilterStaticOptions();
  renderAll();
})();
