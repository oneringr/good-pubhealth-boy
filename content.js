const attemptKey = 'good-pubhealth-boy-login-attempted';
const loginPath = /^\/mengoo\/login\/?$/;
let credentials = null;
let autoLoginEnabled = false;
let forceLogin = false;
let openingLoginPage = false;
let checkQueued = false;

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function checkForLogin() {
  if (!credentials?.username || !credentials?.password) return;
  if (!autoLoginEnabled && !forceLogin) return;
  if (sessionStorage.getItem(attemptKey)) return;

  if (loginPath.test(location.pathname)) {
    const usernameInput = document.querySelector('input[placeholder="账号/邮箱/手机号"]');
    const passwordInput = document.querySelector('input[type="password"][placeholder="密码"]');
    const submitButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === '登录',
    );
    if (!usernameInput || !passwordInput || !submitButton) return;

    sessionStorage.setItem(attemptKey, String(Date.now()));
    setInputValue(usernameInput, credentials.username);
    setInputValue(passwordInput, credentials.password);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (loginPath.test(location.pathname)) submitButton.click();
    forceLogin = false;
    return;
  }

  if (!openingLoginPage) {
    const loginButton = document.querySelector('.loginbtn');
    if (loginButton?.textContent.trim() === '登录') {
      openingLoginPage = true;
      loginButton.click();
    }
  }
}

function queueCheck() {
  if (checkQueued) return;
  checkQueued = true;
  setTimeout(() => {
    checkQueued = false;
    checkForLogin();
  }, 50);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'loginNow') return;
  chrome.storage.local.get(['credentials', 'autoLoginEnabled']).then((saved) => {
    credentials = saved.credentials;
    autoLoginEnabled = saved.autoLoginEnabled === true;
    forceLogin = true;
    openingLoginPage = false;
    sessionStorage.removeItem(attemptKey);
    queueCheck();
    sendResponse({ ok: true });
  }).catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.credentials && !changes.credentials.newValue) {
    credentials = null;
    autoLoginEnabled = false;
    forceLogin = false;
  }
});

new MutationObserver(queueCheck).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
window.addEventListener('popstate', queueCheck);

chrome.storage.local.get(['credentials', 'autoLoginEnabled']).then((saved) => {
  credentials = saved.credentials;
  autoLoginEnabled = saved.autoLoginEnabled === true;
  queueCheck();
});
