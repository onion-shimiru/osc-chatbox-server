let cutBuffer = '';  // ローカル用の一時保存変数（カット専用）

let typingTimeout = null;

// 入力ボックスをクリアする関数
function clearInput() {
  document.getElementById('textInput').value = '';
}

// カット機能（ローカルのみ）
function cutInput() {
  const input = document.getElementById('textInput');
  cutBuffer = input.value;  // ローカルに保存
  input.value = '';         // 入力欄をクリア
  updateCharacterCount();
}

// ペースト機能（ローカルカット用）
function pasteCutBuffer() {
  const input = document.getElementById('textInput');
  input.value = cutBuffer;
  updateCharacterCount();
}

// コピー（履歴などから）→ サーバーに送信
function copyToServer(message) {
  fetch('/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
}

// サーバーから取得してペースト
function pasteFromServer() {
  fetch('/copy')
    .then(response => response.json())
    .then(data => {
      const input = document.getElementById('textInput');
      input.value = data.text || '';
      updateCharacterCount();
    });
}

// メッセージ送信
function sendMessage() {
  const text = document.getElementById('textInput').value;
  if (!text) return;

  fetch('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  });
  
  // タイピング判定を即時終了 ＋ タイマーをリセット
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
  setTypingStatus(false);

  document.getElementById('textInput').value = '';
  updateCharacterCount();
}

// 入力欄でEnter押したら送信
document.getElementById('textInput').addEventListener('keydown', function(event) {
  const enterToSend = document.getElementById('enterToSendCheckbox').checked;
  if (event.key === 'Enter' && enterToSend) {
    event.preventDefault(); // 改行を防ぐ
    sendMessage();          // 送信！
  }
});

// コピー専用のテキストボックス
function sendCopyMode() {
  const text = document.getElementById('copyTextInput').value;
  if (!text) return;

  if (text.length > 144) {
    alert("144文字以内にしてください！");
    return;
  }

  fetch('/send-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  });

  document.getElementById('copyTextInput').value = '';
}

// 入力中ステータスを送る関数
function setTypingStatus(isTyping) {
  fetch('/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ typing: isTyping })
  });
}

// 入力欄でのキー入力イベント
document.getElementById('textInput').addEventListener('input', function () {
  setTypingStatus(true); // 入力が始まったら true

  // 前のタイマーをキャンセルしてリセット
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  // 2秒入力がないと false を送信
  typingTimeout = setTimeout(() => {
    setTypingStatus(false);
  }, 2000);
});

// メッセージ履歴取得・表示
function fetchMessageHistory() {
  fetch('/history')
    .then(response => response.json())
    .then(history => {
      const historyList = document.getElementById('messageHistory');
      historyList.innerHTML = '';
      history.reverse().forEach(message => {
        const li = document.createElement('li');
        li.textContent = message;

        // クリックでコピー（サーバーへ送信）
        li.addEventListener('click', () => {
          copyToServer(message);
        });

        historyList.appendChild(li);
      });
    });
}

// エンターキー送信設定の変更を保存
document.getElementById('enterToSendCheckbox').addEventListener('change', function() {
  localStorage.setItem('enterToSend', this.checked); // 状態を保存
});

// ページ読み込み時にエンターキー送信設定を反映
window.onload = function() {
  const enterToSend = localStorage.getItem('enterToSend') === 'true'; // 保存された設定を取得
  document.getElementById('enterToSendCheckbox').checked = enterToSend; // チェックボックスに反映

  // 初期化処理
  fetchMessageHistory();
  setInterval(fetchMessageHistory, 5000);
};

// 文字数カウント
function updateCharacterCount() {
  const text = document.getElementById('textInput').value;
  const count = text.length;

  // 改行の数 + 1 が行数になる（空文字のときは 0 行）
  const lineCount = text ? text.split('\n').length : 0;

  // 文字数と行数を表示
  document.getElementById('charCount').innerText = `${count} / 144　${lineCount} / 9 行`;

  const sendButton = document.querySelector('button');
  // 文字数または行数が制限を超えていれば無効化
  if (count > 144 || lineCount > 9) {
    sendButton.disabled = true;
  } else {
    sendButton.disabled = false;
  }
}

function sendMessage() {
  const text = document.getElementById('textInput').value;
  const count = text.length;
  const lineCount = text ? text.split('\n').length : 0;

  if (count > 144) {
    alert("144文字以内にしてください！");
    return;
  }

  if (lineCount > 9) {
    alert("9行以内にしてください！");
    return;
  }

  const playSound = document.getElementById('notifySoundCheckbox').checked;

  fetch('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      playSound: playSound
    })
  });

  document.getElementById('textInput').value = '';
  updateCharacterCount();
}



// 定型文の初期値（10個）
const defaultPresets = [
  "こんにちは！",
  "フレンド申請いいですか？",
  "おつかれさまです！",
  "ありがとうございます！",
  "了解です！",
  "少し離席します！",
  "戻りました！",
  "おやすみなさい！",
  "またね！",
  "楽しかったです！"
];

let presetMessages = [...defaultPresets];

// 定型文を初期状態に戻す
function resetPresets() {
  if (confirm("定型文を初期状態に戻しますか？")) {
    presetMessages = [...defaultPresets];
    localStorage.setItem('presetMessages', JSON.stringify(presetMessages));
    renderPresets();
    alert("定型文を初期状態に戻しました！");
  }
}

// localStorageから定型文を読み込む
function loadPresets() {
  const saved = localStorage.getItem('presetMessages');
  if (saved) {
    presetMessages = JSON.parse(saved);
  }
}

// localStorageに保存
function savePresets() {
  const inputs = document.querySelectorAll('.presetInput');
  presetMessages = Array.from(inputs).map(input => input.value);
  localStorage.setItem('presetMessages', JSON.stringify(presetMessages));
  renderPresets();
  alert("定型文を保存しました！");
}

// 定型文をボタンとして表示
function renderPresets() {
  const presetContainer = document.getElementById('presets');
  const inputContainer = document.getElementById('presetInputs');
  presetContainer.innerHTML = '';
  inputContainer.innerHTML = '';

  presetMessages.forEach((msg, index) => {
    // 表示用ボタン
    const btn = document.createElement('button');
    btn.textContent = msg;
    btn.style.margin = '5px';
    btn.onclick = () => {
      document.getElementById('textInput').value = msg;
      updateCharacterCount();
    };
    presetContainer.appendChild(btn);

    // 編集用の入力欄
    const input = document.createElement('input');
    input.type = 'text';
    input.value = msg;
    input.className = 'presetInput';
    input.style.marginBottom = '5px';
    input.style.width = '100%';
    inputContainer.appendChild(input);
  });
}

// 初期化処理
window.addEventListener('DOMContentLoaded', () => {
  loadPresets();
  renderPresets();
});
