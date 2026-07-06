const fs = require('fs');
const path = require('path');

class EventHandler {
    constructor(client) {
        this.client = client;
        this.loadEvents(); 
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, '../events');
        if (!fs.existsSync(eventsPath)) {
            console.warn('⚠️ Events folder not found.');
            return;
        }

        const loadRecursive = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    
                    loadRecursive(fullPath);
                } else if (item.endsWith('.js')) {
                    try {
                        const event = require(fullPath);
                        if (!event.name) {  
                            return;
                        }
                        if (event.once) {
                            this.client.once(event.name, (...args) => event.execute(...args, this.client));
                        } else {
                            this.client.on(event.name, (...args) => event.execute(...args, this.client));
                        }
                        console.log(`✅ Loaded event: ${event.name} (${path.relative(eventsPath, fullPath)})`);
                    } catch (err) {
                        console.error(`❌ Failed to load event ${fullPath}:`, err);
                    }
                }
            }
        };

        loadRecursive(eventsPath);
    }
}

module.exports = EventHandler;
