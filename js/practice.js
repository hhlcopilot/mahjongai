(function () {
  'use strict';

  var BUILD = 'v73';

  var M = window.MahjongCore;
  var T = window.TileUI;
  var JOKER = M.JOKER;

  var LEVEL_RANGE = { easy: [0, 1], normal: [1, 2], hard: [2, 3] };
  var MELD_NAMES = { pong: '碰', kong: '槓' };

  var opts = { joker: true, chiitoi: false, melds: false, noHonors: true, level: 'easy' };
  var state = {
    hand: null, melds: [], data: null, answered: false, picked: -1, round: 0,
    pond: [], otherMelds: [], seen: null, step: 1, steps: [], drawn: -1
  };
  var stats = loadStats();

  var el = {
    statsLabel: document.getElementById('pStats'),
    round: document.getElementById('pRound'),
    streak: document.getElementById('pStreak'),
    question: document.getElementById('pQuestion'),
    hint: document.getElementById('pHint'),
    answerPanel: document.getElementById('pAnswer'),
    difficulty: document.getElementById('pDifficulty'),
    optMelds: document.getElementById('pOptMelds'),
    optJoker: document.getElementById('pOptJoker'),
    optChiitoi: document.getElementById('pOptChiitoi'),
    optNoHonors: document.getElementById('pOptNoHonors'),
    jokerBadge: document.getElementById('pJokerBadge'),
    newBtn: document.getElementById('pNewBtn'),
    skipBtn: document.getElementById('pSkipBtn')
  };

  /* ---------------- 成績 ---------------- */

  function loadStats() {
    try {
      var raw = window.localStorage.getItem('mahjong_practice_stats');
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.total === 'number' && typeof s.correct === 'number') {
          return { total: s.total, correct: s.correct, streak: s.streak || 0, best: s.best || 0 };
        }
      }
    } catch (e) { /* 忽略 */ }
    return { total: 0, correct: 0, streak: 0, best: 0 };
  }

  function saveStats() {
    try {
      window.localStorage.setItem('mahjong_practice_stats', JSON.stringify(stats));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 隨機牌型 ---------------- */

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  // 走番子：0–26 係萬筒索，27 對應「中」；其餘番子（東南西北發白）唔出
  function rndTile() {
    if (!opts.noHonors) return randInt(34);
    var i = randInt(28);
    return i < 27 ? i : JOKER;
  }

  // 香港麻將冇上牌：只會出碰同槓
  function randomMeld(used) {
    for (var tries = 0; tries < 80; tries++) {
      if (Math.random() < 0.72) {
        var t = rndTile();
        if (used[t] + 3 <= 4) {
          used[t] += 3;
          return { kind: 'pong', tiles: [t, t, t] };
        }
      } else {
        var k = rndTile();
        if (used[k] + 4 <= 4) {
          used[k] += 4;
          return { kind: 'kong', tiles: [k, k, k, k] };
        }
      }
    }
    return null;
  }

  // 砌一副「幾乎完成」嘅牌：先砌 (4−副露) 副 + 眼，再隨機換走 1–3 隻
  function buildCandidate() {
    var melds = [];
    var used = M.zeros();

    if (opts.melds) {
      var want = Math.random() < 0.4 ? 0 : (Math.random() < 0.65 ? 1 : 2);
      for (var i = 0; i < want; i++) {
        var m = randomMeld(used);
        if (m) melds.push(m);
      }
    }

    var counts = M.zeros();
    var need = 4 - melds.length;
    var made = 0;
    var guard = 0;

    while (made < need && guard++ < 300) {
      if (Math.random() < 0.62) {
        var base = randInt(3) * 9 + randInt(7);
        var seq = [base, base + 1, base + 2];
        if (seq.every(function (t) { return used[t] + counts[t] < 4; })) {
          seq.forEach(function (t) { counts[t] += 1; });
          made++;
        }
      } else {
        var t2 = rndTile();
        if (used[t2] + counts[t2] <= 1) {
          counts[t2] += 3;
          made++;
        }
      }
    }

    guard = 0;
    while (guard++ < 200) {
      var pair = rndTile();
      if (used[pair] + counts[pair] <= 2) {
        counts[pair] += 2;
        break;
      }
    }

    // 難度越高，換走越多隻 → 向聽越高
    var swaps = opts.level === 'hard' ? 5 + randInt(3)
      : opts.level === 'normal' ? 3 + randInt(2)
        : 1 + randInt(2);
    for (var s = 0; s < swaps; s++) {
      var list = [];
      for (var t3 = 0; t3 < 34; t3++) if (counts[t3] > 0) list.push(t3);
      if (!list.length) break;
      counts[list[randInt(list.length)]] -= 1;

      for (var g2 = 0; g2 < 60; g2++) {
        var to = rndTile();
        if (used[to] + counts[to] < 4) {
          counts[to] += 1;
          break;
        }
      }
    }

    if (M.sum(counts) !== 14 - 3 * melds.length) return null;
    return { hand: counts, melds: melds };
  }

  // 有兩隻以上「孤張番子」嘅題目冇意義（兩隻都係廢牌，揀邊隻都一樣）
  function isolatedHonors(counts) {
    var n = 0;
    for (var t = 27; t < 34; t++) {
      if (opts.joker && t === JOKER) continue;
      if (counts[t] === 1) n++;
    }
    return n;
  }

  function quickShanten(cand) {
    var jk = opts.joker ? cand.hand[JOKER] : 0;
    var base = cand.hand.slice();
    if (opts.joker) base[JOKER] = 0;
    var s = M.standardShanten(base, jk, null, cand.melds.length);
    if (opts.chiitoi && cand.melds.length === 0) {
      s = Math.min(s, M.chiitoiShanten(base, jk));
    }
    return s;
  }

  function generate() {
    var range = LEVEL_RANGE[opts.level] || [0, 1];
    var fallback = null;
    var fallbackDiff = 99;

    for (var i = 0; i < 160; i++) {
      var cand = buildCandidate();
      if (!cand) continue;
      if (isolatedHonors(cand.hand) >= 2) continue; // 兩隻孤張番子 → 冇嘢好揀
      var s = quickShanten(cand);
      if (s >= range[0] && s <= range[1]) return cand;
      var diff = s < range[0] ? range[0] - s : s - range[1];
      if (diff < fallbackDiff) {
        fallbackDiff = diff;
        fallback = cand;
      }
    }

    for (var retry = 0; retry < 30; retry++) {
      var safe = fallback || buildCandidate();
      if (safe) return safe;
    }
    return null;
  }

  // 隨機牌河 + 其他玩家碰：剩餘張數唔同，最佳打法都會唔同
  function makePond(cand) {
    var used = cand.hand.slice();
    cand.melds.forEach(function (m) { m.tiles.forEach(function (t) { used[t] += 1; }); });

    var otherMelds = [];
    var wantMeld = Math.random() < 0.5 ? 1 + randInt(2) : 0;
    for (var i = 0; i < wantMeld; i++) {
      for (var tries = 0; tries < 60; tries++) {
        var t = rndTile();
        if (used[t] + 3 <= 4) {
          used[t] += 3;
          otherMelds.push({ kind: 'pong', tiles: [t, t, t] });
          break;
        }
      }
    }

    var pond = [];
    var wantPond = 4 + randInt(6);
    for (var guard = 0; pond.length < wantPond && guard < 300; guard++) {
      var q = rndTile();
      if (used[q] >= 4) continue;
      used[q] += 1;
      pond.push(q);
    }
    return { pond: pond, otherMelds: otherMelds };
  }

  function seenCounts() {
    var seen = M.zeros();
    (state.pond || []).forEach(function (t) { seen[t] += 1; });
    (state.otherMelds || []).forEach(function (m) {
      m.tiles.forEach(function (t) { seen[t] += 1; });
    });
    return seen;
  }

  // 由未見嘅牌隨機摸一隻（按剩幾多張加權）
  function drawTile(hand) {
    var ownMeld = M.zeros();
    (state.melds || []).forEach(function (m) { m.tiles.forEach(function (t) { ownMeld[t] += 1; }); });
    var pool = [];
    for (var t = 0; t < 34; t++) {
      var rem = 4 - (hand[t] || 0) - ownMeld[t] - (state.seen[t] || 0);
      for (var i = 0; i < rem; i++) pool.push(t);
    }
    if (!pool.length) return -1;
    return pool[randInt(pool.length)];
  }

  function analyzeHand(hand) {
    return M.analyze(hand, state.seen || M.zeros(), {
      joker: opts.joker,
      chiitoi: opts.chiitoi,
      melds: state.melds
    });
  }

  /* ---------------- 畫面 ---------------- */

  function percent(a, b) {
    if (!b) return '0%';
    return Math.round((a / b) * 100) + '%';
  }

  function renderHeader() {
    el.round.textContent = String(state.round || 1);
    el.streak.textContent = '連續 ' + stats.streak;
    el.statsLabel.textContent = '答對 ' + stats.correct + ' / ' + stats.total +
      (stats.total ? '（' + percent(stats.correct, stats.total) + '）' : '');
  }

  // 同向聽、同質素分、同有效牌張數 → 當作一樣好
  function bestList() {
    var list = [];
    if (!state.data || !state.data.results.length) return list;
    var best = state.data.results[0];
    state.data.results.forEach(function (r) {
      if (M.sameEfficiency(r, best)) {
        list.push(r);
      }
    });
    return list;
  }

  function bestSet() {
    var set = {};
    bestList().forEach(function (r) { set[r.discard] = true; });
    return set;
  }

  function renderQuestion() {
    el.question.innerHTML = '';

    if (state.step > 1) {
      var stepBar = document.createElement('div');
      stepBar.className = 'practice-step';
      stepBar.innerHTML = '第 <b>2</b> 步 · 摸到 <b>' + M.tileLabel(state.drawn) + '</b>，再揀一隻打';
      el.question.appendChild(stepBar);
    }

    if (state.data && state.data.kongOptions && state.data.kongOptions.length && !state.answered) {
      var kongBar = document.createElement('div');
      kongBar.className = 'practice-kong';
      var bestSh = state.data.results[0].shanten;
      state.data.kongOptions.filter(function (k) { return k.shanten <= bestSh; }).forEach(function (k) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kong-btn';
        btn.textContent = '暗槓 ' + M.tileLabel(k.tile);
        btn.addEventListener('click', onKong.bind(null, k.tile));
        kongBar.appendChild(btn);
      });
      var kongHint = document.createElement('span');
      kongHint.className = 'kong-hint';
      kongHint.textContent = '槓有錢收，槓完唔會蝕向聽';
      kongBar.appendChild(kongHint);
      el.question.appendChild(kongBar);
    }

    if (state.melds.length) {
      var meldWrap = document.createElement('div');
      meldWrap.className = 'practice-melds';
      state.melds.forEach(function (m) {
        var row = document.createElement('div');
        row.className = 'meld-item';
        var kind = document.createElement('span');
        kind.className = 'meld-kind';
        kind.textContent = MELD_NAMES[m.kind] || '副露';
        row.appendChild(kind);
        m.tiles.forEach(function (t) {
          row.appendChild(T.mini(t, { joker: opts.joker }));
        });
        meldWrap.appendChild(row);
      });
      el.question.appendChild(meldWrap);
    }

    var chosen = bestSet();
    var handWrap = document.createElement('div');
    handWrap.className = 'practice-hand';

    for (var t = 0; t < 34; t++) {
      for (var i = 0; i < state.hand[t]; i++) {
        var tile = T.make(t, { joker: opts.joker });
        if (state.answered) {
          tile.disabled = true;
          if (t === state.picked) tile.classList.add('is-picked');
          if (chosen[t]) tile.classList.add('is-best');
        } else {
          tile.classList.add('is-pickable');
          tile.addEventListener('click', onPick.bind(null, t));
        }
        handWrap.appendChild(tile);
      }
    }

    el.question.appendChild(handWrap);

    // 標示啱啱摸到嗰隻
    if (state.step === 2 && state.drawn >= 0 && !state.answered) {
      var allTiles = handWrap.querySelectorAll('.tile');
      for (var bi = allTiles.length - 1; bi >= 0; bi--) {
        if (Number(allTiles[bi].dataset.tile) === state.drawn) {
          allTiles[bi].classList.add('is-drawn');
          break;
        }
      }
    }

    // 牌河 + 其他玩家副露
    var hasPond = (state.pond && state.pond.length) || (state.otherMelds && state.otherMelds.length);
    if (hasPond) {
      var side = document.createElement('div');
      side.className = 'practice-side';

      if (state.otherMelds && state.otherMelds.length) {
        state.otherMelds.forEach(function (m) {
          var row = document.createElement('div');
          row.className = 'meld-item meld-item--other';
          var kind = document.createElement('span');
          kind.className = 'meld-kind';
          kind.textContent = '他家 ' + (MELD_NAMES[m.kind] || '副露');
          row.appendChild(kind);
          m.tiles.forEach(function (t) { row.appendChild(T.mini(t, { joker: opts.joker })); });
          side.appendChild(row);
        });
      }

      if (state.pond && state.pond.length) {
        var pondHead = document.createElement('div');
        pondHead.className = 'pond-head';
        pondHead.textContent = '牌河（' + state.pond.length + ' 張）';
        side.appendChild(pondHead);

        var pondRow = document.createElement('div');
        pondRow.className = 'pond-row';
        state.pond.forEach(function (t) { pondRow.appendChild(T.mini(t, { joker: opts.joker })); });
        side.appendChild(pondRow);
      }

      el.question.appendChild(side);
    }
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
      chip.appendChild(T.mini(w.tile, { joker: opts.joker }));
      var left = document.createElement('span');
      left.className = 'left';
      left.textContent = '×' + w.remaining;
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

  function discardRow(r, isBest, isPicked) {
    var row = document.createElement('div');
    row.className = 'row';
    if (isBest) row.classList.add('is-best');
    if (isPicked) row.classList.add('is-picked-row');

    var tileWrap = document.createElement('div');
    tileWrap.className = 'row-tile';
    var tile = T.make(r.discard, { joker: opts.joker });
    tile.disabled = true;
    tile.style.cursor = 'default';
    tileWrap.appendChild(tile);
    var label = document.createElement('small');
    if (isBest && isPicked) {
      label.textContent = '你打 ✓';
      label.classList.add('is-best-label');
    } else if (isBest) {
      label.textContent = '最佳';
      label.classList.add('is-best-label');
    } else if (isPicked) {
      label.textContent = '你打';
    } else {
      label.textContent = '打';
    }
    tileWrap.appendChild(label);

    var body = document.createElement('div');
    body.className = 'waits';
    body.appendChild(waitChips(r.tiles));
    if (r.pungs && r.pungs.length) body.appendChild(pungChips(r.pungs));

    var meta = document.createElement('div');
    meta.className = 'row-meta';
    meta.appendChild(shantenTag(r.shanten));
    if (r.refined) {
      var q = document.createElement('span');
      q.className = 'quality';
      q.textContent = '聽 ' + r.avgWaits;
      meta.appendChild(q);
    }
    var total = document.createElement('span');
    total.className = 'total';
    total.textContent = String(r.ukeire);
    var unit = document.createElement('small');
    unit.textContent = '張';
    total.appendChild(unit);
    meta.appendChild(total);

    row.appendChild(tileWrap);
    row.appendChild(body);
    row.appendChild(meta);
    return row;
  }

  function statText(r) {
    return r.shanten === 0 ? '聽牌、' + r.ukeire + ' 張有效牌' : r.shanten + ' 向聽、' + r.ukeire + ' 張有效牌';
  }

  function renderSteps(steps) {
    if (!steps.length) return null;
    var wrap = document.createElement('div');
    wrap.className = 'step-list';
    steps.forEach(function (st) {
      var row = document.createElement('div');
      row.className = 'step-item' + (st.isBest ? ' is-ok' : ' is-no');
      var head = document.createElement('span');
      head.className = 'step-label';
      head.textContent = steps.length > 1 ? '第 ' + st.step + ' 步' : '你揀';
      row.appendChild(head);

      var body = document.createElement('span');
      body.className = 'step-body';
      var pre = st.drawn >= 0 ? '摸 ' + M.tileLabel(st.drawn) + '，' : '';
      if (st.kong !== undefined && st.kong !== null) {
        body.innerHTML = pre + '暗槓 <b>' + M.tileLabel(st.kong) + '</b> ' + (st.isBest ? '✓' : '✗');
      } else {
        var why = st.isBest ? '✓'
          : st.missedKong >= 0 ? '✗（應先暗槓 ' + M.tileLabel(st.missedKong) + '）'
            : '✗（應打 ' + M.tileLabel(st.best.discard) + '）';
        body.innerHTML = pre + '打 <b>' + M.tileLabel(st.picked) + '</b> ' + why;
      }
      row.appendChild(body);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function renderAnswer() {
    el.answerPanel.hidden = false;
    el.answerPanel.innerHTML = '';

    var steps = state.steps || [];
    var last = steps.length ? steps[steps.length - 1] : null;
    var allBest = steps.length > 0 && steps.every(function (st) { return st.isBest; });
    var anyWrong = steps.some(function (st) { return !st.isBest; });

    var card = document.createElement('div');
    card.className = 'best-card verdict' +
      (allBest ? ' is-correct' : anyWrong ? ' is-wrong' : '');

    var bests = bestList();
    var bestNames = bests.length > 4
      ? bests.slice(0, 3).map(function (r) { return M.tileLabel(r.discard); }).join('、') + ' 等 ' + bests.length + ' 隻'
      : bests.map(function (r) { return M.tileLabel(r.discard); }).join(' 或 ');
    var best = state.data.results[0];

    var h3 = document.createElement('h3');
    if (allBest) {
      h3.textContent = (steps.length > 1 ? '✅ 兩步都啱' : '✅ 答啱喇') +
        (bests.length > 1 ? '（有 ' + bests.length + ' 隻一樣好）' : '');
    } else if (anyWrong) {
      h3.textContent = steps.length > 1 ? '❌ 有一步唔係最好' : '❌ 呢隻唔係最好';
    } else {
      h3.textContent = '答案';
    }

    var line = document.createElement('div');
    line.className = 'best-line';
    var text = document.createElement('div');
    text.className = 'best-text';

    var firstWrong = null;
    for (var wi = 0; wi < steps.length; wi++) {
      if (!steps[wi].isBest) { firstWrong = steps[wi]; break; }
    }

    if (firstWrong && firstWrong.missedKong >= 0) {
      text.innerHTML = '有槓應該先槓：暗槓 <strong>' + M.tileLabel(firstWrong.missedKong) +
        '</strong>（槓有錢收），補一隻再揀打邊隻。';
    } else if (firstWrong && firstWrong.kong !== undefined && firstWrong.kong !== null) {
      text.innerHTML = '第 <strong>' + firstWrong.step + '</strong> 步：暗槓 <strong>' +
        M.tileLabel(firstWrong.kong) + '</strong> 之後向聽反而差咗，應該打 <strong>' +
        M.tileLabel(best.discard) + '</strong>。';
    } else if (steps.length > 1 && firstWrong) {
      var ps = firstWrong.pickedStat || { shanten: 0, ukeire: 0 };
      text.innerHTML = '第 <strong>' + firstWrong.step + '</strong> 步：你打 <strong>' +
        M.tileLabel(firstWrong.picked) + '</strong>（' + ps.shanten + ' 向聽、' + ps.ukeire + ' 張）' +
        '，應打 <strong>' + M.tileLabel(firstWrong.best.discard) + '</strong>（' +
        statText(firstWrong.best) + '）。';
    } else if (steps.length > 1 && !firstWrong) {
      text.innerHTML = '兩步都揀啱：' + statText(best) + '。';
    } else if (anyWrong && last) {
      var pickedRes = findResult(last.picked) || best;
      text.innerHTML = '你打 <strong>' + M.tileLabel(last.picked) + '</strong>：' + statText(pickedRes) +
        '。<br>建議打 <strong>' + bestNames + '</strong>：' + statText(best) + '。';
    } else if (bests.length > 1) {
      text.innerHTML = '打 <strong>' + bestNames + '</strong> 都一樣好：' + statText(best) + '。';
    } else if (best.tenpai) {
      text.innerHTML = '打 <strong>' + bestNames + '</strong>，聽 ' +
        best.tiles.length + ' 種 <strong>' + best.ukeire + ' 張</strong>。';
    } else {
      text.innerHTML = '打 <strong>' + bestNames + '</strong>：' + statText(best) + '。';
    }

    line.appendChild(text);
    card.appendChild(h3);
    card.appendChild(line);

    var stepList = renderSteps(steps);
    if (stepList) card.appendChild(stepList);

    if (best.tenpai && best.tiles.length) {
      var waits = document.createElement('div');
      waits.className = 'waits';
      waits.appendChild(waitChips(best.tiles));
      card.appendChild(waits);
    }

    el.answerPanel.appendChild(card);

    // 全部打法
    var rows = document.createElement('div');
    rows.className = 'rows';
    var chosen = bestSet();
    state.data.results.slice(0, 8).forEach(function (r) {
      rows.appendChild(discardRow(r, !!chosen[r.discard], r.discard === state.picked));
    });
    el.answerPanel.appendChild(rows);

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'primary';
    next.textContent = '下一手 →';
    next.addEventListener('click', nextHand);
    el.answerPanel.appendChild(next);
  }

  function renderAll() {
    renderHeader();
    renderQuestion();
  }

  /* ---------------- 流程 ---------------- */

  function findResult(tile) {
    for (var i = 0; i < state.data.results.length; i++) {
      if (state.data.results[i].discard === tile) return state.data.results[i];
    }
    return null;
  }

  function onPick(tile) {
    if (state.answered || !state.data) return;
    var picked = findResult(tile);
    if (!picked) return;

    // 有得暗槓就應該先槓（槓有錢收）
    var missedKong = -1;
    (state.data.kongOptions || []).forEach(function (k) {
      if (missedKong < 0 && k.shanten <= state.data.results[0].shanten) missedKong = k.tile;
    });
    var isBest = missedKong >= 0 ? false : !!bestSet()[tile];

    stats.total += 1;
    if (isBest) {
      stats.correct += 1;
      stats.streak += 1;
      if (stats.streak > stats.best) stats.best = stats.streak;
    } else {
      stats.streak = 0;
    }
    saveStats();

    state.steps.push({
      step: state.step,
      picked: tile,
      isBest: isBest,
      best: state.data.results[0],
      pickedStat: { shanten: picked.shanten, ukeire: picked.ukeire },
      missedKong: missedKong,
      drawn: state.drawn
    });

    // 兩向聽：揀完仲要摸一隻再揀多次
    if (state.step === 1 && state.data.results[0].shanten === 2) {
      var drawn = drawTile(state.hand);
      if (drawn >= 0) {
        var nextHand = state.hand.slice();
        nextHand[tile] -= 1;
        nextHand[drawn] += 1;
        state.hand = nextHand;
        state.drawn = drawn;
        state.step = 2;
        state.data = analyzeHand(nextHand);
        el.hint.textContent = '摸到 ' + M.tileLabel(drawn) + '，再揀一隻打。';
        renderAll();
        return;
      }
    }

    state.answered = true;
    state.picked = tile;
    el.hint.textContent = '撳「下一手」繼續。';
    renderAll();
    renderAnswer();
  }

  function onKong(tile) {
    if (state.answered || !state.data) return;
    var ko = null;
    (state.data.kongOptions || []).forEach(function (k) { if (k.tile === tile) ko = k; });
    if (!ko) return;

    var bestShanten = state.data.results[0].shanten;
    var isBest = ko.shanten <= bestShanten;

    stats.total += 1;
    if (isBest) {
      stats.correct += 1;
      stats.streak += 1;
      if (stats.streak > stats.best) stats.best = stats.streak;
    } else {
      stats.streak = 0;
    }
    saveStats();

    state.steps.push({
      step: state.step,
      kong: tile,
      isBest: isBest,
      best: { discard: tile, shanten: ko.shanten, ukeire: ko.ukeire, tiles: [] },
      drawn: state.drawn
    });

    // 執行暗槓：四張入副露，補一隻
    state.hand[tile] -= 4;
    state.melds = (state.melds || []).concat([{ kind: 'kong', tiles: [tile, tile, tile, tile] }]);
    var drawn = drawTile(state.hand);
    if (drawn >= 0) {
      state.hand[drawn] += 1;
      state.drawn = drawn;
    }
    state.step += 1;
    state.data = analyzeHand(state.hand);
    el.hint.textContent = '暗槓 ' + M.tileLabel(tile) + '，補一隻之後再揀打邊隻。';
    renderAll();
  }

  function skip() {
    if (state.answered || !state.data) return;
    state.answered = true;
    state.picked = -1;
    el.hint.textContent = '撳「下一手」繼續。';
    renderAll();
    renderAnswer();
  }

  function nextHand() {
    var cand = generate();
    if (!cand) return;

    var extra = makePond(cand);

    state.hand = cand.hand;
    state.melds = cand.melds;
    state.pond = extra.pond;
    state.otherMelds = extra.otherMelds;
    state.seen = seenCounts();
    state.step = 1;
    state.steps = [];
    state.drawn = -1;
    state.data = analyzeHand(cand.hand);
    state.answered = false;
    state.picked = -1;
    state.round += 1;

    el.answerPanel.hidden = true;
    el.answerPanel.innerHTML = '';
    el.hint.textContent = '撳你會打嘅嗰隻牌。';
    renderAll();
  }

  /* ---------------- 初始化 ---------------- */

  el.difficulty.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-level]') : null;
    if (!btn) return;
    opts.level = btn.getAttribute('data-level');
    Array.prototype.forEach.call(el.difficulty.children, function (b) {
      b.classList.toggle('is-on', b === btn);
    });
    nextHand();
  });

  el.optMelds.addEventListener('change', function () {
    opts.melds = el.optMelds.checked;
    nextHand();
  });

  el.optJoker.addEventListener('change', function () {
    opts.joker = el.optJoker.checked;
    el.jokerBadge.classList.toggle('is-off', !opts.joker);
    el.jokerBadge.textContent = opts.joker ? '紅中百搭' : '中＝普通牌';
    nextHand();
  });

  el.optChiitoi.addEventListener('change', function () {
    opts.chiitoi = el.optChiitoi.checked;
    nextHand();
  });

  el.optNoHonors.addEventListener('change', function () {
    opts.noHonors = el.optNoHonors.checked;
    nextHand();
  });

  (function stampBuild() {
    var foot = document.querySelector('.foot');
    if (!foot || foot.querySelector('.build')) return;
    var s = document.createElement('p');
    s.className = 'build';
    s.textContent = '版本 ' + BUILD;
    foot.appendChild(s);
  })();

  el.newBtn.addEventListener('click', nextHand);
  el.skipBtn.addEventListener('click', skip);

  // 單頁模式：唔喺載入時就出題（計算器用戶唔需要），第一次切去練習 tab 才開始
  var started = false;
  window.MJPracticeView = {
    start: function () {
      if (started) return;
      started = true;
      nextHand();
    }
  };
})();
