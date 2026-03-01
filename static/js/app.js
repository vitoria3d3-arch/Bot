const socket = io();

const translations = {
    'pt-BR': {
        'nav-title': 'Binance Scaler',
        'botStatus-Running': 'Rodando',
        'botStatus-Stopped': 'Parado',
        'btn-start-text': 'Começar',
        'btn-stop-text': 'Parar',
        'btn-config-text': 'Config',
        'label-units': 'Estratégia Detalhada',
        'label-existing-assets': 'Gerenciar Ativos Existentes',
        'label-leverage': 'Alavancagem e Margem',
        'label-leverage-type': 'Modo de Margem',
        'label-leverage-custom': 'Ajuste Fino',
        'label-bought-price': 'Valor da Operação',
        'label-current-price': 'Preço de Mercado:',
        'label-total': 'Notional (Units)',
        'label-tp': 'Realização de Lucro',
        'label-order-info': 'A ordem será colocada no livro de ordens da exchange antecipadamente',
        'label-available': 'Disponível:',
        'label-percent': 'Percentagem',
        'label-quantity': 'Quantidade',
        'label-max-targets': 'Máximo de alvos TP definidos',
        'label-trailing-tp': 'Realização de Lucro Móvel (Trailing)',
        'label-trailing-deviation': 'Seguir preço máximo com desvio (%)',
        'label-approx-profit': 'Lucro Aproximado:',
        'label-est-peak': 'Preço Máximo Estimado:',
        'label-acc-summary': 'Resumo da Conta',
        'label-total-balance': 'Patrimônio Líquido',
        'label-active-accs': 'Contas Ativas',
        'label-symbols': 'Símbolos',
        'tab-positions': 'Posições',
        'tab-logs': 'Registro Console',
        'th-acc': 'Conta',
        'th-symbol': 'Símbolo',
        'th-size': 'Tamanho',
        'th-entry': 'Preço Entrada',
        'th-pnl': 'PNL Não Realizado',
        'th-action': 'Ação',
        'msg-no-positions': 'Nenhuma posição aberta',
        'label-bot-config': 'Configuração do Bot',
        'tab-api-config': 'Configuração API',
        'tab-strat-config': 'Configuração Estratégia',
        'label-demo-mode': 'Modo Demo / Testnet',
        'lc-symbol': 'Símbolo',
        'lc-direction': 'Direção',
        'lc-total-qty': 'Quant. Total',
        'lc-fractions': 'Frações Totais',
        'lc-total-qty': 'Quant. Total',
        'lc-fractions': 'Frações Totais',
        'lc-deviation': 'Desvio (%)',
        'manual-pos-title': 'Posição Manual Detectada',
        'label-size': 'Tam:',
        'label-entry': 'Ent:',
        'btn-clear': 'Limpar',
        'btn-close': 'Fechar',
        'btn-save': 'Salvar Configuração',
        'prompt-symbol': "Digite o símbolo (ex: BTCUSDC):",
        'confirm-close': "Fechar posição de {symbol} na conta {account}?",
        'margin-req': 'Margem Requerida',
        'margin-est': 'Margem Prevista',
        'label-dev': 'Desvio:',
        'margin-crossed': 'Cruzada',
        'margin-isolated': 'Isolada',
        'btn-clear-console': 'Limpar'
    },
    'en-US': {
        'nav-title': 'Binance Scaler',
        'botStatus-Running': 'Running',
        'botStatus-Stopped': 'Stopped',
        'btn-start-text': 'Start',
        'btn-stop-text': 'Stop',
        'btn-config-text': 'Settings',
        'label-units': 'Strategic Control',
        'label-existing-assets': 'Manage Existing Assets',
        'label-leverage': 'Leverage & Margin',
        'label-leverage-type': 'Margin Mode',
        'label-leverage-custom': 'Leverage Fine-tuning',
        'label-bought-price': 'Trade Amount',
        'label-current-price': 'Market Price:',
        'label-total': 'Total Notional (Units)',
        'label-tp': 'Take Profit',
        'label-order-info': 'The order will be placed on the exchange order book beforehand',
        'label-available': 'Available:',
        'label-percent': 'Percent',
        'label-quantity': 'Quantity',
        'label-max-targets': 'Max TP targets set',
        'label-trailing-tp': 'Trailing Take Profit',
        'label-trailing-deviation': 'Follow max price with deviation (%)',
        'label-approx-profit': 'Approximate Profit:',
        'label-est-peak': 'Estimated Peak Price:',
        'label-acc-summary': 'Account Summary',
        'label-total-balance': 'Net Equity',
        'label-active-accs': 'Active Accounts',
        'label-symbols': 'Symbols',
        'tab-positions': 'Positions',
        'tab-logs': 'Console Log',
        'th-acc': 'Account',
        'th-symbol': 'Symbol',
        'th-size': 'Size',
        'th-entry': 'Entry Price',
        'th-pnl': 'Unrealized PNL',
        'th-action': 'Action',
        'msg-no-positions': 'No open positions',
        'label-bot-config': 'Bot Configuration',
        'tab-api-config': 'API Config',
        'tab-strat-config': 'Strategy Config',
        'label-demo-mode': 'Demo / Testnet Mode',
        'lc-symbol': 'Symbol',
        'lc-direction': 'Direction',
        'lc-total-qty': 'Total Qty',
        'lc-fractions': 'Total Fractions',
        'lc-deviation': 'Deviation (%)',
        'manual-pos-title': 'Manual Position Detected',
        'label-size': 'Size:',
        'label-entry': 'Ent:',
        'btn-clear': 'Clear',
        'btn-close': 'Close',
        'btn-save': 'Save Configuration',
        'prompt-symbol': "Enter Binance Symbol (e.g., BTCUSDC):",
        'confirm-close': "Close position for {symbol} on account {account}?",
        'margin-req': 'Required Margin',
        'margin-est': 'Estimated Margin',
        'label-dev': 'Deviation:',
        'margin-crossed': 'Cross',
        'margin-isolated': 'Isolated',
        'btn-clear-console': 'Clear'
    }
};

let currentLang = 'pt-BR';
let currentConfig = null;
const configModal = new bootstrap.Modal(document.getElementById('configModal'));
let isBotRunning = false;
let activeSymbol = null;
let maxLeverages = {
    'BTCUSDC': 125,
    'LINKUSDC': 75
}; // symbol -> maxLeverage (Defaults, will be updated by socket)

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    setupEventListeners();
    setupSocketListeners();
    applyTranslations();
});

function setupEventListeners() {
    // Language Switch
    document.getElementById('lang-select').addEventListener('change', (e) => {
        currentLang = e.target.value;
        if (currentConfig) {
            currentConfig.language = currentLang;
            saveLiveConfig();
        }
        applyTranslations();
    });

    document.getElementById('startStopBtn').addEventListener('click', () => {
        setBtnLoading(true);
        if (isBotRunning) {
            socket.emit('stop_bot');
        } else {
            socket.emit('start_bot');
        }
    });

    document.getElementById('configBtn').addEventListener('click', () => {
        renderConfig();
        configModal.show();
    });

    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);

    document.getElementById('addSymbolBtn').addEventListener('click', () => {
        const symbol = prompt(translations[currentLang]['prompt-symbol']);
        if (symbol && currentConfig) {
            const upperSymbol = symbol.toUpperCase();
            if (!currentConfig.symbols.includes(upperSymbol)) {
                currentConfig.symbols.push(upperSymbol);
                updateSymbolList();
                saveLiveConfig();
            }
        }
    });

    document.getElementById('clearConsoleBtn').addEventListener('click', () => {
        document.getElementById('consoleOutput').innerHTML = '';
    });

    // Inputs updates
    document.getElementById('inputTradeAmountUSDC').addEventListener('input', updateTotalBaseUnits);

    document.getElementById('selectActiveSymbol').addEventListener('change', (e) => {
        activeSymbol = e.target.value;
        updateUIFromConfig();
    });

    document.getElementById('inputLeverage').addEventListener('input', (e) => {
        updateLeverageDisplay(e.target.value);
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].leverage = parseInt(e.target.value);
            saveLiveConfig();
        }
    });

    document.getElementById('trailingDeviation').addEventListener('input', (e) => {
        const val = e.target.value;
        const label = translations[currentLang]['label-dev'];
        document.getElementById('label-approx-profit').innerText = `${label} ${val}%`;
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].trailing_deviation = parseFloat(val);
            saveLiveConfig();
        }
        updateTrailingMetrics();
    });

    document.getElementById('trailingTpToggle').addEventListener('change', (e) => {
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].trailing_enabled = e.target.checked;
            saveLiveConfig();
        }
        updateTrailingMetrics();
    });

    document.getElementById('tpToggle').addEventListener('change', (e) => {
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].tp_enabled = e.target.checked;
            saveLiveConfig();
        }
    });

    document.getElementById('inputMarginType').addEventListener('change', (e) => {
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].margin_type = e.target.value;
            saveLiveConfig();
        }
    });

    document.getElementById('useExistingAssets').addEventListener('change', (e) => {
        if (currentConfig && activeSymbol) {
            currentConfig.symbol_strategies[activeSymbol].use_existing_assets = e.target.checked;
            saveLiveConfig();
        }
    });

    document.getElementById('inputEstimatedPeak')?.addEventListener('input', updateTrailingMetrics);
}

function updateTotalBaseUnits() {
    const amountUSDC = parseFloat(document.getElementById('inputTradeAmountUSDC').value || 0);
    // User requested: make sure to use the current value of leverage that the slider is set to
    const slider = document.getElementById('inputLeverage');
    const leverage = parseInt(slider.value || 20);
    const priceText = document.getElementById('current-price-val').innerText.split(' ')[0];
    const currentPrice = parseFloat(priceText) || 1;

    const totalUnits = (amountUSDC * leverage) / currentPrice;
    document.getElementById('inputTotalUnits').value = totalUnits.toFixed(4);

    if (currentConfig && activeSymbol) {
        currentConfig.symbol_strategies[activeSymbol].trade_amount_usdc = amountUSDC;
        // saveLiveConfig(); // Too frequent
    }

    updateLeverageDisplay(leverage);
    updateTrailingMetrics();
}

function updateLeverageDisplay(val) {
    const amountUSDC = parseFloat(document.getElementById('inputTradeAmountUSDC').value || 0);
    const leverage = parseInt(val);
    document.getElementById('current-leverage-val').innerText = `${leverage}x`;

    const marginStable = (amountUSDC).toFixed(2);
    const stable = 'USDC';

    const anyEnabled = currentConfig && currentConfig.api_accounts.some(acc => acc.enabled && acc.api_key);
    const marginLabel = anyEnabled ? translations[currentLang]['margin-req'] : translations[currentLang]['margin-est'];

    document.getElementById('margin-info').innerText = `${marginLabel}: ${marginStable} ${stable}`;

    updateTrailingMetrics();
}

function updateTrailingMetrics() {
    if (!currentConfig || !activeSymbol) return;
    const strat = currentConfig.symbol_strategies[activeSymbol];
    if (!strat) return;

    const amountUSDC = parseFloat(document.getElementById('inputTradeAmountUSDC').value || 0);
    const currentPriceText = document.getElementById('current-price-val').innerText.split(' ')[0];
    const currentPrice = parseFloat(currentPriceText) || 0;
    const leverage = parseInt(document.getElementById('inputLeverage').value || 20);
    const devRaw = parseFloat(document.getElementById('trailingDeviation').value || 0);
    const deviationAbs = Math.abs(devRaw);
    const direction = strat.direction;

    // Quantity used for ROI
    const totalQty = (amountUSDC * leverage) / (currentPrice || 1);

    // Using Estimated Peak if provided, otherwise simulating peak as current price
    const estPeakRaw = document.getElementById('inputEstimatedPeak')?.value;
    const peakPrice = parseFloat(estPeakRaw) > 0 ? parseFloat(estPeakRaw) : currentPrice;

    let triggerPrice;
    let profitMoney;

    // Note: We use the "Planned" entry price here for ROI calculation in the calculator
    // In live trade, it's relative to actual Fill
    const entryPrice = parseFloat(document.getElementById('inputEntryPrice').value || currentPrice);

    if (direction === 'LONG') {
        triggerPrice = peakPrice * (1 - (deviationAbs / 100));
        profitMoney = (triggerPrice - entryPrice) * totalQty;
    } else {
        triggerPrice = peakPrice * (1 + (deviationAbs / 100));
        profitMoney = (entryPrice - triggerPrice) * totalQty;
    }

    const priceMovePct = ((triggerPrice - entryPrice) / (entryPrice || 1)) * 100 * (direction === 'LONG' ? 1 : -1);
    const roe = priceMovePct * leverage;

    const moneyEl = document.getElementById('label-approx-profit-money');
    const pctEl = document.getElementById('label-approx-profit-pct');
    const roeEl = document.getElementById('label-approx-profit-roe');
    const valContainer = document.getElementById('approx-profit-val');

    const prefix = profitMoney >= 0 ? '+' : '';
    moneyEl.innerText = `${prefix}$${profitMoney.toFixed(2)}`;
    pctEl.innerText = `${prefix}${priceMovePct.toFixed(2)}%`;
    roeEl.innerText = `(ROE: ${prefix}${roe.toFixed(2)}%)`;

    valContainer.className = profitMoney >= 0 ? 'fw-bold text-success fs-5' : 'fw-bold text-danger fs-5';
}

function applyTranslations() {
    const t = translations[currentLang];
    for (const [id, text] of Object.entries(t)) {
        const el = document.getElementById(id);
        if (el) {
            if (id.startsWith('th-') || id === 'msg-no-positions' || id.startsWith('lc-')) {
                el.innerText = text;
            } else if (id === 'nav-title') {
                el.innerText = text;
            } else if (id.startsWith('label-') || id.startsWith('btn-') || id.startsWith('tab-') || id === 'manual-pos-title') {
                el.innerText = text;
            }
        }
    }

    // Update Margin Type Dropdown options
    const marginSelect = document.getElementById('inputMarginType');
    if (marginSelect) {
        marginSelect.options[0].text = t['margin-crossed'];
        marginSelect.options[1].text = t['margin-isolated'];
    }

    // Update Clear Console button
    const clearBtn = document.getElementById('clearConsoleBtn');
    if (clearBtn) {
        clearBtn.innerHTML = `<i class="bi bi-trash"></i> ${t['btn-clear-console']}`;
    }
    // Specific updates
    const titleTag = document.getElementById('title-tag');
    if (titleTag) titleTag.innerText = t['nav-title'];
    const botStatus = document.getElementById('botStatus');
    if (botStatus) {
        botStatus.innerText = isBotRunning ? t['botStatus-Running'] : t['botStatus-Stopped'];
    }
    const startBtnText = document.querySelector('#startStopBtn span');
    if (startBtnText) {
        startBtnText.innerText = isBotRunning ? t['btn-stop-text'] : t['btn-start-text'];
    }
}

function setupSocketListeners() {
    socket.on('bot_status', (data) => {
        isBotRunning = data.running;
        setBtnLoading(false);
        applyTranslations();
        const btn = document.getElementById('startStopBtn');
        if (isBotRunning) {
            btn.innerHTML = `<i class="bi bi-stop-fill"></i> <span>${translations[currentLang]['btn-stop-text']}</span> <div class="spinner-border spinner-border-sm d-none" role="status" id="btn-spinner"></div>`;
            btn.className = 'btn btn-sm btn-danger d-flex align-items-center gap-1';
        } else {
            btn.innerHTML = `<i class="bi bi-play-fill"></i> <span>${translations[currentLang]['btn-start-text']}</span> <div class="spinner-border spinner-border-sm d-none" role="status" id="btn-spinner"></div>`;
            btn.className = 'btn btn-sm btn-accent d-flex align-items-center gap-1';
        }
    });
    socket.on('price_update', (prices) => {
        // console.log("Price sync update:", Object.keys(prices).length, "symbols");

        // If config is loaded but activeSymbol not set, pick the first one
        if (!activeSymbol && currentConfig && currentConfig.symbols && currentConfig.symbols.length > 0) {
            activeSymbol = currentConfig.symbols[0];
            console.log("Selected activeSymbol from config:", activeSymbol);
        }

        // If still no activeSymbol, fallback to the first symbol in the price map
        if (!activeSymbol) {
            const available = Object.keys(prices);
            if (available.length > 0) {
                activeSymbol = available[0];
                // console.log("Fallback activeSymbol from prices:", activeSymbol);
            } else return;
        }

        const currentPrice = prices[activeSymbol];
        if (currentPrice !== undefined) {
            let quote = activeSymbol.endsWith('USDC') ? 'USDC' : (activeSymbol.endsWith('BTC') ? 'BTC' : 'ETH');
            const priceEl = document.getElementById('current-price-val');
            if (priceEl) priceEl.innerText = `${currentPrice.toFixed(4)} ${quote}`;

            const inputAmount = document.getElementById('inputTradeAmountUSDC');
            if (inputAmount) inputAmount.setAttribute('placeholder', `Price: ${currentPrice.toFixed(4)}`);

            updateTotalBaseUnits();
            updateTrailingMetrics();
        }
    });

    socket.on('max_leverages', (data) => {
        maxLeverages = { ...maxLeverages, ...data };
        if (activeSymbol && maxLeverages[activeSymbol]) {
            const maxL = maxLeverages[activeSymbol];
            const slider = document.getElementById('inputLeverage');
            slider.max = maxL;

            if (parseInt(slider.value) > maxL) {
                slider.value = maxL;
                updateLeverageDisplay(maxL);
            }
            updateLeverageMarks(maxL);
        }
    });

    socket.on('account_update', (data) => {
        document.getElementById('balanceDisplay').textContent = `$${Number(data.total_equity || 0).toFixed(2)}`;

        // Render individual accounts
        const accountsContainer = document.getElementById('individual-accounts-container');
        if (accountsContainer && data.accounts) {
            accountsContainer.innerHTML = data.accounts.map(acc => `
                <div class="px-3 py-2 border-bottom border-secondary d-flex justify-content-between align-items-center bg-tertiary-hover">
                    <div class="d-flex align-items-center gap-2">
                        <div class="account-dot ${acc.active ? 'bg-success' : 'bg-secondary'}"></div>
                        <span class="small text-light">${acc.name}</span>
                    </div>
                    <span class="small fw-bold text-accent">$${acc.balance.toFixed(2)}</span>
                </div>
            `).join('');
        }

        const positionsTable = document.getElementById('positionsTableBody');
        const posToRender = data.positions || [];

        // Update displaySymbol for the active selection
        const activePos = posToRender.find(p => p.symbol === activeSymbol) ||
            (data.manual_positions || []).find(p => p.symbol === activeSymbol);

        if (activePos) {
            const side = activePos.amount > 0 ? 'LONG' : (activePos.amount < 0 ? 'SHORT' : '');
            document.getElementById('displaySymbol').innerText = `${side} ${Math.abs(activePos.amount)} ${activeSymbol}`;
            document.getElementById('displaySymbol').className = activePos.amount > 0 ? 'text-success fw-bold text-center mb-2' : (activePos.amount < 0 ? 'text-danger fw-bold text-center mb-2' : 'text-accent fw-bold text-center mb-2');
        } else {
            document.getElementById('displaySymbol').innerText = `NONE 0.0000000 ${activeSymbol}`;
            document.getElementById('displaySymbol').className = 'text-accent fw-bold text-center mb-2';
        }

        if (posToRender.length > 0) {
            positionsTable.innerHTML = posToRender.map(p => `
                <tr class="${p.is_manual ? 'opacity-75' : ''}">
                    <td>${p.account}${p.is_manual ? ' <span class="badge bg-secondary ms-1" style="font-size:0.65em;">Manual</span>' : ''}</td>
                    <td class="fw-bold">${p.symbol}</td>
                    <td class="${p.amount > 0 ? 'text-success' : 'text-danger'}">${p.amount}</td>
                    <td>${Number(p.entryPrice).toFixed(4)}</td>
                    <td class="${p.unrealizedProfit >= 0 ? 'text-success' : 'text-danger'} fw-bold">${Number(p.unrealizedProfit).toFixed(2)}</td>
                    <td><button class="btn btn-xs btn-outline-danger" onclick="closePosition('${p.account}', '${p.symbol}')">${translations[currentLang]['btn-close']}</button></td>
                </tr>
            `).join('');
        } else {
            positionsTable.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-secondary">${translations[currentLang]['msg-no-positions']}</td></tr>`;
        }

        // Handle Manual Positions
        const manualContainer = document.getElementById('manual-position-container');
        const useExisting = document.getElementById('useExistingAssets').checked;
        const myManualPos = (data.manual_positions || []).find(p => p.symbol === activeSymbol);

        if (useExisting && myManualPos) {
            manualContainer.classList.remove('d-none');
            document.getElementById('manual-pos-badge').innerText = activeSymbol;
            document.getElementById('manual-pos-size').innerText = myManualPos.amount;
            document.getElementById('manual-pos-entry').innerText = Number(myManualPos.entryPrice).toFixed(4);
        } else {
            manualContainer.classList.add('d-none');
        }
    });

    socket.on('console_log', (data) => {
        const consoleOutput = document.getElementById('consoleOutput');
        const line = document.createElement('div');
        line.className = 'small mb-1';
        line.innerHTML = `<span class="text-secondary">[${data.timestamp}]</span> <span class="${data.level === 'error' ? 'text-danger' : (data.level === 'warning' ? 'text-warning' : 'text-success')}">${data.message}</span>`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    });
}

async function loadConfig() {
    const res = await fetch('/api/config');
    currentConfig = await res.json();
    currentLang = currentConfig.language || 'pt-BR';
    document.getElementById('lang-select').value = currentLang;
    updateUIFromConfig();
    applyTranslations();
}

function updateUIFromConfig() {
    if (!currentConfig) return;

    // Initialize activeSymbol if not set
    if (!activeSymbol && currentConfig.symbols && currentConfig.symbols.length > 0) {
        activeSymbol = currentConfig.symbols[0];
    }

    // Populate Symbol Picker
    const select = document.getElementById('selectActiveSymbol');
    if (select) {
        select.innerHTML = currentConfig.symbols.map(s => `<option value="${s}" ${s === activeSymbol ? 'selected' : ''}>${s}</option>`).join('');
    }

    const strat = currentConfig.symbol_strategies[activeSymbol];
    if (strat) {
        document.getElementById('displaySymbol').innerHTML = `${strat.direction} ${strat.trade_amount_usdc} ${activeSymbol}`;
        document.getElementById('inputTradeAmountUSDC').value = strat.trade_amount_usdc || 100;

        const slider = document.getElementById('inputLeverage');
        const maxL = maxLeverages[activeSymbol] || 125;
        slider.max = maxL;

        let lev = strat.leverage || 20;
        if (lev > maxL) lev = maxL;
        slider.value = lev;

        updateLeverageDisplay(lev);
        updateLeverageMarks(maxL);

        // Update Leverage Presets based on Max Leverage
        const presetContainer = document.getElementById('leverage-presets');
        if (presetContainer && presetContainer.children.length === 5) {
            // Keep 1x, 10x, 20x, 50x if they are under or equal to maxL, otherwise hide them.
            // Make the 5th button the "Max" button.
            Array.from(presetContainer.children).forEach((btn, idx) => {
                if (idx < 4) {
                    const presetVal = parseInt(btn.innerText);
                    if (presetVal > maxL) {
                        btn.style.display = 'none';
                    } else {
                        btn.style.display = 'inline-block';
                    }
                } else {
                    // 5th button becomes the Max Leverage button
                    btn.style.display = 'inline-block';
                    btn.innerText = `${maxL}x`;
                    btn.setAttribute('onclick', `setLeverage(${maxL})`);
                }
            });
        }

        document.getElementById('trailingDeviation').value = strat.trailing_deviation || 0;
        document.getElementById('trailingTpToggle').checked = strat.trailing_enabled || false;
        document.getElementById('tpToggle').checked = strat.tp_enabled !== false; // Default true

        document.getElementById('inputMarginType').value = strat.margin_type || 'CROSSED';
        document.getElementById('inputEntryPrice').value = strat.entry_price || 0;
        document.getElementById('useExistingAssets').checked = strat.use_existing_assets !== false; // Default true

        document.getElementById('addon-total-units-symbol').innerText = activeSymbol.split('USDC')[0];

        updateTotalBaseUnits();
        updateTPGrid();
        updateTrailingMetrics();
    }

    document.getElementById('demoBadge').textContent = currentConfig.is_demo ? 'Demo' : 'Live';
    document.getElementById('demoBadge').className = currentConfig.is_demo ? 'badge bg-info ms-1 status-badge' : 'badge bg-danger ms-1 status-badge';

    updateSymbolList();
}

function closePosition(account, symbol) {
    const confirmMsg = translations[currentLang]['confirm-close'].replace('{symbol}', symbol).replace('{account}', account);
    if (confirm(confirmMsg)) {
        socket.emit('close_trade', { account, symbol });
    }
}

function updateSymbolList() {
    const list = document.getElementById('symbolList');
    list.innerHTML = currentConfig.symbols.map(s => `
        <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent border-secondary text-light py-2">
            ${s}
            <i class="bi bi-trash text-danger cursor-pointer" onclick="removeSymbol('${s}')" style="cursor:pointer"></i>
        </li>
    `).join('');
    document.getElementById('activeAccountsDisplay').textContent = currentConfig.api_accounts.filter(a => a.enabled).length;
}

function removeSymbol(symbol) {
    currentConfig.symbols = currentConfig.symbols.filter(s => s !== symbol);
    updateSymbolList();
    saveLiveConfig();
}

function updateTPGrid() {
    if (!currentConfig || !activeSymbol) return;
    const strat = currentConfig.symbol_strategies[activeSymbol];
    if (!strat) return;

    const fractions = parseInt(strat.total_fractions || 8);
    const deviation = parseFloat(strat.price_deviation || 0.6);
    const fractionPct = (100 / fractions).toFixed(2);

    let html = '';
    for (let i = 1; i <= fractions; i++) {
        const devPct = (i * deviation).toFixed(2);
        html += `
            <div class="tp-grid-row">
                <span class="text-accent">${devPct}%</span>
                <span>${fractionPct}%</span>
                <span class="text-secondary"><i class="bi bi-link-45deg"></i></span>
            </div>
        `;
    }
    document.getElementById('tpGridContainer').innerHTML = html;
}

function renderConfig() {
    const accContainer = document.getElementById('accountConfigs');
    accContainer.innerHTML = currentConfig.api_accounts.map((acc, i) => `
        <div class="mb-3 p-3 border border-secondary rounded bg-tertiary">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="fw-bold">Account: ${acc.name}</span>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="acc_enabled_${i}" ${acc.enabled ? 'checked' : ''}>
                    <label class="form-check-label small">Enabled</label>
                </div>
            </div>
            <div class="row g-2">
                <div class="col-12">
                    <label class="small text-secondary">API Key</label>
                    <input type="text" class="form-control" id="acc_key_${i}" value="${acc.api_key}">
                </div>
                <div class="col-12">
                    <label class="small text-secondary">API Secret</label>
                    <input type="password" class="form-control" id="acc_secret_${i}" value="${acc.api_secret}">
                </div>
                <div class="col-12 text-end mt-2">
                    <button class="btn btn-xs btn-outline-info" onclick="testAccount(${i})">Test Connection</button>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('configIsDemo').checked = currentConfig.is_demo;

    // For simplicity, modal edits the current active symbol's strategy
    const strat = currentConfig.symbol_strategies[activeSymbol];
    if (strat) {
        document.getElementById('configDirection').value = strat.direction || 'LONG';
        document.getElementById('configTotalQty').value = strat.trade_amount_usdc || 100;
        document.getElementById('configFractions').value = strat.total_fractions || 8;
        document.getElementById('configDeviation').value = strat.price_deviation || 0.6;
    }
}

async function testAccount(index) {
    const api_key = document.getElementById(`acc_key_${index}`).value;
    const api_secret = document.getElementById(`acc_secret_${index}`).value;

    if (!api_key || !api_secret) {
        alert("Enter API credentials");
        return;
    }

    const res = await fetch('/api/test_api_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key, api_secret })
    });
    const data = await res.json();
    alert(data.message);
}

async function saveConfig() {
    const api_accounts = currentConfig.api_accounts.map((acc, i) => ({
        name: acc.name,
        enabled: document.getElementById(`acc_enabled_${i}`).checked,
        api_key: document.getElementById(`acc_key_${i}`).value,
        api_secret: document.getElementById(`acc_secret_${i}`).value
    }));

    const config = {
        ...currentConfig,
        api_accounts,
        is_demo: document.getElementById('configIsDemo').checked,
        language: currentLang,
        symbols: currentConfig.symbols,
        symbol_strategies: { ...currentConfig.symbol_strategies }
    };

    // Apply strategy settings to the currently active symbol
    if (activeSymbol) {
        config.symbol_strategies[activeSymbol] = {
            ...(config.symbol_strategies[activeSymbol] || {}),
            direction: document.getElementById('configDirection').value,
            trade_amount_usdc: parseFloat(document.getElementById('configTotalQty').value) || 0,
            total_fractions: parseInt(document.getElementById('configFractions').value) || 8,
            price_deviation: parseFloat(document.getElementById('configDeviation').value) || 0.6
        };
    }

    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });

    if (res.ok) {
        currentConfig = config;
        updateUIFromConfig();
        configModal.hide();
    } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (err.message || res.status));
    }
}

window.setLeverage = function (val) {
    const slider = document.getElementById('inputLeverage');
    const maxL = parseInt(slider.max) || 125;
    const target = Math.min(val, maxL);
    slider.value = target;
    updateLeverageDisplay(target);
    if (currentConfig && activeSymbol) {
        currentConfig.symbol_strategies[activeSymbol].leverage = parseInt(target);
        saveLiveConfig();
    }
    updateTotalBaseUnits();
};

window.setDeviation = function (val) {
    const slider = document.getElementById('trailingDeviation');
    slider.value = val;
    const label = translations[currentLang]['label-dev'];
    document.getElementById('label-approx-profit').innerText = `${label} ${val}%`;
    if (currentConfig && activeSymbol) {
        currentConfig.symbol_strategies[activeSymbol].trailing_deviation = parseFloat(val);
        saveLiveConfig();
    }
    updateTrailingMetrics();
};

function updateLeverageMarks(maxL) {
    const marksContainer = document.querySelector('.leverage-marks');
    if (!marksContainer) return;

    // Dynamic marks: Min (1), 25%, 50%, 75%, Max
    const values = [1];
    if (maxL > 4) values.push(Math.round(maxL * 0.25));
    if (maxL > 2) values.push(Math.round(maxL * 0.5));
    if (maxL > 1.5) values.push(Math.round(maxL * 0.75));
    if (!values.includes(maxL)) values.push(maxL);

    // De-duplicate and sort
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

    marksContainer.innerHTML = uniqueValues.map((v, i) => {
        const left = ((v - 1) / (maxL - 1)) * 100;
        // Only show a label if it's not too close to the previous one
        // Minimum 15% distance between labels
        if (i > 0) {
            const prevV = uniqueValues[i - 1];
            const prevLeft = ((prevV - 1) / (maxL - 1)) * 100;
            if (left - prevLeft < 15 && v !== maxL) return '';
        }
        return `<span style="left: ${left}%; transform: translateX(-50%);">${v}x</span>`;
    }).join('');
}

function setBtnLoading(isLoading) {
    const btn = document.getElementById('startStopBtn');
    const spinner = document.getElementById('btn-spinner');
    if (isLoading) {
        btn.classList.add('disabled');
        spinner.classList.remove('d-none');
    } else {
        btn.classList.remove('disabled');
        spinner.classList.add('d-none');
    }
}

async function saveLiveConfig() {
    await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
    });
}
