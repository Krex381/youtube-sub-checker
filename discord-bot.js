const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes } = require('discord.js');
const crypto = require('crypto');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { getChannelInfo, getLatestVideo } = require('./utils/youtube');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const verificationTokens = new Map();

const commands = [
    {
        name: 'verify',
        description: 'Verify your YouTube subscription'
    },
    {
        name: 'setup',
        description: 'Configure YouTube channel verification settings',
        options: [
            {
                name: 'channel',
                description: 'YouTube Channel ID',
                type: 3, // STRING
                required: true
            },
            {
                name: 'require_like',
                description: 'Require users to like latest video',
                type: 5, // BOOLEAN
                required: true
            },
            {
                name: 'require_comment',
                description: 'Require users to comment on latest video',
                type: 5, // BOOLEAN
                required: true
            }
        ]
    },
    {
        name: 'watermark',
        description: 'Add a watermark image to detection system (Admin only)',
        options: [
            {
                name: 'adminkey',
                description: 'Admin key for authentication',
                type: 3, // STRING
                required: true
            },
            {
                name: 'image',
                description: 'Upload the image to add as watermark',
                type: 11, // ATTACHMENT type
                required: false
            }
        ]
    }
];

async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.once('ready', async () => {
    console.log('Discord bot is ready!');
    await registerCommands();
});

async function isBlacklisted(userId) {
    try {
        const bannedUsers = JSON.parse(fs.readFileSync('banned-users.json', 'utf8') || '[]');
        return bannedUsers.includes(userId);
    } catch (error) {
        console.error('Error checking blacklist:', error);
        return false;
    }
}

const getFooter = (interaction) => ({
    text: 'Developed, Designed & Coded by Krex • krex38.xyz',
    iconURL: interaction.client.user.displayAvatarURL()
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Check blacklist before processing any command
    if (await isBlacklisted(interaction.user.id)) {
        const blacklistedEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⛔ Access Denied')
            .setDescription(
                '```diff\n- Your account has been blacklisted\n```\n' +
                '**Reason:** Attempted to use fake screenshots\n\n' +
                '__This action is permanent and cannot be appealed.__'
            )
            .setThumbnail('https://i.imgur.com/cgLKVYb.jpeg')
            .addFields({
                name: '🚫 Status',
                value: 'Your access to verification has been revoked.',
                inline: true
            })
            .setFooter(getFooter(interaction))
            .setTimestamp();

        return interaction.reply({ 
            embeds: [blacklistedEmbed], 
            ephemeral: true 
        });
    }

    if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Unauthorized')
                        .setDescription('Only administrators can use this command.')
                ],
                ephemeral: true
            });
        }

        const channelId = interaction.options.getString('channel');
        
        const channelInfo = await getChannelInfo(channelId);
        if (!channelInfo) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Invalid Channel')
                        .setDescription('Could not find YouTube channel. Please check the ID.')
                ],
                ephemeral: true
            });
        }

        const requireLike = interaction.options.getBoolean('require_like');
        const requireComment = interaction.options.getBoolean('require_comment');

        const setupEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Verification Requirements Updated')
            .addFields(
                { name: '📺 Channel', value: channelInfo.snippet.title, inline: true },
                { name: '👥 Subscribers', value: channelInfo.statistics.subscriberCount, inline: true },
                { name: '🎥 Videos', value: channelInfo.statistics.videoCount, inline: true },
                { name: '👍 Like Required', value: requireLike ? 'Yes' : 'No', inline: true },
                { name: '💬 Comment Required', value: requireComment ? 'Yes' : 'No', inline: true }
            )
            .setThumbnail(channelInfo.snippet.thumbnails.default.url)
            .setFooter({ text: 'Settings saved successfully' })
            .setTimestamp();

        config.youtube.channelId = channelId;
        config.youtube.requiredActions = {
            subscribe: true,
            like: requireLike,
            comment: requireComment
        };

        fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));

        await interaction.reply({ embeds: [setupEmbed], ephemeral: true });
    }

    if (interaction.commandName === 'verify') {
        try {

            const member = interaction.member;
            if (member.roles.cache.has(config.subscribedRoleId)) {
                const alreadyVerifiedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ Already Verified')
                    .setDescription('You are already verified!')
                    .setTimestamp();

                return interaction.reply({
                    embeds: [alreadyVerifiedEmbed],
                    ephemeral: true
                });
            }

            if (config.youtube.requiredActions.like || config.youtube.requiredActions.comment) {
                const latestVideo = await getLatestVideo(config.youtube.channelId);
                if (latestVideo) {
                    config.youtube.latestVideoId = latestVideo.id.videoId;
                    config.youtube.latestVideoTitle = latestVideo.snippet.title;
                }
            }

            const channelEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📨 Check Your DMs')
                .setDescription('I\'ve sent you verification instructions in your DMs!')
                .setFooter({ 
                    text: 'Make sure your DMs are open',
                    iconURL: interaction.client.user.displayAvatarURL()
                });

            await interaction.reply({
                embeds: [channelEmbed],
                ephemeral: true
            });

            const token = crypto.randomBytes(32).toString('hex');
            const userId = interaction.user.id;
            const verifyUrl = `http://localhost:3000/verify?userid=${userId}&token=${token}`;

            const dmEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔍 YouTube Subscription Verification')
                .setDescription(
                    '**Welcome to Krex\'s Verification System!**\n\n' +
                    '**Required Actions:**\n' +
                    '1. Click the verify button below\n' +
                    '2. Take a screenshot showing you are subscribed to Krex\n' +
                    (config.youtube.requiredActions.like ? 
                        '3. Like the video and ensure the like button is filled/colored\n' : '') +
                    (config.youtube.requiredActions.comment ? 
                        '4. Leave a comment and show it in your screenshot\n' : '') +
                    '\n`📸 Important: Your screenshot must show:\n' +
                    '• Subscribed button\n' +
                    (config.youtube.requiredActions.like ? '• Filled/Colored like button\n' : '') +
                    (config.youtube.requiredActions.comment ? '• Your posted comment\n' : '') +
                    '`' +
                    (config.youtube.latestVideoTitle ? `\n\n**Latest Video:**\n${config.youtube.latestVideoTitle}` : '')
                )
                .addFields(
                    { name: '👤 User', value: `<@${userId}>`, inline: true },
                    { name: '🎯 Status', value: '⏳ Pending Verification', inline: true }
                )
                .setImage('https://i.imgur.com/cgLKVYb.jpeg')
                .setFooter(getFooter(interaction))
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('🔗 Verify Subscription')
                        .setStyle(ButtonStyle.Link)
                        .setURL(verifyUrl)
                );

            const dmMessage = await interaction.user.send({
                embeds: [dmEmbed],
                components: [row]
            });

            verificationTokens.set(token, {
                userId,
                timestamp: Date.now(),
                messageId: dmMessage.id,
                channelId: dmMessage.channelId
            });

        } catch (error) {
            console.error('Verification error:', error);
            if (error.code === 50007) {
                const dmBlockedEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ Cannot Send DM')
                    .setDescription('Please enable DMs from server members and try again.')
                    .setTimestamp();

                await interaction.followUp({
                    embeds: [dmBlockedEmbed],
                    ephemeral: true
                });
                return;
            }

            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ Error')
                .setDescription('Failed to create verification link. Please try again.')
                .setTimestamp();

            await interaction.followUp({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    }

    if (interaction.commandName === 'watermark') {
        try {
            await interaction.deferReply({ ephemeral: true });

            const adminKey = interaction.options.getString('adminkey');
            let attachment = interaction.options.getAttachment('image');

            if (adminKey !== config.adminKey) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('❌ Unauthorized')
                            .setDescription('Invalid admin key.')
                    ]
                });
            }

            if (!attachment) {
                const uploadEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📤 Upload Watermark Image')
                    .setDescription(
                        'Please upload the image by either:\n' +
                        '• Selecting a file\n' +
                        '• Pasting from clipboard (Ctrl+V)\n\n' +
                        '`⏳ Waiting for image... (30s timeout)`'
                    );

                const msg = await interaction.editReply({
                    embeds: [uploadEmbed]
                });

                const filter = m => {
                    return m.author.id === interaction.user.id && 
                           m.attachments.size > 0 &&
                           m.attachments.first().contentType?.startsWith('image/');
                };

                const collector = interaction.channel.createMessageCollector({
                    filter,
                    max: 1,
                    time: 30000
                });

                collector.on('collect', async m => {
                    attachment = m.attachments.first();
                    await processWatermark(interaction, attachment);
                    try {
                        await m.delete();
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                });

                collector.on('end', async collected => {
                    if (collected.size === 0) {
                        await interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('#ED4245')
                                    .setTitle('❌ Timeout')
                                    .setDescription('No image was uploaded within 30 seconds.')
                            ]
                        });
                    }
                });
            } else {
                // Process directly uploaded attachment
                await processWatermark(interaction, attachment);
            }

        } catch (error) {
            console.error('Watermark command error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Error')
                        .setDescription('An error occurred while processing the command.')
                ]
            });
        }
    }
});

// Add helper function to process watermark
async function processWatermark(interaction, attachment) {
    try {
        if (!attachment.contentType?.startsWith('image/')) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Invalid File')
                        .setDescription('Please upload an image file.')
                ]
            });
        }

        const response = await fetch(attachment.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const filePath = path.join(__dirname, 'watermarks', `${hash}.png`);
        
        fs.writeFileSync(filePath, buffer);

        const successEmbed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Watermark Added')
            .setDescription('The image has been added to the watermark detection system.')
            .addFields(
                { name: 'File Name', value: attachment.name, inline: true },
                { name: 'Hash', value: hash, inline: true }
            )
            .setThumbnail(attachment.url)
            .setFooter(getFooter(interaction))
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        console.error('Watermark processing error:', error);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ Error')
                    .setDescription('Failed to process image.')
            ]
        });
    }
}

client.on('error', console.error);
process.on('unhandledRejection', console.error);

module.exports = {
    client,
    verificationTokens
};

client.login(config.token);