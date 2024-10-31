# PinAI Bot

An automated bot for managing PinAI accounts, handling daily tasks, and automatic model upgrades.

## Features

- Automatic token management and renewal
- Daily check-in automation
- Automatic coin collection
- Automatic model upgrades when sufficient points are available
- Multi-account support
- Token expiration monitoring
- Detailed logging system

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Telegram account

## 🛠 Installation

1. Clone this repository:

```bash
git clone https://github.com/Galkurta/PinAI-BOT.git
cd PinAI-BOT
```

2. Install dependencies:

```bash
npm install
```

## Configuration

### 1. Register on PinAI:

- Visit this link to register: [PinAI Registration](https://t.me/hi_PIN_bot/app?startapp=pBVlK4n)
- After registration, copy the initialization data

### 2. Set Up data.txt:

- Edit `data.txt` file in the project root
- Add your initialization data (one account per line)

Example `data.txt` format:

```
user=
query_id=
```

## Usage

Run the bot:

```bash
node main.js
```

The bot will automatically:

- Check and renew tokens if needed
- Perform daily check-ins
- Collect available coins
- Upgrade models when possible
- Run tasks every 24 hours

## Logging

The application uses Winston for logging with the following levels:

- ERROR: For error messages
- WARN: For warnings
- INFO: For general information

Logs include timestamps and are displayed in the console.

## Token Management

Tokens are automatically managed and stored in `token.json`. The bot will:

- Check token validity
- Refresh expired tokens
- Store tokens securely

## Timing

The bot includes:

- 3-second delay between account processing
- 24-hour cycle for task repetition
- Time display in HH:MM:SS format

## Dependencies

- axios: For HTTP requests
- luxon: For date/time handling
- winston: For logging
- fs/path: For file operations

## Important Notes

- Keep your initialization data secure
- Don't share your `token.json` file
- The bot runs continuously until stopped
- Make sure you have a stable internet connection

## Contributing

Feel free to contribute to this project by:

1. Forking the repository
2. Creating your feature branch
3. Committing your changes
4. Pushing to the branch
5. Creating a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
