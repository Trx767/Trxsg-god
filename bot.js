const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const express = require('express');

// Express App ဆောက်ခြင်း (Render ပေါ်မှာ မအိပ်စေရန် အသက်သွင်းခြင်း)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('⚡ THAR ZOE MATRIX ENGINE IS ALIVE AND RUNNING!');
});

app.listen(PORT, () => {
    console.log(`💻 Web Server activated on port ${PORT}`);
});

// 🔑 မင်းရဲ့ Telegram Config
const TELEGRAM_TOKEN = '8779758866:AAG-0plJv5ocLuF0iNj957RidDrfCnbUS3E'; 
const WIN_STICKER_ID = 'CAACAgIAAxkBAAERM2FqA00NjohiwKCqOB-Gq8JEZfUtNQACrCMAAkUUgUuCSlIvhq9oaTsE';

const TARGET_API = "https://draw.ar-lottery01.com/TrxWinGo/TrxWinGo_1M/GetHistoryIssuePage.json";
let lastProcessedIssue = "";

let currentMultiplier = 1; 
let lastPrediction = null; 
let predictionTargetIssue = null; 
let historyLogs = []; 

let totalWins = 0;
let totalLoses = 0;
let currentStreak = 0;
let maxStreak = 0;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let activeChatIds = new Set(['8338131451']); 

console.log("=========================================");
console.log("📡 RENDER SERVER INTEGRATION STARTED...");
console.log("=========================================");

// 🔔 [ADMIN DETECTOR SYSTEM]
bot.on('my_chat_member', (update) => {
    const chat = update.chat;
    const status = update.new_chat_member.status;

    if (status === 'administrator' || status === 'creator') {
        activeChatIds.add(chat.id);
        bot.sendMessage(chat.id, `📡 *TRX WIN GO SIGNAL ENGINE v12.0*\nBot ကို Admin ခန့်အပ်မှု အောင်မြင်သည်။ Render Cloud ပေါ်မှ စတင်အလုပ်လုပ်နေပါပြီ။`, { parse_mode: 'Markdown' })
            .catch(err => console.error("Greeting Error:", err.message));
    } 
    else if (status === 'left' || status === 'kicked' || status === 'member') {
        activeChatIds.delete(chat.id);
    }
});

// API Live Monitor Loop
setInterval(async () => {
    try {
        const response = await fetch(`${TARGET_API}?t=${Date.now()}`);
        if (!response.ok) return;

        const resJSON = await response.json();
        let finalDataList = resJSON?.data?.list || resJSON?.list || [];

        if (finalDataList && finalDataList.length > 0) {
            finalDataList.sort((a, b) => b.issueNumber.localeCompare(a.issueNumber));
            let currentTopRow = finalDataList[0]; 

            if (currentTopRow.issueNumber !== lastProcessedIssue) {
                lastProcessedIssue = currentTopRow.issueNumber;
                
                if (predictionTargetIssue && currentTopRow.issueNumber === predictionTargetIssue) {
                    let actualNumber = parseInt(currentTopRow.number);
                    let actualResult = actualNumber >= 5 ? "B" : "S";
                    let isWin = (lastPrediction === actualResult);

                    if (isWin) {
                        totalWins++;
                        currentStreak++;
                        if (currentStreak > maxStreak) maxStreak = currentStreak;
                    } else {
                        totalLoses++;
                        currentStreak = 0; 
                    }

                    historyLogs.push({
                        round: currentTopRow.issueNumber.slice(-5), 
                        pred: lastPrediction,
                        act: actualResult,
                        icon: isWin ? "✅" : "❌"
                    });

                    if (isWin) {
                        currentMultiplier = 1; 
                        broadcastSticker(WIN_STICKER_ID); // Sticker မကျော်စေရ
                    } else {
                        currentMultiplier = currentMultiplier + 1; // 1x2x3x4x5x6x... Infinite Multiplier
                    }

                    if (historyLogs.length >= 10) {
                        sendExactHistoryReport();
                    }
                }

                let computedNextIssue = (BigInt(lastProcessedIssue) + 1n).toString();
                let matrixResult = computeDualTrends(finalDataList.slice(0, 20));
                
                lastPrediction = matrixResult.finalDecision;
                predictionTargetIssue = computedNextIssue;

                broadcastSignal(computedNextIssue, matrixResult.finalDecision, currentMultiplier);
            }
        }
    } catch (err) {
        console.error("📡 Connection Status Error:", err.message);
    }
}, 5000);

// v12 Core Algorithm
function computeDualTrends(history) {
    if (history.length < 5) return { finalDecision: "B" };
    let numbers = history.map(x => parseInt(x.number));
    let trends = numbers.map(x => x >= 5 ? "B" : "S");
    let bScore = 50; 

    let consecutiveCount = 1;
    for (let i = 1; i < trends.length; i++) {
        if (trends[i] === trends[0]) consecutiveCount++;
        else break;
    }
    if (consecutiveCount >= 3) {
        if (trends[0] === "B") bScore += 25; else bScore -= 25;
    }

    let recentB = trends.slice(0, 5).filter(x => x === "B").length;
    let recentS = trends.slice(0, 5).filter(x => x === "S").length;
    bScore += (recentB * 4) - (recentS * 4);

    return { finalDecision: bScore >= 50 ? "B" : "S" };
}

function broadcastSignal(nextRound, decision, multiplier) {
    const shortRound = nextRound.slice(-2); 
    const pureFormat = `${shortRound}${decision}${multiplier}x`; 
    activeChatIds.forEach(chatId => {
        bot.sendMessage(chatId, pureFormat).catch((err) => console.error(err.message));
    });
}

// Sticker ပို့ပေးမည့် Function (ကျော်မသွားစေရ)
function broadcastSticker(stickerId) {
    activeChatIds.forEach(chatId => {
        bot.sendSticker(chatId, stickerId).catch((err) => console.error(err.message));
    });
}

function sendExactHistoryReport() {
    let totalGames = totalWins + totalLoses;
    let winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

    let reportMsg = "```\n";
    reportMsg += "Period      | Predict/Actual | Result\n";
    reportMsg += "------------+----------------+--------\n";
    reportMsg += "----\n";
    historyLogs.forEach(log => {
        reportMsg += `${log.round}        ${log.pred}/${log.act}              ${log.icon}\n`;
    });
    reportMsg += "--------------------------------------\n";
    reportMsg += "-----\n";
    reportMsg += `🏆WIN•[${totalWins}]      | ❤️Lose•[${totalLoses}]\n`;
    reportMsg += `🔥Streak: ${maxStreak}      | 📈Rate: ${winRate}%\n`;
    reportMsg += `📄Total ${totalGames}\n\n`;
    reportMsg += `====== DEVELOPED BY THAR ZOE ======\n`;
    reportMsg += "```";

    activeChatIds.forEach(chatId => {
        bot.sendMessage(chatId, reportMsg, { parse_mode: 'Markdown' }).catch((err) => console.error(err.message));
    });
    historyLogs = []; 
                                                                                                                                        }
              
