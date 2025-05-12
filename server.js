const express = require('express');
const osc = require('osc');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000; // Webサーバー用ポート
const vrchatIP = '127.0.0.1'; // VRChatが動いてるPCのIP（基本は127.0.0.1）

// メッセージ履歴（最大10件）
let messageHistory = [];

// 📌 コピーされたメッセージを一時保存する変数（これが「サーバー内のクリップボード」）
let clipboardMessage = '';

// OSC送信用セットアップ
const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 9001, // 適当な受信用ポート（被らない番号ならOK）
    remoteAddress: vrchatIP,
    remotePort: 9000 // VRChatのOSC受信ポート
});

// publicフォルダの中にindex.htmlを置く場合、明示的なルート指定は不要になる
app.use(express.static(path.join(__dirname, 'public')));

udpPort.open();

// HTTPでJSON受け取る
app.use(bodyParser.json());

// テキストを受け取ってOSC送信
app.post('/send', (req, res) => {
    const text = req.body.text;
    const playSound = req.body.playSound ?? true;  // チェックボックスからの設定

    if (!text) {
        return res.status(400).send('Text is required');
    }

    udpPort.send({
        address: '/chatbox/input',
        args: [
            text,
            true,         // 入力表示は常に true
            playSound     // 通知音フラグ
        ]
    }, (error, bytes) => {
        if (error) {
            console.error("OSC送信エラー:", error);
        }
    });

    setImmediate(() => {
        messageHistory.push(text);
        if (messageHistory.length > 10) {
            messageHistory.shift();
        }
    });

    res.send('OK');
});

// テキストボックスとは別のコピー用テキストボックス
app.post('/send-copy', (req, res) => {
    const text = req.body.text;
    if (!text) {
        return res.status(400).send('Text is required');
    }
    udpPort.send({
        address: '/chatbox/input',
        args: [
            text,
            false, // ← ここが「表示のみ」のポイント（送信フラグが false）
            false
        ]
    });

    res.send('OK');
});

// タイピング中かどうかの判定
app.post('/typing', (req, res) => {
    const typing = req.body?.typing;

    if (typeof typing !== 'boolean') {
        console.warn('Invalid typing value received:', req.body);
        return res.status(400).send('Boolean typing flag required');
    }

    udpPort.send({
        address: '/chatbox/typing',
        args: [
            {
                type: "T",
                value: typing
            }
        ]
    });

    res.send('OK');
});


// メッセージ履歴を取得
app.get('/history', (req, res) => {
    res.json(messageHistory);
});

// POSTでコピー
app.post('/copy', (req, res) => {
    clipboardMessage = req.body.message || '';
    res.status(200).send('Message copied to server clipboard');
});

// 📌 コピー内容を取得するエンドポイント（ペースト用）
app.get('/copy', (req, res) => {
    res.json({ text: clipboardMessage || '' });
});

// Webページを提供（index.html）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const os = require('os');

// IPv4アドレスを取得する関数
function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(port, () => {
  const ip = getLocalIPv4();
  console.log(`サーバー起動中！ http://${ip}:${port}`);
});