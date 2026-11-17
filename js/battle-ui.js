/*!
 * 麻雀實戰 — 介面（4 人一檯：你 + 3 個 AI）
 */
(function (root, doc) {
  'use strict';

  var M = root.MahjongCore;
  var B = root.MahjongBattle;
  var UI = root.TileUI;

  var BUILD = 'v71';

  var el = {
    optJoker: doc.getElementById('bOptJoker'),
    optChiitoi: doc.getElementById('bOptChiitoi'),
    optNoHonors: doc.getElementById('bOptNoHonors'),
    optTsumoOnly: doc.getElementById('bOptTsumoOnly'),
    newBtn: doc.getElementById('bNew'),
    status: doc.getElementById('bStatus'),
    hint: doc.getElementById('bHint'),
    setup: doc.getElementById('bSetup'),
    table: doc.getElementById('bTable'),
    wall: doc.getElementById('bWall'),
    turn: doc.getElementById('bTurn'),
    opps: doc.getElementById('bOpps'),
    rivers: doc.getElementById('bRivers'),
    me: doc.getElementById('bMe'),
    myCount: doc.getElementById('bMyCount'),
    myMelds: doc.getElementById('bMyMelds'),
    myHand: doc.getElementById('bMyHand'),
    actions: doc.getElementById('bActions'),
    result: doc.getElementById('bResult')
  };

  var g = null;
  var mode = 'idle'; // 'idle' | 'discard' | 'claim'
  var claimResolver = null;
  var renderTimer = null;
  var humanBest = { ok: 0, total: 0 }; // 你打嘅牌同引擎最佳打牌（5% 容差內）有幾夾
  var humanLog = [];                    // 逐手紀錄（為咗完局檢討邊手打錯）

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function label(tile) {
    return tile >= 0 ? M.tileLabel(tile) : '';
  }

  /* ---------------- 畫面 ---------------- */

  function setStatus(text) {
    el.status.textContent = text || '';
  }

  function miniTile(tile) {
    var span = doc.createElement('span');
    span.className = 'battle-mini';
    if (tile === M.JOKER && g && g.opts.joker) span.classList.add('is-joker');
    span.innerHTML = UI.svg(tile);
    return span;
  }

  function renderOpps() {
    el.opps.innerHTML = '';
    [1, 2, 3].forEach(function (seat) {
      var box = doc.createElement('div');
      box.className = 'battle-opp' + (g.seat === seat && g.phase !== 'over' ? ' is-turn' : '');

      var head = doc.createElement('div');
      head.className = 'battle-opp-head';
      var name = doc.createElement('span');
      name.textContent = B.SEAT_NAME[seat];
      var count = doc.createElement('span');
      count.className = 'battle-opp-count';
      count.textContent = B.handTotal(g, seat) + ' 張';
      head.appendChild(name);
      head.appendChild(count);
      box.appendChild(head);

      var melds = doc.createElement('div');
      melds.className = 'battle-melds';
      g.melds[seat].forEach(function (m) {
        B.meldTiles(m).forEach(function (t) { melds.appendChild(miniTile(t)); });
      });
      box.appendChild(melds);

      var backs = doc.createElement('div');
      backs.className = 'battle-backs';
      var n = Math.min(B.handTotal(g, seat), 14);
      for (var i = 0; i < n; i++) {
        var b = doc.createElement('span');
        b.className = 'tile-back';
        backs.appendChild(b);
      }
      box.appendChild(backs);

      el.opps.appendChild(box);
    });
  }

  function renderRivers() {
    el.rivers.innerHTML = '';
    [0, 1, 2, 3].forEach(function (seat) {
      var box = doc.createElement('div');
      box.className = 'battle-river';
      var head = doc.createElement('div');
      head.className = 'battle-river-head';
      head.textContent = seat === 0 ? '你' : B.SEAT_NAME[seat];
      box.appendChild(head);
      var tiles = doc.createElement('div');
      tiles.className = 'battle-river-tiles';
      if (!g.discards[seat].length) {
        var empty = doc.createElement('span');
        empty.className = 'battle-river-empty';
        empty.textContent = '—';
        tiles.appendChild(empty);
      }
      g.discards[seat].forEach(function (t) {
        var s = miniTile(t);
        if (g.lastDiscard && g.lastDiscard.seat === seat && g.lastDiscard.tile === t &&
            g.discards[seat][g.discards[seat].length - 1] === t) {
          s.classList.add('is-last');
        }
        tiles.appendChild(s);
      });
      box.appendChild(tiles);
      el.rivers.appendChild(box);
    });
  }

  function renderMyHand() {
    el.myHand.innerHTML = '';
    el.myCount.textContent = B.handTotal(g, 0) + ' 張';
    if (el.myMelds) el.myMelds.innerHTML = '';

    var hand = g.hands[0].slice();
    // 啱啱摸到嗰隻牌：由排序手牌抽出嚟，獨立擺喺最右邊（金色框），一眼睇到摸到咩
    var drawn = -1;
    if (g.phase === 'discard' && g.lastDraw && g.lastDraw.seat === 0 && hand[g.lastDraw.tile] > 0) {
      drawn = g.lastDraw.tile;
      hand[drawn] -= 1;
    }

    // 有人打出嘅牌可以碰／槓 → 喺手牌標示相關嘅牌
    var claim = g.pendingClaim;
    var claimMark = 0;
    if (claim) {
      if (claim.options.indexOf('kong') >= 0) claimMark = 3;
      else if (claim.options.indexOf('pong') >= 0) claimMark = 2;
    }

    function addTile(tile, isDrawn) {
      var btn = UI.make(tile, { joker: g.opts.joker });
      if (isDrawn) btn.classList.add('is-drawn');
      if (claim && claimMark && tile === claim.tile && claimMark > 0) {
        btn.classList.add('is-claim');
        claimMark -= 1;
      }
      if (mode === 'discard') {
        btn.classList.add('is-playable');
        btn.addEventListener('click', onHandClick);
      } else {
        btn.disabled = true;
      }
      return btn;
    }

    // 副露擺喺同一行最左邊（同真實牌桌一樣：副露 | 手牌 | 摸到嗰隻）
    g.melds[0].forEach(function (m) {
      var group = doc.createElement('span');
      group.className = 'battle-hand-meld' + (m.concealed ? ' is-concealed' : '');
      group.title = m.concealed ? '暗槓' : (m.added ? '補槓' : (m.kind === 'kong' ? '明槓' : '碰'));
      B.meldTiles(m).forEach(function (t) {
        var card = UI.make(t, { joker: g.opts.joker });
        card.disabled = true;
        card.classList.add('is-meld');
        group.appendChild(card);
      });
      el.myHand.appendChild(group);
    });
    if (claim && claim.options.length) {
      var tag = doc.createElement('span');
      tag.className = 'battle-hand-claim';
      var what = [];
      if (claim.options.indexOf('hu') >= 0) what.push('食糊');
      if (claim.options.indexOf('kong') >= 0) what.push('槓');
      if (claim.options.indexOf('pong') >= 0) what.push('碰');
      tag.textContent = (claim.from === 0 ? '你' : B.SEAT_NAME[claim.from]) + ' 打出 ' +
        label(claim.tile) + ' · 可以' + what.join('／');
      el.myHand.appendChild(tag);
    }

    if (g.melds[0].length) {
      var split = doc.createElement('span');
      split.className = 'battle-hand-split';
      el.myHand.appendChild(split);
    }

    for (var t = 0; t < M.TILES; t++) {
      for (var i = 0; i < hand[t]; i++) el.myHand.appendChild(addTile(t, false));
    }
    if (drawn >= 0) {
      var gap = doc.createElement('span');
      gap.className = 'battle-hand-gap';
      el.myHand.appendChild(gap);
      el.myHand.appendChild(addTile(drawn, true));
    }
  }

  function makeAction(text, cls, handler) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'battle-btn' + (cls ? ' ' + cls : '');
    b.textContent = text;
    b.addEventListener('click', handler);
    return b;
  }

  function renderActions(claimOptions) {
    el.actions.innerHTML = '';
    el.actions.hidden = true;

    if (claimOptions) {
      el.actions.hidden = false;
      if (claimOptions.indexOf('hu') >= 0) {
        el.actions.appendChild(makeAction('食糊', 'battle-btn--win', function () { pickClaim('hu'); }));
      }
      if (claimOptions.indexOf('kong') >= 0) {
        el.actions.appendChild(makeAction('槓', 'battle-btn--kong', function () { pickClaim('kong'); }));
      }
      if (claimOptions.indexOf('pong') >= 0) {
        el.actions.appendChild(makeAction('碰', '', function () { pickClaim('pong'); }));
      }
      el.actions.appendChild(makeAction('跳過', 'battle-btn--pass', function () { pickClaim(null); }));
      return;
    }

    if (mode === 'discard' && g && g.seat === 0) {
      var kongs = B.concealedKongOptions(g, 0);
      var addedKongs = B.addedKongOptions(g, 0);
      if (B.canWin(g, 0, -1)) {
        el.actions.hidden = false;
        el.actions.appendChild(makeAction('自摸食糊', 'battle-btn--win', onTsumo));
      }
      if (kongs.length) {
        el.actions.hidden = false;
        kongs.forEach(function (t) {
          el.actions.appendChild(makeAction('暗槓 ' + label(t), 'battle-btn--kong', function () { onConcealedKong(t); }));
        });
      }
      if (addedKongs.length) {
        el.actions.hidden = false;
        addedKongs.forEach(function (t) {
          el.actions.appendChild(makeAction('補槓 ' + label(t), 'battle-btn--kong', function () { onAddedKong(t); }));
        });
      }
    }
  }

  function renderAll() {
    if (!g) return;
    el.table.hidden = false;
    el.me.hidden = false;
    el.wall.textContent = '牌牆 ' + g.wall.length + ' 張';
    el.turn.textContent = '第 ' + g.turnCount + ' 巡';
    renderOpps();
    renderRivers();
    renderMyHand();
    renderActions(null);
    if (g.seat === 0 && g.phase === 'discard') renderActions(null);
  }

  /* ---------------- 流程 ---------------- */

  function startGame() {
    g = B.newGame({
      joker: !!el.optJoker.checked,
      chiitoi: !!el.optChiitoi.checked,
      noHonors: !!el.optNoHonors.checked,
      tsumoOnly: !el.optTsumoOnly || !!el.optTsumoOnly.checked
    });
    mode = 'idle';
    claimResolver = null;
    humanBest = { ok: 0, total: 0 };
    humanLog = [];
    el.result.hidden = true;
    el.result.innerHTML = '';
    el.hint.textContent = '你係莊家，先摸牌。撳手牌打出，AI 會用同一個效率引擎計最佳打法。';
    if (el.setup) el.setup.hidden = true; // 對局中收起規則設定，畫面集中喺牌桌
    renderAll();
    setStatus('你摸到 ' + label(g.lastDraw.tile));
    humanTurn();
  }

  function humanTurn() {
    mode = 'discard';
    renderAll();
    setStatus('你嘅回合：揀一隻打出' + (g.lastDraw && g.lastDraw.seat === 0 ? '（摸到 ' + label(g.lastDraw.tile) + '）' : ''));
    renderActions(null);
    if (!el.actions.hidden) setStatus('你嘅回合：可以自摸或暗槓，否則揀一隻打出');
  }

  async function aiTurn() {
    var seat = g.seat;
    setStatus(B.SEAT_NAME[seat] + ' 思考中…');
    await sleep(360);
    if (!g || g.phase === 'over') return;

    // 補槓：已經碰咗又有第四隻，補一隻唔會蝕，AI 一定會補
    var added = B.addedKongOptions(g, seat);
    if (added.length) {
      B.applyAddedKong(g, seat, added[0]);
      renderAll();
      setStatus(B.SEAT_NAME[seat] + ' 補槓 ' + label(added[0]));
      await sleep(300);
      if (!g || g.phase === 'over') return finish();
    }

    if (B.canWin(g, seat, -1)) {
      B.applyHu(g, seat, -1);
      return finish();
    }
    var tile = B.aiDiscard(g, seat);
    if (tile < 0) {
      B.applyHu(g, seat, -1);
      return finish();
    }
    B.discard(g, seat, tile);
    renderAll();
    setStatus(B.SEAT_NAME[seat] + ' 打出 ' + label(tile));
    await sleep(240);
    return resolveClaims();
  }

  async function resolveClaims() {
    if (!g || g.phase !== 'claim') return;
    var q = B.claimQueue(g);
    var tile = g.lastDiscard.tile;

    for (var i = 0; i < q.length; i++) {
      if (q[i].options.indexOf('hu') >= 0) {
        B.applyHu(g, q[i].seat, tile);
        return finish();
      }
    }

    for (var j = 0; j < q.length; j++) {
      var c = q[j];
      var pick;
      if (c.seat === 0) {
        setStatus(B.SEAT_NAME[g.lastDiscard.seat] + ' 打出 ' + label(tile) + '，你可以…');
        pick = await askHuman(c.options);
        if (!g || g.phase !== 'claim') return;
      } else {
        pick = B.aiDecideClaim(g, c.seat, tile, c.options);
      }

      if (pick === 'kong' && B.applyKong(g, c.seat, tile)) {
        renderAll();
        setStatus(B.SEAT_NAME[c.seat] + ' 槓 ' + label(tile));
        await sleep(320);
        return run();
      }
      if (pick === 'pong' && B.applyPong(g, c.seat, tile)) {
        renderAll();
        setStatus(B.SEAT_NAME[c.seat] + ' 碰 ' + label(tile));
        await sleep(280);
        return run();
      }
    }

    B.nextTurn(g);
    if (g.phase === 'over') return finish();
    renderAll();
    await sleep(240);
    return run();
  }

  function run() {
    if (!g) return;
    if (g.phase === 'over') return finish();
    if (g.phase === 'claim') return resolveClaims();
    if (g.seat === 0) return humanTurn();
    return aiTurn();
  }

  function rateDiscard(tile) {
    try {
      var r = B.analyzeSeat(g, 0);
      var best = r.results && r.results[0];
      if (!best || best.discard < 0) return;
      var mine = null;
      for (var i = 0; i < r.results.length; i++) {
        if (r.results[i].discard === tile) { mine = r.results[i]; break; }
      }
      var ok = best.discard === tile || (mine && M.sameEfficiency(best, mine));
      humanBest.total += 1;
      if (ok) humanBest.ok += 1;
      humanLog.push({
        turn: g.turnCount,
        picked: tile,
        best: best.discard,
        ok: ok,
        hand: g.hands[0].slice(),
        meldCount: g.melds[0].length,
        pickUkeire: mine ? mine.ukeire : 0,
        bestUkeire: best.ukeire,
        pickWaits: mine ? mine.avgWaits : 0,
        bestWaits: best.avgWaits,
        pickShanten: mine ? mine.shanten : best.shanten,
        bestShanten: best.shanten
      });
    } catch (e) { /* 計唔到就唔計 */ }
  }

  function onHandClick(event) {
    if (mode !== 'discard' || !g || g.seat !== 0) return;
    var tile = Number(event.currentTarget.dataset.tile);
    rateDiscard(tile);
    mode = 'idle';
    B.discard(g, 0, tile);
    renderAll();
    setStatus('你打出 ' + label(tile));
    resolveClaims();
  }

  function onTsumo() {
    if (mode !== 'discard') return;
    mode = 'idle';
    B.applyHu(g, 0, -1);
    finish();
  }

  function onConcealedKong(tile) {
    if (mode !== 'discard') return;
    if (!B.applyConcealedKong(g, 0, tile)) return;
    renderAll();
    setStatus('你暗槓 ' + label(tile) + '，補到 ' + label(g.lastDraw.tile));
    humanTurn();
  }

  function onAddedKong(tile) {
    if (mode !== 'discard') return;
    if (!B.applyAddedKong(g, 0, tile)) return;
    renderAll();
    setStatus('你補槓 ' + label(tile) + '，補到 ' + label(g.lastDraw.tile));
    humanTurn();
  }

  function askHuman(options) {
    return new Promise(function (resolve) {
      claimResolver = resolve;
      mode = 'claim';
      if (g.lastDiscard) {
        g.pendingClaim = { tile: g.lastDiscard.tile, from: g.lastDiscard.seat, options: options };
      }
      renderMyHand();          // 手牌即刻標示可以碰／槓邊幾隻
      renderActions(options);
    });
  }

  function pickClaim(kind) {
    var resolve = claimResolver;
    claimResolver = null;
    mode = 'idle';
    if (g) g.pendingClaim = null;
    renderMyHand();
    renderActions(null);
    if (resolve) resolve(kind);
  }

  function shantenText(n) {
    if (n < 0) return '食糊';
    if (n === 0) return '聽牌';
    return n + ' 向聽';
  }

  function summaryBlock(r) {
    var box = doc.createElement('div');
    box.className = 'battle-summary';

    var title = doc.createElement('div');
    title.className = 'battle-summary-head';
    title.textContent = '本局摘要';
    box.appendChild(title);

    var meta = doc.createElement('p');
    meta.className = 'battle-summary-meta';
    meta.textContent = '第 ' + g.turnCount + ' 巡完結 · 牌牆剩 ' + g.wall.length + ' 張 · ' +
      (r.type === 'draw' ? '流局（冇人食糊）' : '食糊者：' + (r.seat === 0 ? '你' : B.SEAT_NAME[r.seat])) +
      ' · ' + BUILD;
    box.appendChild(meta);

    var table = doc.createElement('table');
    table.className = 'battle-table';
    table.innerHTML = '<thead><tr><th>玩家</th><th>打出</th><th>碰</th><th>槓</th><th>結果</th></tr></thead>';
    var tbody = doc.createElement('tbody');
    for (var seat = 0; seat < 4; seat++) {
      var tr = doc.createElement('tr');
      if (seat === 0) tr.className = 'is-me';
      var out = '—';
      if (r.type !== 'draw') {
        if (r.seat === seat) out = r.type === 'tsumo' ? '自摸食糊' : '食糊（出銃）';
        else if (r.type === 'ron' && r.from === seat) out = '出銃';
      }
      var cells = [
        seat === 0 ? '你' : B.SEAT_NAME[seat],
        String(g.stats.discards[seat] || 0),
        String(g.stats.pongs[seat] || 0),
        String(g.stats.kongs[seat] || 0),
        out
      ];
      cells.forEach(function (text) {
        var td = doc.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    box.appendChild(table);

    var mine = doc.createElement('ul');
    mine.className = 'battle-summary-list';

    function line(text, cls) {
      var li = doc.createElement('li');
      if (cls) li.className = cls;
      li.textContent = text;
      mine.appendChild(li);
    }

    line('你最終手牌：' + shantenText(B.seatShanten(g, 0)));
    if (humanBest.total) {
      var pct = Math.round((humanBest.ok / humanBest.total) * 100);
      line('最優打牌：' + humanBest.ok + ' / ' + humanBest.total + '（' + pct + '%）' +
        (pct >= 80 ? ' 打得好' : pct >= 60 ? ' 唔錯，可以再貼近引擎' : ' 可以多啲用計算器覆核'),
        pct >= 80 ? 'is-good' : (pct < 60 ? 'is-warn' : null));
    }
    box.appendChild(mine);

    box.appendChild(reviewBlock());

    // 累計戰績（存喺呢部裝置）
    var life = bumpLifetime(r.type !== 'draw' && r.seat === 0);
    if (life) {
      var acc = doc.createElement('p');
      acc.className = 'battle-summary-life';
      acc.textContent = '累計：' + life.games + ' 局 · 你食糊 ' + life.wins + ' 次（' +
        Math.round((life.wins / life.games) * 100) + '%）';
      box.appendChild(acc);
    }
    return box;
  }

  function reviewBlock() {
    var wrap = doc.createElement('div');
    wrap.className = 'battle-review';

    var head = doc.createElement('div');
    head.className = 'battle-summary-head';
    head.textContent = '打牌檢討';
    wrap.appendChild(head);

    var bad = humanLog.filter(function (x) { return !x.ok; });
    var note = doc.createElement('p');
    note.className = 'battle-summary-meta';
    if (!humanLog.length) {
      note.textContent = '呢局未有你打牌嘅紀錄。';
      wrap.appendChild(note);
      return wrap;
    }
    note.textContent = bad.length
      ? bad.length + ' / ' + humanLog.length + ' 手偏離引擎最佳（下面由最早到最遲列出）'
      : '你每一手都同引擎最佳一致（或差 5% 以內）👏';
    wrap.appendChild(note);

    function tileSpan(tile, cls) {
      var span = doc.createElement('span');
      span.className = 'battle-mini' + (cls ? ' ' + cls : '');
      if (tile === M.JOKER && g.opts.joker) span.classList.add('is-joker');
      span.innerHTML = UI.svg(tile);
      return span;
    }

    bad.slice(0, 8).forEach(function (item) {
      var row = doc.createElement('div');
      row.className = 'battle-mistake';

      var line1 = doc.createElement('div');
      line1.className = 'battle-mistake-head';
      var turnText = doc.createElement('span');
      turnText.className = 'battle-mistake-turn';
      turnText.textContent = '第 ' + item.turn + ' 巡';
      line1.appendChild(turnText);

      var you = doc.createElement('span');
      you.className = 'battle-mistake-pick';
      you.appendChild(doc.createTextNode('打 '));
      you.appendChild(tileSpan(item.picked));
      line1.appendChild(you);

      var should = doc.createElement('span');
      should.className = 'battle-mistake-best';
      should.appendChild(doc.createTextNode('應打 '));
      should.appendChild(tileSpan(item.best));
      line1.appendChild(should);
      row.appendChild(line1);

      var stats = doc.createElement('div');
      stats.className = 'battle-mistake-stats';
      var bits = [];
      if (item.pickShanten !== item.bestShanten) {
        bits.push('向聽 ' + shantenText(item.pickShanten) + ' → ' + shantenText(item.bestShanten));
      }
      if (item.pickUkeire !== item.bestUkeire) {
        bits.push('有效牌 ' + item.pickUkeire + ' → ' + item.bestUkeire + ' 張');
      }
      if (item.bestWaits && item.pickWaits !== item.bestWaits) {
        bits.push('入聽後平均聽 ' + item.pickWaits + ' → ' + item.bestWaits + ' 張');
      }
      stats.textContent = bits.length ? bits.join(' · ') : '兩隻差唔多，只係排序先後';
      row.appendChild(stats);

      var hand = doc.createElement('div');
      hand.className = 'battle-mistake-hand';
      var counts = item.hand.slice();
      counts[item.picked] -= 1; // 打之前嘅手牌（唔含將要打嗰隻）
      for (var t = 0; t < M.TILES; t++) {
        for (var k = 0; k < counts[t]; k++) hand.appendChild(tileSpan(t));
      }
      if (item.meldCount) {
        var tag = doc.createElement('span');
        tag.className = 'battle-mistake-meld';
        tag.textContent = '（另有 ' + item.meldCount + ' 副露）';
        hand.appendChild(tag);
      }
      row.appendChild(hand);

      wrap.appendChild(row);
    });

    if (bad.length > 8) {
      var more = doc.createElement('p');
      more.className = 'battle-summary-meta';
      more.textContent = '仲有 ' + (bad.length - 8) + ' 手未列出。';
      wrap.appendChild(more);
    }
    return wrap;
  }

  function bumpLifetime(won) {
    try {
      var games = Number(localStorage.getItem('mj-battle-games') || 0) + 1;
      var wins = Number(localStorage.getItem('mj-battle-wins') || 0) + (won ? 1 : 0);
      localStorage.setItem('mj-battle-games', String(games));
      localStorage.setItem('mj-battle-wins', String(wins));
      return { games: games, wins: wins };
    } catch (e) {
      return null;
    }
  }

  function finish() {
    if (g.__finished) return;
    g.__finished = true;
    mode = 'idle';
    renderAll();
    el.result.hidden = false;
    el.result.innerHTML = '';

    var head = doc.createElement('div');
    head.className = 'panel-head';
    var h = doc.createElement('h2');
    h.textContent = '結果';
    head.appendChild(h);
    el.result.appendChild(head);

    var p = doc.createElement('p');
    var r = g.result || { type: 'draw' };
    if (r.type === 'draw') {
      p.textContent = '流局：牌牆摸完，冇人食糊。';
    } else if (r.type === 'tsumo') {
      p.textContent = r.seat === 0 ? '🎉 你自摸食糊！' : B.SEAT_NAME[r.seat] + ' 自摸食糊。';
    } else {
      p.textContent = (r.seat === 0 ? '🎉 你食糊！' : B.SEAT_NAME[r.seat] + ' 食糊。') +
        '（' + B.SEAT_NAME[r.from] + ' 打出 ' + label(r.tile) + '）';
    }
    el.result.appendChild(p);

    if (r.type !== 'draw') {
      var wrap = doc.createElement('div');
      wrap.className = 'battle-hand battle-hand--result';
      var hand = g.hands[r.seat].slice();
      if (r.type === 'ron') hand[r.tile] += 1;
      for (var t = 0; t < M.TILES; t++) {
        for (var i = 0; i < hand[t]; i++) {
          var s = doc.createElement('span');
          s.className = 'battle-mini';
          if (t === M.JOKER && g.opts.joker) s.classList.add('is-joker');
          s.innerHTML = UI.svg(t);
          wrap.appendChild(s);
        }
      }
      g.melds[r.seat].forEach(function (m) {
        B.meldTiles(m).forEach(function (mt) {
          var s = doc.createElement('span');
          s.className = 'battle-mini';
          s.innerHTML = UI.svg(mt);
          wrap.appendChild(s);
        });
      });
      if (r.type === 'ron') {
        var win = doc.createElement('span');
        win.className = 'battle-mini is-win';
        win.innerHTML = UI.svg(r.tile);
        wrap.appendChild(win);
      }
      el.result.appendChild(wrap);
    }

    el.result.appendChild(summaryBlock(r));

    var again = makeAction('再嚟一局', 'battle-btn--win', startGame);
    var bar = doc.createElement('div');
    bar.className = 'battle-actions';
    bar.appendChild(again);
    el.result.appendChild(bar);

    if (el.setup) el.setup.hidden = false;
    setStatus(r.type === 'draw' ? '流局' : '對局結束');
    el.result.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- 初始化 ---------------- */

  el.newBtn.addEventListener('click', startGame);
  [el.optJoker, el.optChiitoi, el.optNoHonors, el.optTsumoOnly].forEach(function (input) {
    input.addEventListener('change', function () {
      if (g && g.phase !== 'over') return; // 對局中唔改規則
      el.hint.textContent = '規則改咗，撳「新一局」開始。';
    });
  });

  // 開發用（網址加 ?dev=1 先會開）：可以讀／設定牌局，方便測試 UI 流程
  root.MJBattleView = {
    dev: /[?&]dev=1/.test(doc.location.search) ? {
      get: function () { return g; },
      set: function (state) { g = state; mode = 'discard'; renderAll(); },
      // 測試用：直接叫出「你可以碰／槓／食糊」嘅畫面
      claim: function (options) { return askHuman(options || ['pong']); }
    } : null,
    start: function () {
      if (renderTimer) return;
      renderTimer = setTimeout(function () { renderTimer = null; }, 0);
      if (!g) el.hint.textContent = '撳「新一局」開始。你係莊家，先摸牌；AI 會用同一個效率引擎計最佳打法。';
    }
  };
})(typeof self !== 'undefined' ? self : this, document);
