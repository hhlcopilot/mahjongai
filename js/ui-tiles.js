/*!
 * 共用牌面元件（計算器同練習頁一齊用）
 * 牌面圖：tiles/tile-00.png … tile-33.png（由真實牌面圖裁出，點陣圖）
 */
(function (root) {
  'use strict';

  var M = root.MahjongCore;
  var SUIT_CLASS = ['m', 'p', 's', 'z'];
  var IMG_VERSION = '73';

  function imgPath(tile) {
    return 'tiles/tile-' + (tile < 10 ? '0' : '') + tile + '.png?v=' + IMG_VERSION;
  }

  // 用 <img> 顯示牌面；aria-label 由外層按鈕提供
  function svg(tile) {
    return '<img class="tile-img" src="' + imgPath(tile) + '" alt="" aria-hidden="true" draggable="false">';
  }

  function make(tile, options) {
    var opts = options || {};
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.dataset.tile = String(tile);
    btn.setAttribute('aria-label', M.tileLabel(tile));
    btn.innerHTML = svg(tile);
    if (tile === M.JOKER && opts.joker !== false) btn.classList.add('is-joker');
    return btn;
  }

  function mini(tile, options) {
    var opts = options || {};
    var span = document.createElement('span');
    span.className = 'mini-tile';
    if (tile === M.JOKER && opts.joker !== false) span.classList.add('joker');
    span.innerHTML = svg(tile);
    return span;
  }

  root.TileUI = {
    make: make,
    mini: mini,
    svg: svg,
    suitClass: function (tile) { return SUIT_CLASS[M.tileSuit(tile)]; }
  };
})(typeof self !== 'undefined' ? self : this);
