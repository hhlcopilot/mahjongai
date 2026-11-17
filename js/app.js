(function () {
  'use strict';

  var BUILD = 'v71';

  var M = window.MahjongCore;
  var MAX_HAND = 14;

  var hand = M.zeros();
  var seen = M.zeros();
  var melds = [];
  var meldKind = 'pong';
  var history = [];
  var opts = { joker: true, chiitoi: false };

  var pickerTiles = [];
  var seenTiles = [];
  var meldPickerTiles = [];

  var el = {
    handCount: document.getElementById('handCount'),
    handTray: document.getElementById('handTray'),
    tilePicker: document.getElementById('tilePicker'),
    seenPicker: document.getElementById('seenPicker'),
    seenToggle: document.getElementById('seenToggle'),
    clearSeen: document.getElementById('clearSeen'),
    undoBtn: document.getElementById('undoBtn'),
    clearBtn: document.getElementById('clearBtn'),
    optJoker: document.getElementById('optJoker'),
    optChiitoi: document.getElementById('optChiitoi'),
    jokerBadge: document.getElementById('jokerBadge'),
    handHint: document.getElementById('handHint'),
    resultBody: document.getElementById('resultBody'),
    resultMeta: document.getElementById('resultMeta'),
    dock: document.getElementById('dock'),
    dockBtn: document.getElementById('dockBtn'),
    dockLabel: document.getElementById('dockLabel'),
    dockTile: document.getElementById('dockTile'),
    dockText: document.getElementById('dockText'),
    meldCount: document.getElementById('meldCount'),
    meldToggle: document.getElementById('meldToggle'),
    clearMeld: document.getElementById('clearMeld'),
    meldBody: document.getElementById('meldBody'),
    meldTypes: document.getElementById('meldTypes'),
    meldPicker: document.getElementById('meldPicker'),
    meldList: document.getElementById('meldList')
  };

  /* ---------------- 建立牌面 ---------------- */

  function makeTile(tile) {
    return window.TileUI.make(tile, { joker: opts.joker });
  }

  function buildPicker(container, onPick) {
    var refs = [];
    for (var row = 0; row < 4; row++) {
      var rowEl = document.createElement('div');
      rowEl.className = 'picker-row' + (row === 3 ? ' picker-row--honor' : '');
      var start = row === 3 ? 27 : row * 9;
      var end = row === 3 ? 34 : row * 9 + 9;
      for (var t = start; t < end; t++) {
        var tile = makeTile(t);
        var badge = document.createElement('span');
        badge.className = 'count';
        badge.hidden = true;
        tile.appendChild(badge);
        tile.addEventListener('click', onPick.bind(null, t, tile));
        rowEl.appendChild(tile);
        refs.push({ tile: t, el: tile, badge: badge });
      }
      container.appendChild(rowEl);
    }
    return refs;
  }

  /* ---------------- 狀態操作 ---------------- */

  function snapshot() {
    history.push({
      hand: hand.slice(),
      seen: seen.slice(),
      melds: melds.map(function (m) { return { kind: m.kind, tiles: m.tiles.slice() }; })
    });
    if (history.length > 80) history.shift();
  }

  function meldCounts() {
    return M.meldTilesOf(melds);
  }

  function quota() {
    return MAX_HAND - 3 * melds.length;
  }

  function haptic(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* 忽略 */ }
    }
  }

  function reject(el) {
    haptic(28);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function onPickHand(tile, el) {
    var mt = meldCounts();
    if (M.sum(hand) >= quota() || hand[tile] + mt[tile] + seen[tile] >= 4) {
      reject(el);
      return;
    }
    snapshot();
    hand[tile] += 1;
    haptic(8);
    render();
  }

  function onPickSeen(tile, el) {
    var max = 4 - hand[tile];
    if (max <= 0) {
      reject(el);
      return;
    }
    snapshot();
    seen[tile] = seen[tile] >= max ? 0 : seen[tile] + 1;
    haptic(8);
    render();
  }

  // 香港麻將唔准上牌，所以只支援碰同槓
  function meldTilesFor(kind, tile) {
    if (kind === 'kong') return [tile, tile, tile, tile];
    if (kind === 'pong') return [tile, tile, tile];
    return null;
  }

  // 加副露時，會自動由手牌扣走嗰幾張（用剩嘅先當係人哋打出嚟）
  function planMeld(kind, tile) {
    if (melds.length >= 4) return null;
    var tiles = meldTilesFor(kind, tile);
    if (!tiles) return null;

    var add = M.zeros();
    tiles.forEach(function (t) { add[t] += 1; });

    var mt = meldCounts();
    var rest = hand.slice();
    for (var t = 0; t < 34; t++) {
      rest[t] -= Math.min(rest[t], add[t]);
      if (add[t] && rest[t] + mt[t] + seen[t] + add[t] > 4) return null;
    }
    return { tiles: tiles, rest: rest };
  }

  function onPickMeld(tile, el) {
    var plan = planMeld(meldKind, tile);
    if (!plan) {
      reject(el);
      return;
    }
    snapshot();
    hand = plan.rest;
    melds.push({ kind: meldKind, tiles: plan.tiles });
    haptic(8);
    render();
  }

  function removeMeld(index) {
    if (index < 0 || index >= melds.length) return;
    snapshot();
    melds.splice(index, 1);
    haptic(6);
    render();
  }

  function onTrayClick(tile) {
    if (hand[tile] <= 0) return;
    snapshot();
    hand[tile] -= 1;
    haptic(6);
    render();
  }

  function undo() {
    var prev = history.pop();
    if (!prev) return;
    hand = prev.hand;
    seen = prev.seen;
    melds = prev.melds || [];
    render();
  }

  /* ---------------- 畫面更新 ---------------- */

  function render() {
    var total = M.sum(hand);
    var limit = quota();
    el.handCount.textContent = total + ' / ' + limit;
    el.handCount.classList.toggle('counter--full', total === limit);
    el.handCount.classList.toggle('counter--over', total > limit);
    el.undoBtn.disabled = history.length === 0;

    // 手牌
    el.handTray.innerHTML = '';
    if (total === 0) {
      var hint = document.createElement('span');
      hint.className = 'tray-empty';
      hint.textContent = melds.length
        ? '撳下面嘅牌加入手牌（副露 ' + melds.length + ' 副，最多 ' + limit + ' 張）'
        : '撳下面嘅牌加入手牌（13 或 14 張）';
      el.handTray.appendChild(hint);
    } else {
      for (var t = 0; t < 34; t++) {
        for (var i = 0; i < hand[t]; i++) {
          var tile = makeTile(t);
          tile.title = '撳一下拎走';
          tile.addEventListener('click', onTrayClick.bind(null, t));
          el.handTray.appendChild(tile);
        }
      }
    }

    // 揀牌區
    var full = total >= limit;
    var meldTiles = meldCounts();
    el.handHint.hidden = !full;
    el.handHint.textContent = melds.length
      ? '手牌已滿 ' + limit + ' 張（已計 ' + melds.length + ' 副副露）· 撳上面任何一隻牌就可以拎走'
      : '手牌已滿 14 張 · 撳上面任何一隻牌就可以拎走';
    pickerTiles.forEach(function (ref) {
      var count = hand[ref.tile] + meldTiles[ref.tile] + seen[ref.tile];
      ref.el.classList.toggle('is-max', count >= 4);
      ref.badge.hidden = hand[ref.tile] < 2;
      ref.badge.textContent = hand[ref.tile] > 1 ? String(hand[ref.tile]) : '';
      if (ref.tile === M.JOKER) {
        ref.el.classList.toggle('is-joker', opts.joker);
      }
    });

    // 已見牌
    seenTiles.forEach(function (ref) {
      var n = seen[ref.tile];
      ref.el.classList.toggle('is-max', n === 0 ? false : n >= 4 - hand[ref.tile] - meldTiles[ref.tile]);
      ref.badge.hidden = n === 0;
      ref.badge.textContent = n > 0 ? String(n) : '';
      ref.el.classList.toggle('is-seen', n > 0);
      if (ref.tile === M.JOKER) {
        ref.el.classList.toggle('is-joker', opts.joker);
      }
    });

    // 副露
    renderMelds(meldTiles);

    renderDock(total, renderResult(total));
  }

  function miniTile(tile) {
    return window.TileUI.mini(tile, { joker: opts.joker });
  }

  function renderMelds(meldTiles) {
    var kinds = { pong: '碰', kong: '槓' };

    el.meldCount.textContent = melds.length ? melds.length + ' 副' : '未有';

    el.meldList.innerHTML = '';
    melds.forEach(function (m, idx) {
      var row = document.createElement('div');
      row.className = 'meld-item';

      var kind = document.createElement('span');
      kind.className = 'meld-kind';
      kind.textContent = kinds[m.kind] || '副露';
      row.appendChild(kind);

      m.tiles.forEach(function (t) { row.appendChild(miniTile(t)); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'meld-del';
      del.setAttribute('aria-label', '移除這副副露');
      del.textContent = '✕';
      del.addEventListener('click', removeMeld.bind(null, idx));
      row.appendChild(del);

      el.meldList.appendChild(row);
    });

    meldPickerTiles.forEach(function (ref) {
      ref.el.classList.toggle('is-max', !planMeld(meldKind, ref.tile));
      ref.badge.hidden = meldTiles[ref.tile] === 0;
      ref.badge.textContent = meldTiles[ref.tile] || '';
      if (ref.tile === M.JOKER) {
        ref.el.classList.toggle('is-joker', opts.joker);
      }
    });
  }

  function shortTile(tile) {
    return M.tileLabel(tile);
  }

  function waitsSummary(res) {
    if (!res.tiles.length) return '冇有效牌';
    if (res.tiles.length === 34) return '任何牌（34 種）';
    if (res.tiles.length > 12) return res.tiles.length + ' 種牌';
    return res.tiles.map(function (w) { return shortTile(w.tile); }).join('、');
  }

  function pungChips(pungs) {
    var frag = document.createDocumentFragment();
    (pungs || []).forEach(function (pg) {
      var chip = document.createElement('span');
      chip.className = 'wait-chip wait-chip--pung';
      var tag = document.createElement('span');
      tag.className = 'pung-tag';
      tag.textContent = '碰';
      chip.appendChild(tag);
      chip.appendChild(window.TileUI.mini(pg.tile, { joker: opts.joker }));
      var left = document.createElement('span');
      left.className = 'left';
      left.textContent = '×' + pg.remaining;
      chip.appendChild(left);
      frag.appendChild(chip);
    });
    return frag;
  }

  function waitChips(tiles) {
    var frag = document.createDocumentFragment();
    if (tiles.length > 16) {
      var brief = document.createElement('span');
      brief.className = 'wait-chip wait-chip--summary';
      brief.textContent = '共 ' + tiles.length + ' 種有效牌';
      frag.appendChild(brief);
      return frag;
    }
    if (!tiles.length) {
      var none = document.createElement('span');
      none.className = 'waits-empty';
      none.textContent = '冇有效牌';
      frag.appendChild(none);
      return frag;
    }
    tiles.forEach(function (w) {
      var chip = document.createElement('span');
      chip.className = 'wait-chip' + (w.remaining <= 1 ? ' is-dead' : '');
      var mini = window.TileUI.mini(w.tile, { joker: opts.joker });
      var left = document.createElement('span');
      left.className = 'left';
      left.textContent = '×' + w.remaining;
      chip.appendChild(mini);
      chip.appendChild(left);
      frag.appendChild(chip);
    });
    return frag;
  }

  function shantenTag(sh) {
    var tag = document.createElement('span');
    if (sh === -1) {
      tag.className = 'tag tag--win';
      tag.textContent = '已和';
    } else if (sh === 0) {
      tag.className = 'tag tag--tenpai';
      tag.textContent = '聽牌';
    } else {
      tag.className = 'tag tag--shanten';
      tag.textContent = sh + ' 向聽';
    }
    return tag;
  }

  function renderResult(total) {
    var drawn = quota();
    var waiting = drawn - 1;

    el.resultBody.innerHTML = '';
    el.resultMeta.textContent = '';

    if (total !== drawn && total !== waiting) {
      var msg = document.createElement('p');
      msg.className = 'empty-state';
      msg.textContent = total < waiting
        ? '仲差 ' + (waiting - total) + ' 張牌先計到，入夠 ' + waiting + ' 張就即刻同你分析。'
        : '手牌超過 ' + drawn + ' 張，請先拎走 ' + (total - drawn) + ' 張。';
      el.resultBody.appendChild(msg);
      return null;
    }

    var data = M.analyze(hand, seen, {
      joker: opts.joker,
      chiitoi: opts.chiitoi,
      melds: melds
    });
    el.resultMeta.textContent = '未見牌 ' + data.unseen + ' 張';

    if (data.results[0].winning || total === waiting) {
      renderSingle(data);
    } else {
      renderDiscards(data);
    }
    return data;
  }

  function dockNames(res) {
    if (res.tiles.length === 34) return '任何牌';
    if (res.tiles.length > 4) return res.tiles.length + ' 種牌';
    return res.tiles.map(function (w) { return shortTile(w.tile); }).join('、');
  }

  function renderDock(total, data) {
    if (!data || !data.results.length) {
      el.dock.hidden = true;
      document.body.classList.remove('has-dock');
      return;
    }

    var res = data.results[0];
    var label = '現時';
    var text;

    if (res.discard >= 0) {
      label = '建議打';
      el.dockTile.hidden = false;
      el.dockTile.className = 'dock-tile';
      el.dockTile.innerHTML = window.TileUI.svg(res.discard);
    } else {
      el.dockTile.hidden = true;
    }

    if (res.tenpai) {
      text = '聽 ' + dockNames(res) + ' · <b>' + res.ukeire + '</b> 張';
    } else if (res.shanten > 0) {
      text = '仲差 ' + res.shanten + ' 向聽 · 進張 <b>' + res.ukeire + '</b> 張';
    } else {
      text = '已經食得';
    }

    el.dockLabel.textContent = label;
    el.dockText.innerHTML = text;
    el.dock.hidden = false;
    document.body.classList.add('has-dock');
  }

  function statChips(items) {
    var wrap = document.createElement('div');
    wrap.className = 'best-stats';
    items.forEach(function (item) {
      var s = document.createElement('span');
      s.className = 'stat';
      s.appendChild(document.createTextNode(item.label + ' '));
      var b = document.createElement('b');
      b.textContent = item.value;
      s.appendChild(b);
      wrap.appendChild(s);
    });
    return wrap;
  }

  function pct(x, digits) {
    return (x * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function renderSingle(data) {
    var res = data.results[0];
    var card = document.createElement('div');
    card.className = 'best-card';

    var h3 = document.createElement('h3');
    h3.textContent = res.shanten === -1 ? '已經食得' : res.shanten === 0 ? '已經聽牌' : '離聽牌仲有 ' + res.shanten + ' 步';

    var line = document.createElement('div');
    line.className = 'best-line';
    var text = document.createElement('div');
    text.className = 'best-text';
    if (res.shanten === 0) {
      text.innerHTML = '等 <strong>' + res.tiles.length + ' 種 ' + res.ukeire + ' 張</strong>牌食糊。';
    } else if (res.shanten > 0) {
      text.innerHTML = '可以摸嘅有效牌：<strong>' + res.ukeire + ' 張</strong>（' + res.tiles.length + ' 種）';
    } else {
      text.textContent = '呢副牌已經齊晒。';
    }
    line.appendChild(text);
    card.appendChild(h3);
    card.appendChild(line);
    if (!res.winning) {
      card.appendChild(statChips([
        { label: res.tenpai ? '聽牌張數' : '進張張數', value: res.ukeire + ' 張' },
        { label: '種類', value: res.tiles.length + ' 種' },
        { label: res.tenpai ? '下巡和了率' : '下巡進步率', value: pct(res.winRate) }
      ]));
    }
    el.resultBody.appendChild(card);

    if (!res.winning) {
      var wrap = document.createElement('div');
      wrap.className = 'waits';
      wrap.appendChild(waitChips(res.tiles));
      el.resultBody.appendChild(wrap);
    }

    var note = document.createElement('p');
    note.className = 'result-note';
    note.textContent = res.shanten === 0
      ? '需要多一隻牌先可以分析打邊隻。你可以再摸一隻，或者直接輸入 14 張。'
      : '';
    if (note.textContent) el.resultBody.appendChild(note);
  }

  function kongCard(data) {
    if (!data.kongOptions || !data.kongOptions.length) return null;
    var best = data.results[0];
    var k = data.kongOptions[0];

    // 槓完向聽會變差（例如 45555 索）→ 唔建議槓，講返原因
    if (k.shanten > best.shanten) {
      var warn = document.createElement('div');
      warn.className = 'kong-note';
      warn.innerHTML = '🀫 手上有 <strong>' + M.tileLabel(k.tile) + '×4</strong>，但暗槓會令向聽變差（槓完 ' +
        k.shanten + ' 向聽，唔槓就 ' + best.shanten + ' 向聽），所以唔建議槓。';
      return warn;
    }

    var card = document.createElement('div');
    card.className = 'best-card kong-card';

    var h3 = document.createElement('h3');
    h3.textContent = '建議先暗槓 ' + M.tileLabel(k.tile);
    card.appendChild(h3);

    var line = document.createElement('div');
    line.className = 'best-line';
    var tile = makeTile(k.tile);
    tile.disabled = true;
    tile.style.cursor = 'default';
    line.appendChild(tile);
    var text = document.createElement('div');
    text.className = 'best-text';
    text.innerHTML = '槓有錢收，而呢手牌槓完向聽唔會變差（仲係 <strong>' + k.shanten +
      ' 向聽</strong>），所以建議先槓，補一隻返嚟再揀打邊隻。';
    line.appendChild(text);
    card.appendChild(line);

    card.appendChild(statChips([
      { label: '槓後向聽', value: k.shanten + ' 向聽' },
      { label: '槓後有效牌', value: k.ukeire + ' 張' },
      { label: '槓後種類', value: k.tiles.length + ' 種' }
    ]));
    return card;
  }

  function renderDiscards(data) {
    var results = data.results;
    var best = results[0];
    var maxScore = Math.max.apply(null, results.map(function (r) { return r.score; })) || 1;

    var ties = results.filter(function (r) {
      return M.sameEfficiency(r, best);
    });

    // 最佳打法卡
    var card = document.createElement('div');
    card.className = 'best-card';
    var h3 = document.createElement('h3');
    h3.textContent = best.tenpai ? '建議打法（聽牌）' : '建議打法';
    card.appendChild(h3);

    var line = document.createElement('div');
    line.className = 'best-line';
    var bestTile = makeTile(best.discard);
    bestTile.disabled = true;
    bestTile.style.cursor = 'default';
    line.appendChild(bestTile);

    var arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    line.appendChild(arrow);

    var text = document.createElement('div');
    text.className = 'best-text';
    if (best.tenpai) {
      text.innerHTML = '聽 <strong>' + waitsSummary(best) + '</strong>';
    } else {
      var imp = best.tiles.slice(0, 6).map(function (w) { return shortTile(w.tile); }).join('、');
      text.innerHTML = '仲係 <strong>' + best.shanten + ' 向聽</strong>，摸 ' + imp + ' 等 ' + best.tiles.length + ' 種牌有進步。';
    }
    line.appendChild(text);
    card.appendChild(line);
    var stats = [
      { label: best.tenpai ? '聽牌張數' : '進張張數', value: best.ukeire + ' 張' },
      { label: best.tenpai ? '聽牌種類' : '進張種類', value: best.tiles.length + ' 種' },
      { label: best.tenpai ? '下巡和了率' : '下巡進步率', value: pct(best.winRate) }
    ];
    if (best.refined) {
      stats.push({ label: '入聽後平均聽', value: best.avgWaits + ' 張' });
    }
    if (best.pungs && best.pungs.length) {
      stats.push({ label: '可碰', value: best.pungs.map(function (p) { return shortTile(p.tile); }).join('、') });
    }
    if (data.kongs && data.kongs.length) {
      stats.push({ label: '可暗槓', value: data.kongs.map(function (k) { return shortTile(k.tile); }).join('、') });
    }
    card.appendChild(statChips(stats));
    el.resultBody.appendChild(card);

    var kc = kongCard(data);
    if (kc) el.resultBody.appendChild(kc);

    if (best.pungs && best.pungs.length) {
      var pungRow = document.createElement('div');
      pungRow.className = 'waits waits--pung';
      pungRow.appendChild(pungChips(best.pungs));
      el.resultBody.appendChild(pungRow);
    }

    if (ties.length > 1) {
      var tieNote = document.createElement('p');
      tieNote.className = 'result-note';
      tieNote.style.marginTop = '-6px';
      tieNote.textContent = '同樣效率嘅打法：' + ties.map(function (r) { return shortTile(r.discard); }).join('、');
      el.resultBody.appendChild(tieNote);
    }

    // 全部打法
    var rows = document.createElement('div');
    rows.className = 'rows';

    results.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'row';
      var isBest = M.sameEfficiency(r, best);
      if (isBest) row.classList.add('is-best');
      if (r.ukeire === 0 && !isBest) row.classList.add('is-dim');

      var tileWrap = document.createElement('div');
      tileWrap.className = 'row-tile';
      var t = makeTile(r.discard);
      t.disabled = true;
      t.style.cursor = 'default';
      var label = document.createElement('small');
      label.textContent = '打';
      tileWrap.appendChild(t);
      tileWrap.appendChild(label);

      var body = document.createElement('div');
      body.className = 'waits';
      body.appendChild(waitChips(r.tiles));
      if (r.pungs && r.pungs.length) body.appendChild(pungChips(r.pungs));

      var meta = document.createElement('div');
      meta.className = 'row-meta';
      var totalEl = document.createElement('span');
      totalEl.className = 'total';
      totalEl.textContent = String(r.ukeire);
      var unit = document.createElement('small');
      unit.textContent = '張';
      totalEl.appendChild(unit);
      meta.appendChild(shantenTag(r.shanten));
      if (r.breaksKong) {
        var qk = document.createElement('span');
        qk.className = 'quality quality--warn';
        qk.textContent = '拆槓';
        meta.appendChild(qk);
      }
      if (r.refined) {
        var q = document.createElement('span');
        q.className = 'quality';
        q.textContent = '聽 ' + r.avgWaits;
        q.title = '入聽之後平均聽幾多張牌（越高越好）';
        meta.appendChild(q);
      }
      meta.appendChild(totalEl);

      var bar = document.createElement('div');
      bar.className = 'bar';
      var fill = document.createElement('span');
      fill.style.width = Math.round((r.score / maxScore) * 100) + '%';
      bar.appendChild(fill);

      row.appendChild(tileWrap);
      row.appendChild(body);
      row.appendChild(meta);
      row.appendChild(bar);
      rows.appendChild(row);
    });

    el.resultBody.appendChild(rows);

    var note = document.createElement('p');
    note.className = 'result-note';
    note.textContent = '排序：向聽數 → 入聽質素（進張之後平均聽幾多張，可碰嘅對子會加權）→ 有效牌張數。剩餘張數已扣減手牌同已見牌。';
    if (best.shanten >= 2) {
      note.textContent += ' 向聽仲有 ' + best.shanten + ' 步，進張數只作參考。';
    }
    el.resultBody.appendChild(note);
  }

  function stampBuild() {
    var foot = document.querySelector('.foot');
    if (!foot || foot.querySelector('.build')) return;
    var s = document.createElement('p');
    s.className = 'build';
    s.textContent = '版本 ' + BUILD;
    foot.appendChild(s);
  }

  /* ---------------- 初始化 ---------------- */

  stampBuild();
  pickerTiles = buildPicker(el.tilePicker, onPickHand);
  seenTiles = buildPicker(el.seenPicker, onPickSeen);
  meldPickerTiles = buildPicker(el.meldPicker, onPickMeld);

  el.undoBtn.addEventListener('click', undo);
  el.clearBtn.addEventListener('click', function () {
    snapshot();
    hand = M.zeros();
    render();
  });
  el.clearSeen.addEventListener('click', function () {
    snapshot();
    seen = M.zeros();
    render();
  });
  el.seenToggle.addEventListener('click', function () {
    var open = el.seenPicker.hidden;
    el.seenPicker.hidden = !open;
    el.seenToggle.textContent = open ? '收起' : '展開';
    el.seenToggle.setAttribute('aria-expanded', String(open));
  });
  el.optJoker.addEventListener('change', function () {
    opts.joker = el.optJoker.checked;
    el.jokerBadge.classList.toggle('is-off', !opts.joker);
    el.jokerBadge.textContent = opts.joker ? '紅中百搭' : '中＝普通牌';
    render();
  });
  el.meldToggle.addEventListener('click', function () {
    var open = el.meldBody.hidden;
    el.meldBody.hidden = !open;
    el.meldToggle.textContent = open ? '收起' : '展開';
    el.meldToggle.setAttribute('aria-expanded', String(open));
  });
  el.meldTypes.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-kind]') : null;
    if (!btn) return;
    meldKind = btn.getAttribute('data-kind');
    Array.prototype.forEach.call(el.meldTypes.children, function (b) {
      b.classList.toggle('is-on', b === btn);
    });
    haptic(5);
    render();
  });
  el.clearMeld.addEventListener('click', function () {
    if (!melds.length) return;
    snapshot();
    melds = [];
    render();
  });

  el.dockBtn.addEventListener('click', function () {
    document.getElementById('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  el.optChiitoi.addEventListener('change', function () {
    opts.chiitoi = el.optChiitoi.checked;
    render();
  });

  render();
})();
