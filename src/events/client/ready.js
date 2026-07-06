const { Events, ActivityType } = require('discord.js');
const startProfileFlow = require('../../flow/profileFlow');
const startMatchingFlow = require('../../flow/matchingFlow');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ ${client.user.username} is alive and operational!`);

        try {
            await startProfileFlow(client);
            await startMatchingFlow(client);
            console.log('🚀 Profile and Matching flows are now active!');
        } catch (err) {
            console.error('❌ Error starting flows:', err);
        }

        const activities = [
            `Status 1`,
            `Status 2`,
            `Try New Profile`,
        ];

        const updateStatus = () => {
            const name = activities[Math.floor(Math.random() * activities.length)];
            client.user.setPresence({
                activities: [{ 
                    name, 
                    type: ActivityType.Streaming, 
                    url: "https://www.twitch.tv/test"
                }],
                status: 'idle'
            });
        };

        updateStatus(); 
        setInterval(updateStatus, 10000); 
    },
};
