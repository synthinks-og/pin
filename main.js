const fs = require("fs");
const path = require("path");
const axios = require("axios");
const readline = require("readline");
const { DateTime } = require("luxon");
const logger = require("./config/logger");
const printBanner = require("./config/banner");

// API Service class to handle all HTTP requests
class ApiService {
  constructor(headers) {
    this.headers = headers;
    this.baseUrl = "https://prod-api.pinai.tech";
  }

  async post(endpoint, data, token = null) {
    try {
      const headers = token
        ? { ...this.headers, Authorization: `Bearer ${token}` }
        : this.headers;
      const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers,
      });
      return response;
    } catch (error) {
      logger.error(`API POST Error (${endpoint}): ${error.message}`);
      throw error;
    }
  }

  async get(endpoint, token = null) {
    try {
      const headers = token
        ? { ...this.headers, Authorization: `Bearer ${token}` }
        : this.headers;
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers,
      });
      return response;
    } catch (error) {
      logger.error(`API GET Error (${endpoint}): ${error.message}`);
      throw error;
    }
  }
}

// Token Manager class to handle token operations
class TokenManager {
  constructor(tokenFilePath) {
    this.tokenFilePath = tokenFilePath;
  }

  loadTokens() {
    try {
      return fs.existsSync(this.tokenFilePath)
        ? JSON.parse(fs.readFileSync(this.tokenFilePath, "utf8"))
        : {};
    } catch (error) {
      logger.error(`Error loading tokens: ${error.message}`);
      return {};
    }
  }

  saveToken(userId, token) {
    try {
      const tokens = this.loadTokens();
      tokens[userId] = { access_token: token };
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2));
      logger.info(`Token saved for account ${userId}`);
    } catch (error) {
      logger.error(`Error saving token: ${error.message}`);
    }
  }

  isExpired(token) {
    try {
      const [, payload] = token.split(".");
      const decodedPayload = JSON.parse(
        Buffer.from(payload, "base64").toString()
      );
      const now = Math.floor(DateTime.now().toSeconds());

      if (decodedPayload.exp) {
        const expirationDate = DateTime.fromSeconds(
          decodedPayload.exp
        ).toLocal();
        logger.info(
          `Token expires at: ${expirationDate.toFormat("yyyy-MM-dd HH:mm:ss")}`
        );
        return now > decodedPayload.exp;
      }
      return false;
    } catch (error) {
      logger.error(`Error checking token expiration: ${error.message}`);
      return true;
    }
  }
}

// User Interface class to handle user interactions
class UserInterface {
  static formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":");
  }

  static async countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Waiting ${this.formatTime(i)} to continue...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // Clear the countdown line
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout);
    process.stdout.write("\r");
  }

  static async askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) =>
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
      })
    );
  }
}

// Points Calculator utility class
class PointsCalculator {
  static parsePoints(points) {
    if (typeof points === "number") return points;

    const multipliers = { K: 1000, M: 1000000 };
    let numericValue = points.replace(/[,]/g, "");

    for (const [suffix, multiplier] of Object.entries(multipliers)) {
      if (points.includes(suffix)) {
        numericValue = parseFloat(points.replace(suffix, "")) * multiplier;
        break;
      }
    }
    return parseFloat(numericValue);
  }
}

// Main PinAi class
class PinAi {
  constructor() {
    this.headers = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US;q=0.6,en;q=0.5",
      "Content-Type": "application/json",
      Origin: "https://web.pinai.tech",
      Referer: "https://web.pinai.tech/",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
      Lang: "en",
    };
    this.tokenManager = new TokenManager(path.join(__dirname, "token.json"));
    this.api = new ApiService(this.headers);
  }

  async loginToPinaiAPI(initData) {
    try {
      const response = await this.api.post("/passport/login/telegram", {
        invite_code: "pBVlK4n",
        init_data: initData,
      });

      if (response.status === 200) {
        logger.info("Login successful");
        return response.data.access_token;
      }
    } catch (error) {
      logger.error(`Login failed: ${error.message}`);
    }
    return null;
  }

  async getHomeData(token, shouldUpgrade) {
    try {
      const response = await this.api.get("/home", token);
      if (response.status === 200) {
        const { pin_points, coins, current_model, data_power } = response.data;
        this.logHomeData(current_model, data_power, pin_points);

        const coinToCollect = coins.find((c) => c.type === "Telegram");
        if (coinToCollect?.count > 0) {
          await this.collectCoins(token, coinToCollect);
        }

        if (shouldUpgrade) {
          await this.checkAndUpgradeModel(
            token,
            pin_points,
            current_model.current_level
          );
        }
      }
    } catch (error) {
      logger.error(`Error fetching home data: ${error.message}`);
    }
  }

  logHomeData(currentModel, dataPower, points) {
    logger.info(`Current Model: ${currentModel.name}`);
    logger.info(`Current Level: ${currentModel.current_level}`);
    logger.info(`Data Power: ${dataPower}`);
    logger.info(`Balance: ${points}`);
  }

  async checkAndUpgradeModel(token, currentPoints, currentLevel) {
    try {
      const response = await this.api.get("/model/list", token);
      if (response.status === 200) {
        const nextLevelCost = response.data.cost_config.find(
          (config) => config.level === currentLevel + 1
        );

        if (nextLevelCost) {
          const numericPoints = PointsCalculator.parsePoints(currentPoints);
          if (numericPoints >= nextLevelCost.cost) {
            await this.upgradeModel(token, currentLevel + 1);
          } else {
            logger.warn(
              `Insufficient balance for upgrade to level ${currentLevel + 1}`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking upgrade possibility: ${error.message}`);
    }
  }

  async upgradeModel(token, newLevel) {
    try {
      const response = await this.api.post("/model/upgrade", {}, token);
      if (response.status === 200) {
        logger.info(`Model upgraded to level ${newLevel}`);
      }
    } catch (error) {
      logger.error(`Error upgrading model: ${error.message}`);
    }
  }

  async collectCoins(token, coin) {
    try {
      while (coin.count > 0) {
        const response = await this.api.post(
          "/home/collect",
          [{ type: coin.type, count: coin.count }],
          token
        );

        if (response.status === 200) {
          coin.count = response.data.coins.find(
            (c) => c.type === "Telegram"
          ).count;
          logger.info(`Coins collected, remaining: ${coin.count}`);
          if (coin.count === 0) break;
          await UserInterface.countdown(2);
        } else {
          break;
        }
      }
      logger.info("All coins collected");
    } catch (error) {
      logger.error(`Error collecting coins: ${error.message}`);
    }
  }

  async getTasks(token) {
    try {
      const response = await this.api.get("/task/list", token);
      if (response.status === 200) {
        for (const task of response.data.tasks) {
          if (
            task.task_id === 1001 &&
            task.checkin_detail.is_today_checkin === 0
          ) {
            await this.completeTask(
              token,
              task.task_id,
              "Daily check-in completed"
            );
          } else if (!task.is_complete) {
            await this.completeTask(
              token,
              task.task_id,
              `Task ${task.task_name} completed | Reward: ${task.reward_points}`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error fetching tasks: ${error.message}`);
    }
  }

  async completeTask(token, taskId, successMessage) {
    try {
      const response = await this.api.post(
        `/task/${taskId}/complete`,
        {},
        token
      );
      if (response.status === 200 && response.data.status === "success") {
        logger.info(successMessage);
      }
    } catch (error) {
      logger.error(`Error completing task ${taskId}: ${error.message}`);
    }
  }

  async main() {
    printBanner();

    try {
      const dataFile = path.join(__dirname, "data.txt");
      const data = fs
        .readFileSync(dataFile, "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .filter(Boolean);

      const shouldUpgrade = true;
      const tokenData = this.tokenManager.loadTokens();

      while (true) {
        for (let i = 0; i < data.length; i++) {
          const initData = data[i];
          const userId = JSON.parse(
            decodeURIComponent(initData.split("user=")[1].split("&")[0])
          ).id;

          logger.info(`Processing Account ${i + 1}`);

          const currentToken = tokenData[userId]?.access_token;
          if (!currentToken || this.tokenManager.isExpired(currentToken)) {
            logger.warn(`Token invalid/expired for account ${userId}`);
            const newToken = await this.loginToPinaiAPI(initData);

            if (newToken) {
              this.tokenManager.saveToken(userId, newToken);
              await this.getHomeData(newToken, shouldUpgrade);
              await this.getTasks(newToken);
            }
          } else {
            await this.getHomeData(currentToken, shouldUpgrade);
            await this.getTasks(currentToken);
          }

          await UserInterface.countdown(3);
        }
        await UserInterface.countdown(86400);
      }
    } catch (error) {
      logger.error(`Main process error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Start the application
const client = new PinAi();
client.main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
