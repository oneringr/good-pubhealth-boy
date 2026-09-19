const siteUrl = 'https://virlab.swmu.edu.cn/mengoo/';
const form = document.querySelector('#login-form');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const status = document.querySelector('#status');

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function loadSavedCredentials() {
  try {
    const { credentials } = await chrome.storage.local.get('credentials');
    if (credentials) {
      usernameInput.value = credentials.username || '';
      passwordInput.value = credentials.password || '';
    }
  } catch {
    showStatus('读取保存的信息失败。', true);
  }
}

async function openOrNotifySite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.startsWith('https://virlab.swmu.edu.cn/')) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'loginNow' });
      if (response?.ok) return;
    } catch {
      // A page opened before this extension was loaded has no content script.
    }
  }
  await chrome.tabs.create({ url: siteUrl });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    showStatus('请输入账号和密码。', true);
    return;
  }

  try {
    await chrome.storage.local.set({
      credentials: { username, password },
      autoLoginEnabled: true,
    });
    await openOrNotifySite();
    showStatus('已保存，并已向网站发送登录指令。');
  } catch {
    showStatus('保存或打开网站失败，请重试。', true);
  }
});

document.querySelector('#clear').addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove(['credentials', 'autoLoginEnabled']);
    form.reset();
    usernameInput.value = '';
    passwordInput.value = '';
    showStatus('已清除保存的账号密码。');
  } catch {
    showStatus('清除失败，请重试。', true);
  }
});

loadSavedCredentials();
