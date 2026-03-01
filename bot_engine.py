import json
import math
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
import time
import logging
import threading
import asyncio
from datetime import datetime
from collections import deque
from binance.client import Client
from binance.streams import ThreadedWebsocketManager
from binance.exceptions import BinanceAPIException
from translations_py import TRANSLATIONS

class BinanceTradingBotEngine:
    def __init__(self, config_path, emit_callback):
        self.config_path = config_path
        self.emit = emit_callback
        self.console_logs = deque(maxlen=500)
        self.config = self._load_config()
        self.language = self.config.get('language', 'pt-BR')
        self.bg_clients = {} # account_index -> { 'client': Client, 'name': str }
        self._initialize_bg_clients()
        self.metadata_client = self._get_metadata_client()

        self.is_running = False
        self.stop_event = threading.Event()

        self.accounts = {} # account_index -> { 'client': Client, 'twm': ThreadedWebsocketManager, 'info': account_config }
        self.exchange_info = {} # symbol -> info

        # Shared market data: symbol -> { 'price': float, 'last_update': float, 'info': info }
        self.shared_market_data = {}
        self.market_data_lock = threading.Lock()
        self.max_leverages = {} # symbol -> max_leverage
        self.trailing_state = {} # (idx, symbol) -> { 'peak': float }

        # Grid state: (account_index, symbol) -> { 'initial_filled': bool, 'levels': { level: { 'tp_id': id, 'rb_id': id } } }
        self.grid_state = {}

        # Threads: (account_index, symbol) -> Thread
        self.symbol_threads = {}
        
        # Dashboard metrics
        self.account_balances = {} # account_index -> balance
        self.open_positions = {} # account_index -> [positions]
        # Trailing TP state: (account_index, symbol) -> { 'highest_pnl': float, 'last_update': float }
        self.trailing_state = {}
        
        self.data_lock = threading.Lock()
        
        self._setup_logging()
        
        # Start global background tasks immediately (pricing, metrics)
        self._background_tasks_started = False
        threading.Thread(target=self._global_background_worker, daemon=True).start()

    def _setup_logging(self):
        numeric_level = logging.INFO
        root_logger = logging.getLogger()
        root_logger.setLevel(numeric_level)
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        ch = logging.StreamHandler()
        ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        root_logger.addHandler(ch)
        fh = logging.FileHandler('binance_bot.log', encoding='utf-8')
        fh.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        root_logger.addHandler(fh)

    def _load_config(self):
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error loading config: {e}")
            return {}

    def _t(self, key, **kwargs):
        """Helper to get translated strings."""
        lang = self.language if self.language in TRANSLATIONS else 'pt-BR'
        template = TRANSLATIONS[lang].get(key, key)
        try:
            return template.format(**kwargs)
        except Exception:
            return template

    def log(self, message_or_key, level='info', account_name=None, is_key=False, **kwargs):
        if is_key:
            message = self._t(message_or_key, **kwargs)
        else:
            message = message_or_key
            
        timestamp = datetime.now().strftime('%H:%M:%S')
        prefix = f"[{account_name}] " if account_name else ""
        log_entry = {'timestamp': timestamp, 'message': f"{prefix}{message}", 'level': level}
        self.console_logs.append(log_entry)
        self.emit('console_log', log_entry)
        if level == 'error': logging.error(f"{prefix}{message}")
        elif level == 'warning': logging.warning(f"{prefix}{message}")
        else: logging.info(f"{prefix}{message}")

    def _create_client(self, api_key, api_secret):
        testnet = self.config.get('is_demo', True)
        client = Client(api_key, api_secret, testnet=testnet, requests_params={'timeout': 20})
        try:
            res = client.get_server_time()
            client.timestamp_offset = res['serverTime'] - int(time.time() * 1000)
        except Exception as e:
            logging.warning(f"Failed to sync time: {e}")
        return client

    def _get_client(self, api_key, api_secret):
        return self._create_client(api_key, api_secret)

    def _initialize_bg_clients(self):
        """Initializes clients for all enabled accounts to fetch balances in background."""
        api_accounts = self.config.get('api_accounts', [])
        new_bg_clients = {}
        for i, acc in enumerate(api_accounts):
            if acc.get('api_key') and acc.get('api_secret') and acc.get('enabled', True):
                try:
                    # Check if we already have a client for this key
                    existing = self.bg_clients.get(i)
                    if existing and existing['info']['api_key'] == acc['api_key']:
                        new_bg_clients[i] = existing
                    else:
                        client = self._get_client(acc['api_key'], acc['api_secret'])
                        new_bg_clients[i] = {
                            'client': client,
                            'name': acc.get('name', f"Account {i+1}"),
                            'info': acc
                        }
                except Exception as e:
                    logging.error(f"Failed to init bg client for {acc.get('name')}: {e}")
        self.bg_clients = new_bg_clients

    def _get_metadata_client(self):
        """Creates a client for fetching prices/leverage even when bot is stopped."""
        try:
            testnet = self.config.get('is_demo', True)
            accs = self.config.get('api_accounts', [])
            if accs:
                # Use first account's keys even if disabled, or public if possible
                return self._create_client(accs[0]['api_key'], accs[0]['api_secret'])
            return self._create_client("", "")
        except:
            return None

    def test_account(self, api_key, api_secret):
        try:
            client = self._get_client(api_key, api_secret)
            client.futures_account_balance()
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)

    def start(self):
        if self.is_running: return
        self.is_running = True
        self.stop_event.clear()

        self.log("bot_starting", is_key=True)

        # Initialize accounts
        api_accounts = self.config.get('api_accounts', [])
        for i, acc in enumerate(api_accounts):
            if acc.get('api_key') and acc.get('api_secret') and acc.get('enabled', True):
                try:
                    client = self._get_client(acc['api_key'], acc['api_secret'])
                    twm = ThreadedWebsocketManager(api_key=acc['api_key'], api_secret=acc['api_secret'], testnet=self.config.get('is_demo', True))
                    twm.start()

                    self.accounts[i] = {
                        'client': client,
                        'twm': twm,
                        'info': acc,
                        'last_update': 0
                    }

                    # Start user data stream
                    twm.start_futures_user_socket(callback=lambda msg, idx=i: self._handle_user_data(idx, msg))
                    
                    # Initialize strategy for each symbol in its own thread
                    for symbol in self.config.get('symbols', []):
                        self._start_symbol_thread(i, symbol)
                    
                    self.log("account_init", account_name=acc.get('name'), is_key=True, name=acc.get('name', i))

                except Exception as e:
                    self.log("account_init_failed", level='error', is_key=True, name=acc.get('name', i), error=str(e))

    def stop(self):
        self.is_running = False
        # Do NOT set stop_event here because it stops the global pricing/balance worker
        # Instead, we just stop the TWMs and clear active trading accounts
        for i, acc in self.accounts.items():
            try:
                acc['twm'].stop()
            except: pass
        self.accounts = {}
        self.log("bot_stopped", is_key=True)

    def _setup_strategy_for_account(self, idx, symbol):
        acc = self.accounts[idx]
        client = acc['client']
        symbol_strategies = self.config.get('symbol_strategies', {})
        strategy = symbol_strategies.get(symbol, {})
        if not symbol: return

        try:
            # Get and cache exchange info centrally
            with self.market_data_lock:
                if symbol not in self.shared_market_data:
                    info = client.futures_exchange_info()
                    for s in info['symbols']:
                        if s['symbol'] == symbol:
                            self.shared_market_data[symbol] = {'info': s, 'price': 0.0, 'last_update': 0}
                            break
            
            # Set leverage and margin type
            leverage = int(strategy.get('leverage', 20))
            max_l = self.max_leverages.get(symbol, 125)
            if leverage > max_l:
                leverage = max_l
            margin_type = strategy.get('margin_type', 'CROSSED')

            try:
                client.futures_change_margin_type(symbol=symbol, marginType=margin_type)
            except BinanceAPIException as e:
                if "No need to change margin type" not in e.message:
                    self.log("margin_type_error", level='warning', account_name=acc['info'].get('name'), is_key=True, error=e.message)

            client.futures_change_leverage(symbol=symbol, leverage=leverage)

            self.log("leverage_set", account_name=acc['info'].get('name'), is_key=True, leverage=leverage, margin_type=margin_type)

            # Force metrics update to get balance
            self._update_account_metrics(idx, force=True)

            # Initial entry if needed
            self._check_and_place_initial_entry(idx, symbol)

        except Exception as e:
            self.log("strategy_setup_error", level='error', account_name=acc['info'].get('name'), is_key=True, error=str(e))

    def _check_and_place_initial_entry(self, idx, symbol):
        acc = self.accounts[idx]
        client = acc['client']
        symbol_strategies = self.config.get('symbol_strategies', {})
        strategy = symbol_strategies.get(symbol, {})
        direction = strategy.get('direction', 'LONG')
        
        trade_amount_usdc = float(strategy.get('trade_amount_usdc', 0))
        leverage = int(strategy.get('leverage', 20))
        
        with self.market_data_lock:
            current_price = self.shared_market_data.get(symbol, {}).get('price', 0)
        
        if current_price <= 0: return
        
        # Calculate quantity based on USDC amount and leverage
        quantity = (trade_amount_usdc * leverage) / current_price
        entry_price = float(strategy.get('entry_price', 0))

        if quantity <= 0 or entry_price <= 0: return

        # "Use Existing Assets" logic
        use_existing = strategy.get('use_existing_assets', True)
        pos = client.futures_position_information(symbol=symbol)
        has_pos = any(float(p['positionAmt']) != 0 for p in pos if p['symbol'] == symbol)

        if use_existing and has_pos:
            self.log("pos_exists_skip", account_name=acc['info'].get('name'), is_key=True, symbol=symbol)
            # Force grid placement if not already placed
            with self.data_lock:
                if (idx, symbol) not in self.grid_state:
                    self.grid_state[(idx, symbol)] = {'initial_filled': True, 'levels': {}}
                    # Only place TP grid if tp_enabled
                    if strategy.get('tp_enabled', True):
                        current_price = float(pos[0]['entryPrice']) if float(pos[0]['entryPrice']) > 0 else entry_price
                        total_fractions = int(strategy.get('total_fractions', 8))
                        price_deviation = float(strategy.get('price_deviation', 0.6)) / 100.0
                        fraction_qty = quantity / total_fractions
                        self._place_tp_grid(idx, symbol, current_price, total_fractions, fraction_qty, price_deviation, direction)
            return

        # Check if we have open orders
        orders = client.futures_get_open_orders(symbol=symbol)
        
        if not has_pos and not orders:
            self.log("placing_initial", account_name=acc['info'].get('name'), is_key=True, direction=direction, price=entry_price)
            side = Client.SIDE_BUY if direction == 'LONG' else Client.SIDE_SELL

            try:
                order_id = self._place_limit_order(idx, symbol, side, quantity, entry_price)

                if order_id:
                    with self.data_lock:
                        self.grid_state[(idx, symbol)] = {
                            'initial_order_id': order_id,
                            'initial_filled': False,
                            'levels': {} # level -> { 'tp_order_id': id, 'buy_back_order_id': id }
                        }

            except Exception as e:
                self.log("initial_failed", level='error', account_name=acc['info'].get('name'), is_key=True, error=str(e))

    def _format_quantity(self, symbol, quantity):
        with self.market_data_lock:
            info = self.shared_market_data.get(symbol, {}).get('info')
        if not info: return quantity
        step_size = "0.00000001"
        for f in info['filters']:
            if f['filterType'] == 'LOT_SIZE':
                step_size = f['stepSize']
                break
        step_d = Decimal(step_size).normalize()
        qty_d = Decimal(str(quantity))

        # Precision from step_size
        precision = abs(step_d.as_tuple().exponent)
        
        # Format explicitly using decimal string formatting
        # Round down to avoid exceeding available balance mathematically
        factor = Decimal(10) ** precision
        qty_floored = math.floor(qty_d * factor) / factor
        
        return f"{qty_floored:.{precision}f}"


    def _format_price(self, symbol, price):
        with self.market_data_lock:
            info = self.shared_market_data.get(symbol, {}).get('info')
        if not info: return str(price)
        tick_size = "0.00000001"
        for f in info['filters']:
            if f['filterType'] == 'PRICE_FILTER':
                tick_size = f['tickSize']
                break
        
        price_d = Decimal(str(price))
        tick_d = Decimal(tick_size)
        
        # Quantize to the same number of decimals as tick_size
        exp = tick_d.normalize().as_tuple().exponent
        places = Decimal(10) ** exp
        result = price_d.quantize(places, rounding=ROUND_HALF_UP)
        
        return format(result.normalize(), 'f')

    def _handle_user_data(self, idx, msg):
        event_type = msg.get('e')
        acc_name = self.accounts[idx]['info'].get('name')

        if event_type == 'ORDER_TRADE_UPDATE':
            order_data = msg.get('o', {})
            symbol = order_data.get('s')
            status = order_data.get('X')
            side = order_data.get('S')
            order_id = order_data.get('i')
            avg_price = float(order_data.get('ap', 0))
            filled_qty = float(order_data.get('z', 0))

            if status == 'FILLED':
                self.log("order_filled", account_name=acc_name, is_key=True, id=order_id, side=side, qty=filled_qty, symbol=symbol, price=avg_price)
                self._process_filled_order(idx, symbol, order_data)

        elif event_type == 'ACCOUNT_UPDATE':
            # Update balances and positions
            update_data = msg.get('a', {})
            balances = update_data.get('B', [])
            for b in balances:
                asset = b.get('a')
                # Update local balance storage
                pass
            self._update_account_metrics(idx, force=True)

    def _process_filled_order(self, idx, symbol, order_data):
        order_id = order_data.get('i')
        symbol_strategies = self.config.get('symbol_strategies', {})
        strategy = symbol_strategies.get(symbol)
        if not strategy: return

        direction = strategy.get('direction', 'LONG')
        total_fractions = int(strategy.get('total_fractions', 8))
        price_deviation = float(strategy.get('price_deviation', 0.6)) / 100.0
        
        trade_amount_usdc = float(strategy.get('trade_amount_usdc', 0))
        leverage = int(strategy.get('leverage', 20))
        
        # We need the price when the initial entry filled to calculate quantity if we haven't already
        avg_price = float(order_data.get('ap', 0))
        if avg_price <= 0: return
        
        total_qty = (trade_amount_usdc * leverage) / avg_price
        fraction_qty = total_qty / total_fractions
        entry_price_base = float(strategy.get('entry_price', 0))

        with self.data_lock:
            state = self.grid_state.get((idx, symbol))
            if not state: return

            # 1. Initial Entry Filled
            if not state.get('initial_filled') and order_id == state.get('initial_order_id'):
                state['initial_filled'] = True
                avg_price = float(order_data.get('ap'))
                self.log("initial_filled_grid", account_name=self.accounts[idx]['info'].get('name'), is_key=True, price=avg_price)
                # Only place TP grid if tp_enabled
                if strategy.get('tp_enabled', True):
                    self._place_tp_grid(idx, symbol, avg_price, total_fractions, fraction_qty, price_deviation, direction)
                return

            # 2. Check levels for TP or Re-entry fills
            for level, orders in state['levels'].items():
                if order_id == orders.get('tp_order_id'):
                    self.log("tp_filled_reentry", account_name=self.accounts[idx]['info'].get('name'), is_key=True, level=level)
                    # If TP filled (e.g., Sell in LONG), we place a Buy order at the previous price level
                    rb_price = entry_price_base + (level - 1) * entry_price_base * price_deviation if direction == 'LONG' else \
                               entry_price_base - (level - 1) * entry_price_base * price_deviation
                    
                    rb_side = Client.SIDE_BUY if direction == 'LONG' else Client.SIDE_SELL
                    rb_id = self._place_limit_order(idx, symbol, rb_side, fraction_qty, rb_price)
                    orders['re_entry_order_id'] = rb_id
                    orders['tp_order_id'] = None
                    return

                if order_id == orders.get('re_entry_order_id'):
                    self.log("reentry_filled_tp", account_name=self.accounts[idx]['info'].get('name'), is_key=True, level=level)
                    # If Re-entry filled (e.g., Buy in LONG), we place the TP order back at this level
                    tp_price = entry_price_base + level * entry_price_base * price_deviation if direction == 'LONG' else \
                               entry_price_base - level * entry_price_base * price_deviation
                    
                    tp_side = Client.SIDE_SELL if direction == 'LONG' else Client.SIDE_BUY
                    tp_id = self._place_limit_order(idx, symbol, tp_side, fraction_qty, tp_price)
                    orders['tp_order_id'] = tp_id
                    orders['re_entry_order_id'] = None
                    return

    def _place_tp_grid(self, idx, symbol, entry_price, fractions, qty, deviation, direction):
        state = self.grid_state.get((idx, symbol))
        if not state: return
        
        for i in range(1, fractions + 1):
            if direction == 'LONG':
                tp_price = entry_price + (i * entry_price * deviation)
                side = Client.SIDE_SELL
            else:
                tp_price = entry_price - (i * entry_price * deviation)
                side = Client.SIDE_BUY

            order_id = self._place_limit_order(idx, symbol, side, qty, tp_price)
            state['levels'][i] = {
                'tp_order_id': order_id,
                're_entry_order_id': None,
                'price': tp_price
            }

    def _check_balance_for_order(self, idx, qty, price):
        # Specifically check USDC balance for USDC-M pairs
        balance = self.account_balances.get(idx, 0)
        notional = qty * price
        # Buffer for margin
        return balance > (notional / 5) # Simplified check for leverage safety

    def _place_limit_order(self, idx, symbol, side, qty, price):
        client = self.accounts[idx]['client']

        # Validate balance before placing re-buy/re-sell orders
        if not self._check_balance_for_order(idx, qty, price):
            self.log("insufficient_balance", level='warning', account_name=self.accounts[idx]['info'].get('name'), is_key=True, qty=qty, price=price)
            return None

        try:
            formatted_qty = self._format_quantity(symbol, qty)
            formatted_price = self._format_price(symbol, price)
            order = client.futures_create_order(
                symbol=symbol,
                side=side,
                type=Client.FUTURE_ORDER_TYPE_LIMIT,
                timeInForce=Client.TIME_IN_FORCE_GTC,
                quantity=formatted_qty,
                price=formatted_price
            )
            return order['orderId']
        except Exception as e:
            self.log("limit_order_failed", level='error', account_name=self.accounts[idx]['info'].get('name'), is_key=True, error=str(e))
            return None

    def _update_account_metrics(self, idx, force=False):
        acc = self.accounts[idx]
        client = acc['client']
        try:
            # Throttle updates
            if not force and time.time() - acc['last_update'] < 5: return
            acc['last_update'] = time.time()

            account_info = client.futures_account()
            
            # Find USDC asset balance specifically
            usdc_balance = 0.0
            for asset in account_info.get('assets', []):
                if asset['asset'] == 'USDC':
                    usdc_balance = float(asset['walletBalance'])
                    break
            
            total_unrealized_pnl = float(account_info['totalUnrealizedProfit'])

            self.account_balances[idx] = usdc_balance

            positions = []
            for p in account_info['positions']:
                if float(p['positionAmt']) != 0:
                    positions.append({
                        'symbol': p['symbol'],
                        'amount': p['positionAmt'],
                        'entryPrice': p['entryPrice'],
                        'unrealizedProfit': p['unrealizedProfit'],
                        'leverage': p['leverage']
                    })
            self.open_positions[idx] = positions

            self._emit_account_update()

        except Exception as e:
            logging.error(f"Error updating metrics for account {idx}: {e}")

    def _update_bg_account_metrics(self, idx):
        """Updates balance for background accounts (non-trading)."""
        acc = self.bg_clients.get(idx)
        if not acc: return
        client = acc['client']
        try:
            account_info = client.futures_account()
            # Find USDC asset balance specifically
            usdc_balance = 0.0
            for asset in account_info.get('assets', []):
                if asset['asset'] == 'USDC':
                    usdc_balance = float(asset['walletBalance'])
                    break
            self.account_balances[idx] = usdc_balance
        except Exception as e:
            # logging.error(f"Error updating bg metrics for account {idx}: {e}")
            pass

    def _emit_account_update(self):
        total_balance = sum(self.account_balances.values())
        total_pnl = 0.0
        
        # Flatten positions for UI — all positions are shown, manual ones flagged
        all_positions = []
        manual_positions = []
        
        for idx, pos_list in self.open_positions.items():
            acc_name = self.accounts[idx]['info'].get('name')
            for p in pos_list:
                p['account'] = acc_name
                total_pnl += float(p['unrealizedProfit'])
                
                # Tag as manual if not tracked in grid_state
                symbol = p['symbol']
                with self.data_lock:
                    state = self.grid_state.get((idx, symbol))
                p['is_manual'] = (state is None)
                
                all_positions.append(p)
                if p['is_manual']:
                    manual_positions.append(p)

        payload = {
            'total_balance': total_balance,
            'total_equity': total_balance + total_pnl,
            'total_pnl': total_pnl,
            'positions': all_positions,
            'manual_positions': manual_positions,
            'running': self.is_running,
            'accounts': [
                {
                    'name': self.bg_clients[idx]['name'],
                    'balance': self.account_balances.get(idx, 0.0),
                    'active': idx in self.accounts
                } for idx in self.bg_clients
            ]
        }
        self.emit('account_update', payload)

    def apply_live_config_update(self, new_config):
        self.config = new_config
        self.language = self.config.get('language', 'pt-BR')
        self._initialize_bg_clients()
        
        if self.is_running:
            strategy = self.config.get('strategy', {})
            leverage = int(strategy.get('leverage', 20))
            symbols = self.config.get('symbols', [])
            
            for idx in self.accounts:
                # 1. Start threads for new symbols
                for symbol in symbols:
                    self._start_symbol_thread(idx, symbol)
                
                # 2. Update leverage for current symbol (primary)
                try:
                    primary_symbol = strategy.get('symbol')
                    if primary_symbol:
                        self.accounts[idx]['client'].futures_change_leverage(symbol=primary_symbol, leverage=leverage)
                        self.log("live_update_leverage", account_name=self.accounts[idx]['info'].get('name'), is_key=True, leverage=leverage, symbol=primary_symbol)
                except Exception as e:
                    self.log(f"Failed to update leverage: {e}", 'warning')
        
        return {"success": True}

    def close_position(self, account_name, symbol):
        # Find the account
        for idx, acc in self.accounts.items():
            if acc['info'].get('name') == account_name:
                client = acc['client']
                try:
                    # Cancel all orders
                    client.futures_cancel_all_open_orders(symbol=symbol)
                    # Close position by market order
                    pos = client.futures_position_information(symbol=symbol)
                    for p in pos:
                        if p['symbol'] == symbol:
                            amt = float(p['positionAmt'])
                            if amt != 0:
                                side = Client.SIDE_SELL if amt > 0 else Client.SIDE_BUY
                                client.futures_create_order(
                                    symbol=symbol,
                                    side=side,
                                    type=Client.FUTURE_ORDER_TYPE_MARKET,
                                    quantity=abs(amt)
                                )
                    self.log("pos_closed_manual", account_name=account_name, is_key=True, symbol=symbol)
                except Exception as e:
                    self.log("error_closing_pos", level='error', account_name=account_name, is_key=True, error=str(e))
                break

    def _global_background_worker(self):
        """Global worker for fetching prices once and updating shared metrics."""
        while not self.stop_event.is_set():
            try:
                # 1. Update shared market data (prices)
                symbols = list(self.config.get('symbols', []))
                # logging.info(f"[DEBUG] Pricing worker starting for symbols: {symbols}")
                
                # Use metadata client if no accounts are active yet
                active_client = None
                for acc in self.accounts.values():
                    if acc.get('client'):
                        active_client = acc['client']
                        break
                
                if not active_client:
                    active_client = self.metadata_client

                if symbols and active_client:
                    try:
                        prices = active_client.futures_symbol_ticker()
                        price_map = {item['symbol']: float(item['price']) for item in prices}
                    except Exception as e:
                        logging.error(f"[DEBUG] Error fetching futures ticker: {e}")
                        price_map = {}
                    
                    if not price_map:
                        logging.warning("[DEBUG] Price map is empty!")
                    
                    with self.market_data_lock:
                        for symbol in symbols:
                            if symbol in price_map:
                                if symbol not in self.shared_market_data:
                                    self.shared_market_data[symbol] = {'price': 0, 'last_update': 0}
                                    # Fetch exchange info for precision parsing
                                    try:
                                        info = active_client.futures_exchange_info()
                                        for s in info['symbols']:
                                            if s['symbol'] == symbol:
                                                self.shared_market_data[symbol]['info'] = s
                                                break
                                    except Exception as e:
                                        logging.error(f"[DEBUG] Error fetching exchange info for {symbol}: {e}")
                                        
                                self.shared_market_data[symbol]['price'] = price_map[symbol]
                                self.shared_market_data[symbol]['last_update'] = time.time()
                                
                                # Fetch max leverage if not cached
                                if symbol not in self.max_leverages:
                                    try:
                                        # Use active_client (metadata or account client)
                                        brackets = active_client.futures_leverage_bracket(symbol=symbol)
                                        if brackets and len(brackets) > 0:
                                            # Normalize response format
                                            bracket_info = brackets[0] if 'brackets' in brackets[0] else brackets
                                            max_l = bracket_info['brackets'][0]['initialLeverage']
                                            self.max_leverages[symbol] = max_l
                                    except:
                                        self.max_leverages[symbol] = 125 # Default fallback
                    
                    if price_map:
                        # logging.info(f"[DEBUG] Emitting price_update with {len(price_map)} symbols")
                        self.emit('price_update', price_map)
                    
                    # 2. Update balances for all background accounts
                    for idx in self.bg_clients:
                        self._update_bg_account_metrics(idx)
                    
                    self._emit_account_update()
                    self.emit('max_leverages', self.max_leverages)
                
                # 2. Update account metrics (balance/positions)
                for idx in list(self.accounts.keys()):
                    self._update_account_metrics(idx)
                    
                time.sleep(1) # Faster update loop (1s)
            except Exception as e:
                # logging.error(f"Global worker error: {e}")
                time.sleep(2)

    def _emit_latest_prices(self):
        """Broadcasts the current last-known state from shared memory."""
        with self.market_data_lock:
            # Reconstruct price map from shared storage
            price_map = {s: data['price'] for s, data in self.shared_market_data.items()}
            if price_map:
                self.emit('price_update', price_map)
            self.emit('max_leverages', self.max_leverages)

    def _start_symbol_thread(self, idx, symbol):
        key = (idx, symbol)
        if key not in self.symbol_threads:
            t = threading.Thread(target=self._symbol_logic_worker, args=(idx, symbol), daemon=True)
            self.symbol_threads[key] = t
            t.start()
            self.log("started_thread", account_name=self.accounts[idx]['info'].get('name'), is_key=True, symbol=symbol)

    def _symbol_logic_worker(self, idx, symbol):
        """Dedicated worker for each symbol's grid and trailing logic."""
        self._setup_strategy_for_account(idx, symbol)
        
        while self.is_running and not self.stop_event.is_set():
            try:
                # Check if this symbol still in config (for live removal)
                if symbol not in self.config.get('symbols', []):
                    self.log("stopping_thread", is_key=True, symbol=symbol)
                    break
                    
                self._trailing_tp_logic(idx, symbol)
                time.sleep(1)
            except Exception as e:
                logging.error(f"Symbol logic worker error ({symbol}): {e}")
                time.sleep(5)

    def _trailing_tp_logic(self, idx, symbol):
        symbol_strategies = self.config.get('symbol_strategies', {})
        strategy = symbol_strategies.get(symbol, {})
        if not strategy.get('trailing_enabled'): return
        
        deviation_pct = float(strategy.get('trailing_deviation', 0.5))
        # Enforce a minimum deviation to avoid accidental immediate triggers
        if deviation_pct < 0.01:
            return
        
        direction = strategy.get('direction', 'LONG')
        
        with self.data_lock:
            state = self.grid_state.get((idx, symbol))
            if not state or not state.get('initial_filled'): return
            
            # Get current price from shared data
            with self.market_data_lock:
                current_price = self.shared_market_data.get(symbol, {}).get('price', 0)
            
            if current_price == 0: return

            # Initialize peak price if not present — skip trigger on this tick
            peak_key = (idx, symbol)
            if peak_key not in self.trailing_state:
                self.trailing_state[peak_key] = {'peak': current_price, 'just_initialized': True}
                return  # Don't trigger on the initialization tick
            
            # Clear the just_initialized flag on the next tick
            if self.trailing_state[peak_key].get('just_initialized'):
                self.trailing_state[peak_key]['just_initialized'] = False

            peak = self.trailing_state[peak_key]['peak']

            # Update peak price
            if direction == 'LONG':
                if current_price > peak:
                    self.trailing_state[peak_key]['peak'] = current_price
                else:
                    # Check for trailing retrace
                    retrace = (peak - current_price) / peak * 100
                    if retrace >= deviation_pct:
                        self.log("trailing_triggered", account_name=self.accounts[idx]['info'].get('name'), is_key=True, symbol=symbol, retrace=f"{retrace:.2f}", peak=peak)
                        self.close_position(self.accounts[idx]['info'].get('name'), symbol)
                        state['initial_filled'] = False
                        del self.trailing_state[peak_key]
            else: # SHORT
                if current_price < peak:
                    self.trailing_state[peak_key]['peak'] = current_price
                else:
                    # Check for trailing retrace (price up is bad for short)
                    retrace = (current_price - peak) / peak * 100
                    if retrace >= deviation_pct:
                        self.log("trailing_triggered", account_name=self.accounts[idx]['info'].get('name'), is_key=True, symbol=symbol, retrace=f"{retrace:.2f}", peak=peak)
                        self.close_position(self.accounts[idx]['info'].get('name'), symbol)
                        state['initial_filled'] = False
                        del self.trailing_state[peak_key]

    def get_status(self):
        return {
            'running': self.is_running,
            'accounts_count': len(self.accounts),
            'total_balance': sum(self.account_balances.values())
        }
