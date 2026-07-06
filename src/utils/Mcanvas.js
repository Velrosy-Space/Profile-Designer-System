const Canvas = require('canvas');
const fs = require('fs');
const gifFrames = require('gif-frames');
const GIFEncoder = require('gifencoder');
const getStream = require('get-stream');

function isGifBuffer(buf) {
  if (!buf || buf.length < 3) return false;
  return buf.slice(0, 3).toString() === 'GIF';
}
async function bufferFromStream(stream) { return await getStream.buffer(stream); }

const DEFAULTS = {
  logicalWidth: 1200,
  logicalHeight: 700,
  scale: 2,                     
  bannerBlur: 20,               
  bannerScaleCover: 1.15,        
  bannerDesaturate: 0.9,        
  vignetteAlpha: 0.4,           
  avatarBorderThickness: 12,    
  bannerBorderThickness: 8,     
  avatarShadowBlur: 30,         
  avatarShadowOpacity: 0.4,     
  defaultPrimary: '#2b2329',    
  defaultAccent: '#5e4354'
};


function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function createCircularMaskedImage(img, size) {
  const tmp = Canvas.createCanvas(size, size);
  const tctx = tmp.getContext('2d');
  tctx.clearRect(0, 0, size, size);

  const iw = img.width, ih = img.height, ir = iw / ih;
  const target = size / size;
  let dw, dh, dx, dy;
  if (ir > target) {
    dh = size; dw = dh * ir; dx = - (dw - size) / 2; dy = 0;
  } else {
    dw = size; dh = dw / ir; dx = 0; dy = - (dh - size) / 2;
  }

  tctx.drawImage(img, dx, dy, dw, dh);

  const mask = Canvas.createCanvas(size, size);
  const mctx = mask.getContext('2d');
  mctx.clearRect(0, 0, size, size);
  mctx.beginPath();
  mctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  mctx.closePath();
  mctx.fillStyle = '#fff';
  mctx.fill();

  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(mask, 0, 0);
  tctx.globalCompositeOperation = 'source-over';

  return tmp;
}

function buildBlurredBannerCache(ctxMain, bannerImg, bannerW, bannerH, opts) {
  const bgScale = opts.bannerScaleCover || DEFAULTS.bannerScaleCover;
  const blur = Math.max(0, opts.bannerBlur || DEFAULTS.bannerBlur);
  const saturation = DEFAULTS.bannerDesaturate;

  const temp = Canvas.createCanvas(Math.round(bannerW * bgScale), Math.round(bannerH * bgScale));
  const tctx = temp.getContext('2d');

  const imgRatio = bannerImg.width / bannerImg.height;
  const targetRatio = temp.width / temp.height;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > targetRatio) {
    drawH = temp.height; drawW = drawH * imgRatio;
    drawX = - (drawW - temp.width) / 2; drawY = 0;
  } else {
    drawW = temp.width; drawH = drawW / imgRatio;
    drawX = 0; drawY = - (drawH - temp.height) / 2;
  }

  tctx.filter = `blur(${blur}px) saturate(${saturation})`;
  tctx.drawImage(bannerImg, drawX, drawY, drawW, drawH);
  tctx.filter = 'none';


  tctx.fillStyle = 'rgba(0,0,0,0.45)'; 
  tctx.fillRect(0, 0, temp.width, temp.height);

  return temp;
}

function drawVignette(ctx, width, height, alpha) {
  ctx.save();
  const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4, width / 2, height / 2, Math.max(width, height) * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawSoftShadow(ctx, cx, cy, radius) {
  ctx.save();
  ctx.translate(cx, cy + 8); 
  
  const g = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius * 1.6);
  g.addColorStop(0, `rgba(0,0,0,${DEFAULTS.avatarShadowOpacity})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.filter = `blur(${DEFAULTS.avatarShadowBlur}px)`;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'none';
  ctx.restore();
}


async function drawMatchingLayout_Clean(ctx, logicalW, logicalH, assets, primaryHex, accentHex) {
  const { bannerImg, avatarImg, avatar2Img } = assets;


  const color1 = primaryHex || DEFAULTS.defaultPrimary;
  const color2 = accentHex || DEFAULTS.defaultAccent;
  
  const themeGradient = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  themeGradient.addColorStop(0, color1);
  themeGradient.addColorStop(1, color2);

  
  const bannerW = logicalW * 0.88;
  const bannerHcard = logicalH * 0.45;
  const bannerX = (logicalW - bannerW) / 2;
  const bannerY = logicalH * 0.12;

  const avatarSize = 250; 
  const avatarY = bannerY + bannerHcard - (avatarSize / 2); 
  

  const gap = 35; 
  const avatar1X = (logicalW / 2) - avatarSize - (gap / 2);
  const avatar2X = (logicalW / 2) + (gap / 2);


  if (bannerImg) {
    const bcan = buildBlurredBannerCache(ctx, bannerImg, logicalW, logicalH, { bannerBlur: DEFAULTS.bannerBlur });
    ctx.drawImage(bcan, 0, 0, logicalW, logicalH);
  } else {
    ctx.fillStyle = '#1e1b1e';
    ctx.fillRect(0, 0, logicalW, logicalH);
  }


  ctx.save();
  drawRoundedRectPath(ctx, bannerX, bannerY, bannerW, bannerHcard, 30); 
  ctx.clip();

  if (bannerImg) {
    const imgRatio = bannerImg.width / bannerImg.height;
    const targetRatio = bannerW / bannerHcard;
    let drawW, drawH, drawX, drawY;
    if (imgRatio > targetRatio) {
      drawH = bannerHcard; drawW = drawH * imgRatio;
      drawX = bannerX - (drawW - bannerW) / 2; drawY = bannerY;
    } else {
      drawW = bannerW; drawH = drawW / imgRatio;
      drawX = bannerX; drawY = bannerY - (drawH - bannerHcard) / 2;
    }
    ctx.drawImage(bannerImg, drawX, drawY, drawW, drawH);
  }
  ctx.restore();

  
  ctx.save();
  ctx.lineWidth = DEFAULTS.bannerBorderThickness;
  ctx.strokeStyle = themeGradient;
  drawRoundedRectPath(ctx, bannerX, bannerY, bannerW, bannerHcard, 30);
  ctx.stroke();
  ctx.restore();


  if (avatarImg) {
    const circ = await createCircularMaskedImage(avatarImg, avatarSize);
    const cx = avatar1X + avatarSize / 2;
    const cy = avatarY + avatarSize / 2;

    drawSoftShadow(ctx, cx, cy, avatarSize / 2);
    ctx.drawImage(circ, avatar1X, avatarY, avatarSize, avatarSize);


    ctx.save();
    ctx.lineWidth = DEFAULTS.avatarBorderThickness;
    ctx.strokeStyle = themeGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }


  if (avatar2Img) {
    const circ2 = await createCircularMaskedImage(avatar2Img, avatarSize);
    const cx2 = avatar2X + avatarSize / 2;
    const cy2 = avatarY + avatarSize / 2;

    drawSoftShadow(ctx, cx2, cy2, avatarSize / 2);
    ctx.drawImage(circ2, avatar2X, avatarY, avatarSize, avatarSize);

    
    ctx.save();
    ctx.lineWidth = DEFAULTS.avatarBorderThickness;
    ctx.strokeStyle = themeGradient;
    ctx.beginPath();
    ctx.arc(cx2, cy2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  
  drawVignette(ctx, logicalW, logicalH, DEFAULTS.vignetteAlpha);
}


async function extractFramesMaybe(buf) {
  if (!buf) return [];
  if (!isGifBuffer(buf)) return [{ buffer: buf, delayMs: 100 }];
  const frames = [];
  const result = await gifFrames({ url: buf, frames: 'all', outputType: 'png', cumulative: true });
  for (const f of result) {
    const b = await bufferFromStream(f.getImage());
    const delayUnits = (f.frameInfo && (f.frameInfo.delay != null)) ? f.frameInfo.delay : 10;
    const delayMs = Math.max(20, delayUnits * 10);
    frames.push({ buffer: b, delayMs });
  }
  return frames;
}


async function createMatchingImage({ avatarBuffer, avatar2Buffer, bannerBuffer, primaryHex, accentHex }) {
  const logicalWidth = DEFAULTS.logicalWidth;
  const logicalHeight = DEFAULTS.logicalHeight;
  const scale = DEFAULTS.scale;
  const width = logicalWidth * scale;
  const height = logicalHeight * scale;

  const avatar1IsGif = isGifBuffer(avatarBuffer);
  const avatar2IsGif = isGifBuffer(avatar2Buffer);
  const bannerIsGif = isGifBuffer(bannerBuffer);

  if (!avatar1IsGif && !avatar2IsGif && !bannerIsGif) {
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const assets = {
      avatarImg: avatarBuffer ? await Canvas.loadImage(avatarBuffer) : null,
      avatar2Img: avatar2Buffer ? await Canvas.loadImage(avatar2Buffer) : null,
      bannerImg: bannerBuffer ? await Canvas.loadImage(bannerBuffer) : null
    };

    await drawMatchingLayout_Clean(ctx, logicalWidth, logicalHeight, assets, primaryHex, accentHex);

    return canvas.toBuffer('image/png');
  }

  const framesA = await extractFramesMaybe(avatarBuffer);
  const framesB = await extractFramesMaybe(avatar2Buffer);
  const framesBanner = await extractFramesMaybe(bannerBuffer);

  if (framesA.length === 0) framesA.push({ buffer: null, delayMs: 100 });
  if (framesB.length === 0) framesB.push({ buffer: null, delayMs: 100 });

  const frameCount = Math.max(framesA.length, framesB.length, framesBanner.length || 1);

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(8);

  const stream = encoder.createReadStream();
  const outPromise = getStream.buffer(stream);

  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  let bannerImgForCache = null;
  if (framesBanner.length) {
    for (const f of framesBanner) { if (f.buffer) { bannerImgForCache = await Canvas.loadImage(f.buffer); break; } }
  }

  for (let i = 0; i < frameCount; i++) {
    const aFrame = framesA[i % framesA.length];
    const bFrame = framesB[i % framesB.length];
    const banFrame = framesBanner.length ? framesBanner[i % framesBanner.length] : null;

    const assets = {
      avatarImg: aFrame.buffer ? await Canvas.loadImage(aFrame.buffer) : (avatarBuffer ? await Canvas.loadImage(avatarBuffer) : null),
      avatar2Img: bFrame.buffer ? await Canvas.loadImage(bFrame.buffer) : (avatar2Buffer ? await Canvas.loadImage(avatar2Buffer) : null),
      bannerImg: banFrame && banFrame.buffer ? await Canvas.loadImage(banFrame.buffer) : (bannerImgForCache || null)
    };

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(scale, scale);
    await drawMatchingLayout_Clean(ctx, logicalWidth, logicalHeight, assets, primaryHex, accentHex);
    ctx.restore();

    const delayMs = Math.max(aFrame.delayMs || 100, bFrame.delayMs || 100, (banFrame ? (banFrame.delayMs || 100) : 100));
    encoder.setDelay(delayMs);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  const buf = await outPromise;
  return buf;
}

module.exports = { createMatchingImage, isGifBuffer };
