const LEVEL_LIMIT = 100;
const LEVEL_TIME = 30;
const LANE_COUNT = 3;
const BASE_SPAWN_INTERVAL = 1.2;
const MIN_SPAWN_INTERVAL = 0.35;
const BASE_SPEED = 2.2;
const SPEED_PER_LEVEL = 0.08;

Page({
  data: {
    level: 1,
    score: 0,
    timeLeft: LEVEL_TIME,
    isRunning: false,
    message: '点击开始进入闯关',
    timePercent: 100,
    canvasWidth: 0,
    canvasHeight: 0
  },

  onReady() {
    this.ctx = wx.createCanvasContext('gameCanvas', this);
    const { windowWidth, windowHeight } = wx.getSystemInfoSync();
    const canvasWidth = Math.min(400, Math.floor(windowWidth * 0.92));
    const canvasHeight = Math.min(620, Math.floor(windowHeight * 0.6));
    this.setData({ canvasWidth, canvasHeight });
    this.resetGameState();
    this.drawScene();
  },

  onUnload() {
    this.stopLoops();
  },

  resetGameState() {
    const laneHeight = this.getLaneHeight();
    this.player = {
      x: 60,
      lane: 1,
      y: this.getLaneY(1),
      radius: Math.max(14, Math.floor(laneHeight * 0.22))
    };
    this.items = [];
    this.lastSpawn = 0;
    this.elapsed = 0;
  },

  handleStart() {
    if (this.data.isRunning) return;
    this.setData({ isRunning: true, message: '' });
    this.startLoops();
  },

  handlePause() {
    if (!this.data.isRunning) return;
    this.setData({ isRunning: false, message: '已暂停' });
    this.stopLoops();
  },

  handleReset() {
    this.stopLoops();
    this.setData({
      level: 1,
      score: 0,
      timeLeft: LEVEL_TIME,
      isRunning: false,
      message: '点击开始进入闯关',
      timePercent: 100
    });
    this.resetGameState();
    this.drawScene();
  },

  handleCanvasTap(event) {
    if (!this.data.isRunning) return;
    const tapY =
      event.detail?.y ||
      event.touches?.[0]?.y ||
      event.changedTouches?.[0]?.y;
    if (typeof tapY !== 'number') return;
    const laneHeight = this.getLaneHeight();
    const lane = Math.min(
      LANE_COUNT - 1,
      Math.max(0, Math.floor((tapY - 40) / laneHeight))
    );
    this.player.lane = lane;
    this.player.y = this.getLaneY(lane);
  },

  startLoops() {
    this.loopTimer = setInterval(() => {
      this.updateFrame();
      this.drawScene();
    }, 1000 / 30);

    this.timeTimer = setInterval(() => {
      const nextTime = this.data.timeLeft - 1;
      if (nextTime <= 0) {
        this.advanceLevel();
      } else {
        this.setData({
          timeLeft: nextTime,
          timePercent: Math.max(0, Math.floor((nextTime / LEVEL_TIME) * 100))
        });
      }
    }, 1000);
  },

  stopLoops() {
    clearInterval(this.loopTimer);
    clearInterval(this.timeTimer);
  },

  advanceLevel() {
    const nextLevel = this.data.level + 1;
    if (nextLevel > LEVEL_LIMIT) {
      this.setData({ isRunning: false, timeLeft: 0, message: '恭喜通关！' });
      this.stopLoops();
      return;
    }
    this.setData({
      level: nextLevel,
      timeLeft: LEVEL_TIME,
      message: `第 ${nextLevel} 关开始`,
      timePercent: 100
    });
    this.resetGameState();
  },

  updateFrame() {
    if (!this.data.isRunning) return;
    this.elapsed += 1 / 30;
    this.spawnItems();
    const speed = this.getSpeed();

    this.items = this.items
      .map((item) => ({
        ...item,
        x: item.x - speed
      }))
      .filter((item) => item.x > -40);

    this.handleCollisions();
  },

  spawnItems() {
    const spawnInterval = this.getSpawnInterval();
    if (this.elapsed - this.lastSpawn < spawnInterval) return;
    this.lastSpawn = this.elapsed;

    const lane = Math.floor(Math.random() * LANE_COUNT);
    const laneY = this.getLaneY(lane);
    const kindPool = ['coin-small', 'coin-medium', 'coin-large', 'bomb'];
    const kind = kindPool[Math.floor(Math.random() * kindPool.length)];
    const valueMap = {
      'coin-small': 10,
      'coin-medium': 25,
      'coin-large': 50,
      bomb: -60
    };
    const value = valueMap[kind];

    this.items.push({
      x: this.data.canvasWidth + 40,
      y: laneY,
      radius: Math.max(10, Math.floor(this.getLaneHeight() * 0.18)),
      kind,
      value,
      lane
    });
  },

  handleCollisions() {
    const remaining = [];
    let scoreDelta = 0;

    this.items.forEach((item) => {
      const dx = item.x - this.player.x;
      const dy = item.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < item.radius + this.player.radius) {
        scoreDelta += item.value;
      } else {
        remaining.push(item);
      }
    });

    if (scoreDelta !== 0) {
      this.setData({ score: Math.max(0, this.data.score + scoreDelta) });
    }

    this.items = remaining;
  },

  getSpeed() {
    return BASE_SPEED + this.data.level * SPEED_PER_LEVEL;
  },

  getSpawnInterval() {
    const reduction = Math.min(0.9, this.data.level * 0.01);
    return Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - reduction);
  },

  getLaneHeight() {
    const availableHeight = this.data.canvasHeight - 120;
    return availableHeight / LANE_COUNT;
  },

  getLaneY(lane) {
    const laneHeight = this.getLaneHeight();
    const paddingTop = 40;
    return paddingTop + laneHeight * lane + laneHeight / 2;
  },

  drawScene() {
    const ctx = this.ctx;
    ctx.setFillStyle('#020617');
    ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);

    this.drawTrack(ctx);
    this.drawPlayer(ctx);
    this.drawItems(ctx);

    ctx.draw();
  },

  drawTrack(ctx) {
    const width = this.data.canvasWidth;
    const height = this.data.canvasHeight;
    ctx.setFillStyle('#1e293b');
    ctx.fillRect(0, 0, width, height);

    for (let i = 1; i < LANE_COUNT; i += 1) {
      ctx.setStrokeStyle('rgba(56, 189, 248, 0.35)');
      ctx.setLineWidth(2);
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(0, this.getLaneY(i) - this.getLaneHeight() / 2);
      ctx.lineTo(width, this.getLaneY(i) - this.getLaneHeight() / 2);
      ctx.stroke();
    }
  },

  drawPlayer(ctx) {
    ctx.setFillStyle('#f8fafc');
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.setFillStyle('#38bdf8');
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y - 10, 6, 0, Math.PI * 2);
    ctx.fill();
  },

  drawItems(ctx) {
    this.items.forEach((item) => {
      if (item.kind === 'bomb') {
        ctx.setFillStyle('#f87171');
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.setStrokeStyle('#1f2937');
        ctx.setLineWidth(2);
        ctx.beginPath();
        ctx.moveTo(item.x - 6, item.y - 6);
        ctx.lineTo(item.x + 6, item.y + 6);
        ctx.stroke();
      } else {
        const colorMap = {
          'coin-small': '#facc15',
          'coin-medium': '#fbbf24',
          'coin-large': '#f59e0b'
        };
        ctx.setFillStyle(colorMap[item.kind] || '#facc15');
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.setFillStyle('#92400e');
        ctx.setFontSize(10);
        ctx.fillText('+', item.x - 3, item.y + 3);
      }
    });
    if (!this.data.isRunning && this.data.message) {
      ctx.setFillStyle('rgba(15, 23, 42, 0.6)');
      ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      ctx.setFillStyle('#f8fafc');
      ctx.setFontSize(18);
      ctx.setTextAlign('center');
      ctx.fillText(
        this.data.message,
        this.data.canvasWidth / 2,
        this.data.canvasHeight / 2
      );
      ctx.setTextAlign('left');
    }
  }
});
