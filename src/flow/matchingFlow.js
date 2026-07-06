const { createMatchingImage, isGifBuffer } = require('../utils/Mcanvas');
const config = require('../config');
/**
 * @param {Buffer} buffer 
 * @returns {string|null} - 'png', 'jpg', 'gif', 'webp', أو null
 */
function getImageTypeFromBuffer(buffer) {
  if (!buffer || buffer.length < 8) return null;
  

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'gif';
  }

  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }
  return null;
}

const { AttachmentBuilder } = require('discord.js');

const INTERACTION_CHANNEL_ID = '1460649090298675374';
const MATCHING_RESULT_CHANNEL_ID = '1457845491583815690';
const MAX_FILE_SIZE = 10 * 1024 * 1024; 


const activeFlows = new Map();

async function waitForUserMessage(channel, userId, time = 1000 * 60 * 3) {
  try {
    const collected = await channel.awaitMessages({
      filter: m => m.author.id === userId && !m.author.bot,
      max: 1,
      time,
      errors: ['time']
    });
    const msg = collected.first();
    if (msg && msg.content.toLowerCase().trim() === 'cancel') {
      await msg.reply('❌ تم إلغاء العملية.');
      return null;
    }
    return msg;
  } catch {
    return null;
  }
}


function isValidHex(h) {
  if (!h || typeof h !== 'string') return false;
  return /^#?[0-9A-Fa-f]{6}$/.test(h.trim());
}


async function fetchImageBuffer(url, maxSize = MAX_FILE_SIZE) {
  const resp = await fetch(url);
  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length > maxSize) throw new Error('File too large (max 10MB)');
  
  
  const imgType = getImageTypeFromBuffer(buffer);
  if (!imgType) {
    throw new Error('Invalid image format (only PNG, JPG, GIF, WEBP allowed)');
  }
  return buffer;
}


async function safeDelete(msg, delay = 0) {
  if (!msg || typeof msg.delete !== 'function') return;
  setTimeout(() => msg.delete().catch(() => {}), delay);
}

module.exports = async function startMatchingFlow(client) {
  const channel = await client.channels.fetch(INTERACTION_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const starter = channel.createMessageCollector({
    filter: (m) => {
      if (m.author.bot) return false;
      const key = `${m.guild.id}_${m.author.id}`;
      if (activeFlows.has(key)) return false;
      return m.attachments.size > 0;
    },
    time: 1000 * 60 * 60 
  });

  starter.on('collect', async (m) => {
    const userId = m.author.id;
    const guildId = m.guild.id;
    const flowKey = `${guildId}_${userId}`;

    if (activeFlows.has(flowKey)) return;
    activeFlows.set(flowKey, { stage: 'started', startTime: Date.now() });

    const botMessages = [];
    const userMessages = [];
    let cancelled = false;

    const cancelFlow = async (reason) => {
      if (cancelled) return;
      cancelled = true;
      console.log(`[MatchingFlow] Cancelled for ${userId}: ${reason}`);
      await m.author.send(`⚠️ تم إلغاء العملية: ${reason}`).catch(() => {});
      for (const msg of botMessages) safeDelete(msg, 2000);
      for (const msg of userMessages) safeDelete(msg, 2000);
      activeFlows.delete(flowKey);
    };

    try {
      
      const attach1 = m.attachments.first();
      if (attach1.size > MAX_FILE_SIZE) throw new Error('Avatar1 exceeds 10MB');
      const avatar1Buffer = await fetchImageBuffer(attach1.url);
      const reply1 = await m.reply('✨ تم حفظ الافتار الأول. أرسل الافتار الثاني (أو `cancel` للإلغاء).');
      botMessages.push(reply1);
      userMessages.push(m);

      
      const msg2 = await waitForUserMessage(channel, userId);
      if (!msg2) throw new Error('No avatar2 received or timeout');
      if (msg2.attachments.size === 0) throw new Error('Avatar2 must be an image');
      if (msg2.attachments.first().size > MAX_FILE_SIZE) throw new Error('Avatar2 exceeds 10MB');
      const avatar2Buffer = await fetchImageBuffer(msg2.attachments.first().url);
      userMessages.push(msg2);
      const reply2 = await msg2.reply('تم حفظ الافتار الثاني. أرسل البنر أو اكتب `none` (أو `cancel`).');
      botMessages.push(reply2);

      
      const bannerMsg = await waitForUserMessage(channel, userId);
      if (!bannerMsg) throw new Error('Banner timeout');
      userMessages.push(bannerMsg);
      let bannerBuffer = null;
      if (bannerMsg.content?.toLowerCase() !== 'none') {
        if (bannerMsg.attachments.size === 0) throw new Error('Banner must be an image or "none"');
        if (bannerMsg.attachments.first().size > MAX_FILE_SIZE) throw new Error('Banner exceeds 10MB');
        bannerBuffer = await fetchImageBuffer(bannerMsg.attachments.first().url);
      }

      
      const primaryPrompt = await channel.send(`<@${userId}> أرسل رمز HEX للـ Primary (مثال: #ff0000) أو \`cancel\`.`);
      botMessages.push(primaryPrompt);
      const primaryMsg = await waitForUserMessage(channel, userId);
      if (!primaryMsg) throw new Error('Primary color timeout');
      if (!isValidHex(primaryMsg.content)) throw new Error('Invalid HEX for Primary');
      const primary = primaryMsg.content.startsWith('#') ? primaryMsg.content : `#${primaryMsg.content}`;
      userMessages.push(primaryMsg);

      
      const accentPrompt = await channel.send(`<@${userId}> أرسل رمز HEX للـ Accent (أو \`skip\` لتطابق Primary).`);
      botMessages.push(accentPrompt);
      const accentMsg = await waitForUserMessage(channel, userId);
      let accent = primary;
      if (accentMsg && accentMsg.content.toLowerCase() !== 'skip' && isValidHex(accentMsg.content)) {
        accent = accentMsg.content.startsWith('#') ? accentMsg.content : `#${accentMsg.content}`;
        userMessages.push(accentMsg);
      } else if (accentMsg && accentMsg.content.toLowerCase() !== 'skip') {
        await accentMsg.reply('⚠️ رمز غير صالح، سيتم استخدام نفس اللون الأساسي.').catch(() => {});
        if (accentMsg) userMessages.push(accentMsg);
      } else if (accentMsg) {
        userMessages.push(accentMsg);
      }

      
      const finalBuffer = await createMatchingImage({
        avatarBuffer: avatar1Buffer,
        avatar2Buffer: avatar2Buffer,
        bannerBuffer,
        primaryHex: primary,
        accentHex: accent
      });


      const targetChannel = await client.channels.fetch(MATCHING_RESULT_CHANNEL_ID);
      const isGif = isGifBuffer(finalBuffer);
      const attachment = new AttachmentBuilder(finalBuffer, {
        name: isGif ? 'matching_vibe.gif' : 'matching_vibe.png'
      });

      await targetChannel.send({
        content: `🎨 **New Matching Profile**\n👤 **By:** <@${userId}>\n🎨 **Colors:** \`${primary}\` & \`${accent}\``,
        files: [attachment]
      });

      const successMsg = await channel.send(`✅ تم إرسال البروفايل إلى <#${MATCHING_RESULT_CHANNEL_ID}>`);
      botMessages.push(successMsg);

      
      setTimeout(async () => {
        for (const msg of botMessages) safeDelete(msg);
        for (const msg of userMessages) safeDelete(msg);
      }, 8000);

    } catch (err) {
      if (!cancelled) {
        console.error(`[MatchingFlow] Error for user ${userId}:`, err.message);
        await channel.send(`<@${userId}> ❌ حدث خطأ: ${err.message || 'يرجى المحاولة لاحقاً'}`).catch(() => {});
      }
    } finally {
      if (!cancelled) {
        activeFlows.delete(flowKey);
        setTimeout(() => {
          for (const msg of botMessages) safeDelete(msg);
          for (const msg of userMessages) safeDelete(msg);
        }, 10000);
      }
    }
  });
};
