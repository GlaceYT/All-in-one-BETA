const dotenv = require('dotenv');
const client = require('./main');
const aiManager = require('./utils/AIManager');
dotenv.config();

const AiChat = require('./models/aichat/aiModel');

const activeChannelsCache = new Map();
const MESSAGE_HISTORY_SIZE = 10;
const conversationHistory = new Map();

function getConversationContext(channelId) {
    if (!conversationHistory.has(channelId)) {
        conversationHistory.set(channelId, []);
    }
    return conversationHistory.get(channelId);
}

function addToConversationHistory(channelId, role, text) {
    const history = getConversationContext(channelId);
    history.push({ role, text });
    if (history.length > MESSAGE_HISTORY_SIZE) {
        history.shift();
    }
}

async function isAIChatChannel(channelId, guildId) {
    const cacheKey = `${guildId}-${channelId}`;
    if (activeChannelsCache.has(cacheKey)) {
        return activeChannelsCache.get(cacheKey);
    }

    try {
        const config = await AiChat.findActiveChannel(guildId, channelId);
        const isActive = !!config;
        activeChannelsCache.set(cacheKey, isActive);
        setTimeout(() => activeChannelsCache.delete(cacheKey), 5 * 60 * 1000);
        return isActive;
    } catch (error) {
        console.error(`Error checking AI chat status for ${channelId}:`, error);
        return false;
    }
}

async function getGeminiResponse(prompt, channelId) {
    try {
        const history = getConversationContext(channelId);
        const contents = [];
        contents.push({
            role: "user",
            parts: [{ text: "You are a helpful Discord bot assistant. Keep your responses concise and friendly. Don't use markdown formatting." }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Understood. I'll keep responses concise and friendly." }]
        });

        for (const msg of history) {
            contents.push({
                role: msg.role === "bot" ? "model" : "user",
                parts: [{ text: msg.text }]
            });
        }

        contents.push({ role: "user", parts: [{ text: prompt }] });

        const response = await aiManager.generateContent(contents, {
            model: "gemini-2.5-flash",
            timeout: 30000
        });

        return response.text();

    } catch (error) {
        console.error('Error getting Gemini response:', error.message);
        if (error.message.includes('blocked') || error.message.includes('safety')) {
            return "Sorry, I can't respond to that due to content guidelines.";
        } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
            return "High demand right now — please try again later.";
        } else if (error.message.includes('No active Gemini API keys')) {
            return "AI services are temporarily unavailable. Please contact the admin.";
        }
        return "Sorry, I encountered an error while processing your request.";
    }
}

client.once('ready', async () => {
    console.log(`✅ Bot Logged in as: ${client.user.tag}`);
    console.log(`🧠 AI Manager Ready`);
    
    try {
        const stats = await aiManager.getStats();
        console.log(`🧠 AI Manager: ${stats.activeKeys}/${stats.totalKeys} keys active, ${stats.successRate} success rate`);
    } catch (error) {
        console.error('Failed to get AI manager stats:', error.message);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isActive = await isAIChatChannel(message.channel.id, message.guild.id);
    if (!isActive) return;

    await message.channel.sendTyping();

    try {
        addToConversationHistory(message.channel.id, "user", message.content);
        const aiResponse = await getGeminiResponse(message.content, message.channel.id);
        addToConversationHistory(message.channel.id, "bot", aiResponse);

        if (aiResponse.length > 2000) {
            for (let i = 0; i < aiResponse.length; i += 2000) {
                await message.reply(aiResponse.substring(i, i + 2000));
            }
        } else {
            await message.reply(aiResponse);
        }
    } catch (error) {
        console.error('Error in AI chat response:', error);
        let msg = "Sorry, I encountered an error processing your message.";
        if (error.message.includes('rate limit')) msg = "I'm overloaded. Please wait a bit.";
        if (error.message.includes('blocked')) msg = "That request violates my safety rules.";
        await message.reply(msg);
    }
});

module.exports = {
    isServerOnline: () => true,
    getAIStats: async () => {
        try {
            return await aiManager.getStats();
        } catch (error) {
            return { error: error.message };
        }
    }
};
