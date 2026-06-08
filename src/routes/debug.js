/**
 * Debug routes for server-side rendering testing
 * Comprehensive test page with mock skins for all rendering scenarios
 */

const storage = require('../services/storage');
const nativeRenderer = require('../services/nativeRenderer');
const { sendJson, sendHtml, sendBinary } = require('../utils/response');

/**
 * Mock skin configurations for testing various rendering scenarios
 * Each skin tests specific rendering aspects (ordering, UV mapping, OIT, etc.)
 */
const MOCK_SKINS = {
  // Test 1: Basic face with beard (tests facialHair over face ordering)
  'beard-over-face': {
    name: 'Beard Over Face',
    description: 'Tests facialHair renders IN FRONT of face (zOffset ordering)',
    expectedBehavior: 'Beard should be visible, not hidden behind face',
    skin: {
      bodyCharacteristic: 'Regular.01',
      face: 'Face_Neutral',
      facialHair: 'Beard_Large.BrownDark',
      eyes: 'Medium_Eyes.Blue',
      eyebrows: 'Medium.BrownDark',
      mouth: 'Mouth_Default'
    }
  },

  // Test 2: Haircut rendering
  'haircut-basic': {
    name: 'Basic Haircut',
    description: 'Tests haircut model loads and renders correctly',
    expectedBehavior: 'Hair should cover top of head, properly textured',
    skin: {
      bodyCharacteristic: 'Regular.05',
      haircut: 'Messy.Black',
      eyes: 'Large_Eyes.GreenDark',
      eyebrows: 'Thick.Black',
      mouth: 'Mouth_Default'
    }
  },

  // Test 3: Viking beard + hair (complex facial hair)
  'viking-beard': {
    name: 'Viking Beard + Hair',
    description: 'Tests complex facial hair with haircut combo',
    expectedBehavior: 'Both beard and hair visible, no z-fighting',
    skin: {
      bodyCharacteristic: 'Muscular.07',
      haircut: 'Viking.BrownDark',
      facialHair: 'VikingBeard.BrownDark',
      face: 'Face_Scar',
      eyes: 'Square_Eyes.Brown',
      eyebrows: 'Bushy.BrownDark',
      mouth: 'Mouth_Default'
    }
  },

  // Test 4: Eye rendering (OIT test - pupils over background)
  'eye-test': {
    name: 'Eye Rendering (OIT)',
    description: 'Tests eye pupil renders over eye background (OIT)',
    expectedBehavior: 'Eyes should have proper pupils, no holes/artifacts',
    skin: {
      bodyCharacteristic: 'Regular.01',
      eyes: 'Cat_Eyes.Honey',
      eyebrows: 'Thin.Black',
      mouth: 'Mouth_Cute'
    }
  },

  // Test 5: Demon eyes (complex transparency)
  'demon-eyes': {
    name: 'Demonic Eyes',
    description: 'Tests complex eye transparency',
    expectedBehavior: 'Demonic eyes should render without artifacts',
    skin: {
      bodyCharacteristic: 'Regular.50',
      eyes: 'Demonic_Eyes.Orange',
      eyebrows: 'Shaved',
      face: 'Face_Sunken',
      mouth: 'Mouth_Vampire'
    }
  },

  // Test 6: Full face cosmetics stack
  'full-face-stack': {
    name: 'Full Face Cosmetics',
    description: 'Tests all face cosmetics layered correctly',
    expectedBehavior: 'All layers visible: face < beard < mouth < eyes < eyebrows',
    skin: {
      bodyCharacteristic: 'Regular.03',
      face: 'Face_Neutral_Freckles',
      facialHair: 'Goatee.BrownDark',
      mouth: 'Mouth_Thin',
      eyes: 'Almond_Eyes.Blue',
      eyebrows: 'Large.BrownDark'
    }
  },

  // Test 7: Moustache only (no beard)
  'moustache-only': {
    name: 'Moustache Only',
    description: 'Tests small facial hair item over face',
    expectedBehavior: 'Moustache visible above lip, not hidden',
    skin: {
      bodyCharacteristic: 'Regular.08',
      facialHair: 'TwirlyMoustache.Black',
      eyes: 'Plain_Eyes.Brown',
      eyebrows: 'RoundThin.Black',
      mouth: 'Mouth_Long'
    }
  },

  // Test 8: Dark skin tone
  'dark-skin': {
    name: 'Dark Skin Tone',
    description: 'Tests skin gradient tinting on dark tones',
    expectedBehavior: 'Skin should be properly tinted, not washed out',
    skin: {
      bodyCharacteristic: 'Regular.14',
      haircut: 'BobCut.PitchBlack',
      eyes: 'Large_Eyes.Brown',
      eyebrows: 'Medium.PitchBlack',
      face: 'Face_Neutral',
      mouth: 'Mouth_Makeup'
    }
  },

  // Test 9: Bald head (no haircut)
  'bald-head': {
    name: 'Bald Head',
    description: 'Tests head renders correctly without haircut',
    expectedBehavior: 'Smooth bald head, no missing textures',
    skin: {
      bodyCharacteristic: 'Regular.27',
      eyes: 'Reptile_Eyes.GreenDark',
      eyebrows: 'Shaved',
      face: 'Face_Aged',
      mouth: 'Mouth_Orc',
      facialHair: 'Chin_Curtain.GreyAsh'
    }
  },

  // Test 10: Minimal - just eyes
  'minimal-eyes': {
    name: 'Minimal (Eyes Only)',
    description: 'Tests rendering with minimal cosmetics',
    expectedBehavior: 'Basic head with just eyes, clean render',
    skin: {
      bodyCharacteristic: 'Regular.01',
      eyes: 'Medium_Eyes.Blue'
    }
  },

  // Test 11: Head accessory test
  'head-accessory': {
    name: 'Head Accessory',
    description: 'Tests head accessory over haircut',
    expectedBehavior: 'Accessory should render over hair',
    skin: {
      bodyCharacteristic: 'Regular.05',
      haircut: 'PonyTail.Blond',
      eyes: 'Large_Eyes.Blue',
      eyebrows: 'Medium.Blond',
      mouth: 'Mouth_Cute'
    }
  },

  // Test 12: Face accessory (glasses, etc)
  'face-accessory': {
    name: 'Face Accessory',
    description: 'Tests face accessory layering',
    expectedBehavior: 'Accessory should render in front of face',
    skin: {
      bodyCharacteristic: 'Regular.02',
      haircut: 'Quiff.BrownDark',
      eyes: 'Square_Eyes.GreenDark',
      eyebrows: 'Thick.BrownDark',
      face: 'Face_Stubble',
      mouth: 'Mouth_Default'
    }
  },

  // Test 13: Blue/fantasy skin
  'fantasy-skin': {
    name: 'Fantasy Skin (Blue)',
    description: 'Tests non-realistic skin tone gradient',
    expectedBehavior: 'Blue skin should be properly tinted',
    skin: {
      bodyCharacteristic: 'Regular.19',
      haircut: 'Bangs.White',
      eyes: 'Cat_Eyes.Pink',
      eyebrows: 'SmallRound.White',
      mouth: 'Mouth_Tiny'
    }
  },

  // Test 14: Muscular body type
  'muscular-body': {
    name: 'Muscular Body Type',
    description: 'Tests muscular body texture mapping',
    expectedBehavior: 'Thicker neck, proper texture UV',
    skin: {
      bodyCharacteristic: 'Muscular.06',
      haircut: 'Berserker.BrownDark',
      facialHair: 'Medium.BrownDark',
      eyes: 'Square_Eyes.Brown',
      eyebrows: 'Bushy.BrownDark',
      face: 'Face_Scar',
      mouth: 'Mouth_Default'
    }
  },

  // Test 15: All transparent layers (stress test)
  'transparency-stress': {
    name: 'Transparency Stress Test',
    description: 'Tests OIT with many transparent layers',
    expectedBehavior: 'All layers visible, no z-fighting or holes',
    skin: {
      bodyCharacteristic: 'Regular.01',
      haircut: 'Fringe.Blond',
      face: 'Face_Tired_Eyes',
      facialHair: 'SoulPatch.Blond',
      eyes: 'Large_Eyes.Blue',
      eyebrows: 'Thin.Blond',
      mouth: 'Mouth_Makeup'
    }
  },

  // ============ BODY/CLOTHING TESTS ============

  // Test 16: Full outfit (tests body part hiding + clothing rendering)
  'full-outfit': {
    name: 'Full Outfit',
    description: 'Tests complete outfit with pants, top, shoes',
    expectedBehavior: 'Body parts hidden, clothing renders properly',
    skin: {
      bodyCharacteristic: 'Regular.05',
      haircut: 'Messy.BrownDark',
      eyes: 'Medium_Eyes.Brown',
      eyebrows: 'Quiff.BrownDark',
      mouth: 'Mouth_Default',
      pants: 'Jeans.Blue',
      overtop: 'PuffyJacket.Red',
      shoes: 'BasicBoots.Brown'
    }
  },

  // Test 17: Cape rendering
  'cape-test': {
    name: 'Cape Rendering',
    description: 'Tests cape attachment and transparency',
    expectedBehavior: 'Cape should hang from shoulders, proper layering',
    skin: {
      bodyCharacteristic: 'Regular.03',
      haircut: 'PonyTail.Blond',
      eyes: 'Large_Eyes.Blue',
      eyebrows: 'Bangs.Blond',
      mouth: 'Mouth_Default',
      overtop: 'RobeOvertops.Purple',
      pants: 'StripedPants.Brown',
      cape: 'Cape_Royal_Emissary.Red',
      shoes: 'BasicBoots.Black'
    }
  },

  // Test 18: Layered clothing (undertop + overtop)
  'layered-clothing': {
    name: 'Layered Clothing',
    description: 'Tests undertop under overtop layering',
    expectedBehavior: 'Both layers visible, undertop shows at sleeves/collar',
    skin: {
      bodyCharacteristic: 'Regular.02',
      haircut: 'Messy.Black',
      eyes: 'Square_Eyes.GreenDark',
      eyebrows: 'Morning.Black',
      mouth: 'Mouth_Default',
      undertop: 'VNeck_Shirt.White',
      overtop: 'Suit_Jacket.Black',
      pants: 'LeatherPants.Brown',
      shoes: 'BasicShoes.Brown'
    }
  },

  // Test 19: Gloves test
  'gloves-test': {
    name: 'Gloves Rendering',
    description: 'Tests gloves hide hands properly',
    expectedBehavior: 'Hands hidden, gloves visible',
    skin: {
      bodyCharacteristic: 'Muscular.07',
      haircut: 'Viking.BrownDark',
      eyes: 'Square_Eyes.Brown',
      eyebrows: 'Lazy.BrownDark',
      facialHair: 'Beard_Large.BrownDark',
      mouth: 'Mouth_Default',
      overtop: 'RaggedVest.Brown',
      pants: 'SurvivorPants.Brown',
      gloves: 'MiningGloves.Brown',
      shoes: 'Boots_Thick.Brown'
    }
  },

  // Test 20: Underwear/base layers
  'underwear-base': {
    name: 'Underwear Base Layers',
    description: 'Tests underwear renders under outer clothes',
    expectedBehavior: 'Underwear visible where outer clothes dont cover',
    skin: {
      bodyCharacteristic: 'Regular.01',
      eyes: 'Medium_Eyes.Blue',
      eyebrows: 'Fringe.BrownDark',
      mouth: 'Mouth_Default',
      underwear: 'Boxer.White',
      pants: 'ShortyRolled.Blue'
    }
  },

  // Test 21: Overpants test (socks over pants)
  'overpants-test': {
    name: 'Overpants Layering',
    description: 'Tests overpants layer over pants',
    expectedBehavior: 'Overpants visible over base pants',
    skin: {
      bodyCharacteristic: 'Regular.06',
      haircut: 'PonyTail.BrownDark',
      eyes: 'Large_Eyes.Brown',
      eyebrows: 'Bun.BrownDark',
      mouth: 'Mouth_Default',
      pants: 'ApprenticePants.Brown',
      overpants: 'LongSocks_BasicWrap.White',
      overtop: 'ThreadedOvertops.Green',
      shoes: 'AdventurerBoots.Brown'
    }
  },

  // Test 22: Ear accessories
  'ear-accessories': {
    name: 'Ear Accessories',
    description: 'Tests ear/earring attachment',
    expectedBehavior: 'Earrings attach to ear position',
    skin: {
      bodyCharacteristic: 'Regular.08',
      haircut: 'BobCut.Black',
      eyes: 'Almond_Eyes.Brown',
      eyebrows: 'Braid.Black',
      ears: 'Elf_Ears.08',
      earAccessory: 'EarHoops.Gold',
      mouth: 'Mouth_Makeup.01',
      pants: 'CostumePants.Pink',
      overtop: 'BunnyHoody.Pink',
      shoes: 'Sneakers_Sneakers.White'
    }
  },

  // Test 23: Full character (everything equipped)
  'full-character': {
    name: 'Full Character (All Slots)',
    description: 'Tests character with all cosmetic slots filled',
    expectedBehavior: 'All cosmetics render without conflicts',
    skin: {
      bodyCharacteristic: 'Regular.05',
      haircut: 'Quiff.BrownDark',
      headAccessory: 'Goggles.Brown',
      face: 'Face_Neutral',
      faceAccessory: 'Glasses_Monocle.Gold',
      eyes: 'Medium_Eyes.GreenDark',
      eyebrows: 'Morning.BrownDark',
      mouth: 'Mouth_Default',
      ears: 'Elf_Ears.05',
      earAccessory: 'EarHoops.Silver',
      undertop: 'LongSleeveShirt.White',
      overtop: 'StylishJacket.Brown',
      pants: 'BulkySuede.Brown',
      overpants: 'LongSocks_Plain.Brown',
      gloves: 'BasicGloves_Basic.Brown',
      shoes: 'ScavenverLeatherBoots.Brown',
      cape: 'Cape_Scavenger.Brown'
    }
  },

  // Test 24: Colorful outfit - comprehensive all-slots test with real item IDs
  'colorful-complete': {
    name: 'Colorful Complete Outfit',
    description: 'Tests all cosmetic slots with colorful real game item IDs',
    expectedBehavior: 'Colorful outfit renders with elf ears, cape, and vibrant colors',
    skin: {
      bodyCharacteristic: 'Default.10',
      haircut: 'AfroPuffs.Red',
      pants: 'DaisySkirt.White',
      overtop: 'OnePiece_SchoolDress.Yellow',
      undertop: 'PastelTracksuit.YellowPastel+PinkPastel+BluePastel',
      shoes: 'BasicShoes_Sandals.Red',
      eyebrows: 'Medium.Red',
      eyes: 'Goat_Eyes.Purple',
      face: 'Face_Tired_Eyes',
      facialHair: 'PirateBeard.Red',
      cape: 'Cape_Seasons.Green',
      overpants: 'LongSocks_Bow.Cream',
      mouth: 'Mouth_Long',
      ears: 'Elf_Ears_Small',
      underwear: 'Suit.Pink'
    }
  }
};

/**
 * Handle comprehensive SSR debug page
 */
async function handleDebugSSR(req, res) {
  console.log('[Debug SSR] Rendering comprehensive test page...');

  let status = { available: false, error: 'Unknown', dependencies: {} };
  try {
    status = nativeRenderer.getStatus();
  } catch (err) {
    console.error('[Debug SSR] Error getting status:', err);
    status.error = err.message;
  }

  const mockSkinIds = Object.keys(MOCK_SKINS);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSR Debug - Comprehensive Rendering Tests</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
      min-height: 100vh;
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1800px; margin: 0 auto; }
    h1 { color: #00d4ff; margin-bottom: 10px; font-size: 1.8em; }
    h2 { color: #888; margin: 20px 0 15px; font-size: 1.2em; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 20px; }

    .status-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 20px;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    .status-item { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; }
    .status-dot.ok { background: #00ff88; box-shadow: 0 0 8px #00ff88; }
    .status-dot.error { background: #ff4444; box-shadow: 0 0 8px #ff4444; }

    .controls {
      background: rgba(0,0,0,0.3);
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }
    .controls label { color: #aaa; }
    .controls select, .controls button {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 8px 12px;
      border-radius: 5px;
      cursor: pointer;
    }
    .controls button:hover { background: rgba(0, 212, 255, 0.3); }
    .controls button.active { background: rgba(0, 212, 255, 0.5); }

    .test-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 20px;
    }

    .test-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      overflow: hidden;
    }
    .test-header {
      background: rgba(0,0,0,0.3);
      padding: 12px 15px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .test-header h3 { color: #00d4ff; font-size: 1em; margin-bottom: 4px; }
    .test-header .desc { color: #888; font-size: 0.8em; }
    .test-header .expected { color: #666; font-size: 0.75em; font-style: italic; margin-top: 4px; }

    .render-compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      background: rgba(255,255,255,0.05);
    }
    .render-panel {
      background: rgba(0,0,0,0.5);
      padding: 10px;
      text-align: center;
    }
    .render-panel .label {
      font-size: 0.7em;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .render-panel img, .render-panel canvas {
      max-width: 150px;
      min-height: 150px;
      border-radius: 8px;
      background: #000;
      object-fit: contain;
    }
    .render-panel .timing {
      font-size: 0.7em;
      color: #555;
      margin-top: 5px;
    }
    .render-panel .loading {
      width: 150px;
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
    }
    .render-panel .error {
      color: #ff6666;
      font-size: 0.8em;
    }

    .skin-data {
      padding: 10px 15px;
      font-size: 0.7em;
      font-family: monospace;
      color: #666;
      background: rgba(0,0,0,0.2);
      max-height: 80px;
      overflow-y: auto;
    }
    .skin-data code {
      display: block;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Three.js avatar container */
    .avatar-container {
      width: 150px;
      height: 150px;
      margin: 0 auto;
    }

    .summary {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 15px;
      margin-top: 20px;
    }
    .summary h3 { color: #00d4ff; margin-bottom: 10px; }
    .summary .stats { display: flex; gap: 30px; flex-wrap: wrap; }
    .summary .stat { text-align: center; }
    .summary .stat .value { font-size: 2em; color: #00d4ff; }
    .summary .stat .label { font-size: 0.8em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SSR Debug - Comprehensive Rendering Tests</h1>
    <p class="subtitle">Mock skins testing all rendering scenarios (ordering, UV mapping, OIT, transparency)</p>

    <div class="status-card">
      <div class="status-item">
        <span class="status-dot ${status.available ? 'ok' : 'error'}"></span>
        <span>Native Renderer: ${status.available ? 'Available' : 'Not Available'}</span>
      </div>
      ${status.error && !status.available ? '<span style="color:#ff6666">' + status.error + '</span>' : ''}
      <div class="status-item">
        <span>Dependencies:</span>
        ${Object.entries(status.dependencies || {}).map(([k, v]) =>
          '<span style="color:' + (v ? '#00ff88' : '#ff6666') + '">' + k + '</span>'
        ).join(', ')}
      </div>
    </div>

    <div class="controls">
      <label>Background:</label>
      <select id="bgColor">
        <option value="black" selected>Black</option>
        <option value="white">White</option>
        <option value="transparent">Transparent</option>
        <option value="#1a1a2e">Dark Blue</option>
      </select>
      <label>View Mode:</label>
      <select id="viewMode">
        <option value="auto" selected>Auto (body for clothes)</option>
        <option value="head">Head Only</option>
        <option value="body">Full Body</option>
      </select>
      <button onclick="renderAll()">Render All SSR</button>
      <button onclick="renderAllBrowser()">Render All Browser</button>
      <button onclick="clearAll()">Clear</button>
      <span id="progress" style="color:#666"></span>
    </div>

    <h2>Rendering Test Cases (${mockSkinIds.length} tests)</h2>

    <div class="test-grid" id="testGrid">
      ${mockSkinIds.map(id => {
        const test = MOCK_SKINS[id];
        const hasClothing = test.skin.pants || test.skin.overtop || test.skin.undertop ||
                           test.skin.shoes || test.skin.gloves || test.skin.cape ||
                           test.skin.overpants || test.skin.underwear;
        const badge = hasClothing ?
          '<span style="background:#4a9; color:#fff; padding:2px 6px; border-radius:3px; font-size:0.7em; margin-left:8px;">BODY</span>' : '';
        return `
          <div class="test-card" data-skin-id="${id}">
            <div class="test-header">
              <h3>${test.name}${badge}</h3>
              <div class="desc">${test.description}</div>
              <div class="expected">Expected: ${test.expectedBehavior}</div>
            </div>
            <div class="render-compare">
              <div class="render-panel" id="ssr-${id}">
                <div class="label">SSR (headless-gl)</div>
                <div class="loading">Click "Render All"</div>
              </div>
              <div class="render-panel" id="browser-${id}">
                <div class="label">Browser (Three.js)</div>
                <div class="avatar-container" id="avatar-${id}"></div>
              </div>
            </div>
            <div class="skin-data">
              <code>${JSON.stringify(test.skin, null, 2)}</code>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="summary">
      <h3>Render Summary</h3>
      <div class="stats">
        <div class="stat">
          <div class="value" id="totalTests">${mockSkinIds.length}</div>
          <div class="label">Total Tests</div>
        </div>
        <div class="stat">
          <div class="value" id="ssrRendered">0</div>
          <div class="label">SSR Rendered</div>
        </div>
        <div class="stat">
          <div class="value" id="browserRendered">0</div>
          <div class="label">Browser Rendered</div>
        </div>
        <div class="stat">
          <div class="value" id="avgTime">-</div>
          <div class="label">Avg SSR Time (ms)</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Three.js for browser rendering -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="/assets/depth-peeling.js"></script>
  <script src="/assets/avatar.js"></script>

  <script>
    const MOCK_SKINS = ${JSON.stringify(MOCK_SKINS)};
    const skinIds = ${JSON.stringify(mockSkinIds)};
    let ssrTimes = [];
    let ssrCount = 0;
    let browserCount = 0;

    // Clothing test IDs that should use body view in auto mode
    const CLOTHING_TESTS = ['full-outfit', 'cape-test', 'layered-clothing', 'gloves-test',
                            'underwear-base', 'overpants-test', 'ear-accessories', 'full-character',
                            'colorful-complete'];

    function getViewForSkin(skinId) {
      const mode = document.getElementById('viewMode').value;
      if (mode === 'head') return 'head';
      if (mode === 'body') return 'body';
      // Auto mode: use body for clothing tests
      return CLOTHING_TESTS.includes(skinId) ? 'body' : 'head';
    }

    function updateStats() {
      document.getElementById('ssrRendered').textContent = ssrCount;
      document.getElementById('browserRendered').textContent = browserCount;
      if (ssrTimes.length > 0) {
        const avg = Math.round(ssrTimes.reduce((a, b) => a + b, 0) / ssrTimes.length);
        document.getElementById('avgTime').textContent = avg;
      }
    }

    async function renderSSR(skinId) {
      const panel = document.getElementById('ssr-' + skinId);
      const bg = document.getElementById('bgColor').value;
      const view = getViewForSkin(skinId);
      const isBody = view === 'body';

      panel.innerHTML = '<div class="label">SSR (' + view + ')</div><div class="loading">Rendering...</div>';

      try {
        const url = '/debug/ssr/mock/' + skinId + '?bg=' + bg + '&view=' + view + '&format=json&_t=' + Date.now();
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
          panel.innerHTML = '<div class="label">SSR (' + view + ')</div><div class="error">' + data.error + '</div>';
        } else {
          ssrTimes.push(data.timings.total);
          ssrCount++;
          const imgStyle = isBody ? 'width:150px;height:225px' : 'width:150px;height:150px';
          panel.innerHTML = '<div class="label">SSR (' + view + ')</div>' +
            '<img src="/debug/ssr/mock/' + skinId + '?bg=' + bg + '&view=' + view + '&_t=' + Date.now() + '" style="' + imgStyle + '" alt="SSR">' +
            '<div class="timing">' + data.timings.total + 'ms</div>';
          updateStats();
        }
      } catch (err) {
        panel.innerHTML = '<div class="label">SSR (' + view + ')</div><div class="error">' + err.message + '</div>';
      }
    }

    async function renderBrowser(skinId) {
      const container = document.getElementById('avatar-' + skinId);
      const bg = document.getElementById('bgColor').value;
      const view = getViewForSkin(skinId);

      if (!container) return;

      // Clear container and resize for body view
      container.innerHTML = '';
      if (view === 'body') {
        container.style.height = '225px';
      } else {
        container.style.height = '150px';
      }

      try {
        const skin = MOCK_SKINS[skinId].skin;

        // Convert skin to model data format for avatar viewer
        const response = await fetch('/debug/ssr/resolve-skin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skin)
        });
        const modelData = await response.json();

        if (modelData.error) {
          container.innerHTML = '<div class="error">' + modelData.error + '</div>';
          return;
        }

        // Create mini avatar viewer
        const viewer = new HytaleAvatarViewer(container, {
          autoRotate: false,
          showGrid: false,
          backgroundColor: bg === 'black' ? 0x000000 : bg === 'white' ? 0xffffff : 0x1a1a2e,
          useOIT: true
        });

        viewer.init();

        // Load directly from model data
        await viewer.loadFromModelData(modelData);

        // Set camera based on view type
        if (view === 'body') {
          viewer.camera.position.set(0, 0.6, -2.5);
          viewer.camera.lookAt(0, 0.5, 0);
          viewer.camera.fov = 45;
        } else {
          viewer.camera.position.set(0, 1.1, -1.0);
          viewer.camera.lookAt(0, 1.0, 0);
          viewer.camera.fov = 40;
        }
        viewer.camera.updateProjectionMatrix();

        browserCount++;
        updateStats();
      } catch (err) {
        container.innerHTML = '<div class="error" style="font-size:10px">' + err.message + '</div>';
      }
    }

    async function renderAll() {
      const progress = document.getElementById('progress');
      ssrTimes = [];
      ssrCount = 0;
      updateStats();

      for (let i = 0; i < skinIds.length; i++) {
        progress.textContent = 'SSR: ' + (i + 1) + '/' + skinIds.length;
        await renderSSR(skinIds[i]);
        // Small delay to prevent overload
        await new Promise(r => setTimeout(r, 100));
      }
      progress.textContent = 'SSR Complete!';
    }

    async function renderAllBrowser() {
      const progress = document.getElementById('progress');
      browserCount = 0;
      updateStats();

      for (let i = 0; i < skinIds.length; i++) {
        progress.textContent = 'Browser: ' + (i + 1) + '/' + skinIds.length;
        await renderBrowser(skinIds[i]);
        await new Promise(r => setTimeout(r, 50));
      }
      progress.textContent = 'Browser Complete!';
    }

    function clearAll() {
      skinIds.forEach(id => {
        const ssrPanel = document.getElementById('ssr-' + id);
        const browserContainer = document.getElementById('avatar-' + id);
        if (ssrPanel) ssrPanel.innerHTML = '<div class="label">SSR (headless-gl)</div><div class="loading">Click "Render All"</div>';
        if (browserContainer) browserContainer.innerHTML = '';
      });
      ssrTimes = [];
      ssrCount = 0;
      browserCount = 0;
      updateStats();
      document.getElementById('progress').textContent = '';
    }

    // Auto-render SSR on load
    // Uncomment to auto-start: setTimeout(renderAll, 1000);
  </script>
</body>
</html>`;

  sendHtml(res, 200, html);
}

/**
 * Handle mock skin SSR render endpoint
 * Supports ?view=head (default) or ?view=body for full body rendering
 */
async function handleMockSSRRender(req, res, skinId) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const bg = url.searchParams.get('bg') || 'black';
  const format = url.searchParams.get('format') || 'image';
  const view = url.searchParams.get('view') || 'head';

  // Default sizes based on view type
  const defaultWidth = view === 'body' ? 300 : 200;
  const defaultHeight = view === 'body' ? 450 : 200;
  const width = parseInt(url.searchParams.get('width') || defaultWidth, 10);
  const height = parseInt(url.searchParams.get('height') || defaultHeight, 10);

  const mockSkin = MOCK_SKINS[skinId];
  if (!mockSkin) {
    sendJson(res, 404, { error: 'Mock skin not found: ' + skinId });
    return;
  }

  try {
    let result;
    if (view === 'body') {
      result = await nativeRenderer.renderFullBodyFromSkinData(mockSkin.skin, bg, width, height);
    } else {
      result = await nativeRenderer.renderHeadFromSkinData(mockSkin.skin, bg, width, height);
    }

    if (format === 'json') {
      sendJson(res, 200, {
        success: true,
        skinId,
        name: mockSkin.name,
        view,
        bg,
        size: { width, height },
        timings: result.timings,
        bufferSize: result.buffer.length
      });
      return;
    }

    sendBinary(res, 200, result.buffer, 'image/png', {
      'Cache-Control': 'no-cache',
      'X-Render-Time': result.timings.total + 'ms',
      'X-View-Type': view
    });
  } catch (err) {
    console.error('[Debug SSR] Mock render error:', err);
    sendJson(res, 500, {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

/**
 * Handle skin resolution endpoint (for browser rendering)
 */
async function handleResolveSkin(req, res, body) {
  const assets = require('../services/assets');

  try {
    const skinData = body;
    const configs = assets.loadCosmeticConfigs();
    const gradientSets = assets.loadGradientSets();

    if (!configs) {
      sendJson(res, 500, { error: 'Could not load cosmetic configs' });
      return;
    }

    const resolvedParts = {};
    const categories = [
      'haircut', 'pants', 'overtop', 'undertop', 'shoes',
      'headAccessory', 'faceAccessory', 'earAccessory',
      'eyebrows', 'eyes', 'face', 'facialHair', 'gloves',
      'cape', 'overpants', 'mouth', 'ears', 'underwear'
    ];

    for (const category of categories) {
      if (skinData[category]) {
        const resolved = assets.resolveSkinPart(category, skinData[category], configs, gradientSets);
        if (resolved) {
          resolvedParts[category] = resolved;
        }
      }
    }

    // Parse body characteristic
    let bodyType = 'Regular';
    let skinTone = '01';

    if (skinData.bodyCharacteristic) {
      const bodyParts = skinData.bodyCharacteristic.split('.');
      bodyType = bodyParts[0] || 'Regular';
      if (bodyParts.length > 1 && bodyParts[1]) {
        skinTone = bodyParts[1].padStart(2, '0');
      }
    }

    sendJson(res, 200, {
      uuid: 'mock-' + Date.now(),
      skinTone,
      bodyType,
      parts: resolvedParts
    });
  } catch (err) {
    console.error('[Debug SSR] Resolve skin error:', err);
    sendJson(res, 500, { error: err.message });
  }
}

/**
 * Handle SSR render endpoint (existing UUID-based)
 */
async function handleDebugSSRRender(req, res, uuid) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const bg = url.searchParams.get('bg') || 'black';
  const format = url.searchParams.get('format') || 'image';
  const width = parseInt(url.searchParams.get('width') || '200', 10);
  const height = parseInt(url.searchParams.get('height') || '200', 10);

  try {
    const result = await nativeRenderer.renderHead(uuid, bg, width, height);

    if (format === 'json') {
      sendJson(res, 200, {
        success: true,
        uuid,
        bg,
        size: { width, height },
        timings: result.timings,
        bufferSize: result.buffer.length
      });
      return;
    }

    sendBinary(res, 200, result.buffer, 'image/png', {
      'Cache-Control': 'no-cache',
      'X-Render-Time': result.timings.total + 'ms'
    });
  } catch (err) {
    console.error('[Debug SSR] Render error:', err);
    sendJson(res, 500, {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

/**
 * Handle SSR status endpoint
 */
function handleDebugSSRStatus(req, res) {
  const status = nativeRenderer.getStatus();
  sendJson(res, 200, status);
}

/**
 * Handle SSR benchmark endpoint
 */
async function handleDebugSSRBenchmark(req, res, uuid) {
  const iterations = 5;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await nativeRenderer.renderHead(uuid, 'black');
      results.push({
        iteration: i + 1,
        ...result.timings
      });
    } catch (err) {
      results.push({
        iteration: i + 1,
        error: err.message
      });
    }
  }

  // Calculate averages
  const successful = results.filter(r => !r.error);
  const averages = {};

  if (successful.length > 0) {
    const timingKeys = Object.keys(successful[0]).filter(k => k !== 'iteration');
    for (const key of timingKeys) {
      averages[key] = Math.round(successful.reduce((sum, r) => sum + r[key], 0) / successful.length);
    }
  }

  sendJson(res, 200, {
    uuid,
    iterations,
    results,
    averages,
    successRate: `${successful.length}/${iterations}`
  });
}

/**
 * Get list of mock skins
 */
function handleMockSkinsList(req, res) {
  const list = Object.entries(MOCK_SKINS).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description,
    expectedBehavior: config.expectedBehavior
  }));
  sendJson(res, 200, { skins: list, count: list.length });
}

/**
 * Route handler for debug endpoints
 */
async function handleDebugRoutes(req, res, urlPath, body = {}) {
  // Main debug page
  if (urlPath === '/debug/ssr' || urlPath === '/debug/ssr/') {
    await handleDebugSSR(req, res);
    return true;
  }

  // Status endpoint
  if (urlPath === '/debug/ssr/status') {
    handleDebugSSRStatus(req, res);
    return true;
  }

  // Mock skins list
  if (urlPath === '/debug/ssr/mocks') {
    handleMockSkinsList(req, res);
    return true;
  }

  // Resolve skin endpoint (POST)
  if (urlPath === '/debug/ssr/resolve-skin' && req.method === 'POST') {
    await handleResolveSkin(req, res, body);
    return true;
  }

  // Mock skin render
  if (urlPath.startsWith('/debug/ssr/mock/')) {
    const skinId = urlPath.replace('/debug/ssr/mock/', '').split('?')[0];
    await handleMockSSRRender(req, res, skinId);
    return true;
  }

  // UUID-based render (existing)
  if (urlPath.startsWith('/debug/ssr/render/')) {
    const uuid = urlPath.replace('/debug/ssr/render/', '').split('?')[0];
    await handleDebugSSRRender(req, res, uuid);
    return true;
  }

  // Benchmark
  if (urlPath.startsWith('/debug/ssr/benchmark/')) {
    const uuid = urlPath.replace('/debug/ssr/benchmark/', '').split('?')[0];
    await handleDebugSSRBenchmark(req, res, uuid);
    return true;
  }

  return false;
}

module.exports = {
  handleDebugRoutes,
  handleDebugSSR,
  handleDebugSSRRender,
  handleDebugSSRStatus,
  handleDebugSSRBenchmark,
  handleMockSSRRender,
  handleResolveSkin,
  MOCK_SKINS
};
