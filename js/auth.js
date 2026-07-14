/*
 * Tus 账户客户端
 * 用户数据只由后端保存；浏览器仅保存签名会话令牌。
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'tus_auth_token';
  var USER_KEY = 'tus_auth_user';
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var API_BASE = window.TUS_AUTH_API_URL || (isLocal ? 'http://localhost:3001/api' : 'https://api.haximtus.cn/api');
  var currentUser = readStoredUser();

  function isAuthRequired() {
    return document.body && document.body.getAttribute('data-auth-required') === 'true';
  }

  function returnDestination() {
    var requested = new URLSearchParams(location.search).get('return');
    return requested === 'submit.html' ? 'submit.html' : '.';
  }

  function redirectToLogin() {
    var currentPage = location.pathname.split('/').pop() || 'index.html';
    var returnTo = currentPage === 'submit.html' ? 'submit.html' : '';
    location.replace('account.html' + (returnTo ? '?return=' + encodeURIComponent(returnTo) : ''));
  }

  function readStoredUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (error) { return null; }
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    currentUser = data.user;
    renderNav();
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    currentUser = null;
    renderNav();
  }

  async function request(path, options) {
    var opts = options || {};
    opts.headers = opts.headers || {};
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    if (token()) opts.headers.Authorization = 'Bearer ' + token();

    var response;
    try {
      response = await fetch(API_BASE + path, opts);
    } catch (error) {
      throw new Error('暂时无法连接账户服务，请稍后重试。');
    }

    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      if (response.status === 401) clearSession();
      throw new Error(data.message || '操作未完成，请稍后重试。');
    }
    return data;
  }

  function renderNav() {
    var link = document.getElementById('navAccount');
    if (!link) return;
    link.textContent = currentUser ? currentUser.username : '登录';
    link.href = 'account.html';
    link.title = currentUser ? '账户：' + currentUser.username : '登录或注册';
  }

  function setMessage(text, isError) {
    var message = document.getElementById('authMessage');
    if (!message) return;
    message.textContent = text || '';
    message.className = text ? (isError ? 'auth-message auth-message-error' : 'auth-message auth-message-success') : 'auth-message hidden';
  }

  function showGuest() {
    var guest = document.getElementById('authGuest');
    var signedIn = document.getElementById('authSignedIn');
    if (guest) guest.classList.remove('hidden');
    if (signedIn) signedIn.classList.add('hidden');
  }

  function showSignedIn() {
    var guest = document.getElementById('authGuest');
    var signedIn = document.getElementById('authSignedIn');
    var name = document.getElementById('accountName');
    var continueLink = document.getElementById('accountContinue');
    if (guest) guest.classList.add('hidden');
    if (signedIn) signedIn.classList.remove('hidden');
    if (name && currentUser) name.textContent = currentUser.username;
    if (continueLink) {
      continueLink.href = returnDestination();
      continueLink.textContent = returnDestination() === 'submit.html' ? '继续提交试卷' : '返回试卷库';
    }
  }

  function switchMode(mode) {
    var isRegister = mode === 'register';
    var title = document.getElementById('authTitle');
    var hint = document.getElementById('authHint');
    var confirm = document.getElementById('confirmPasswordRow');
    var submit = document.getElementById('authSubmit');
    var modeInput = document.getElementById('authMode');
    var loginTab = document.getElementById('loginTab');
    var registerTab = document.getElementById('registerTab');
    if (!modeInput) return;
    modeInput.value = mode;
    if (title) title.textContent = isRegister ? '创建账户' : '登录账户';
    if (hint) hint.textContent = isRegister ? '创建一次账户，之后可以在任何设备上登录。' : '继续提交试卷，或管理这台设备上的登录状态。';
    if (confirm) confirm.classList.toggle('hidden', !isRegister);
    if (submit) submit.textContent = isRegister ? '注册并登录' : '登录';
    if (loginTab) loginTab.classList.toggle('is-active', !isRegister);
    if (registerTab) registerTab.classList.toggle('is-active', isRegister);
    if (loginTab) loginTab.setAttribute('aria-selected', String(!isRegister));
    if (registerTab) registerTab.setAttribute('aria-selected', String(isRegister));
    var passwordInput = document.getElementById('authPassword');
    var confirmInput = document.getElementById('authConfirmPassword');
    if (passwordInput) passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    if (confirmInput) confirmInput.required = isRegister;
    setMessage('');
  }

  function initializeAccountPage() {
    var form = document.getElementById('authForm');
    if (!form) return;

    if (currentUser) showSignedIn(); else showGuest();
    document.getElementById('loginTab').addEventListener('click', function () { switchMode('login'); });
    document.getElementById('registerTab').addEventListener('click', function () { switchMode('register'); });
    document.getElementById('authLogout').addEventListener('click', function () {
      clearSession();
      showGuest();
      switchMode('login');
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var username = document.getElementById('authUsername').value.trim();
      var password = document.getElementById('authPassword').value;
      var mode = document.getElementById('authMode').value;
      var confirm = document.getElementById('authConfirmPassword').value;
      var submit = document.getElementById('authSubmit');

      if (mode === 'register' && password !== confirm) {
        setMessage('两次输入的密码不一致。', true);
        return;
      }

      submit.disabled = true;
      submit.textContent = mode === 'register' ? '正在注册...' : '正在登录...';
      setMessage('');
      try {
        var data = await request('/auth/' + mode, {
          method: 'POST',
          body: JSON.stringify({ username: username, password: password })
        });
        setSession(data);
        form.reset();
        location.replace(returnDestination());
      } catch (error) {
        setMessage(error.message, true);
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'register' ? '注册并登录' : '登录';
      }
    });
  }

  async function validateSession() {
    if (!token()) {
      renderNav();
      if (isAuthRequired()) redirectToLogin();
      return;
    }
    try {
      var data = await request('/auth/me');
      currentUser = data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (error) {
      // request already clears an invalid session. The cached username remains usable offline only until validation fails.
    }
    renderNav();
    if (document.getElementById('authForm')) currentUser ? showSignedIn() : showGuest();
    if (isAuthRequired()) {
      if (!currentUser) {
        redirectToLogin();
        return;
      }
      document.body.classList.remove('auth-checking');
      document.dispatchEvent(new CustomEvent('tus:auth-ready', { detail: { user: currentUser } }));
    }
  }

  window.TusAuth = {
    logout: clearSession,
    getUser: function () { return currentUser; },
    request: request,
    apiBase: API_BASE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderNav();
      initializeAccountPage();
      validateSession();
    });
  } else {
    renderNav();
    initializeAccountPage();
    validateSession();
  }
})();
