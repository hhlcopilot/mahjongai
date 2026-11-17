/*!
 * 麻雀聽牌效率計算核心
 * 香港麻將 13 張，支援「紅中百搭」（中 = 百搭牌），可扣減已見牌。
 * 手牌以 34 種牌計數表示：0-8 萬、9-17 筒、18-26 索、27-33 東南西北中發白。
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.MahjongCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TILES = 34;
  var JOKER = 31; // 中
  var PUNG_WEIGHT = 0.6; // 可以碰嘅對子，額外加權（三家都可能打出）
  // 手上有百搭（中）時，碰更值錢：碰完之後好大機會變成「單吊中」，
  // 而單吊百搭＝34 種牌任何一隻都食糊，所以對子要再加重。
  var JOKER_PUNG_WEIGHT = 1.2;
  var SAME_RATIO = 0.95;   // 分數相差 5% 以內，當同一個級數（唔好雞蛋裡挑骨頭）
  var SUIT_TEXT = ['萬', '筒', '索'];
  var HONOR_TEXT = ['東', '南', '西', '北', '中', '發', '白'];

  function tileLabel(i) {
    if (i < 27) return (i % 9 + 1) + SUIT_TEXT[(i / 9) | 0];
    return HONOR_TEXT[i - 27];
  }

  function tileSuit(i) {
    return i < 27 ? (i / 9) | 0 : 3;
  }

  function tileNumber(i) {
    return i < 27 ? (i % 9) + 1 : i - 26;
  }

  function zeros() {
    var a = new Array(TILES);
    for (var i = 0; i < TILES; i++) a[i] = 0;
    return a;
  }

  function toCounts(source) {
    var a = zeros();
    if (!source) return a;
    for (var i = 0; i < TILES && i < source.length; i++) a[i] = source[i] || 0;
    return a;
  }

  function sum(a) {
    var s = 0;
    for (var i = 0; i < TILES; i++) s += a[i] || 0;
    return s;
  }

  // 只保留不被支配的 (副數, 搭子數, 眼) 組合
  function prune(states) {
    var seen = Object.create(null);
    var list = [];
    for (var i = 0; i < states.length; i++) {
      var s = states[i];
      var k = s[0] * 100 + s[1] * 10 + s[2];
      if (seen[k]) continue;
      seen[k] = 1;
      list.push(s);
    }
    var out = [];
    for (var a = 0; a < list.length; a++) {
      var x = list[a];
      var dominated = false;
      for (var b = 0; b < list.length; b++) {
        if (a === b) continue;
        var y = list[b];
        if (y[0] >= x[0] && y[1] >= x[1] && y[2] >= x[2] &&
            (y[0] > x[0] || y[1] > x[1] || y[2] > x[2])) {
          dominated = true;
          break;
        }
      }
      if (!dominated) out.push(x);
    }
    return out;
  }

  /**
   * 標準形（4 副 + 1 眼）向聽數。
   * @param {number[]} hand 34 種牌計數（不含百搭）
   * @param {number} jokers 百搭張數
   * @param {object} memo 跨計算共用的記憶表（可省略）
   */
  function standardShanten(hand, jokers, memo, meldCount) {
    var counts = hand.slice(0);
    var cache = memo || Object.create(null);
    var open = meldCount || 0;
    var allowed = 4 - open;

    function dfs(i, jk) {
      if (i >= TILES) return [[0, 0, 0]];
      if (!counts[i]) return dfs(i + 1, jk);

      // 用數字雜湊做 key（比 slice().join() 快幾倍）
      var h = 0;
      for (var z = i; z < TILES; z++) h = (h * 5 + counts[z]) | 0;
      var key = (i * 8 + jk) + ':' + h;
      var cached = cache[key];
      if (cached) return cached;

      var out = [];

      function use(list, cost, dm, dt, dp) {
        if (jk < cost) return;
        var k;
        for (k = 0; k < list.length; k++) if (counts[list[k][0]] < list[k][1]) return;
        for (k = 0; k < list.length; k++) counts[list[k][0]] -= list[k][1];
        var sub = dfs(i, jk - cost);
        for (k = 0; k < list.length; k++) counts[list[k][0]] += list[k][1];
        for (k = 0; k < sub.length; k++) {
          out.push([sub[k][0] + dm, sub[k][1] + dt, sub[k][2] + dp]);
        }
      }

      var c = counts[i];
      var isSuit = i < 27;
      var pos = i % 9;

      // 刻子（補百搭）
      if (c >= 3) use([[i, 3]], 0, 1, 0, 0);
      if (c === 2 && jk >= 1) use([[i, 2]], 1, 1, 0, 0);
      if (c === 1 && jk >= 2) use([[i, 1]], 2, 1, 0, 0);

      // 順子（補百搭）
      if (isSuit && pos <= 6) {
        var has1 = counts[i + 1] > 0;
        var has2 = counts[i + 2] > 0;
        var cost = (has1 ? 0 : 1) + (has2 ? 0 : 1);
        var seq = [[i, 1]];
        if (has1) seq.push([i + 1, 1]);
        if (has2) seq.push([i + 2, 1]);
        use(seq, cost, 1, 0, 0);
      }

      // 眼
      if (c >= 2) use([[i, 2]], 0, 0, 0, 1);
      else if (jk >= 1) use([[i, 1]], 1, 0, 0, 1);

      // 搭子（對子）
      if (c >= 2) use([[i, 2]], 0, 0, 1, 0);
      else if (jk >= 1) use([[i, 1]], 1, 0, 1, 0);

      // 搭子（兩面 / 邊張 / 嵌張）
      if (isSuit) {
        if (pos <= 7) {
          if (counts[i + 1] > 0) use([[i, 1], [i + 1, 1]], 0, 0, 1, 0);
          else if (jk >= 1) use([[i, 1]], 1, 0, 1, 0);
        }
        if (pos <= 6) {
          if (counts[i + 2] > 0) use([[i, 1], [i + 2, 1]], 0, 0, 1, 0);
          else if (jk >= 1) use([[i, 1]], 1, 0, 1, 0);
        }
      }

      // 閒置一張
      use([[i, 1]], 0, 0, 0, 0);

      var result = prune(out);
      cache[key] = result;
      return result;
    }

    var states = dfs(0, jokers);
    var best = 8;
    for (var s = 0; s < states.length; s++) {
      var m = states[s][0];
      var t = states[s][1];
      var p = states[s][2];
      if (m > allowed) continue;
      // 一副牌只有一個眼：四張相同唔可以當「兩個眼」，最多計一個
      var eye = p > 0 ? 1 : 0;
      var taatsu = Math.min(t, allowed - m);
      var value = 8 - 2 * (m + open) - taatsu - eye;
      if (value < best) best = value;
    }
    return best;
  }

  // 七對子向聽（預設不計，部分香港牌局有計）
  // 注意：單張之間唔可以互相成對，只可以同百搭配，或者兩隻百搭自己成對。
  function chiitoiShanten(hand, jokers) {
    var pairs = 0;
    var singles = 0;
    for (var i = 0; i < TILES; i++) {
      pairs += hand[i] >> 1;
      singles += hand[i] & 1;
    }
    var withSingles = Math.min(jokers, singles);
    var spare = jokers - withSingles;
    var possible = pairs + withSingles + (spare >> 1);
    if (possible > 7) possible = 7;
    return 6 - possible;
  }

  function makeShantenFn(opts, memo, meldCount) {
    var open = meldCount || 0;
    return function (hand, jokers) {
      var s = standardShanten(hand, jokers, memo, open);
      // 有副露就一定唔係七對子
      if (opts.chiitoi && open === 0) {
        var c = chiitoiShanten(hand, jokers);
        if (c < s) s = c;
      }
      return s;
    };
  }

  /**
   * 13 張聽牌手牌嘅和牌張數（百搭已抽出，另外用 jk 表示）。
   */
  function winTileCount(counts, jk, shantenOf, jokerOn) {
    var n = 0;
    for (var t = 0; t < TILES; t++) {
      var rem = 4 - (counts[t] || 0);
      if (rem <= 0) continue;
      if (t === JOKER && jokerOn) {
        if (shantenOf(counts, jk + 1) === -1) n += rem;
      } else {
        var c = counts.slice();
        c[t] += 1;
        if (shantenOf(c, jk) === -1) n += rem;
      }
    }
    return n;
  }

  /**
   * 14 張（已聽牌）手牌打邊隻之後，聽牌面最闊有幾多張。
   * 用嚟量度「進張之後嘅質素」——同樣係 1 向聽，聽 1 張同聽 20 張差好遠。
   */
  function bestWaits(counts14, jk, shantenOf, jokerOn) {
    var best = 0;
    for (var e = 0; e < TILES; e++) {
      if (!counts14[e]) continue;
      var h = counts14.slice();
      h[e] -= 1;
      var jk2 = jk;
      if (jokerOn && e === JOKER) jk2 += 1;
      if (shantenOf(h, jk2) !== 0) continue;
      var w = winTileCount(h, jk2, shantenOf, jokerOn);
      if (w > best) best = w;
    }
    return best;
  }

  /**
   * 評估 13 張手牌：向聽、有效牌（聽牌或進張）及剩餘張數。
   */
  function evaluate13(own, seen, opts, memo, meldCount, meldTiles, doRefine) {
    var jokerOn = opts.joker !== false;
    var jk = jokerOn ? own[JOKER] : 0;
    var open = meldCount || 0;

    // 百搭不參與拆牌，只當作可自由變身的張數
    var base = own.slice();
    if (jokerOn) base[JOKER] = 0;

    var shantenOf = makeShantenFn(opts, memo, open);
    var shanten = shantenOf(base, jk);
    // 手上有百搭時，碰嘅加權再高（碰完可以單吊中＝任何牌都食糊）
    var pungWeight = jokerOn && jk > 0 ? JOKER_PUNG_WEIGHT : PUNG_WEIGHT;

    var tiles = [];
    var pungs = [];
    var ukeire = 0;
    var waitSum = 0;   // 進張 × 之後聽幾多張
    var score = 0;     // waitSum，但可以碰嘅對子加權
    var refined = shanten === 1 && !!doRefine; // 得 1 向聽先需要睇「之後聽幾多張」

    if (shanten > -1) {
      for (var t = 0; t < TILES; t++) {
        var remaining = 4 - (own[t] || 0) - (meldTiles ? meldTiles[t] : 0) - (seen[t] || 0);
        if (remaining <= 0) continue;
        var next, c2, jk2;
        if (t === JOKER && jokerOn) {
          c2 = base;
          jk2 = jk + 1;
          next = shantenOf(c2, jk2);
        } else {
          c2 = base.slice();
          c2[t] += 1;
          jk2 = jk;
          next = shantenOf(c2, jk2);
        }
        var useful = shanten === 0 ? next === -1 : next < shanten;
        if (!useful) continue;

        tiles.push({ tile: t, remaining: remaining, gain: shanten - next });
        ukeire += remaining;

        var value = 1;
        if (refined && next === 0) value = bestWaits(c2, jk2, shantenOf, jokerOn);
        waitSum += remaining * value;

        // 手牌有一對就可以碰（紅中係百搭，唔當普通對子碰；已聽牌就唔講碰）
        var isPair = shanten >= 1 && !(t === JOKER && jokerOn) && (own[t] || 0) === 2;
        if (isPair) pungs.push({ tile: t, remaining: remaining });
        score += remaining * Math.sqrt(value) * (isPair ? (1 + pungWeight) : 1);
      }
    }

    return {
      shanten: shanten,
      tenpai: shanten === 0,
      winning: shanten === -1,
      tiles: tiles,
      pungs: pungs,
      ukeire: ukeire,
      waitSum: waitSum,
      avgWaits: ukeire ? Math.round((waitSum / ukeire) * 10) / 10 : 0,
      refined: refined,
      pungWeight: 1 + pungWeight,
      score: score
    };
  }

  /**
   * 主入口。
   * @param {number[]} ownCounts 手牌 34 種計數（含中）
   * @param {number[]} seenCounts 已見牌 34 種計數
   * @param {{joker?:boolean, chiitoi?:boolean}} options
   */
  function analyze(ownCounts, seenCounts, options) {
    var opts = options || {};
    var own = toCounts(ownCounts);
    var seen = toCounts(seenCounts);
    var melds = opts.melds || [];
    var meldCount = melds.length;
    var meldTiles = zeros();
    for (var mi = 0; mi < melds.length; mi++) {
      var mt = melds[mi].tiles || [];
      for (var mj = 0; mj < mt.length; mj++) meldTiles[mt[mj]] += 1;
    }
    var n = sum(own);
    var seenTotal = sum(seen);
    var memo = Object.create(null);
    var results = [];
    var ownTotal = n + sum(meldTiles);
    var unseen = Math.max(1, 136 - ownTotal - seenTotal);
    var drawn = 14 - 3 * meldCount;
    var waiting = drawn - 1;

    if (n === drawn) {
      // 先睇成手牌（連摸牌）係咪已經食得
      var jokerOn0 = opts.joker !== false;
      var jkAll = jokerOn0 ? own[JOKER] : 0;
      var whole = own.slice();
      if (jokerOn0) whole[JOKER] = 0;
      var wholeShanten = standardShanten(whole, jkAll, memo, meldCount);
      if (opts.chiitoi && meldCount === 0) {
        wholeShanten = Math.min(wholeShanten, chiitoiShanten(whole, jkAll));
      }
      if (wholeShanten === -1) {
        return {
          total: n,
          expectDrawn: drawn,
          expectWaiting: waiting,
          meldCount: meldCount,
          kongs: [],
          kongOptions: [],
          jokers: jkAll,
          seenTotal: seenTotal,
          unseen: unseen,
          results: [{
            discard: -1,
            shanten: -1,
            tenpai: false,
            winning: true,
            tiles: [],
            pungs: [],
            ukeire: 0,
            waitSum: 0,
            avgWaits: 0,
            refined: false,
            score: 0,
            unseen: unseen,
            winRate: 0
          }]
        };
      }

      for (var t = 0; t < TILES; t++) {
        if (!own[t]) continue;
        var hand = own.slice();
        hand[t] -= 1;
        var seen2 = seen.slice();
        seen2[t] += 1; // 打出的牌已離手，不能再摸
        var ev = evaluate13(hand, seen2, opts, memo, meldCount, meldTiles, false);
        ev.discard = t;
        ev.breaksKong = own[t] === 4; // 手上有四張，打走一隻就冇得暗槓
        ev.unseen = unseen;
        ev.winRate = ev.ukeire / ev.unseen;
        results.push(ev);
      }
      // 第二步：只針對「有效牌夠多」嘅 1 向聽打法，計埋之後嘅聽牌質素
      // （全部計會太慢，手機頂唔住；低於門檻嘅打法本身已經差好遠）
      var bestUkeire = 0;
      var minShanten = 99;
      for (var q = 0; q < results.length; q++) {
        if (results[q].shanten < minShanten) {
          minShanten = results[q].shanten;
          bestUkeire = results[q].ukeire;
        } else if (results[q].shanten === minShanten && results[q].ukeire > bestUkeire) {
          bestUkeire = results[q].ukeire;
        }
      }
      var threshold = Math.max(6, bestUkeire * 0.45);
      if (minShanten === 1) {
        for (var r = 0; r < results.length; r++) {
          var cr = results[r];
          if (cr.shanten !== 1 || cr.ukeire < threshold) continue;
          var handR = own.slice();
          handR[cr.discard] -= 1;
          var seenR = seen.slice();
          seenR[cr.discard] += 1;
          var fine = evaluate13(handR, seenR, opts, memo, meldCount, meldTiles, true);
          cr.waitSum = fine.waitSum;
          cr.avgWaits = fine.avgWaits;
          cr.refined = true;
          cr.score = fine.score;
        }
      }

      // 排序：向聽 → 分數（有效牌張數 × √入聽質素）→ 張數
      results.sort(function (a, b) {
        return a.shanten - b.shanten ||
          (a.breaksKong ? 1 : 0) - (b.breaksKong ? 1 : 0) ||
          b.score - a.score ||
          b.ukeire - a.ukeire ||
          b.tiles.length - a.tiles.length ||
          a.discard - b.discard;
      });
    } else if (n === waiting) {
      var single = evaluate13(own, seen, opts, memo, meldCount, meldTiles);
      single.discard = -1;
      single.unseen = unseen;
      single.winRate = single.ukeire / single.unseen;
      results.push(single);
    }

    var kongs = [];
    var kongOptions = [];
    for (var kt = 0; kt < TILES; kt++) {
      if ((own[kt] || 0) < 4) continue;
      kongs.push({ tile: kt, count: own[kt] });
      // 暗槓之後：四張入副露，補一隻再打（手牌少 4 張、副露 +1）
      if (n === drawn) {
        var kh = own.slice();
        kh[kt] -= 4;
        var kMeld = zeros();
        for (var km = 0; km < melds.length; km++) {
          (melds[km].tiles || []).forEach(function (x) { kMeld[x] += 1; });
        }
        kMeld[kt] += 4;
        var kev = evaluate13(kh, seen, opts, memo, meldCount + 1, kMeld, false);
        kongOptions.push({
          tile: kt,
          shanten: kev.shanten,
          ukeire: kev.ukeire,
          tiles: kev.tiles
        });
      }
    }

    return {
      total: n,
      expectDrawn: drawn,
      expectWaiting: waiting,
      meldCount: meldCount,
      kongs: kongs,
      kongOptions: kongOptions,
      jokers: opts.joker !== false ? own[JOKER] : 0,
      seenTotal: seenTotal,
      unseen: unseen,
      results: results
    };
  }

  /**
   * 兩隻打法係咪「一樣好」：同向聽，而且質素分相差 8% 以內。
   * 用嚟避免「37 張 vs 36 張」呢類微差都判錯。
   */
  function sameEfficiency(a, b) {
    if (!a || !b) return false;
    if (a.shanten !== b.shanten) return false;
    var hi = Math.max(a.score || 0, b.score || 0);
    var lo = Math.min(a.score || 0, b.score || 0);
    if (hi <= 0) return (a.ukeire || 0) === (b.ukeire || 0);
    return lo / hi >= SAME_RATIO;
  }

  return {
    TILES: TILES,
    JOKER: JOKER,
    tileLabel: tileLabel,
    tileSuit: tileSuit,
    tileNumber: tileNumber,
    zeros: zeros,
    sum: sum,
    standardShanten: standardShanten,
    meldTilesOf: function (melds) {
      var a = zeros();
      (melds || []).forEach(function (m) {
        (m.tiles || []).forEach(function (t) { a[t] += 1; });
      });
      return a;
    },
    chiitoiShanten: chiitoiShanten,
    sameEfficiency: sameEfficiency,
    analyze: analyze
  };
});
