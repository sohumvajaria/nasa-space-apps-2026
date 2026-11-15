// Earth Jukebox: the shared NASA GIBS layer definitions, used by every page.
// Each layer is a colorized GIBS image. We turn each pixel's legend color back into a position along that
// layer's own legend (0..1, using the real GIBS colormap), then into a calibrated "level" with per-layer
// anchors, so every layer's tiers (light, moderate, heavy, extreme...) land on clearly different sounds.
//
//   id        GIBS layer id               semis   interval of the layer's second note above the root
//   wave      its oscillator type         trem    shimmer rate (Hz) and tremDepth (0..1)
//   bright    how far its filter opens    home    fixed center {lat, lon}, or null to auto-find the peak
//   tiers     short words (index 0 = nothing, 1..4 = rising)         say   full spoken phrases
//   anchors   [legend position, level] pairs     ramp   the legend colors, low -> high, as hex RGB
(function () {
  'use strict';
  const LAYERS = {
    rain: {
      id: 'IMERG_Precipitation_Rate', dataset: 'GPM IMERG precipitation rate', noun: 'Rain', centerName: 'Storm center',
      blurb: 'Rain rate from the GPM IMERG satellites. A minor sixth rises above the center note and gets louder and brighter as the rain gets heavier.',
      semis: 8, wave: 'sawtooth', trem: 0, tremDepth: 0, bright: 5000, home: null, maxLat: 45,
      tiers: ['dry', 'light', 'moderate', 'heavy', 'extreme'],
      say: ['No rain here', 'Light rain', 'Moderate rain', 'Heavy rain', 'Extreme rain'],
      anchors: [[0, 0.08], [0.1, 0.25], [0.2, 0.45], [0.25, 0.62], [0.31, 0.8], [0.36, 0.9], [0.45, 1], [1, 1]],
      ramp: '00764e00784b007b48007e4500814200833e00863a008936008c32008e2e00912900942400971f00991a009c14009f0f00a20900a50303a70009aa0010ad0017b0001eb20026b5002db80035bb003dbd0045c0004ec30056c6005fc80068cb0072ce007bd10085d4008fd60099d900a3dc00aedf00b8e100c3e400cfe700daea00e6ec00efed00f2e600f5e000f7d900fad200fdca00ffc201ffb904ffb006ffa809ffa00cff980fff9011ff8814ff8117ff7a1aff731cff6c1fff6522ff5f25ff5927ff532aff4d2dff4730ff4233ff342cff2626ff2020ff1a1aff1313ff0d0dff0707ff0101fa0000f30000ed0000e70000e10000da0000d40000ce0000c80000c20000bb0000b50000af0000a90000a200009c00009600009000008a00008300007d00007700007100006a00006400005e00005800005200004b00004500003f0000390000330000b1faeeaefaefaaf9efa7f8f0a4f8f1a1f7f29ef6f39bf5f498f4f495f1f392eef28febf18ce7f089e4ef86e0ee84dded81d9ec7ed5ea7cd1e979cde876c9e674c5e571c1e46fbde26db8e16ab4df68b0dd66abdc63a7da61a2d85f9ed75d99d55b95d35990d1578ccf5587cd5383cb517ec94f7ac74d75c54f73c44d70c54c6dc64b6ac74a66c94963ca485fcb465ccc4558cd4454ce4350d0424cd14048d23f44d33e40d43f3dd5413cd7433bd84539d94838da4a37db4d36dc5035de5334df5632e05931e15c30e25f2fe4632ee5662de66a2be76a25e86a1fe86b19e96d14e96f12e57010e1720fdd740dd9750cd5770bd1780acc790ac77a0ac17a09bc7b09b77b09b27b09ac7a08a77a08a279089d78089877079276078d74078872068370067d6e06786c067369056e6605696305635e045d59045654044f4f044849034244033c3f03363a0330',
    },
    heat: {
      id: 'MODIS_Terra_Land_Surface_Temp_Day', dataset: 'MODIS Terra land surface temperature (day)', noun: 'Land heat', centerName: 'Hottest spot',
      blurb: 'How hot the ground is. A perfect fifth joins the center note with a fast shimmer that is faint over cold ground and burns bright over scorching land. Oceans are silent.',
      semis: 7, wave: 'triangle', trem: 6, tremDepth: 0.5, bright: 4500, home: null,
      tiers: ['no data', 'cold', 'mild', 'hot', 'scorching'],
      say: ['No land temperature here', 'Cold land', 'Mild land', 'Hot land', 'Scorching land'],
      anchors: [[0, 0.03], [0.5, 0.22], [0.62, 0.4], [0.75, 0.6], [0.9, 0.85], [1, 1]],
      ramp: 'c900ffc500ffc100ffbd00ffb900ffb500ffb100ffad00ffa900ffa500ffa100ff9d00ff9900ff9500ff9100ff8d00ff8900ff8500ff8100ff7d00ff7900ff7500ff7100ff6d00ff6900ff6500ff6100ff5d00ff5900ff5500ff5100ff4d00ff4900ff4500ff4100ff3d00ff3900ff3500ff3100ff2d00ff2900ff2500ff2100ff1d00ff1900ff1500ff1100ff0d00ff0900ff0500ff0100ff000aff000fff0014ff001aff001fff0024ff0029ff002eff0033ff0038ff003dff0042ff0047ff004dff0052ff0057ff005cff0061ff0066ff006bff0070ff0075ff007aff0080ff0085ff008aff008fff0094ff0099ff009eff00a3ff00a8ff00adff00b3ff00b8ff00bdff00c2ff00c7ff00ccff00d1ff00d6ff00dbff00e0ff00e6ff00ebff00f0ff00f5ff00faff00ffff04fff70bffe60fffde12ffd516ffcd1affc41dffbc21ffb324ffab28ffa22cff9a2fff9133ff8937ff803aff783eff6f42ff6745ff5e49ff564dff4d50ff4554ff3c57ff345bff2b5fff2362ff1a66ff126aff096dff0171ff0075ff0078ff007cff0080ff0083ff0087ff008aff008eff0092ff0095ff0099ff009dff00a0ff00a4ff00a8ff00abff00afff00b3ff00b6ff00baff00bdff00c5ff00c8ff00ccff00d0ff00d3ff00d7ff00dbff00deff00e2ff00e6ff00e9ff00edff00f0ff00f4ff00f8ff00fbff00ffff00fffd00fffa00fff700fff400fff100ffee00ffeb00ffe800ffe500ffe200ffdf00ffdc00ffd900ffd600ffd300ffd000ffcd00ffca00ffc700ffc400ffc100ffbe00ffbb00ffb800ffb500ffb200ffaf00ffac00ffa900ffa600ffa300ffa000ff9d00ff9700ff9400ff9100ff8e00ff8b00ff8800ff8500ff8200ff7f00ff7c00ff7900ff7600ff7300ff7000ff6d00ff6a00ff6700ff6400ff6100ff5e00ff5b00ff5800ff5500ff5200ff4f00ff4c00ff4900ff4600ff4300ff4000ff3d00ff3a00ff3700ff3400ff3100ff2e00ff2b00ff2800ff2500ff2200ff1f00ff1c00ff1900ff1600ff1300ff1000ff0d00ff0a00ff0700ff0400ff0100',
    },
    plants: {
      id: 'MODIS_Terra_NDVI_8Day', dataset: 'MODIS Terra vegetation index (NDVI, 8-day)', noun: 'Greenness', centerName: 'Amazon center',
      blurb: 'How green and leafy the land is, centered on the Amazon. A major third swells slowly in and out, fuller where the forest is dense.',
      semis: 4, wave: 'triangle', trem: 0.35, tremDepth: 0.55, bright: 3500, home: { lat: -4, lon: -62 },
      tiers: ['no data', 'sparse', 'moderate', 'lush', 'dense'],
      say: ['No vegetation here', 'Sparse vegetation', 'Moderate vegetation', 'Lush vegetation', 'Dense vegetation'],
      anchors: [[0, 0.03], [0.3, 0.2], [0.5, 0.45], [0.7, 0.7], [0.9, 0.92], [1, 1]],
      ramp: 'f1ececf1ecedefe7e7efe7e8ece2e2ece2e3e2d8d8e2d8d9e1d9d4e1d9d5e0dad2e0dad3ddd5cbddd5cce5dbcde5dbcee1d2c5e1d2c6dfcec1dfcec2ddc9bcddc9bdd7c4b3d7c4b4d1c0abd1c0accdba9ecdba9fc8b5a5c8b5a6c0b096c0b097b9ab9bb9ab9cb4a595b4a596b09f8eb09f8fb09b89b09b8ab19883b19884b0957db0957eb09278b09279ac8d73ac8d74a9896ea9896fa58468a58469a18063a180649d7c5e9d7c5f9a6e599a6e5a965a46965a47bfde77bfde78b0cf68b0cf69a7cc4ba7cc4ca4c63da4c63ea0c030a0c03196ba2096ba218fb7158fb71687b30a87b30b80b00580b00678ad0078ad016eaa006eaa0164a60064a6015da3005da30156a10056a1015298005298015397005397014e94004e9401489000489001438d00438d013e8a003e8a013987003987013383003383012e80002e8001297d00297d012178002178011d75001d7501197300197301126e00126e010a69000a6901086700086701056400056401006400006401006000006001005a00005a01005400005401004800004801003c00003c01003600003601002400002401001800001801',
    },
    ocean: {
      id: 'GHRSST_L4_MUR_Sea_Surface_Temperature', dataset: 'GHRSST MUR sea surface temperature', noun: 'Sea heat', centerName: 'Warm pool center',
      blurb: 'Sea surface temperature, centered on the western Pacific warm pool. A perfect fourth drifts slowly in and out and gets warmer and louder as the water heats up. Land is silent.',
      semis: 5, wave: 'triangle', trem: 0.25, tremDepth: 0.4, bright: 3000, home: { lat: 5, lon: 150 },
      tiers: ['no data', 'cold', 'cool', 'warm', 'very warm'],
      say: ['No ocean data here', 'Cold water', 'Cool water', 'Warm water', 'Very warm water'],
      anchors: [[0, 0.03], [0.3, 0.06], [0.5, 0.25], [0.7, 0.5], [0.85, 0.8], [1, 1]],
      ramp: '2b001a2d001c30001f3300223500243800273b002b3f012e4201324501354801394b023d4e024151024555024958024d5b03515f035562035965035d6904616c046670056a73056e7606717806737906757a06777906777807777507757207746f07726b087067086e62086c5e08695a09675609655109634d0961490a5e450a5c410a5a3d0a58390a56350b54300b512c0b4f280b4d250c4c220d4b200e4b1e104d1e124e1e14511e16541e18571e1a5a1f1c5d1e1e601e21631f23661f25691f276c1f2a701f2c731f2e761f30791f327c1f357f1f3782203985203b88203d8b20408e20429120449420469721499b214b9e214ea12151a42254a72257aa235aad235db02460b32464b62567b9256abb266ebe2671c22775c52878c8287bcb297fce2982d12a85d42a88d72a8bda2b8edd2b92e02c95e32c98e62d9ce92e9fec2ea3ef2fa6f230aaf530acf42fadf02eaee82daede2badd029abbf27a8ab25a69823a48520a3711ea35d1ba54819a7351aaa251caf1720b30d26b7062dbb0137be0042c2004cc50057c90062cc006dcf0078d30083d7008eda0099de00a5e100b0e500bbe800c5ec00d0ef00dbf300e5f600edf700f3f700f8f500fcf300feef00ffea00ffe400ffdf00ffd900ffd400ffce00ffc900ffc400ffbf00ffb900ffb400ffaf00ffaa00ffa400ff9f00ff9900ff9400ff8e00ff8900ff8300fe7e00fd7a00fc7500fb7100fa6d00f86a00f66600f46200f25f00f05b00ee5700ec5300ea5000e84c00e64900e44500e24200e03e00de3b00dc3700da3300d83000d52d00d22a00ce2700ca2500c52200c02000bb1f00b51d00b01b00ab1900a61700a115009c14009712009110008c0e00870c00820a007c08007807007305006e03006b0200',
    },
    air: {
      id: 'MODIS_Terra_Aerosol', dataset: 'MODIS Terra aerosol optical depth', noun: 'Haze', centerName: 'Haziest spot',
      blurb: 'How much smoke, dust and haze is in the air. A tense tritone pulses unevenly, getting louder and harsher in thick haze.',
      semis: 6, wave: 'sawtooth', trem: 0.8, tremDepth: 0.6, bright: 2500, home: null,
      tiers: ['clear', 'light haze', 'moderate haze', 'heavy haze', 'thick smoke'],
      say: ['Clear air here', 'Light haze', 'Moderate haze', 'Heavy haze', 'Thick smoke or dust'],
      anchors: [[0, 0.03], [0.25, 0.2], [0.5, 0.45], [0.7, 0.7], [0.85, 0.9], [1, 1]],
      ramp: 'fffdcdfffcc7fffbc1fffabcfff9b7fff8b2fff7adfff6a7fff5a2fff49dfff398fff293fff090ffef8dffee8affec87ffeb84ffea81ffe87effe77bffe678ffe576ffe373ffe271ffe16effdf6cffde6affdd67ffdb65ffda62ffd960ffd85effd65bffd459ffd257ffd055ffcf53ffcd50ffcb4effc94cffc74affc648ffc346ffc144ffbe42ffbc40ffb93effb73cffb43affb238ffaf36ffad35ffaa33ffa832ffa531ffa32fffa12eff9e2dff9c2bff992aff9729ff9528ff9227ff9026ff8e25ff8c25ff8a24ff8723ff8523ff8322ff8121ff7f21ff7c20ff791fff761fff731eff701eff6d1dff6a1cff671cff641bff621bff5e1aff5b19ff5818ff5518ff5217ff4e16ff4b16ff4815ff4514ff4214fe3f13fd3c13fc3a12fb3712fa3512f93211f82f11f72d10f62a10f52810f3260ff2240ff0220eef200eee1e0dec1c0deb1a0ce9180ce8160be7140be5120be3110be1100bdf0e0bdd0d0bdb0c0bd90a0bd7090bd5080bd3070cd0060cce050ccc040cc9040cc7030dc5020dc2020dc0010dbe000dbc000eb8000eb5000eb2000eae000eab000ea8000ea4000ea1000e9e000e9b000e98000e95000e92000e8f000e8c000e89000e86000e83000e80000e7d000e',
    },
  };

  const ORDER = ['rain', 'heat', 'plants', 'ocean', 'air'];
  const ramps = {};
  function rampFor(key) {
    if (ramps[key]) return ramps[key];
    const str = LAYERS[key].ramp, rgb = [];
    for (let i = 0; i < str.length; i += 6) rgb.push([parseInt(str.substr(i, 2), 16), parseInt(str.substr(i + 2, 2), 16), parseInt(str.substr(i + 4, 2), 16)]);
    return (ramps[key] = { rgb, cache: new Map() });
  }
  function rampPos(R, r, g, b) {             // nearest legend color -> position 0..1 along the legend
    const k = (r << 16) | (g << 8) | b;
    let v = R.cache.get(k);
    if (v !== undefined) return v;
    let best = 0, bd = Infinity;
    for (let i = 0; i < R.rgb.length; i++) {
      const c = R.rgb[i], d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    v = best / (R.rgb.length - 1);
    R.cache.set(k, v);
    return v;
  }
  function levelOf(pos, anchors) {           // piecewise-linear through the layer's anchors
    if (pos <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      if (pos <= anchors[i][0]) {
        const [p0, l0] = anchors[i - 1], [p1, l1] = anchors[i];
        return l0 + (l1 - l0) * (pos - p0) / (p1 - p0);
      }
    }
    return anchors[anchors.length - 1][1];
  }
  const tierIndex = v => v < 0.03 ? 0 : v < 0.3 ? 1 : v < 0.55 ? 2 : v < 0.85 ? 3 : 4;

  window.EJ_LAYERS = LAYERS;
  window.EJ = { LAYERS, ORDER, rampFor, rampPos, levelOf, tierIndex };
})();
