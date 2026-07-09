const { connectToDatabase } = require('./mongodb');
const initializeBot = require('./utils/intializer');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    await connectToDatabase();
    const client = require('./main');
    await new Promise((resolve) => {
        if (client.isReady()) {
            resolve();
        } else {
            client.once('ready', resolve);
        }
    });
    
    console.log('\n[WAIT] Client ready, loading event handlers...\n');
    await delay(2000); 
    
    await loadEventHandlers(client);
    
    await delay(5000); 
    // require('./shiva'); ❌ حيدناها - فيها التحقق
    console.log('[ SYSTEM ] Shiva Verification Bypassed ✅');
 
    console.log('\n[WAIT] Stabilizing before bot initialization...\n');
    await initializeBot();
    console.log('\n[READY] Bot fully initialized and running.\n');
})();

const loadEventHandlers = async (client) => {
    const log = (msg) => console.log(`[SYSTEM] ${msg}`);
    console.log(`\n===== Bot System Initialization (${new Date().toLocaleString()}) =====\n`);
    
    require('./events/ticketHandler')(client);
    log('Ticket Handler loaded');
    require('./events/voiceChannelHandler')(client);
    log('Voice Channel Handler loaded');
    require('./events/autorole')(client);
    log('Autorole Handler loaded');
    require('./events/nqn')(client);
    log('NQN Handler loaded');
    require('./events/afkHandler')(client);
    log('AFK Handler loaded');
    require('./events/youTubeHandler')(client);
    log('YouTube Notifier loaded');
    require('./events/twitchHandler')(client);
    log('Twitch Notifier loaded');
    require('./events/facebookHandler')(client);
    log('Facebook Notifier loaded');
    require('./events/instagramHandler')(client);
    log('Instagram Notifier loaded');
    
    await delay(3000); 
    
    try {
        require('./events/music')(client);
        log('Lavalink Music System loaded');
    } catch (error) {
        console.error('[ERROR] Failed to load music system:', error);
    }
    
    await delay(3000); 
    
    require('./handlers/distube')(client);
    log('Distube Music System loaded');
    
    console.log(`\n[STATUS] All systems initialized successfully at ${new Date().toLocaleTimeString()}\n`);
};
