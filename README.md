# 🔒 YouTube Subscription Verification Bot

A modern Discord bot that verifies YouTube channel subscriptions with screenshot detection and anti-fraud protection.

## ✨ Features

- 🤖 Discord Bot Integration
- 📸 Screenshot Verification
- 🛡️ Anti-Fraud Protection
- 🔍 OCR Text Detection
- 🌐 Multi-language Support
- 🎨 Modern Web Interface
- ⚡ Real-time Processing
- 🔒 Secure Token System

## 🚀 Getting Started

### Prerequisites

```bash
Node.js v16+ required
Discord Bot Token
YouTube API Key
```

### 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/Krex381/youtube-sub-checker.git
cd youtube-sub-checker
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
   - Rename `config.example.json` to `config.json`
   - Fill in your credentials:
     ```json
     {
       "token": "YOUR_DISCORD_BOT_TOKEN",
       "clientId": "YOUR_CLIENT_ID",
       "guildId": "YOUR_GUILD_ID",
       "subscribedRoleId": "ROLE_ID",
       "youtube": {
         "apiKey": "YOUR_YOUTUBE_API_KEY"
       }
     }
     ```

4. Start the bot:
```bash
npm start
```

## 💻 Commands

- `/verify` - Start verification process
- `/setup` - Configure verification settings (Admin only)
- `/watermark` - Add watermark detection (Admin only)

## 🛠️ Configuration

### Required Permissions
- `MANAGE_ROLES` - For assigning roles
- `SEND_MESSAGES` - For sending verification instructions
- `CREATE_INSTANT_INVITE` - For generating verification links

### YouTube API Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable YouTube Data API v3
3. Create API credentials
4. Copy the API key to your config

## 🔐 Security Features

- 🛡️ Screenshot Watermark Detection
- 🚫 Blacklist System
- ⏱️ Token Expiration
- 🔒 Secure Session Management
- 🔍 Fraud Detection

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Krex** - [Website](https://krex38.xyz)

## 🤝 Support

For support, [DM Me](https://discord.com/users/1012249571436548136)

---
<div align="center">
  Made with ❤️ by <a href="https://krex38.xyz">Krex</a>
</div>