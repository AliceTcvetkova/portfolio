(function () {
  function isGold(r, g, b) {
    if (r < 165 || g < 110 || b > 130) return false;
    if (r - b < 70) return false;
    if (g - b < 25) return false;
    if (r + g > 380 && r > g && g > b) return true;
    return r > 190 && g > 130 && b < 95;
  }

  function cleanGoldLines(img) {
    if (!img || !img.naturalWidth || img.dataset.locusGoldCleaned === "1") return;

    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    var mask = new Uint8Array(w * h);

    for (var i = 0; i < w * h; i++) {
      var o = i * 4;
      if (isGold(data[o], data[o + 1], data[o + 2])) mask[i] = 1;
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x;
        if (!mask[idx]) continue;
        var rs = 0;
        var gs = 0;
        var bs = 0;
        var n = 0;
        for (var dy = -3; dy <= 3; dy++) {
          for (var dx = -3; dx <= 3; dx++) {
            if (!dx && !dy) continue;
            var nx = x + dx;
            var ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var ni = ny * w + nx;
            if (mask[ni]) continue;
            var no = ni * 4;
            rs += data[no];
            gs += data[no + 1];
            bs += data[no + 2];
            n++;
          }
        }
        if (!n) continue;
        var o = idx * 4;
        data[o] = (rs / n) | 0;
        data[o + 1] = (gs / n) | 0;
        data[o + 2] = (bs / n) | 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    try {
      img.src = canvas.toDataURL("image/png");
      img.dataset.locusGoldCleaned = "1";
    } catch (e) {
      /* ignore canvas export errors */
    }
  }

  window.LOCUS_ROOM_IMAGE = {
    cleanGoldLines: cleanGoldLines
  };
})();
