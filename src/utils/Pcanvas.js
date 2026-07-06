const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const gifFrames = require('gif-frames');
const GIFEncoder = require('gifencoder');
const getStream = require('get-stream');
const path = require('path');


function isGifBuffer(buf) {
  if (!buf || buf.length < 3) return false;
  return buf.slice(0, 3).toString() === 'GIF';
}



async function bufferFromStream(stream) {
  return await getStream.buffer(stream);
}


function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}


function drawDiscordLayout(ctx, width, height, assets, data, theme) {
  const { bannerImg, avatarImg, badgesImg } = assets;
  const { username, displayName } = data;
  const { primaryHex, accentHex } = theme;

  ctx.save();


  const cardFrameThickness = 12; 
  const cardCornerRadius = 30; 


  const innerWidth = width - (cardFrameThickness * 2);
  const innerHeight = height - (cardFrameThickness * 2);

  const bannerH = 300;
  const avatarSize = 210;
  const avatarX = cardFrameThickness + 60; 
  const avatarY = cardFrameThickness + bannerH - 105;
  const borderThickness = 12; 

  
  const cardFrameGrad = ctx.createLinearGradient(0, 0, 0, height);
  cardFrameGrad.addColorStop(0, primaryHex || '#f2c4d0');
  cardFrameGrad.addColorStop(1, accentHex || '#6c0a23'); 

  
  ctx.save();
  ctx.beginPath();
  
  drawRoundedRect(ctx, cardFrameThickness, cardFrameThickness, innerWidth, innerHeight, cardCornerRadius - (cardFrameThickness/2)); 
  ctx.clip(); 

  
  const bgGrad = ctx.createLinearGradient(0, cardFrameThickness, 0, innerHeight + cardFrameThickness); 
  bgGrad.addColorStop(0, primaryHex || '#f2c4d0');
  bgGrad.addColorStop(0.35, primaryHex || '#f2c4d0'); 
  bgGrad.addColorStop(1, accentHex || '#6c0a23');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(cardFrameThickness, cardFrameThickness, innerWidth, innerHeight); 

  
  ctx.save();
  ctx.beginPath();

  drawRoundedRect(ctx, cardFrameThickness, cardFrameThickness, innerWidth, bannerH, cardCornerRadius - (cardFrameThickness/2)); 
  ctx.clip();

  if (bannerImg) {
    const scale = Math.max(innerWidth / bannerImg.width, bannerH / bannerImg.height);
    const x = cardFrameThickness + (innerWidth / 2) - (bannerImg.width / 2) * scale;
    const y = cardFrameThickness + (bannerH / 2) - (bannerImg.height / 2) * scale;
    ctx.drawImage(bannerImg, x, y, bannerImg.width * scale, bannerImg.height * scale);

    const shadowGrad = ctx.createLinearGradient(0, cardFrameThickness + bannerH - 50, 0, cardFrameThickness + bannerH);
    shadowGrad.addColorStop(0, 'transparent');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(cardFrameThickness, cardFrameThickness + bannerH - 50, innerWidth, 50);
  } else {
    
    ctx.fillStyle = primaryHex || '#f2c4d0';
    ctx.fillRect(cardFrameThickness, cardFrameThickness, innerWidth, bannerH);
  }
  ctx.restore(); 

  
  ctx.save();
  
  ctx.fillStyle = primaryHex || '#f2c4d0'; 
  
  ctx.beginPath();
  ctx.arc(avatarX + (avatarSize / 2), avatarY + (avatarSize / 2), (avatarSize / 2) + borderThickness, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + (avatarSize / 2), avatarY + (avatarSize / 2), avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#2b2d31'; 
    ctx.fill();
  }
  ctx.restore();

  
  const textX = avatarX;
  let textY = avatarY + avatarSize + 70;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 60px "Arial", sans-serif';
  ctx.fillText(displayName || 'Discord User', textX, textY);

  textY += 55;
  ctx.fillStyle = '#B5BAC1'; 
  ctx.font = '36px "Arial", sans-serif';
  ctx.fillText(`@${username || 'user'}`, textX, textY);
  ctx.restore();

  
  if (badgesImg) {
    const badgesH = 320;    
    const extraLeft = 5;  
    const innerPadding = 20; 
    const fixedCapsuleHeight = 80; 

    const ratio = badgesImg.width / badgesImg.height;
    const badgesW = Math.round(badgesH * ratio);

    const bX = width - Math.round((badgesW)) - 65 - cardFrameThickness; 
    const bY = cardFrameThickness + bannerH + 45; 

    const originalCapsuleX = Math.round(bX - 25);
    const originalCapsuleWidth = Math.round(Math.round(badgesW) + 20);

    let capsuleX = originalCapsuleX - extraLeft;
    if (capsuleX < cardFrameThickness + 12) capsuleX = cardFrameThickness + 12; 
    const capsuleWidth = originalCapsuleWidth + extraLeft;

    const capsuleHeight = fixedCapsuleHeight;

    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; 
    drawRoundedRect(ctx, capsuleX, bY - 15, capsuleWidth, capsuleHeight, 25);
    ctx.fill();

    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, capsuleX, bY - 15, capsuleWidth, capsuleHeight, 25);
    ctx.stroke();

    
    const availableW = capsuleWidth - (innerPadding * 2);

    let drawW = badgesW;
    let drawH = badgesH;

    const maxAllowedW = Math.round(innerWidth - 22); 
    if (drawW > maxAllowedW) {
      drawW = maxAllowedW;
      drawH = Math.round(drawW / ratio);
    }

    const overflowW = Math.max(0, drawW - availableW);
    const overflowShift = Math.round(overflowW / 2);

    let badgesDrawX = capsuleX + innerPadding - overflowShift;
    if (badgesDrawX < capsuleX + 8) badgesDrawX = capsuleX + 8; 

    const badgesDrawY = (bY - 15) + Math.round((capsuleHeight - drawH) / 2) - 40;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(badgesImg, badgesDrawX, badgesDrawY, drawW, drawH);

    ctx.restore();
  }

  ctx.restore(); 

  
  ctx.save();
  ctx.strokeStyle = cardFrameGrad; 
  ctx.lineWidth = cardFrameThickness;
  
  
  drawRoundedRect(ctx, 0, 0, width, height, cardCornerRadius);
  ctx.stroke(); 

  ctx.restore(); 

  ctx.restore(); 
}


async function createProfileImage(options) {
   
  const { 
    avatarBuffer, bannerBuffer, username, displayName, primaryHex = '#f2c4d0', accentHex = '#6c0a23'
  } = options;

  const width = 1000;
  const height = 650;

  let badgesImg = null;
  const badgesPath = path.join(__dirname, '..', '..', 'Assets', 'badges.png');

  if (fs.existsSync(badgesPath)) {
    badgesImg = await loadImage(badgesPath).catch(() => null);
  }

  const avatarIsGif = isGifBuffer(avatarBuffer);
  const bannerIsGif = isGifBuffer(bannerBuffer);

  
  if (!avatarIsGif && !bannerIsGif) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const [avatarImg, bannerImg] = await Promise.all([
      avatarBuffer ? loadImage(avatarBuffer) : null,
      bannerBuffer ? loadImage(bannerBuffer) : null
    ]);

    drawDiscordLayout(ctx, width, height, 
      { bannerImg, avatarImg, badgesImg }, 
      { username, displayName }, 
      { primaryHex, accentHex }
    );
    return canvas.encodeSync('png'); 
  }


  const extractFrames = async (buffer) => {
    if (!buffer) return [];
    if (!isGifBuffer(buffer)) {
      const img = await loadImage(buffer);
      return [{ img, delay: 10 }];
    }
    const frames = await gifFrames({ url: buffer, frames: 'all', outputType: 'png', cumulative: true });
    return Promise.all(frames.map(async f => ({
      buffer: await bufferFromStream(f.getImage()),
      delay: f.frameInfo.delay || 10
    })));
  };

  const [avatarFrames, bannerFrames] = await Promise.all([
    extractFrames(avatarBuffer),
    extractFrames(bannerBuffer)
  ]);

  if (avatarFrames.length === 0) avatarFrames.push({ delay: 10 });
  if (bannerFrames.length === 0) bannerFrames.push({ delay: 10 });

  const totalFrames = Math.min(Math.max(avatarFrames.length, bannerFrames.length), 40); 
  const encoder = new GIFEncoder(width, height);
  const stream = encoder.createReadStream();
  
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(10); 
  encoder.setTransparent(0x00000000);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < totalFrames; i++) {
    const avF = avatarFrames[i % avatarFrames.length];
    const bnF = bannerFrames[i % bannerFrames.length];
    const avatarImg = avF.img || (avF.buffer ? await loadImage(avF.buffer) : null);
    const bannerImg = bnF.img || (bnF.buffer ? await loadImage(bnF.buffer) : null);

    ctx.clearRect(0, 0, width, height);
    drawDiscordLayout(ctx, width, height, 
      { bannerImg, avatarImg, badgesImg }, 
      { username, displayName }, 
      { primaryHex, accentHex }
    );
    encoder.setDelay((avF.delay || 10) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return await bufferFromStream(stream);
}

module.exports = { 
    createProfileImage, 
    isGifBuffer 
};
