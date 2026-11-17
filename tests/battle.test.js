/*!
 * 麻雀實戰核心測試（Node 直接跑：node tests/battle.test.js）
 */
'use strict';

const assert = require('assert');
const M = require('../js/mahjong.js');
const B = require('../js/battle.js');

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail += 1;
    console.log('  ✗ ' + name);
    console.log('    ' + (e && e.message));
  }
}

const IDX = {
  '1m': 0, '2m': 1, '3m': 2, '4m': 3, '5m': 4, '6m': 5, '7m': 6, '8m': 7, '9m': 8,
  '1p': 9, '2p': 10, '3p': 11, '4p': 12, '5p': 13, '6p': 14, '7p': 15, '8p': 16, '9p': 17,
  '1s': 18, '2s': 19, '3s': 20, '4s': 21, '5s': 22, '6s': 23, '7s': 24, '8s': 25, '9s': 26,
  '1z': 27, '2z': 28, '3z': 29, '4z': 30, '5z': 31, '6z': 32, '7z': 33
};

function counts(str) {
  const c = M.zeros();
  str.trim().split(/\s+/).forEach((k) => { c[IDX[k]] += 1; });
  return c;
}

console.log('\n建立牌局');

check('四家各 13 張，莊家（你）摸多一隻', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  assert.strictEqual(B.handTotal(g, 0), 14, '莊家 14 張');
  assert.strictEqual(B.handTotal(g, 1), 13);
  assert.strictEqual(B.handTotal(g, 2), 13);
  assert.strictEqual(B.handTotal(g, 3), 13);
  assert.strictEqual(g.wall.length, 136 - 53, '牌牆剩 83 張');
  assert.strictEqual(g.phase, 'discard');
  assert.strictEqual(g.seat, 0);
});

check('每種牌最多四張', () => {
  const g = B.newGame({ joker: true, seed: 7 });
  for (let t = 0; t < M.TILES; t++) {
    let n = g.wall.filter((x) => x === t).length + g.discards.flat().filter((x) => x === t).length;
    for (let s = 0; s < 4; s++) n += g.hands[s][t];
    assert.ok(n <= 4, M.tileLabel(t) + ' 超過四張');
  }
});

check('同一個 seed 會發同一副牌', () => {
  const a = B.newGame({ joker: true, seed: 2024 });
  const b = B.newGame({ joker: true, seed: 2024 });
  assert.deepStrictEqual(a.hands, b.hands);
});

check('走番子：唔會出東南西北發白', () => {
  const g = B.newGame({ joker: true, noHonors: true, seed: 99 });
  for (let s = 0; s < 4; s++) {
    for (let t = 27; t < M.TILES; t++) {
      if (t === M.JOKER) continue;
      assert.strictEqual(g.hands[s][t], 0, M.tileLabel(t) + ' 唔應該出現');
    }
  }
  assert.strictEqual(g.wall.length, 112 - 53, '112 張（27 種 × 4 + 4 張中）');
});

console.log('\n打牌／摸牌');

check('打牌會入牌河，並等緊人食／碰', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  const tile = g.hands[0].findIndex((n) => n > 0);
  const before = g.hands[0][tile];
  assert.ok(B.discard(g, 0, tile));
  assert.strictEqual(g.hands[0][tile], before - 1, '手牌少一張');
  assert.strictEqual(B.handTotal(g, 0), 13);
  assert.deepStrictEqual(g.discards[0], [tile]);
  assert.strictEqual(g.phase, 'claim');
  assert.deepStrictEqual(g.lastDiscard, { seat: 0, tile: tile });
});

check('摸牌會入手牌，並轉做打牌階段', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  B.discard(g, 0, g.hands[0].findIndex((n) => n > 0));
  const tile = B.nextTurn(g);
  assert.strictEqual(typeof tile, 'number');
  assert.strictEqual(g.seat, 1);
  assert.strictEqual(g.phase, 'discard');
  assert.strictEqual(B.handTotal(g, 1), 14);
});

check('牌牆摸完 = 流局', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.wall = [];
  assert.strictEqual(B.drawFor(g, 1), null);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.result.type, 'draw');
});

console.log('\n食糊');

check('四副 + 一隻中：加任何一隻都食得（單吊百搭）', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  g.melds[0] = [];
  assert.strictEqual(B.handTotal(g, 0), 13);
  [0, 13, 26, 30, 32].forEach((t) => {
    assert.ok(B.canWin(g, 0, t), '加 ' + M.tileLabel(t) + ' 應該食得');
  });
});

check('打到 14 張（已食糊）唔會當可以再食', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  assert.ok(B.canWin(g, 0, 13));
  g.hands[0][13] += 1; // 而家 14 張
  assert.strictEqual(B.shantenOfHand(g, g.hands[0], []), -1, '14 張應該係 -1');
});

check('差一隻先叫糊：唔算食得', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 2z 4z');
  assert.strictEqual(B.canWin(g, 0, 13), false);
});

console.log('\n碰／槓／食糊優先');

check('手上兩張，人哋打出可以碰', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[1] = counts('5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z 2z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  const opts = B.claimOptions(g, 1, 13);
  assert.ok(opts.indexOf('pong') >= 0, '應該可以碰');
});

check('碰完會開副露、手牌少兩張、由碰嘅人打牌', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[1] = counts('5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z 2z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  assert.ok(B.applyPong(g, 1, 13));
  assert.strictEqual(B.handTotal(g, 1), 11);
  assert.deepStrictEqual(g.melds[1], [{ kind: 'pong', tile: 13 }]);
  assert.deepStrictEqual(g.discards[0], [], '打出的牌要由牌河拎走');
  assert.strictEqual(g.seat, 1);
  assert.strictEqual(g.phase, 'discard');
});

check('明槓：手牌少三張、補一隻、副露變槓', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[1] = counts('5p 5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  assert.ok(B.claimOptions(g, 1, 13).indexOf('kong') >= 0, '三張可以槓');
  const wallBefore = g.wall.length;
  assert.ok(B.applyKong(g, 1, 13));
  assert.strictEqual(g.wall.length, wallBefore - 1, '槓完要補一隻');
  assert.strictEqual(B.handTotal(g, 1), 11, '13 - 3 + 1 = 11');
  assert.strictEqual(g.melds[1][0].kind, 'kong');
  assert.strictEqual(g.phase, 'discard');
});

check('暗槓：手上四張，補一隻，副露係暗槓', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('5p 5p 5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z');
  assert.deepStrictEqual(B.concealedKongOptions(g, 0), [13]);
  assert.ok(B.applyConcealedKong(g, 0, 13));
  assert.strictEqual(g.hands[0][13], 0);
  assert.strictEqual(g.melds[0][0].concealed, true);
  assert.strictEqual(B.handTotal(g, 0), 11, '14 - 4 + 1 = 11');
});

check('食糊優先過碰：claimQueue 會列出食得嗰家先', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  // 下家（1）差一隻 5筒食糊，對家（2）有兩隻 5筒可以碰
  g.hands[1] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  g.hands[2] = counts('5p 5p 1s 2s 3s 6s 7s 8s 2z 3z 4z 6z 7z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  const q = B.claimQueue(g);
  assert.strictEqual(q[0].seat, 1, '最接近打牌者嗰家先');
  assert.ok(q[0].options.indexOf('hu') >= 0, '下家可以食糊');
  const huSeat = q.find((c) => c.options.indexOf('hu') >= 0).seat;
  assert.strictEqual(huSeat, 1);
});

check('只許自摸：人哋打出嘅牌唔可以食糊', () => {
  const g = B.newGame({ joker: true, tsumoOnly: true, seed: 42 });
  // 下家差一隻 5筒食糊
  g.hands[1] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  assert.strictEqual(B.claimOptions(g, 1, 13).indexOf('hu'), -1, '只許自摸：唔應該俾出銃食');
  assert.strictEqual(B.claimQueue(g).length, 0, '冇人可以食／碰');
  // 但自己摸到就食得
  g.hands[1][13] += 1;
  assert.ok(B.canWin(g, 1, -1), '自摸應該食得');
});

check('唔係只許自摸：出銃可以食糊', () => {
  const g = B.newGame({ joker: true, tsumoOnly: false, seed: 42 });
  g.hands[1] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  assert.ok(B.claimOptions(g, 1, 13).indexOf('hu') >= 0, '出銃可以食');
});

check('碰完清走 lastDraw（畫面唔會再標「啱啱摸到」）', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[1] = counts('5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z 2z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  g.lastDraw = { seat: 1, tile: 20 };
  assert.ok(B.applyPong(g, 1, 13));
  assert.strictEqual(g.lastDraw, null);
});

check('補槓：碰咗又有第四隻就可以升級做槓', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('5p 5p 5p 5p 1m 2m 3m 4s 5s 6s 8s 8s 9s 1z');
  g.melds[0] = [{ kind: 'pong', tile: 13 }]; // 已經碰咗 5筒，手上仲有一隻
  g.seat = 0;
  g.phase = 'discard';
  assert.deepStrictEqual(B.addedKongOptions(g, 0), [13], '應該可以補槓 5筒');
  const wallBefore = g.wall.length;
  assert.ok(B.applyAddedKong(g, 0, 13));
  assert.strictEqual(g.melds[0][0].kind, 'kong', '副露要變槓');
  assert.strictEqual(g.melds[0][0].added, true, '要記住係補槓');
  assert.strictEqual(g.hands[0][13], 3, '手上少一隻');
  assert.strictEqual(g.wall.length, wallBefore - 1, '補槓要補一隻');
  assert.strictEqual(g.phase, 'discard', '補完即刻打牌');
});

check('冇第四隻／已經係槓就唔可以補槓', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[0] = counts('1m 2m 3m 4s 5s 6s 8s 8s 9s 1z 2z 3z 4z');
  g.melds[0] = [{ kind: 'pong', tile: 13 }]; // 碰咗 5筒，但手上冇第四隻
  assert.deepStrictEqual(B.addedKongOptions(g, 0), [], '手上冇第四隻');
  assert.strictEqual(B.applyAddedKong(g, 0, 13), false);

  const g2 = B.newGame({ joker: true, seed: 42 });
  g2.hands[0] = counts('5p 1m 2m 3m 4s 5s 6s 8s 8s 9s 1z 2z'); // 有第四隻 5筒
  g2.melds[0] = [{ kind: 'kong', tile: 13 }]; // 但副露已經係槓
  assert.deepStrictEqual(B.addedKongOptions(g2, 0), [], '已經係槓唔可以再補');
});

check('補槓補到食糊牌可以自摸（槓上開花）', () => {
  const g = B.newGame({ joker: true, tsumoOnly: true, seed: 42 });
  // 碰咗 5筒；手上 11 張 = 123萬 456索 789索 東 + 第四隻 5筒
  g.hands[0] = counts('1m 2m 3m 4s 5s 6s 7s 8s 9s 1z 5p');
  g.melds[0] = [{ kind: 'pong', tile: 13 }];
  assert.strictEqual(B.handTotal(g, 0), 11);
  // 牌牆最尾（會補到嗰隻）放一隻東 → 補槓後 東東 做眼即食糊
  g.wall = [0, 0, 0, 27];
  assert.ok(B.applyAddedKong(g, 0, 13));
  assert.strictEqual(g.lastDraw.tile, 27, '補到東');
  assert.strictEqual(B.handTotal(g, 0), 11, '11 - 1 + 1 = 11');
  assert.ok(B.canWin(g, 0, -1), '槓上開花');
});

console.log('\n碰完唔可以即刻食糊（回歸測試）');

check('碰完手牌雖然係「完整一手」，但唔可以自摸食糊', () => {
  const g = B.newGame({ joker: false, noHonors: true, tsumoOnly: true, seed: 2 });
  // 你 13 張：123萬 456筒 789索 東東 7索7索（等碰／食）
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 7s 7s');
  g.seat = 1;
  g.phase = 'discard';
  g.hands[1] = counts('1p 1p 2p 3p 4p 5p 6p 8p 8p 9p 9p 2z 3z 7s');
  B.discard(g, 1, 24); // 下家打 7索
  assert.ok(B.applyPong(g, 0, 24));
  assert.strictEqual(B.handTotal(g, 0), 11, '碰完 11 張');
  assert.strictEqual(g.fromClaim, true, '要記住呢手係碰返嚟');
  assert.strictEqual(B.canWin(g, 0, -1), false, '碰完唔可以自摸食糊');
});

check('碰完仍然有打牌建議（唔會走去食糊）', () => {
  const g = B.newGame({ joker: false, noHonors: true, tsumoOnly: true, seed: 2 });
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 7s 7s');
  g.seat = 1;
  g.phase = 'discard';
  g.hands[1] = counts('1p 1p 2p 3p 4p 5p 6p 8p 8p 9p 9p 2z 3z 7s');
  B.discard(g, 1, 24);
  B.applyPong(g, 0, 24);
  const r = B.analyzeSeat(g, 0);
  assert.ok(r.results.length > 0, '要列到打牌選擇');
  assert.ok(r.results[0].discard >= 0, '建議要係一隻真牌');
  assert.ok(g.hands[0][r.results[0].discard] > 0, '建議打嘅牌要喺手上');
  const t = B.aiDiscard(g, 0);
  assert.ok(t >= 0 && g.hands[0][t] > 0, 'AI 亦要打牌，唔可以當食糊');
});

check('碰完打一隻、再摸到食糊牌 → 可以自摸', () => {
  const g = B.newGame({ joker: false, noHonors: true, tsumoOnly: true, seed: 2 });
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 7s 7s');
  g.seat = 1;
  g.phase = 'discard';
  g.hands[1] = counts('1p 1p 2p 3p 4p 5p 6p 8p 8p 9p 9p 2z 3z 7s');
  B.discard(g, 1, 24);
  B.applyPong(g, 0, 24);
  B.discard(g, 0, 27);                 // 打東 → 單吊東
  g.wall = [0, 0, 27];                 // pop() 由尾攞 → 摸東
  B.drawFor(g, 0);
  assert.strictEqual(g.fromClaim, false, '摸牌後要清 fromClaim');
  assert.strictEqual(B.canWin(g, 0, -1), true, '摸到食糊牌應該可以自摸');
});

check('碰完之後 14 張局面唔會被當成食糊（張數檢查）', () => {
  const g = B.newGame({ joker: false, noHonors: true, tsumoOnly: true, seed: 3 });
  // 手牌多一隻（模擬不正常狀態）→ 唔可以當食糊
  g.hands[0] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 7s 7s 8m');
  g.melds[0] = [];
  g.seat = 0;
  g.phase = 'discard';
  assert.strictEqual(B.canWin(g, 0, -1), false, '13 張唔可以自摸');
});

console.log('\n每局統計');

check('會統計打牌／碰／槓次數', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  assert.deepStrictEqual(g.stats.discards, [0, 0, 0, 0]);

  B.discard(g, 0, g.hands[0].findIndex((n) => n > 0));
  assert.strictEqual(g.stats.discards[0], 1, '打牌要計數');

  // 碰
  g.hands[1] = counts('5p 5p 1m 2m 3m 4s 5s 6s 7s 8s 9s 1z 2z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  B.applyPong(g, 1, 13);
  assert.strictEqual(g.stats.pongs[1], 1, '碰要計數');

  // 補槓
  g.hands[1][13] += 1;
  g.seat = 1;
  g.phase = 'discard';
  B.applyAddedKong(g, 1, 13);
  assert.strictEqual(g.stats.kongs[1], 1, '補槓要計數');

  // 暗槓
  g.hands[2] = counts('7s 7s 7s 7s 1m 2m 3m 4p 5p 6p 8p 8p 9p 1z');
  B.applyConcealedKong(g, 2, 24);
  assert.strictEqual(g.stats.kongs[2], 1, '暗槓要計數');
});

console.log('\nAI');

check('AI 打嘅牌一定喺自己手牌入面', () => {
  for (let i = 0; i < 30; i++) {
    const g = B.newGame({ joker: true, seed: 1000 + i });
    for (let turn = 0; turn < 12 && g.phase !== 'over'; turn++) {
      if (g.phase === 'discard') {
        const seat = g.seat;
        const t = B.aiDiscard(g, seat);
        assert.ok(t >= 0 && g.hands[seat][t] > 0, 'AI 打咗手上冇嘅牌');
        B.discard(g, seat, t);
      } else if (g.phase === 'claim') {
        const q = B.claimQueue(g);
        const hu = q.find((c) => c.options.indexOf('hu') >= 0);
        if (hu) { B.applyHu(g, hu.seat, g.lastDiscard.tile); break; }
        const take = q.length ? B.aiDecideClaim(g, q[0].seat, g.lastDiscard.tile, q[0].options) : null;
        if (take === 'pong') B.applyPong(g, q[0].seat, g.lastDiscard.tile);
        else if (take === 'kong') B.applyKong(g, q[0].seat, g.lastDiscard.tile);
        else B.nextTurn(g);
      }
    }
  }
});

check('AI 見到食糊一定食', () => {
  const g = B.newGame({ joker: true, seed: 42 });
  g.hands[1] = counts('1m 2m 3m 4p 5p 6p 7s 8s 9s 1z 1z 1z 5z');
  g.lastDiscard = { seat: 0, tile: 13 };
  g.discards[0] = [13];
  assert.strictEqual(B.aiDecideClaim(g, 1, 13), 'hu');
});

check('AI 唔會亂碰（拆散手牌唔會碰）', () => {
  const g = B.newGame({ joker: false, seed: 42 });
  // 一副完整 123 456 789 萬 + 一座搭子，碰咗會蝕
  g.hands[1] = counts('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 5p 5p');
  g.hands[1][13] -= 1; // 13 張
  g.lastDiscard = { seat: 0, tile: 12 };
  g.discards[0] = [12];
  const decide = B.aiDecideClaim(g, 1, 12, ['pong']);
  assert.notStrictEqual(decide, 'pong', '唔應該為咗碰而拆好牌');
});

console.log('\n' + pass + ' 項測試全部通過' + (fail ? '，' + fail + ' 項失敗' : ''));
if (fail) process.exit(1);
