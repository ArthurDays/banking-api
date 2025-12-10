// API Configuration
const API_URL = '/api';

// Auth State
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// State
let accounts = [];
let transactions = [];

// DOM Elements
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const modalOverlay = document.getElementById('modal-overlay');

// XSS Sanitization
function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// API Request Helper (automatically adds auth token)
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const result = await response.json();

    // Handle token expired
    if (response.status === 401 && result.code === 'TOKEN_EXPIRED') {
        const refreshed = await refreshToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${authToken}`;
            const retryResponse = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            return retryResponse.json();
        } else {
            logout();
            throw new Error('Session expired');
        }
    }

    return result;
}

// Refresh Token
let refreshTokenValue = localStorage.getItem('refreshToken');

async function refreshToken() {
    if (!refreshTokenValue) return false;

    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshTokenValue })
        });
        const result = await response.json();

        if (result.success) {
            authToken = result.data.accessToken;
            refreshTokenValue = result.data.refreshToken;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('refreshToken', refreshTokenValue);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// CPF/CNPJ Mask
function maskDocument(value) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
        // CPF: 000.000.000-00
        return numbers
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        // CNPJ: 00.000.000/0000-00
        return numbers
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Auth Functions
function initAuth() {
    initAuthTabs();
    initAuthForms();
    checkAuth();
}

// WebSocket Connection
let ws = null;

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('ðŸ”Œ WebSocket conectado');
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
        }
    };

    ws.onclose = () => {
        console.log('ðŸ”Œ WebSocket desconectado, reconectando em 3s...');
        setTimeout(initWebSocket, 3000);
    };
}

function handleWebSocketMessage(message) {
    console.log('ðŸ“¡ Mensagem recebida:', message);

    switch (message.type) {
        case 'transaction':
            showToast('info', 'Nova transacao', message.data.description || 'Transacao realizada');
            loadDashboard();
            break;
        case 'balance_update':
            loadDashboard();
            break;
    }
}

function initAuthTabs() {
    const tabs = document.querySelectorAll('.login-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const formId = tab.dataset.tab === 'login' ? 'login-form' : 'register-form';
            document.getElementById(formId).classList.add('active');
        });
    });
}

function initAuthForms() {
    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (result.success) {
                authToken = result.data.accessToken;
                refreshTokenValue = result.data.refreshToken;
                currentUser = result.data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('refreshToken', refreshTokenValue);
                showApp();
                showToast('success', 'Bem-vindo!', `Ola, ${currentUser.name}`);
            } else {
                showToast('error', 'Erro', result.error);
            }
        } catch (error) {
            showToast('error', 'Erro', 'Nao foi possivel fazer login');
        }
    });

    // Register Form
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const result = await response.json();

            if (result.success) {
                authToken = result.data.accessToken;
                refreshTokenValue = result.data.refreshToken;
                currentUser = result.data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('refreshToken', refreshTokenValue);
                showApp();
                showToast('success', 'Conta criada!', 'Bem-vindo ao NeoBank');
            } else {
                showToast('error', 'Erro', result.error);
            }
        } catch (error) {
            showToast('error', 'Erro', 'Nao foi possivel criar a conta');
        }
    });
}

async function checkAuth() {
    if (!authToken) {
        showLogin();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();

        if (result.success) {
            currentUser = result.data;
            showApp();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    // Update user menu
    if (currentUser) {
        document.getElementById('user-initials').textContent = getInitials(currentUser.name);
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-email').textContent = currentUser.email;
    }

    // Init app
    initNavigation();
    initForms();
    initMasks();
    initEventDelegation();
    initUserMenu();
    initWebSocket();
    loadDashboard();
}

function initUserMenu() {
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    const userMenu = document.getElementById('user-menu');
    const logoutBtn = document.getElementById('logout-btn');

    userAvatarBtn?.addEventListener('click', () => {
        userMenu.classList.toggle('open');
    });

    logoutBtn?.addEventListener('click', logout);

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!userMenu?.contains(e.target)) {
            userMenu?.classList.remove('open');
        }
    });
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    showLogin();
}

// Event Delegation for dynamic content
function initEventDelegation() {
    // Delegate clicks on account items
    document.addEventListener('click', (e) => {
        const accountItem = e.target.closest('.account-item');
        if (accountItem) {
            const accountId = accountItem.dataset.accountId;
            if (accountId) {
                showAccountDetails(accountId);
            }
        }
    });
}

// Input Masks
function initMasks() {
    const documentInput = document.getElementById('account-document');
    if (documentInput) {
        documentInput.addEventListener('input', (e) => {
            e.target.value = maskDocument(e.target.value);
        });
    }

    const pixKeyInput = document.getElementById('pix-key');
    if (pixKeyInput) {
        pixKeyInput.addEventListener('input', (e) => {
            e.target.value = maskDocument(e.target.value);
        });
    }
}

// Navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateTo(section);
        });
    });

    document.getElementById('new-account-btn').addEventListener('click', openModal);
}

function navigateTo(section) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');

    // Update header
    const titles = {
        dashboard: ['Dashboard', 'Visao geral das suas contas'],
        accounts: ['Contas', 'Gerencie suas contas bancarias'],
        transactions: ['Transacoes', 'Historico de movimentacoes'],
        transfer: ['Transferir', 'Envie dinheiro entre contas'],
        pix: ['PIX', 'Transferencia instantanea']
    };

    pageTitle.textContent = titles[section][0];
    pageSubtitle.textContent = titles[section][1];

    // Load section data
    if (section === 'dashboard') loadDashboard();
    if (section === 'accounts') loadAllAccounts();
    if (section === 'transactions') loadAllTransactions();
    if (section === 'transfer' || section === 'pix') populateAccountSelects();
}

// Load Dashboard
async function loadDashboard() {
    await loadAccounts();
    await loadTransactions();
    updateStats();
    renderTransactionChart();
}

// Chart Instance
let transactionChart = null;

// Render Transaction Chart
function renderTransactionChart() {
    const ctx = document.getElementById('transactions-chart');
    if (!ctx) return;

    // Calculate totals by type
    const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
    const withdrawals = transactions.filter(t => t.type === 'withdraw').reduce((sum, t) => sum + t.amount, 0);
    const transfers = transactions.filter(t => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
    const pix = transactions.filter(t => t.type === 'pix').reduce((sum, t) => sum + t.amount, 0);

    // Destroy existing chart
    if (transactionChart) {
        transactionChart.destroy();
    }

    transactionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Depositos', 'Saques', 'Transferencias', 'PIX'],
            datasets: [{
                data: [deposits, withdrawals, transfers, pix],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        padding: 16,
                        font: { family: 'Inter', size: 12 }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Load Accounts
async function loadAccounts() {
    try {
        const data = await apiRequest('/accounts');

        if (data.success) {
            accounts = data.data;
            renderAccountsList('accounts-list');
            populateAccountSelects();
        }
    } catch (error) {
        console.error('Erro ao carregar contas:', error);
        showToast('error', 'Erro', 'Nao foi possivel carregar as contas');
    }
}

function renderAccountsList(containerId) {
    const container = document.getElementById(containerId);

    if (accounts.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        <p>Nenhuma conta cadastrada</p>
      </div>
    `;
        return;
    }

    container.innerHTML = accounts.map(account => `
    <div class="account-item" data-account-id="${sanitizeHTML(account.id)}">
      <div class="account-avatar">${sanitizeHTML(getInitials(account.holder_name))}</div>
      <div class="account-info">
        <div class="account-name">${sanitizeHTML(account.holder_name)}</div>
        <div class="account-details">Ag ${sanitizeHTML(account.agency)} | Conta ${sanitizeHTML(account.account_number)}</div>
      </div>
      <div class="account-balance">
        <div class="account-balance-value">${formatCurrency(account.balance)}</div>
        <div class="account-balance-label">Saldo disponivel</div>
      </div>
    </div>
  `).join('');
}

// Load Transactions
async function loadTransactions(type = '') {
    try {
        let endpoint = '/transactions?limit=10';
        if (type) endpoint += `&type=${type}`;

        const data = await apiRequest(endpoint);

        if (data.success) {
            transactions = data.data;
            renderTransactionsList('transactions-list');
        }
    } catch (error) {
        console.error('Erro ao carregar transacoes:', error);
    }
}

function renderTransactionsList(containerId) {
    const container = document.getElementById(containerId);

    if (transactions.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <p>Nenhuma transacao realizada</p>
      </div>
    `;
        return;
    }

    container.innerHTML = transactions.map(tx => `
    <div class="transaction-item">
      <div class="transaction-icon ${sanitizeHTML(tx.type)}">
        ${getTransactionIcon(tx.type)}
      </div>
      <div class="transaction-info">
        <div class="transaction-type">${getTransactionLabel(tx.type)}</div>
        <div class="transaction-description">${sanitizeHTML(tx.description) || '-'}</div>
      </div>
      <div class="transaction-amount">
        <div class="transaction-amount-value ${tx.type === 'deposit' ? 'positive' : 'negative'}">
          ${tx.type === 'deposit' ? '+' : '-'} ${formatCurrency(tx.amount)}
        </div>
        <div class="transaction-date">${formatDate(tx.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// Load All Accounts (for accounts section)
async function loadAllAccounts() {
    await loadAccounts();
    renderAccountsList('all-accounts-list');
}

// Load All Transactions (for transactions section)
async function loadAllTransactions() {
    const filter = document.getElementById('transaction-filter').value;

    try {
        let endpoint = '/transactions?limit=50';
        if (filter) endpoint += `&type=${filter}`;

        const data = await apiRequest(endpoint);

        if (data.success) {
            transactions = data.data;
            renderTransactionsList('all-transactions-list');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// Update Stats
function updateStats() {
    document.getElementById('total-accounts').textContent = accounts.length;

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    document.getElementById('total-balance').textContent = formatCurrency(totalBalance);

    document.getElementById('total-transactions').textContent = transactions.length;
}

// Populate Account Selects
function populateAccountSelects() {
    const selects = [
        'transfer-source', 'transfer-destination',
        'deposit-account', 'withdraw-account', 'pix-source'
    ];

    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione a conta</option>';

        accounts.forEach(account => {
            select.innerHTML += `<option value="${account.id}">${account.holder_name} - ${formatCurrency(account.balance)}</option>`;
        });

        select.value = currentValue;
    });
}

// Forms
function initForms() {
    // New Account Form
    document.getElementById('new-account-form').addEventListener('submit', handleNewAccount);

    // Deposit Form
    document.getElementById('deposit-form').addEventListener('submit', handleDeposit);

    // Withdraw Form
    document.getElementById('withdraw-form').addEventListener('submit', handleWithdraw);

    // Transfer Form
    document.getElementById('transfer-form').addEventListener('submit', handleTransfer);

    // PIX Form
    document.getElementById('pix-form').addEventListener('submit', handlePix);

    // Transaction Filter
    document.getElementById('transaction-filter').addEventListener('change', loadAllTransactions);
}

async function handleNewAccount(e) {
    e.preventDefault();

    const data = {
        holder_name: document.getElementById('account-holder').value,
        document: document.getElementById('account-document').value.replace(/\D/g, ''),
        bank_code: document.getElementById('account-bank').value,
        agency: document.getElementById('account-agency').value,
        account_number: document.getElementById('account-number').value,
        account_type: document.getElementById('account-type').value,
        initial_balance: parseFloat(document.getElementById('account-balance').value) || 0
    };

    try {
        const result = await apiRequest('/accounts', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            showToast('success', 'Sucesso!', 'Conta criada com sucesso');
            closeModal();
            e.target.reset();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel criar a conta');
    }
}

async function handleDeposit(e) {
    e.preventDefault();

    const data = {
        account_id: document.getElementById('deposit-account').value,
        amount: parseFloat(document.getElementById('deposit-amount').value),
        description: 'Deposito via app'
    };

    try {
        const result = await apiRequest('/transactions/deposit', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            showToast('success', 'Deposito realizado!', 'Novo saldo: ' + result.data.formatted_balance);
            e.target.reset();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel realizar o deposito');
    }
}

async function handleWithdraw(e) {
    e.preventDefault();

    const data = {
        account_id: document.getElementById('withdraw-account').value,
        amount: parseFloat(document.getElementById('withdraw-amount').value),
        description: 'Saque via app'
    };

    try {
        const result = await apiRequest('/transactions/withdraw', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            showToast('success', 'Saque realizado!', 'Novo saldo: ' + result.data.formatted_balance);
            e.target.reset();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel realizar o saque');
    }
}

async function handleTransfer(e) {
    e.preventDefault();

    const data = {
        source_account_id: document.getElementById('transfer-source').value,
        destination_account_id: document.getElementById('transfer-destination').value,
        amount: parseFloat(document.getElementById('transfer-amount').value),
        description: document.getElementById('transfer-description').value || 'Transferencia'
    };

    try {
        const result = await apiRequest('/transactions/transfer', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            showToast('success', 'Transferencia realizada!', 'Valor: ' + formatCurrency(data.amount));
            e.target.reset();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel realizar a transferencia');
    }
}

async function handlePix(e) {
    e.preventDefault();

    const data = {
        source_account_id: document.getElementById('pix-source').value,
        pix_key: document.getElementById('pix-key').value.replace(/\D/g, ''),
        amount: parseFloat(document.getElementById('pix-amount').value),
        description: document.getElementById('pix-description').value || 'PIX'
    };

    try {
        const result = await apiRequest('/transactions/pix', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            showToast('success', 'PIX enviado!', 'Valor: ' + formatCurrency(data.amount));
            e.target.reset();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel enviar o PIX');
    }
}

// Modal
function openModal() {
    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Toast Notifications
function showToast(type, title, message) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success'
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
    </svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Helper Functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getTransactionIcon(type) {
    const icons = {
        deposit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        withdraw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/></svg>',
        pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
    };
    return icons[type] || icons.transfer;
}

function getTransactionLabel(type) {
    const labels = { deposit: 'Deposito', withdraw: 'Saque', transfer: 'Transferencia', pix: 'PIX' };
    return labels[type] || type;
}

function showAccountDetails(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById('modal-title').textContent = 'Detalhes da Conta';
    document.getElementById('modal-body').innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div class="account-avatar" style="width: 80px; height: 80px; font-size: 2rem; margin: 0 auto 16px;">
        ${getInitials(account.holder_name)}
      </div>
      <h2 style="font-size: 1.25rem; margin-bottom: 4px;">${sanitizeHTML(account.holder_name)}</h2>
      <p style="color: var(--gray-500);">CPF: ${sanitizeHTML(account.document)}</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: var(--gray-400);">Banco</span>
        <span>${sanitizeHTML(account.bank_code)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: var(--gray-400);">Agencia</span>
        <span>${sanitizeHTML(account.agency)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: var(--gray-400);">Conta</span>
        <span>${sanitizeHTML(account.account_number)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--gray-400);">Tipo</span>
        <span>${account.account_type === 'checking' ? 'Corrente' : 'Poupanca'}</span>
      </div>
    </div>
    <div style="text-align: center; padding: 24px; background: var(--gradient-1); border-radius: 12px; margin-bottom: 16px;">
      <span style="display: block; color: rgba(255,255,255,0.8); font-size: 0.875rem; margin-bottom: 4px;">Saldo Disponivel</span>
      <span style="font-size: 2rem; font-weight: 700; color: white;">${formatCurrency(account.balance)}</span>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="btn-edit-account" class="btn btn-ghost" style="flex: 1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>
      <button id="btn-delete-account" class="btn btn-ghost" style="flex: 1; color: var(--error-500);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Excluir
      </button>
    </div>
  `;

    // Add event listeners after inserting HTML
    document.getElementById('btn-edit-account').addEventListener('click', function () {
        showEditAccountForm(id);
    });

    document.getElementById('btn-delete-account').addEventListener('click', function () {
        confirmDeleteAccount(id);
    });

    openModal();
}

function showEditAccountForm(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById('modal-title').textContent = 'Editar Conta';
    document.getElementById('modal-body').innerHTML = `
    <form id="edit-account-form">
      <div class="form-group">
        <label>Nome do Titular</label>
        <input type="text" id="edit-holder-name" value="${sanitizeHTML(account.holder_name)}" required>
      </div>
      <div style="display: flex; gap: 12px;">
        <button type="button" class="btn btn-ghost" style="flex: 1;" onclick="showAccountDetails('${id}')">Cancelar</button>
        <button type="submit" class="btn btn-primary" style="flex: 1;">Salvar</button>
      </div>
    </form>
  `;

    document.getElementById('edit-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const holderName = document.getElementById('edit-holder-name').value;

        try {
            const result = await apiRequest(`/accounts/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ holder_name: holderName })
            });

            if (result.success) {
                showToast('success', 'Sucesso!', 'Conta atualizada');
                closeModal();
                loadDashboard();
            } else {
                showToast('error', 'Erro', result.error);
            }
        } catch (error) {
            showToast('error', 'Erro', 'Nao foi possivel atualizar a conta');
        }
    });
}

function confirmDeleteAccount(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById('modal-title').textContent = 'Confirmar Exclusao';
    document.getElementById('modal-body').innerHTML = `
    <div style="text-align: center; padding: 20px 0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--error-500)" stroke-width="2" style="width: 64px; height: 64px; margin-bottom: 16px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h3 style="margin-bottom: 8px;">Desativar conta?</h3>
      <p style="color: var(--gray-500); margin-bottom: 24px;">
        A conta de <strong>${sanitizeHTML(account.holder_name)}</strong> sera desativada.<br>
        Esta acao pode ser revertida posteriormente.
      </p>
      <div style="display: flex; gap: 12px;">
        <button class="btn btn-ghost" style="flex: 1;" onclick="showAccountDetails('${id}')">Cancelar</button>
        <button class="btn" style="flex: 1; background: var(--error-500); color: white;" onclick="deleteAccount('${id}')">Desativar</button>
      </div>
    </div>
  `;
}

async function deleteAccount(id) {
    try {
        const result = await apiRequest(`/accounts/${id}`, { method: 'DELETE' });

        if (result.success) {
            showToast('success', 'Conta desativada', 'A conta foi desativada com sucesso');
            closeModal();
            loadDashboard();
        } else {
            showToast('error', 'Erro', result.error);
        }
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel desativar a conta');
    }
}

// ==============================
// EXPORT STATEMENT FUNCTIONS
// ==============================

async function getAccountStatement(accountId) {
    try {
        const result = await apiRequest(`/accounts/${accountId}/statement`);
        return result.success ? result.data : null;
    } catch (error) {
        console.error('Erro ao buscar extrato:', error);
        return null;
    }
}

async function exportStatementPDF(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    showToast('info', 'Gerando PDF', 'Aguarde...');

    const statement = await getAccountStatement(accountId);
    if (!statement) {
        showToast('error', 'Erro', 'Nao foi possivel gerar o extrato');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 220, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('NeoBank', 20, 25);
    doc.setFontSize(10);
    doc.text('Extrato Bancario', 20, 33);

    // Account Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('Titular: ' + account.holder_name, 20, 55);
    doc.text('CPF/CNPJ: ' + maskDocument(account.document), 20, 63);
    doc.text('Agencia: ' + account.agency + ' | Conta: ' + account.account_number, 20, 71);
    doc.text('Saldo Atual: ' + formatCurrency(account.balance), 20, 79);
    doc.text('Data: ' + new Date().toLocaleDateString('pt-BR'), 20, 87);

    // Transactions Table
    if (statement.transactions && statement.transactions.length > 0) {
        const tableData = statement.transactions.map(tx => [
            new Date(tx.created_at).toLocaleDateString('pt-BR'),
            getTransactionLabel(tx.type),
            tx.description || '-',
            formatCurrency(tx.amount)
        ]);

        doc.autoTable({
            startY: 95,
            head: [['Data', 'Tipo', 'Descricao', 'Valor']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241] },
            styles: { fontSize: 9 }
        });
    } else {
        doc.text('Nenhuma transacao encontrada', 20, 100);
    }

    doc.save('extrato_' + account.holder_name.replace(/\s+/g, '_') + '.pdf');
    showToast('success', 'PDF Gerado', 'Download iniciado');
}

async function exportStatementCSV(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    showToast('info', 'Gerando CSV', 'Aguarde...');

    const statement = await getAccountStatement(accountId);
    if (!statement) {
        showToast('error', 'Erro', 'Nao foi possivel gerar o extrato');
        return;
    }

    let csv = 'Data,Tipo,Descricao,Valor\n';

    if (statement.transactions && statement.transactions.length > 0) {
        statement.transactions.forEach(tx => {
            const date = new Date(tx.created_at).toLocaleDateString('pt-BR');
            const type = getTransactionLabel(tx.type);
            const desc = (tx.description || '-').replace(/,/g, ';');
            csv += date + ',' + type + ',"' + desc + '",' + tx.amount + '\n';
        });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'extrato_' + account.holder_name.replace(/\s+/g, '_') + '.csv';
    link.click();

    showToast('success', 'CSV Gerado', 'Download iniciado');
}

// Expose functions globally for onclick handlers
window.closeModal = closeModal;
window.openModal = openModal;
window.showAccountDetails = showAccountDetails;
window.showEditAccountForm = showEditAccountForm;
window.confirmDeleteAccount = confirmDeleteAccount;
window.deleteAccount = deleteAccount;
window.loadAccounts = loadAccounts;
window.loadTransactions = loadTransactions;
window.loadDashboard = loadDashboard;
window.exportStatementPDF = exportStatementPDF;
window.exportStatementCSV = exportStatementCSV;
