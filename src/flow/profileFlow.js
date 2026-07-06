const { createProfileImage, isGifBuffer } = require('../utils/canvas');
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

const {
  ActionRowBuilder,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionsBitField
} = require('discord.js');

const INTERACTION_CHANNEL_ID = '1460649020354728149'; // 🎨 Channel where profile commands are received
// 🗂️ Destination channels based on profile type
const TARGET_CHANNELS = {
  boy: { id: '1457845005518508275', label: 'Boy profile' }, // Boys profiles room id
  girl: { id: '1457845307139162312', label: 'Girl profile' }, // Girls profiles room id
  anime: { id: '1457845411388854495', label: 'Anime profile' } // Anime profiles room id
};


const activeProfileFlows = new Map();


const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
      await msg.reply('❌ The operation has been cancelled.');
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

module.exports = async function startProfileFlow(client) {
  const channel = await client.channels.fetch(INTERACTION_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  
  const starter = channel.createMessageCollector({
    filter: (m) => {
      if (m.author.bot) return false;
      const key = `${m.guild.id}_${m.author.id}`;
      
      if (activeProfileFlows.has(key)) return false;
  
      return m.attachments.size > 0;
    },
    time: 1000 * 60 * 60 
  });

  starter.on('collect', async (m) => {
    const userId = m.author.id;
    const guildId = m.guild.id;
    const flowKey = `${guildId}_${userId}`;

    
    if (activeProfileFlows.has(flowKey)) return;
    activeProfileFlows.set(flowKey, { stage: 'started', startTime: Date.now() });

    const botMessages = [];
    const userMessages = [];
    let cancelled = false;

    const cancelFlow = async (reason) => {
      if (cancelled) return;
      cancelled = true;
      console.log(`[ProfileFlow] Cancelled for ${userId}: ${reason}`);
      await m.author.send(`⚠️ The operation has been cancelled: ${reason}`).catch(() => {});
      
      for (const msg of botMessages) safeDelete(msg, 2000);
      for (const msg of userMessages) safeDelete(msg, 2000);
      activeProfileFlows.delete(flowKey);
    };

    try {
      
      const attach = m.attachments.first();
      if (attach.size > MAX_FILE_SIZE) throw new Error('Avatar exceeds 10MB');
      const avatarBuffer = await fetchImageBuffer(attach.url);
      const avatarMsg = await m.reply('✨ Avatar saved. Now send the banner image – or type none (or cancel to cancel).');
      botMessages.push(avatarMsg);
      userMessages.push(m);

      
      const bannerMsg = await waitForUserMessage(channel, userId);
      if (!bannerMsg) throw new Error('No banner received or timeout');
      if (bannerMsg.content?.toLowerCase() === 'none') {
        userMessages.push(bannerMsg);
        
      } else if (bannerMsg.attachments.size > 0) {
        if (bannerMsg.attachments.first().size > MAX_FILE_SIZE) throw new Error('Banner exceeds 10MB');
        const bannerBuffer = await fetchImageBuffer(bannerMsg.attachments.first().url);
        userMessages.push(bannerMsg);
        
        activeProfileFlows.set(flowKey, { ...activeProfileFlows.get(flowKey), bannerBuffer });
      } else {
        throw new Error('Invalid banner input (must be image or "none")');
      }

      
      const primaryPrompt = await channel.send(`<@${userId}> 🎨 Now send the HEX code for the Primary color (example: #ff0000) – or type cancel to cancel.`);
      botMessages.push(primaryPrompt);
      const primaryMsg = await waitForUserMessage(channel, userId);
      if (!primaryMsg) throw new Error('Primary color timeout');
      if (!isValidHex(primaryMsg.content)) throw new Error('Invalid HEX code for Primary');
      const primary = primaryMsg.content.startsWith('#') ? primaryMsg.content : `#${primaryMsg.content}`;
      userMessages.push(primaryMsg);

      
      const accentPrompt = await channel.send(`<@${userId}> 🎨 Now send the HEX code for the Accent color – or type skip to match the Primary color.`);
      botMessages.push(accentPrompt);
      const accentMsg = await waitForUserMessage(channel, userId);
      let accent = primary;
      if (accentMsg && accentMsg.content.toLowerCase() !== 'skip' && isValidHex(accentMsg.content)) {
        accent = accentMsg.content.startsWith('#') ? accentMsg.content : `#${accentMsg.content}`;
        userMessages.push(accentMsg);
      } else if (accentMsg && accentMsg.content.toLowerCase() !== 'skip') {
        await accentMsg.reply('⚠️ Invalid HEX code. The Primary color will be used instead.').catch(() => {});
        if (accentMsg) userMessages.push(accentMsg);
      } else if (accentMsg) {
        userMessages.push(accentMsg);
      }

      
      const session = activeProfileFlows.get(flowKey);
      const bannerBuffer = session?.bannerBuffer || null;

      
      const finalBuffer = await createProfileImage({
        avatarBuffer,
        bannerBuffer,
        statusIconBuffer: null,
        primaryHex: primary,
        accentHex: accent,
        username: m.author.username,
        displayName: m.member?.displayName || m.author.globalName || m.author.username
      });

      const finalIsGif = isGifBuffer(finalBuffer);
      const finalName = finalIsGif ? `profile_${userId}.gif` : `profile_${userId}.png`;
      const attachmentPreview = new AttachmentBuilder(finalBuffer, { name: finalName });

      
      const options = Object.entries(TARGET_CHANNELS).map(([value, obj]) => ({
        label: obj.label,
        value,
        description: `📤 Sending to ${obj.label}`
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`route_profile_${userId}_${Date.now()}`) 
        .setPlaceholder('📂 Choose the appropriate section')
        .addOptions(options);

      const menuMsg = await channel.send({
        content: `<@${userId}> 🎨 Preview ready! Choose the section:`,
        files: [attachmentPreview],
        components: [new ActionRowBuilder().addComponents(select)]
      });
      botMessages.push(menuMsg);

      
      let interaction;
      try {
        interaction = await menuMsg.awaitMessageComponent({
          filter: i => i.user.id === userId && i.customId.startsWith('route_profile_'),
          componentType: ComponentType.StringSelect,
          time: 120_000 
        });
      } catch (err) {
        
        await channel.send(`<@${userId}> ⏰ Time's up! Please start the process again.`);
        throw new Error('Interaction timeout');
      }

      const chosen = interaction.values[0];
      const targetChannel = await client.channels.fetch(TARGET_CHANNELS[chosen].id);
      if (!targetChannel) throw new Error('Target channel not found');

      await targetChannel.send({
        content: `🎨 **New Profile** By <@${userId}>\n🎨 **Colors:** \`${primary}\` & \`${accent}\``,
        files: [new AttachmentBuilder(finalBuffer, { name: finalName })]
      });

      await interaction.reply({ content: '✅ Profile sent to!', ephemeral: true });

      
      setTimeout(async () => {
        for (const msg of botMessages) safeDelete(msg);
        for (const msg of userMessages) safeDelete(msg);
      }, 8000);

    } catch (err) {
      if (!cancelled) {
        console.error(`[ProfileFlow] Error for user ${userId}:`, err.message);
        await m.author.send(`❌ An error occurred: ${err.message || 'Please try again later.'}`).catch(() => {});
      }
    } finally {
      if (!cancelled) {
        
        activeProfileFlows.delete(flowKey);
        
        setTimeout(() => {
          for (const msg of botMessages) safeDelete(msg);
          for (const msg of userMessages) safeDelete(msg);
        }, 10000);
      }
    }
  });
};
