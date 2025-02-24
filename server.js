const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const { client, verificationTokens } = require('./discord-bot');
const { youtube, getChannelInfo, getLatestVideo } = require('./utils/youtube');
const crypto = require('crypto');
const { createHash } = require('crypto');
const pixelmatch = require('pixelmatch');
const sharp = require('sharp');


const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, 
        files: 1
    }
});


if (!fs.existsSync('watermarks')) {
    fs.mkdirSync('watermarks');
}


async function getImageHash(buffer) {
    const resizedBuffer = await sharp(buffer)
        .resize(100, 100, { fit: 'fill' })
        .toBuffer();
    return createHash('sha256').update(resizedBuffer).digest('hex');
}


async function checkWatermarkMatch(buffer) {
    const hash = await getImageHash(buffer);
    const watermarkFiles = fs.readdirSync('watermarks');
    
    for (const file of watermarkFiles) {
        const watermarkBuffer = fs.readFileSync(path.join('watermarks', file));
        const watermarkHash = await getImageHash(watermarkBuffer);
        if (hash === watermarkHash) {
            return true;
        }
    }
    return false;
}


async function blacklistUser(userId) {
    try {
        const bannedUsers = JSON.parse(fs.readFileSync('banned-users.json', 'utf8') || '[]');
        if (!bannedUsers.includes(userId)) {
            bannedUsers.push(userId);
            fs.writeFileSync('banned-users.json', JSON.stringify(bannedUsers, null, 2));
            console.log(`User ${userId} has been blacklisted`);
            
            
            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('⛔ Account Blacklisted')
                            .setDescription('Your account has been blacklisted from using the verification system for attempting to use fake screenshots.')
                            .setTimestamp()
                    ]
                });
            } catch (dmError) {
                console.error('Could not send blacklist notification:', dmError);
            }
        }
    } catch (error) {
        console.error('Error blacklisting user:', error);
    }
}

const app = express();


app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use(express.static('frontend'));
app.use(express.json());


const authMiddleware = (req, res, next) => {
    const { userid, token } = req.query;
    
    if (!userid || !token) {
        return res.status(401).json({ error: 'Missing authentication parameters' });
    }

    const verification = verificationTokens.get(token);
    if (!verification) {
        return res.status(401).json({ error: 'Invalid verification token' });
    }

    if (verification.userId !== userid) {
        return res.status(401).json({ error: 'User ID mismatch' });
    }

    if (Date.now() - verification.timestamp > config.verificationTimeout) {
        verificationTokens.delete(token);
        return res.status(401).json({ error: 'Verification token expired' });
    }

    req.discordUserId = userid;
    next();
};


app.post('/check-subscription', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        
        const bannedUsers = JSON.parse(fs.readFileSync('banned-users.json', 'utf8') || '[]');
        if (bannedUsers.includes(req.discordUserId)) {
            
            verificationTokens.delete(req.query.token);
            return res.status(403).json({ 
                error: 'Your account has been blacklisted from using this service',
                banned: true,
                sessionTerminated: true
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        if (!req.file.mimetype.match(/^image\/(png|jpeg|jpg)$/)) {
            return res.status(400).json({ error: 'Invalid file type' });
        }

        
        const isWatermarked = await checkWatermarkMatch(req.file.buffer);
        if (isWatermarked) {
            await blacklistUser(req.discordUserId);
            
            verificationTokens.delete(req.query.token);
            return res.status(403).json({ 
                error: 'Account blacklisted for using watermarked image',
                banned: true,
                sessionTerminated: true
            });
        }

        
        const result = await Tesseract.recognize(
            req.file.buffer,
            'eng',
            { 
                logger: m => console.log(m),
                errorHandler: err => console.error('Tesseract Error:', err),
                
                langPath: 'https://tessdata.projectnaptha.com/4.0.0',
                
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
                tessedit_pageseg_mode: '1'
            }
        );

        const text = result.data.text.toLowerCase();
        console.log('Raw OCR text:', text);

        
        const cleanText = text
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        console.log('Cleaned text:', cleanText);

        
        const subscribeTexts = JSON.parse(fs.readFileSync('translations.json', 'utf8'));
        const subscribeCheck = subscribeTexts.some(subText => {
            const found = cleanText.includes(subText.toLowerCase());
            console.log(`Checking "${subText}": ${found}`);
            return found;
        });

        
        const channelVariants = ['krex', 'крекс', 'кrех', 'кrex', 'kreks'];
        const channelCheck = channelVariants.some(name => 
            cleanText.includes(name.toLowerCase())
        );

        
        const isSubscribed = subscribeCheck;
        const channelName = channelCheck ? 'Krex' : null;

        
        const verificationData = {
            success: true,
            isSubscribed: isSubscribed && channelCheck, 
            channelName: channelName,
            requirements: config.youtube.requiredActions,
            details: {
                subscriptionFound: subscribeCheck,
                channelFound: channelCheck,
                debug: {
                    rawText: text.substring(0, 100),
                    cleanText: cleanText.substring(0, 100)
                }
            }
        };

        
        if (verificationData.isSubscribed) {
            try {
                const guild = client.guilds.cache.get(config.guildId);
                const member = await guild.members.fetch(req.discordUserId);
                await member.roles.add(config.subscribedRoleId);

                
                try {
                    const user = await client.users.fetch(req.discordUserId);
                    const successEmbed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle('✅ Verification Successful!')
                        .setDescription(
                            '**Congratulations!**\n\n' +
                            '• You have been verified as a Krex subscriber\n' +
                            '• Your subscriber role has been assigned\n' +
                            '• You now have access to subscriber channels\n\n' +
                            '`🎉 Thank you for subscribing to Krex!`'
                        )
                        .setThumbnail(guild.iconURL()) 
                        .setTimestamp();

                    await user.send({ embeds: [successEmbed] });
                } catch (dmError) {
                    console.error('DM send error:', dmError);
                    
                }

                verificationTokens.delete(req.query.token);
                verificationData.sessionTerminated = true;
                
                verificationData.success = true;
            } catch (roleError) {
                console.error('Role assignment error:', roleError);
                return res.status(500).json({ error: 'Failed to assign role' });
            }
        }

        console.log('Final verification result:', verificationData);
        res.json(verificationData);

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ 
            error: 'Image processing failed', 
            details: error.message 
        });
    }
});


app.post('/admin/add-watermark', async (req, res) => {
    
    if (req.headers['x-admin-key'] !== config.adminKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const upload = multer({ storage: multer.memoryStorage() }).single('image');
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const hash = await getImageHash(req.file.buffer);
        fs.writeFileSync(path.join('watermarks', `${hash}.png`), req.file.buffer);
        
        res.json({ success: true, message: 'Watermark added' });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));
