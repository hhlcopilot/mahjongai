/*!
 * 麻雀實戰 — 遊戲核心（純邏輯，唔掂 DOM，可以喺 Node 直接測試）
 *
 * 規則：香港麻將 13 張、4 人、冇上牌（只可以碰／槓／食糊），紅中百搭。
 * 座位：0 = 你（莊家先手）、1 = 下家、2 = 對家、3 = 上家；出牌次序 0 → 1 → 2 → 3 → 0。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mahjong.js'));
  } else {
    root.MahjongBattle = factory(root.MahjongCore);
  }
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var TILES = M.TILES;
  var JOKER = M.JOKER;
  var SEAT_NAME = ['你', '下家', '對家', '上家'];

  /* ---------------- 洗牌 ---------------- */

  function rngFrom(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function buildWall(opts, rng) {
    var pool = [];
    for (var t = 0; t < TILES; t++) {
      if (opts.noHonors && t >= 27 && t !== JOKER) continue;
      for (var i = 0; i < 4; i++) pool.push(t);
    }
    for (var k = pool.length - 1; k > 0; k--) {
      var j = (rng() * (k + 1)) | 0;
      var tmp = pool[k];
      pool[k] = pool[j];
      pool[j] = tmp;
    }
    return pool;
  }

  /* ---------------- 建立牌局 ---------------- */

  function newGame(options) {
    var o = { joker: true, chiitoi: false, noHonors: false, tsumoOnly: false, seed: (Math.random() * 4294967296) >>> 0 };
    options = options || {};
    for (var k in options) {
      if (Object.prototype.hasOwnProperty.call(options, k)) o[k] = options[k];
    }

    var rng = rngFrom(o.seed);
    var wall = buildWall(o, rng);
    var hands = [M.zeros(), M.zeros(), M.zeros(), M.zeros()];
    for (var r = 0; r < 13; r++) {
      for (var s = 0; s < 4; s++) hands[s][wall.pop()] += 1;
    }

    var g = {
      opts: o,
      wall: wall,
      hands: hands,
      melds: [[], [], [], []],
      discards: [[], [], [], []],
      seat: 0,
      phase: 'discard', // 'discard' = 呢家要打牌；'claim' = 等緊人食糊／碰／槓；'over' = 完
      lastDiscard: null,
      lastDraw: null,
      fromClaim: false, // true = 啱啱碰完／明槓完（冇摸牌），唔可以自摸
      turnCount: 1,
      result: null,
      // 每局統計（給結算摘要用）
      stats: {
        discards: [0, 0, 0, 0], // 打牌張數
        pongs: [0, 0, 0, 0],    // 碰幾多次
        kongs: [0, 0, 0, 0]     // 槓幾多次（明槓／暗槓／補槓）
      }
    };

    var first = wall.pop();
    hands[0][first] += 1;
    g.lastDraw = { seat: 0, tile: first };
    return g;
  }

  /* ---------------- 小工具 ---------------- */

  /** 係咪正常摸牌後嘅打牌階段（唔係啱啱碰完多一隻嘅狀況） */
  function isNormalTurn(g, seat) {
    return g.phase === 'discard' && g.seat === seat && M.sum(g.hands[seat]) === drawnSize(g, seat);
  }

  function handTotal(g, seat) {
    return M.sum(g.hands[seat]);
  }

  function meldTiles(meld) {
    var n = meld.kind === 'kong' ? 4 : 3;
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(meld.tile);
    return arr;
  }

  function meldsForAnalyze(g, seat) {
    return g.melds[seat].map(function (m) {
      return { kind: m.kind, tiles: meldTiles(m) };
    });
  }

  /** 呢個座位「睇得到」嘅牌（所有牌河 + 其他座位嘅副露） */
  function seenFor(g, seat) {
    var s = M.zeros();
    for (var i = 0; i < 4; i++) {
      var river = g.discards[i];
      for (var d = 0; d < river.length; d++) s[river[d]] += 1;
      if (i === seat) continue; // 自己副露另外用 melds 扣
      var ms = g.melds[i];
      for (var m = 0; m < ms.length; m++) {
        var tiles = meldTiles(ms[m]);
        for (var t = 0; t < tiles.length; t++) s[tiles[t]] += 1;
      }
    }
    return s;
  }

  /**
   * 啱啱碰完（冇摸牌）：手牌本身可能已經係「完整一手」，但唔可以食糊，必須打一隻。
   * 引擎會當佢係食糊，所以呢種情況要自己逐隻試打，砌返一份同格式嘅結果。
   */
  function claimTurnResults(g, seat, hand, melds) {
    var opts = { joker: g.opts.joker, chiitoi: g.opts.chiitoi, melds: melds };
    var seen = seenFor(g, seat);
    var out = [];
    for (var t = 0; t < TILES; t++) {
      if (!hand[t]) continue;
      var h = hand.slice();
      h[t] -= 1;
      var r = M.analyze(h, seen, opts);
      var top = r.results && r.results[0];
      if (!top) continue;
      out.push({
        discard: t,
        shanten: top.shanten,
        tenpai: top.shanten === 0,
        winning: false,
        tiles: top.tiles || [],
        pungs: top.pungs || [],
        ukeire: top.ukeire || 0,
        waitSum: top.waitSum || 0,
        avgWaits: top.avgWaits || 0,
        refined: !!top.refined,
        score: top.score || 0,
        breaksKong: hand[t] === 4
      });
    }
    out.sort(function (a, b) {
      return a.shanten - b.shanten ||
        (a.breaksKong ? 1 : 0) - (b.breaksKong ? 1 : 0) ||
        b.score - a.score ||
        b.ukeire - a.ukeire ||
        a.discard - b.discard;
    });
    return { results: out };
  }

  function analyzeSeat(g, seat, hand, melds) {
    var h = hand || g.hands[seat];
    var ms = melds || meldsForAnalyze(g, seat);
    // 碰完之後：手牌張數啱（drawn），但唔可以食糊 → 要逐隻試打
    if (seat === g.seat && g.fromClaim && M.sum(h) === 14 - 3 * ms.length) {
      return claimTurnResults(g, seat, h, ms);
    }
    return M.analyze(h, seenFor(g, seat), {
      joker: g.opts.joker,
      chiitoi: g.opts.chiitoi,
      melds: ms
    });
  }

  /** 呢個座位而家嘅向聽（13 張為基準，-1 = 已經食得） */
  function seatShanten(g, seat) {
    var r = analyzeSeat(g, seat);
    return r.results.length ? r.results[0].shanten : 99;
  }

  /** 手牌（連埋擬摸／擬食嗰隻）嘅向聽 */
  function shantenOfHand(g, hand, melds) {
    var base = hand.slice();
    var jk = 0;
    if (g.opts.joker) {
      jk = base[JOKER];
      base[JOKER] = 0;
    }
    var memo = Object.create(null);
    var mc = (melds || []).length;
    var s = M.standardShanten(base, jk, memo, mc);
    if (g.opts.chiitoi && mc === 0) {
      var c = M.chiitoiShanten(base, jk);
      if (c < s) s = c;
    }
    return s;
  }

  /** 呢個座位「打牌階段」正常應該有幾多張手牌 */
  function drawnSize(g, seat) {
    return 14 - 3 * g.melds[seat].length;
  }

  /** 加多一隻（食糊／摸牌）之後係咪食得 */
  function canWin(g, seat, extra) {
    var isRon = typeof extra === 'number' && extra >= 0;
    var h = g.hands[seat].slice();
    if (isRon) h[extra] += 1;
    // 一定要「完整一手」先可以食糊
    if (M.sum(h) !== 14 - 3 * g.melds[seat].length) return false;
    // 自摸一定要係摸牌返嚟：碰完／明槓完（冇摸牌）唔可以即刻食糊，要打一隻先
    if (!isRon && g.fromClaim && g.seat === seat) return false;
    return shantenOfHand(g, h, g.melds[seat]) === -1;
  }

  /* ---------------- 打牌／摸牌 ---------------- */

  function discard(g, seat, tile) {
    if (g.phase !== 'discard' || g.seat !== seat) return false;
    if (!g.hands[seat][tile]) return false;
    g.hands[seat][tile] -= 1;
    g.discards[seat].push(tile);
    g.stats.discards[seat] += 1;
    g.lastDiscard = { seat: seat, tile: tile };
    g.phase = 'claim';
    return true;
  }

  function drawFor(g, seat) {
    if (!g.wall.length) {
      g.phase = 'over';
      g.result = { type: 'draw' };
      return null;
    }
    var tile = g.wall.pop();
    g.hands[seat][tile] += 1;
    g.fromClaim = false; // 摸咗牌 → 可以自摸（包括槓上開花）
    g.seat = seat;
    g.phase = 'discard';
    g.lastDraw = { seat: seat, tile: tile };
    g.turnCount += 1;
    return tile;
  }

  /** 冇人食／碰 → 下一家摸牌 */
  function nextTurn(g) {
    var from = g.lastDiscard ? g.lastDiscard.seat : g.seat;
    return drawFor(g, (from + 1) % 4);
  }

  /* ---------------- 碰／槓／食糊 ---------------- */

  function claimOptions(g, seat, tile) {
    var out = [];
    if (seat === g.lastDiscard.seat) return out;
    // 「只許自摸」：人哋打出嘅牌唔可以食（出銃唔算）
    if (!g.opts.tsumoOnly && canWin(g, seat, tile)) out.push('hu');
    var n = g.hands[seat][tile] || 0;
    if (n >= 3) out.push('kong');
    if (n >= 2) out.push('pong');
    return out;
  }

  /** 由打牌者嘅下家開始，逐家問（食糊優先睇最接近嗰家） */
  function claimQueue(g) {
    var out = [];
    if (!g.lastDiscard) return out;
    for (var d = 1; d <= 3; d++) {
      var seat = (g.lastDiscard.seat + d) % 4;
      var options = claimOptions(g, seat, g.lastDiscard.tile);
      if (options.length) out.push({ seat: seat, options: options });
    }
    return out;
  }

  function takeFromRiver(g, fromSeat) {
    var river = g.discards[fromSeat];
    if (river.length && river[river.length - 1] === g.lastDiscard.tile) river.pop();
  }

  function applyHu(g, seat, extra) {
    g.phase = 'over';
    var type = typeof extra === 'number' && extra >= 0 && g.lastDiscard && g.lastDiscard.seat !== seat ? 'ron' : 'tsumo';
    g.result = {
      type: type,
      seat: seat,
      tile: typeof extra === 'number' ? extra : -1,
      from: type === 'ron' ? g.lastDiscard.seat : -1
    };
    return g.result;
  }

  function applyPong(g, seat, tile) {
    if ((g.hands[seat][tile] || 0) < 2) return false;
    g.hands[seat][tile] -= 2;
    g.melds[seat].push({ kind: 'pong', tile: tile });
    g.stats.pongs[seat] += 1;
    takeFromRiver(g, g.lastDiscard.seat);
    g.lastDiscard = null;
    g.lastDraw = null; // 碰完冇摸牌，畫面唔應該再標「啱啱摸到」
    g.fromClaim = true; // 碰完冇摸牌 → 唔可以自摸，必須打一隻
    g.seat = seat;
    g.phase = 'discard';
    return true;
  }

  function applyKong(g, seat, tile) {
    if ((g.hands[seat][tile] || 0) < 3) return false;
    g.hands[seat][tile] -= 3;
    g.melds[seat].push({ kind: 'kong', tile: tile });
    g.stats.kongs[seat] += 1;
    takeFromRiver(g, g.lastDiscard.seat);
    g.lastDiscard = null;
    g.seat = seat;
    drawFor(g, seat); // 槓完補一隻
    return true;
  }

  /** 手上四張相同 → 可以暗槓 */
  function concealedKongOptions(g, seat) {
    var out = [];
    for (var t = 0; t < TILES; t++) {
      if ((g.hands[seat][t] || 0) === 4) out.push(t);
    }
    return out;
  }

  function applyConcealedKong(g, seat, tile) {
    if ((g.hands[seat][tile] || 0) !== 4) return false;
    g.hands[seat][tile] -= 4;
    g.melds[seat].push({ kind: 'kong', tile: tile, concealed: true });
    g.stats.kongs[seat] += 1;
    g.seat = seat;
    g.phase = 'discard';
    drawFor(g, seat);
    return true;
  }

  /** 已經碰咗，手上仲有第四隻 → 可以補槓（加槓） */
  function addedKongOptions(g, seat) {
    var out = [];
    var ms = g.melds[seat];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].kind === 'pong' && (g.hands[seat][ms[i].tile] || 0) >= 1) out.push(ms[i].tile);
    }
    return out;
  }

  function applyAddedKong(g, seat, tile) {
    if ((g.hands[seat][tile] || 0) < 1) return false;
    var meld = null;
    var ms = g.melds[seat];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].kind === 'pong' && ms[i].tile === tile) { meld = ms[i]; break; }
    }
    if (!meld) return false;
    g.hands[seat][tile] -= 1;
    meld.kind = 'kong';
    meld.added = true;
    g.stats.kongs[seat] += 1;
    g.seat = seat;
    g.phase = 'discard';
    drawFor(g, seat); // 補槓一樣要補一隻
    return true;
  }

  /* ---------------- AI ---------------- */

  /**
   * AI 打邊隻：用效率引擎排序，但喺「分數差 5% 內當一樣好」嗰堆入面隨機揀一隻。
   * 咁樣唔會隻隻都同一個最優解（似真人），牌局亦唔會快到離譜；強度基本唔變。
   */
  function aiDiscard(g, seat) {
    var r = analyzeSeat(g, seat);
    var list = (r.results || []).filter(function (x) { return x.discard >= 0; });
    if (!list.length) return -1;
    var best = list[0];
    var pool = list.filter(function (x) { return M.sameEfficiency(best, x); });
    var pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : best;
    return pick.discard;
  }

  /** AI 要唔要食／碰／槓 */
  function aiDecideClaim(g, seat, tile, options) {
    options = options || claimOptions(g, seat, tile);
    if (options.indexOf('hu') >= 0) return 'hu';

    var before = seatShanten(g, seat);
    var melds = g.melds[seat];

    function shantenAfter(removeCount, kind) {
      var h = g.hands[seat].slice();
      h[tile] -= removeCount;
      var fake = melds.concat([{ kind: kind, tile: tile }]);
      var r = M.analyze(h, seenFor(g, seat), {
        joker: g.opts.joker,
        chiitoi: g.opts.chiitoi,
        melds: fake.map(function (m) { return { kind: m.kind, tiles: meldTiles(m) }; })
      });
      return r.results.length ? r.results[0].shanten : 99;
    }

    if (options.indexOf('kong') >= 0) {
      // 槓完會補一隻，用「少三張」嘅基準同打牌前比較
      var afterKong = shantenAfter(3, 'kong');
      if (afterKong < before) return 'kong';
    }
    if (options.indexOf('pong') >= 0) {
      if (shantenAfter(2, 'pong') < before) return 'pong';
    }
    return null;
  }

  return {
    SEAT_NAME: SEAT_NAME,
    JOKER: JOKER,
    newGame: newGame,
    handTotal: handTotal,
    drawnSize: drawnSize,
    isNormalTurn: isNormalTurn,
    meldTiles: meldTiles,
    meldsForAnalyze: meldsForAnalyze,
    seenFor: seenFor,
    analyzeSeat: analyzeSeat,
    seatShanten: seatShanten,
    shantenOfHand: shantenOfHand,
    canWin: canWin,
    discard: discard,
    drawFor: drawFor,
    nextTurn: nextTurn,
    claimOptions: claimOptions,
    claimQueue: claimQueue,
    applyHu: applyHu,
    applyPong: applyPong,
    applyKong: applyKong,
    concealedKongOptions: concealedKongOptions,
    applyConcealedKong: applyConcealedKong,
    addedKongOptions: addedKongOptions,
    applyAddedKong: applyAddedKong,
    aiDiscard: aiDiscard,
    aiDecideClaim: aiDecideClaim,
    rngFrom: rngFrom
  };
});
