'use strict';

const assert = require('assert');
const M = require('../js/mahjong.js');

// ---- 測試用嘅獨立實作（暴力驗證「和了」判斷） ----
function canFormMelds(counts, jokers) {
  let i = 0;
  while (i < 34 && counts[i] === 0) i++;
  if (i === 34) return jokers % 3 === 0; // 剩低嘅百搭要自己組成副
  const c = counts[i];
  // 刻子
  if (c >= 3) {
    counts[i] -= 3;
    if (canFormMelds(counts, jokers)) { counts[i] += 3; return true; }
    counts[i] += 3;
  }
  const useJ = Math.max(0, 3 - c);
  if (useJ <= jokers) {
    const back = c;
    counts[i] = 0;
    if (canFormMelds(counts, jokers - useJ)) { counts[i] = back; return true; }
    counts[i] = back;
  }
  // 順子
  if (i < 27 && i % 9 <= 6) {
    const have1 = counts[i + 1] > 0;
    const have2 = counts[i + 2] > 0;
    const need = (have1 ? 0 : 1) + (have2 ? 0 : 1);
    if (need <= jokers) {
      counts[i] -= 1;
      if (have1) counts[i + 1] -= 1;
      if (have2) counts[i + 2] -= 1;
      const ok = canFormMelds(counts, jokers - need);
      counts[i] += 1;
      if (have1) counts[i + 1] += 1;
      if (have2) counts[i + 2] += 1;
      if (ok) return true;
    }
  }
  return false;
}

function isWinning(hand, jokers) {
  const counts = hand.slice();
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      if (canFormMelds(counts, jokers)) { counts[i] += 2; return true; }
      counts[i] += 2;
    }
    if (counts[i] >= 1 && jokers >= 1) {
      counts[i] -= 1;
      if (canFormMelds(counts, jokers - 1)) { counts[i] += 1; return true; }
      counts[i] += 1;
    }
  }
  if (jokers >= 2 && canFormMelds(counts, jokers - 2)) return true;
  return false;
}

function isTenpai(hand, jokers) {
  const counts = hand.slice();
  for (let t = 0; t < 34; t++) {
    if (counts[t] >= 4) continue;
    if (t === 31) {
      if (isWinning(counts, jokers + 1)) return true;
    } else {
      counts[t] += 1;
      const ok = isWinning(counts, jokers);
      counts[t] -= 1;
      if (ok) return true;
    }
  }
  return false;
}

// ---- 手牌工具 ----
function makeHand(spec, jokers = 0) {
  const counts = M.zeros();
  for (const key of spec.split(' ')) {
    const m = key.match(/^(\d)([mpsz])$/);
    if (!m) throw new Error('bad tile: ' + key);
    const n = Number(m[1]);
    const suit = 'mpsz'.indexOf(m[2]);
    counts[suit * 9 + n - 1] += 1;
  }
  if (jokers) counts[31] += jokers;
  return counts;
}

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log('  ✓ ' + name);
}

console.log('基本向聽 / 聽牌');

check('4 副 + 單張 = 聽牌（單騎）', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p');
  const r = M.analyze(hand, null, { joker: false });
  assert.deepStrictEqual(r.results[0].shanten, 0);
  assert.deepStrictEqual(r.results[0].tiles.map(x => M.tileLabel(x.tile)), ['5筒']);
  assert.strictEqual(r.results[0].ukeire, 3);
});

check('兩面聽牌 12p 等 3p', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 9s 9s');
  const r = M.analyze(hand, null, { joker: false });
  const res = r.results[0];
  assert.strictEqual(res.shanten, 0);
  assert.deepStrictEqual(res.tiles.map(x => M.tileLabel(x.tile)), ['3筒']);
});

check('14 張：打走一隻閒張之後單騎聽牌', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p 9p');
  const r = M.analyze(hand, null, { joker: false });
  const best = r.results[0];
  assert.strictEqual(best.tenpai, true);
  assert.strictEqual(best.tiles.length, 1);
  assert.ok(['5筒', '9筒'].indexOf(M.tileLabel(best.tiles[0].tile)) >= 0);
  assert.strictEqual(best.ukeire, 3);
});

check('14 張已經齊晒 → 直接報「已食」', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p 5p');
  const r = M.analyze(hand, null, { joker: false });
  assert.strictEqual(r.results.length, 1);
  assert.strictEqual(r.results[0].winning, true);
  assert.strictEqual(r.results[0].shanten, -1);
});

check('七對子向聽：單張唔可以互相成對', () => {
  const junk13 = makeHand('1m 2m 3m 9m 9m 1p 2p 5p 7p 1s 3s 4s 7s');
  assert.strictEqual(M.chiitoiShanten(junk13, 0), 5);
  const junk14 = makeHand('1m 2m 3m 9m 9m 1p 2p 5p 7p 1s 3s 4s 7s 8s');
  assert.strictEqual(M.chiitoiShanten(junk14, 0), 5);
});

check('七對子向聽：6 對 + 1 單 = 聽牌，7 對 = 和', () => {
  assert.strictEqual(M.chiitoiShanten(makeHand('1m 1m 2m 2m 3m 3m 4m 4m 5m 5m 6m 6m 9m'), 0), 0);
  assert.strictEqual(M.chiitoiShanten(makeHand('1m 1m 2m 2m 3m 3m 4m 4m 5m 5m 6m 6m 9m 9m'), 0), -1);
});

check('七對子向聽：百搭配單張', () => {
  // 核心會將「中」抽出嚟做百搭，所以呢度只傳 12 張真牌 + 1 隻百搭
  assert.strictEqual(M.chiitoiShanten(makeHand('1m 1m 2m 2m 3m 3m 4m 4m 5m 5m 7m 9m'), 1), 0);
});

check('開啟七對子之後，普通牌唔會再變成 34 種聽牌', () => {
  const hand = makeHand('1m 2m 3m 9m 9m 1p 2p 5p 7p 1s 3s 4s 7s 8s');
  const r = M.analyze(hand, null, { joker: true, chiitoi: true });
  const top = r.results[0];
  assert.strictEqual(top.tenpai, false, '唔應該聽牌');
  assert.strictEqual(top.shanten, 2);
  assert.ok(top.tiles.length < 34);
});

check('13 張七對子聽牌（開啟選項）', () => {
  const hand = makeHand('1m 1m 3m 3m 5m 5m 7m 7m 9m 9m 2p 2p 4p');
  const r = M.analyze(hand, null, { joker: false, chiitoi: true });
  assert.strictEqual(r.results[0].shanten, 0);
});

console.log('\n紅中百搭');

check('百搭做眼：3 副 + 中中 + 89s = 聽牌', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7p 8p 9p 8s 9s', 2);
  // 11 張真牌 + 2 張中 = 13 張
  const r = M.analyze(hand, null, { joker: true });
  assert.strictEqual(r.results[0].shanten, 0, '應該已經聽牌');
});

check('百搭可以和任何牌（摸中都計）', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 1p 9s', 1);
  const r = M.analyze(hand, null, { joker: true });
  const res = r.results[0];
  assert.strictEqual(res.shanten, 0);
  assert.ok(res.tiles.some(x => x.tile === M.JOKER), '摸中（百搭）應該計和了');
});

console.log('\n隨機交叉驗證（對比暴力法）');

check('300 手隨機牌：聽牌判斷一致', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const jokers = k % 3 === 0 ? 0 : (k % 4 === 1 ? 1 : 2);
    const wall = [];
    for (let t = 0; t < 34; t++) {
      const n = t === 31 ? 4 - jokers : 4;
      for (let c = 0; c < n; c++) wall.push(t);
    }
    const counts = M.zeros();
    counts[31] = jokers;
    while (M.sum(counts) < 13) {
      const idx = Math.floor(rnd() * wall.length);
      const tile = wall.splice(idx, 1)[0];
      if (counts[tile] < 4) counts[tile] += 1;
    }
    const r = M.analyze(counts, null, { joker: true });
    const got = r.results[0].shanten === 0;
    const base = counts.slice();
    const jk = base[31];
    base[31] = 0;
    const expect = isTenpai(base, jk);
    assert.strictEqual(got, expect,
      '手牌 ' + counts.map((c, i) => c ? M.tileLabel(i).repeat(c) : '').join('') +
      ' 判斷不一致 got=' + got + ' expect=' + expect);
    checked++;
  }
  assert.strictEqual(checked, 300);
});

console.log('\n副露（碰／槓）');

check('1 副副露 + 10 張手牌 = 聽牌', () => {
  const melds = [{ kind: 'pong', tiles: [13, 13, 13] }]; // 碰 5筒
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9s 9s');
  const r = M.analyze(hand, null, { joker: true, melds: melds });
  const res = r.results[0];
  assert.strictEqual(r.expectWaiting, 10);
  assert.strictEqual(r.expectDrawn, 11);
  assert.strictEqual(res.shanten, 0);
  assert.deepStrictEqual(
    res.tiles.map(x => M.tileLabel(x.tile)).sort(),
    ['3萬', '6萬', '9萬', '中'].sort()
  );
});

check('1 副副露 + 11 張：打得最好嘅係孤張', () => {
  const melds = [{ kind: 'pong', tiles: [13, 13, 13] }];
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9s 9s 2s');
  const r = M.analyze(hand, null, { joker: true, melds: melds });
  const best = r.results[0];
  assert.strictEqual(best.shanten, 0);
  assert.strictEqual(M.tileLabel(best.discard), '2索');
  assert.deepStrictEqual(best.tiles.map(x => M.tileLabel(x.tile)).sort(), ['3萬', '6萬', '9萬', '中'].sort());
});

check('4 副副露：單張聽牌，對子即和', () => {
  const melds = [
    { kind: 'pong', tiles: [13, 13, 13] },
    { kind: 'chi', tiles: [0, 1, 2] },
    { kind: 'pong', tiles: [24, 24, 24] },
    { kind: 'kong', tiles: [9, 9, 9, 9] }
  ];
  const tenpai = M.analyze(makeHand('1z'), null, { joker: true, melds: melds }).results[0];
  assert.strictEqual(tenpai.shanten, 0);
  assert.deepStrictEqual(tenpai.tiles.map(x => M.tileLabel(x.tile)).sort(), ['中', '東'].sort());

  const won = M.analyze(makeHand('1z 1z'), null, { joker: true, melds: melds }).results[0];
  assert.strictEqual(won.winning, true);
});

check('副露張數會扣減剩餘張數', () => {
  const melds = [{ kind: 'pong', tiles: [13, 13, 13] }]; // 自己碰咗三張 5筒
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 5p 9s 9s');
  const r = M.analyze(hand, null, { joker: true, melds: melds });
  const row = r.results.find(x => x.discard === 13); // 打 5筒
  assert.ok(row, '應該可以打 5筒');
});

console.log('\n已見牌扣減');

check('已見牌會扣減剩餘張數', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p');
  const seen = M.zeros();
  seen[13] += 3; // 三張 5 筒已見
  const r = M.analyze(hand, seen, { joker: false });
  const res = r.results[0];
  assert.strictEqual(res.tiles.length, 0, '5 筒已見 3 張 + 手上 1 張 = 冇得摸');
  assert.strictEqual(res.ukeire, 0);
});

console.log('\n排序');

check('14 張：效率最高嘅打法排第一', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 9p');
  const r = M.analyze(hand, null, { joker: false });
  assert.strictEqual(r.results[0].shanten, 0);
  for (let i = 1; i < r.results.length; i++) {
    const prev = r.results[i - 1];
    const cur = r.results[i];
    assert.ok(prev.shanten <= cur.shanten, '向聽要遞增');
    if (prev.shanten === cur.shanten) {
      assert.ok(prev.score >= cur.score, '同向聽下質素分要遞減');
    }
  }
});


console.log('\n入聽質素／碰牌');

check('1 向聽：唔好淨係睇進張張數，要睇之後聽幾多張', () => {
  // 7萬8萬9萬 4筒 6筒6筒 8筒8筒 9筒 3索 7索8索 中中（14 張）
  const hand = makeHand('7m 8m 9m 4p 6p 6p 8p 8p 9p 3s 7s 8s 5z 5z');
  const r = M.analyze(hand, null, { joker: true });
  const byTile = {};
  r.results.forEach((x) => { byTile[M.tileLabel(x.discard)] = x; });
  assert.ok(byTile['8筒'].ukeire > byTile['9筒'].ukeire, '打 8 筒進張張數最多');
  assert.ok(byTile['8筒'].avgWaits < byTile['9筒'].avgWaits, '但打 8 筒入聽質素最差');
  assert.ok(r.results[0].discard !== 16, '唔應該再推薦打 8 筒');
});

check('1 向聽：對子會列出「可碰」', () => {
  const hand = makeHand('7m 8m 9m 4p 6p 6p 8p 8p 9p 3s 7s 8s 5z 5z');
  const r = M.analyze(hand, null, { joker: true });
  const best = r.results[0];
  const labels = best.pungs.map((p) => M.tileLabel(p.tile));
  assert.ok(labels.length > 0, '最佳打法應該有可碰嘅牌');
  assert.ok(labels.indexOf('6筒') >= 0, '手牌有一對 6 筒，應該可以碰');
  assert.strictEqual(labels.indexOf('中'), -1, '紅中係百搭，唔當普通對子碰');
});

check('手上有紅中（百搭）時，對子（碰）加權更高', () => {
  // 有中：碰完可以單吊中＝任何牌都食糊，所以碰更值錢
  const withJoker = M.analyze(makeHand('7m 8m 9m 4p 6p 6p 8p 8p 9p 3s 7s 8s 5z 5z'), null, { joker: true });
  assert.strictEqual(withJoker.results[0].pungWeight, 2.2, '手上有百搭：對子加權 ×2.2');
  // 冇中（百搭模式但手牌冇中）：照舊 ×1.6
  const noJoker = M.analyze(makeHand('7m 8m 9m 4p 6p 6p 8p 8p 9p 3s 7s 8s 9s 1z'), null, { joker: true });
  assert.strictEqual(noJoker.results[0].pungWeight, 1.6, '冇百搭：對子加權 ×1.6');
  // 熄咗百搭：×1.6
  const jokerOff = M.analyze(makeHand('7m 8m 9m 4p 6p 6p 8p 8p 9p 3s 7s 8s 5z 5z'), null, { joker: false });
  assert.strictEqual(jokerOff.results[0].pungWeight, 1.6, '熄百搭：對子加權 ×1.6');
});

check('有百搭又有幾多對：唔會叫你拆對子', () => {
  // 5m 6m6m 7m 2p 5p 6p6p 7p 2s 3s 5s 7s 中（1 向聽）
  const r = M.analyze(makeHand('5m 6m 6m 7m 2p 5p 6p 6p 7p 2s 3s 5s 7s 5z'), null, { joker: true });
  const best = r.results[0];
  assert.ok(best.pungs.length >= 2, '最佳打法應該保留兩個對子（可碰）');
  const pairTiles = best.pungs.map((p) => p.tile);
  assert.strictEqual(pairTiles.indexOf(best.discard), -1, '唔應該打走對子嘅牌');
});

check('已聽牌：唔會列「可碰」（碰會拆聽）', () => {
  const hand = makeHand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5s 5s');
  const r = M.analyze(hand, null, { joker: false });
  r.results.forEach((x) => {
    assert.strictEqual(x.pungs.length, 0, '聽牌時唔應該提示碰');
  });
});


console.log('\n四張相同（暗槓）');

check('四張相同唔可以當兩個眼（向聽唔會計少）', () => {
  // 三萬x4 + 五萬 + 4筒x2 + 1索x2 + 3索x2 + 4索x2
  const hand = makeHand('3m 3m 3m 3m 5m 4p 4p 1s 1s 3s 3s 4s 4s');
  const c = hand;
  const s = M.standardShanten(c.slice(), 0, Object.create(null), 0);
  assert.strictEqual(s, 2, '應該係 2 向聽');
});

check('有暗槓機會時，唔會叫你打走第四張', () => {
  const hand = makeHand('3m 3m 3m 3m 5m 5m 4p 4p 1s 1s 3s 3s 4s 4s');
  const r = M.analyze(hand, null, { joker: true });
  assert.strictEqual(r.results[0].breaksKong, false, '第一名唔應該係拆槓');
  assert.ok(r.kongs.length === 1 && M.tileLabel(r.kongs[0].tile) === '3萬', '要認得出可以暗槓三萬');
  const quadDiscard = r.results.filter((x) => x.breaksKong);
  assert.strictEqual(quadDiscard.length, 1);
  assert.strictEqual(r.results[r.results.length - 1].discard, quadDiscard[0].discard, '拆槓要排最後');
});


check('45555索：暗槓會蝕向聽，唔應該建議槓', () => {
  // 4索 5索x4 + 789萬 + 123筒 + 東南
  const hand = makeHand('4s 5s 5s 5s 5s 7m 8m 9m 1p 2p 3p 1z 2z 3z');
  const r = M.analyze(hand, null, { joker: true });
  assert.strictEqual(r.kongOptions.length, 1, '要認得可以暗槓 5索');
  const kong = r.kongOptions[0];
  const best = r.results[0];
  assert.ok(kong.shanten > best.shanten, '槓完向聽應該變差');
  assert.ok(M.tileLabel(kong.tile) === '5索');
});

console.log('\n' + pass + ' 項測試全部通過');
