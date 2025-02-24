const { google } = require('googleapis');
const config = require('../config.json');


const youtube = google.youtube({
    version: 'v3',
    auth: config.youtube.apiKey
});


async function getChannelInfo(channelId) {
    try {
        const response = await youtube.channels.list({
            part: 'snippet,statistics',
            id: channelId
        });
        return response.data.items[0];
    } catch (error) {
        console.error('Error fetching channel:', error);
        return null;
    }
}


async function getLatestVideo(channelId) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            channelId: channelId,
            order: 'date',
            maxResults: 1,
            type: 'video'
        });
        return response.data.items[0];
    } catch (error) {
        console.error('Error fetching latest video:', error);
        return null;
    }
}

module.exports = {
    youtube,
    getChannelInfo,
    getLatestVideo
};
