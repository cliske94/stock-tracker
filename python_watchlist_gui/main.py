import json
import threading
import queue
import time
import websocket
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from tkinter import font as tkfont
import requests
import os


def _python_heartbeat_loop():
    hb_url = os.environ.get('BACKEND_HEARTBEAT_URL', API_BASE + '/heartbeat')
    interval = int(os.environ.get('HEARTBEAT_INTERVAL', '30'))
    ts_file = '/tmp/python_heartbeat'
    while True:
        ts = int(time.time() * 1000)
        try:
            requests.post(hb_url, json={'app': 'python_watchlist_gui', 'ts': ts}, timeout=5)
        except Exception:
            pass
        # optional: report to dashboard ingestion endpoint
        try:
            dash = os.environ.get('DASHBOARD_URL')
            if dash:
                metric = {'service': 'python_watchlist_gui', 'uptime': int(ts/1000), 'requests': 0}
                try:
                    requests.post(dash.rstrip('/') + '/ingest', json=metric, timeout=3)
                except Exception:
                    pass
        except Exception:
            pass
        try:
            with open(ts_file, 'w') as f:
                f.write(str(ts))
        except Exception:
            pass
        time.sleep(interval)

API_BASE = os.environ.get('BACKEND_URL', 'http://localhost:8080')
# Derive websocket URL from API_BASE unless explicitly provided.
if API_BASE.startswith('https'):
    _ws_proto = 'wss'
else:
    _ws_proto = 'ws'
try:
    _host_part = API_BASE.split('://', 1)[1]
except Exception:
    _host_part = API_BASE
WS_URL = os.environ.get('BACKEND_WS', f"{_ws_proto}://{_host_part}/ws-plain")

q = queue.Queue()


def on_message(ws, message):
    try:
        data = json.loads(message)
    except Exception:
        return
    q.put(data)


def on_error(ws, error):
    print("WebSocket error:", error)


def on_close(ws, close_status_code, close_msg):
    print("WebSocket closed")


def on_open(ws):
    pass


class WatchlistGUI:
    def __init__(self, root):
        self.root = root
        root.title("Watchlist")
        # Modern ttk theme and fonts
        try:
            style = ttk.Style()
            # prefer 'clam' for consistent look across platforms
            style.theme_use('clam')
            default_font = tkfont.nametofont('TkDefaultFont')
            default_font.configure(size=10)
            heading_font = tkfont.Font(family=default_font.actual('family'), size=10, weight='bold')
            style.configure('Treeview.Heading', font=heading_font)
            # visual tweaks for modern look
            style.configure('Treeview', rowheight=26)
            style.configure('Action.TButton', padding=6)
            style.map('Action.TButton', foreground=[('active', '!disabled', 'white')])
        except Exception:
            pass

        # Allow the main window to be resized by the user
        try:
            root.resizable(True, True)
        except Exception:
            pass

        # Top frame: controls (use grid for better fitting)
        ctrl = ttk.Frame(root, padding=(8, 8, 8, 4))
        ctrl.grid(row=0, column=0, sticky='ew')
        root.grid_columnconfigure(0, weight=1)

        # Left: auth controls
        auth_frame = ttk.Frame(ctrl)
        auth_frame.grid(row=0, column=0, sticky='w')
        ttk.Label(auth_frame, text="User:").grid(row=0, column=0, sticky='w')
        self.user_var = tk.StringVar()
        ttk.Entry(auth_frame, textvariable=self.user_var, width=12).grid(row=0, column=1, padx=4)
        ttk.Label(auth_frame, text="Pass:").grid(row=0, column=2, sticky='w', padx=(8, 0))
        self.pass_var = tk.StringVar()
        self.pass_entry = ttk.Entry(auth_frame, textvariable=self.pass_var, width=12, show='*')
        self.pass_entry.grid(row=0, column=3, padx=4)
        # allow Enter in password field to submit login
        try:
            self.pass_entry.bind('<Return>', lambda e: self.login())
        except Exception:
            pass
        # auth buttons
        self.login_btn = ttk.Button(auth_frame, text="Login", command=self.login, style='Action.TButton')
        self.login_btn.grid(row=0, column=4, padx=(8, 2))
        self.register_btn = ttk.Button(auth_frame, text="Register", command=self.register, style='Action.TButton')
        self.register_btn.grid(row=0, column=5, padx=2)
        self.logout_btn = ttk.Button(auth_frame, text="Logout", command=self.logout, style='Action.TButton')
        self.logout_btn.grid(row=0, column=6, padx=(6,0))
        # start hidden
        self.logout_btn.grid_remove()

        # Right (stacked below auth): token and ticker controls
        op_frame = ttk.Frame(ctrl)
        op_frame.grid(row=1, column=0, sticky='ew', pady=(6,0))
        ctrl.grid_columnconfigure(0, weight=1)
        op_frame.grid_columnconfigure(1, weight=1)
        ttk.Label(op_frame, text="Auth token:").grid(row=0, column=0, sticky='e')
        self.token_var = tk.StringVar()
        # hide token characters in header
        ttk.Entry(op_frame, textvariable=self.token_var, width=36, show='*').grid(row=0, column=1, padx=6, sticky='ew')
        ttk.Label(op_frame, text="Ticker:").grid(row=0, column=2, sticky='e')
        self.ticker_var = tk.StringVar()
        ttk.Entry(op_frame, textvariable=self.ticker_var, width=8).grid(row=0, column=3, padx=6)
        ttk.Button(op_frame, text="Add", command=self.add_ticker, style='Action.TButton').grid(row=0, column=4)
        ttk.Button(op_frame, text="Remove", command=self.remove_selected, style='Action.TButton').grid(row=0, column=5, padx=(6,0))
        ttk.Button(op_frame, text="Refresh", command=lambda: threading.Thread(target=self.fetch_watchlist_background, daemon=True).start(), style='Action.TButton').grid(row=0, column=6, padx=(8,0))

        # Tree with columns: id, ticker, price, updated, raw, action
        cols = ("id", "ticker", "price", "updated", "raw", "action")
        tree_frame = ttk.Frame(root, padding=(8,4,8,8))
        tree_frame.grid(row=1, column=0, sticky='nsew')
        root.grid_rowconfigure(1, weight=1)

        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings", selectmode='browse')
        self.tree.heading("id", text="ID")
        self.tree.heading("ticker", text="Ticker")
        self.tree.heading("price", text="Price")
        self.tree.heading("updated", text="Updated")
        self.tree.heading("raw", text="Raw JSON")
        # Set sensible column widths and allow the raw JSON column to stretch
        self.tree.column("id", width=60, stretch=False, anchor='w')
        self.tree.column("ticker", width=100, stretch=False, anchor='w')
        self.tree.column("price", width=90, stretch=False, anchor='e')
        self.tree.column("updated", width=120, stretch=False, anchor='center')
        self.tree.column("raw", width=300, stretch=True, anchor='w')
        self.tree.heading("action", text="Remove")
        self.tree.column("action", width=80, anchor='center', stretch=False)

        # add vertical scrollbar
        vsb = ttk.Scrollbar(tree_frame, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        # horizontal scrollbar
        hsb = ttk.Scrollbar(tree_frame, orient='horizontal', command=self.tree.xview)
        self.tree.configure(xscrollcommand=hsb.set)
        self.tree.grid(row=0, column=0, sticky='nsew')
        vsb.grid(row=0, column=1, sticky='ns')
        hsb.grid(row=1, column=0, sticky='ew')
        # keep layout responsive
        tree_frame.grid_columnconfigure(0, weight=1)
        tree_frame.grid_rowconfigure(0, weight=1)

        # alternating row colors for readability
        try:
            self.tree.tag_configure('even', background='#ffffff')
            self.tree.tag_configure('odd', background='#f6f7fb')
        except Exception:
            pass

        self.items = {}  # map ticker -> item id
        self.items_meta = {}  # map ticker -> (item id, entry_id)

        # bind click to handle inline action column
        self.tree.bind("<Button-1>", self.on_tree_click)
        # double-click to view wrapped details
        self.tree.bind("<Double-1>", self.on_tree_double_click)

        root.after(200, self.poll_queue)
        # load token if present and update UI
        try:
            with open('token.txt', 'r') as f:
                tok = f.read().strip()
                if tok:
                    # load token silently and allow population from backend
                    self.token_var.set(tok)
                    try:
                        # allow population immediately when a token is present
                        self.allow_populate = True
                        threading.Thread(target=self.fetch_watchlist_background, daemon=True).start()
                    except Exception:
                        pass
        except Exception:
            pass
        # track whether login occurred via UI interaction
        self.user_initiated_login = False
        self.update_auth_ui()

        # status bar
        self.status_var = tk.StringVar(value='Disconnected')
        self.heartbeat_var = tk.StringVar(value='last hb: -')
        status_frame = ttk.Frame(root)
        status_frame.grid(row=2, column=0, sticky='ew')
        ttk.Label(status_frame, textvariable=self.status_var).pack(side='left', padx=6, pady=4)
        ttk.Label(status_frame, textvariable=self.heartbeat_var).pack(side='right', padx=6, pady=4)
        # kick off an initial watchlist fetch in background so the UI can populate
        try:
            threading.Thread(target=self.fetch_watchlist_background, daemon=True).start()
        except Exception:
            pass
        # population flag (fetch_watchlist_background will set allow_populate=True when successful)
        self.allow_populate = False

    def on_app_close(self):
        # silent logout on application exit (no confirm)
        token = self.token_var.get().strip()
        if token:
            try:
                headers = { 'Authorization': f'Bearer {token}' }
                requests.post(f"{API_BASE}/auth/logout", headers=headers, timeout=3)
            except Exception:
                pass
        try:
            if os.path.exists('token.txt'):
                os.remove('token.txt')
        except Exception:
            pass
        try:
            self.root.destroy()
        except Exception:
            pass

    def update_auth_ui(self):
        # if token present, show logout and hide login/register
        if self.user_initiated_login:
            try:
                self.login_btn.grid_remove()
                self.register_btn.grid_remove()
            except Exception:
                pass
            try:
                self.logout_btn.grid()
            except Exception:
                pass
        else:
            try:
                self.logout_btn.grid_remove()
            except Exception:
                pass
            # ensure login/register are visible
            try:
                self.login_btn.grid()
                self.register_btn.grid()
            except Exception:
                pass

    def add_ticker(self):
        ticker = self.ticker_var.get().strip()
        if not ticker:
            return
        # prevent duplicates (case-insensitive) against current UI list
        tu = ticker.upper()
        try:
            for k in list(self.items.keys()):
                if k and k.upper() == tu:
                    try:
                        self.status_var.set(f'Already watching {tu}')
                    except Exception:
                        pass
                    return
        except Exception:
            pass
        headers = {}
        token = self.token_var.get().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            r = requests.post(f"{API_BASE}/watchlist", params={"ticker": ticker}, headers=headers, timeout=5)
            if r.status_code == 200:
                print("Added", ticker)
                # refresh watchlist entries from server to ensure UI reflects server state
                try:
                    threading.Thread(target=self.fetch_watchlist_background, daemon=True).start()
                except Exception:
                    pass
            else:
                print("Add failed:", r.status_code, r.text)
        except Exception as e:
            print("Add request error:", e)

    def remove_selected(self):
        sel = self.tree.selection()
        if not sel:
            return
        # Use first selected
        iid = sel[0]
        values = self.tree.item(iid, "values")
        entry_id = values[0]
        ticker = values[1]
        headers = {}
        token = self.token_var.get().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            # Prefer removal by id using POST /watchlist/remove to avoid DELETE issues
            if entry_id:
                r = requests.post(f"{API_BASE}/watchlist/remove", params={"id": entry_id}, headers=headers, timeout=5)
            else:
                r = requests.post(f"{API_BASE}/watchlist/remove", params={"ticker": ticker}, headers=headers, timeout=5)
            if r.status_code == 200:
                try:
                    self.tree.delete(iid)
                except Exception:
                    pass
                # remove from mapping
                if ticker in self.items:
                    del self.items[ticker]
            else:
                print("Remove failed:", r.status_code, r.text)
        except Exception as e:
            print("Remove request error:", e)

    def register(self):
        user = self.user_var.get().strip()
        pwd = self.pass_var.get().strip()
        if not user or not pwd:
            print("username and password required")
            return
        try:
            r = requests.post(f"{API_BASE}/auth/register", json={"username": user, "password": pwd}, timeout=5)
            if r.ok:
                token = r.json().get("token")
                if token:
                    self.set_token(token, via_ui=True)
                    self.update_auth_ui()
                    print("Registered and logged in")
                else:
                    print("Register succeeded but no token returned")
            else:
                print("Register failed:", r.status_code, r.text)
        except Exception as e:
            print("Register error:", e)

    def login(self):
        user = self.user_var.get().strip()
        pwd = self.pass_var.get().strip()
        if not user or not pwd:
            print("username and password required")
            return
        try:
            r = requests.post(f"{API_BASE}/auth/login", json={"username": user, "password": pwd}, timeout=5)
            if r.ok:
                token = r.json().get("token")
                if token:
                    self.set_token(token, via_ui=True)
                    self.update_auth_ui()
                    print("Logged in")
                else:
                    print("Login succeeded but no token returned")
            else:
                print("Login failed:", r.status_code, r.text)
        except Exception as e:
            print("Login error:", e)

    def set_token(self, token):
        # legacy single-arg kept for compatibility
        try:
            # allow calling set_token(token, via_ui=True)
            pass
        except Exception:
            pass
        self.token_var.set(token)
        return

    def set_token(self, token, via_ui=False):
        self.token_var.set(token)
        if via_ui:
            self.user_initiated_login = True
            # allow population when user logs in via UI
            try:
                self.allow_populate = True
                threading.Thread(target=self.fetch_watchlist_background, daemon=True).start()
            except Exception:
                pass
        try:
            with open('token.txt', 'w') as f:
                f.write(token)
        except Exception:
            pass

    def on_tree_double_click(self, event):
        # show a wrapped view of the raw JSON for the selected row
        row = self.tree.identify_row(event.y)
        if not row:
            return
        values = self.tree.item(row, 'values')
        if not values or len(values) < 5:
            return
        raw = values[4]
        try:
            win = tk.Toplevel(self.root)
            win.title('Details')
            win.geometry('600x400')
            txt = tk.Text(win, wrap='word')
            txt.insert('1.0', raw)
            txt.config(state='disabled')
            txt.pack(fill='both', expand=True)
            return
        except Exception:
            return
        try:
            with open('token.txt', 'w') as f:
                f.write(token)
        except Exception:
            pass

    def logout(self):
        # confirm logout
        if not messagebox.askyesno("Logout", "Are you sure you want to logout?"):
            return
        token = self.token_var.get().strip()
        if token:
            try:
                headers = {"Authorization": f"Bearer {token}"}
                requests.post(f"{API_BASE}/auth/logout", headers=headers, timeout=5)
            except Exception:
                pass
        # clear token and delete token file locally
        self.token_var.set('')
        # mark as not logged in via UI
        self.user_initiated_login = False
        try:
            import os
            if os.path.exists('token.txt'):
                os.remove('token.txt')
        except Exception:
            pass
        self.update_auth_ui()

    def poll_queue(self):
        # ignore websocket messages until population is allowed
        if not getattr(self, 'allow_populate', False):
            while not q.empty():
                try:
                    q.get()
                except Exception:
                    break
            self.root.after(200, self.poll_queue)
            return

        while not q.empty():
            data = q.get()
            updates = data if isinstance(data, list) else [data]
            for u in updates:
                ticker = u.get("ticker")
                price = u.get("price")
                ts = u.get("timestamp") or u.get("fetchedAt")
                tstr = time.strftime('%H:%M:%S', time.localtime(ts/1000)) if ts else ''
                entry_id = u.get("id") or ''
                raw = json.dumps(u)
                if ticker in self.items:
                    iid = self.items[ticker]
                    self.tree.item(iid, values=(entry_id, ticker, price, tstr, raw, "Remove"))
                    self.items_meta[ticker] = (iid, entry_id)
                else:
                    # alternate row tag
                    idx = len(self.tree.get_children())
                    tag = 'even' if (idx % 2 == 0) else 'odd'
                    iid = self.tree.insert('', tk.END, values=(entry_id, ticker, price, tstr, raw, "Remove"), tags=(tag,))
                    self.items[ticker] = iid
                    self.items_meta[ticker] = (iid, entry_id)
                # update heartbeat status if present
                try:
                    if 'fetchedAt' in u or 'timestamp' in u:
                        ts = u.get('timestamp') or u.get('fetchedAt')
                        if ts:
                            tstr = time.strftime('%H:%M:%S', time.localtime(ts/1000))
                            self.heartbeat_var.set(f'last hb: {tstr}')
                            self.status_var.set('Connected')
                except Exception:
                    pass
        self.root.after(200, self.poll_queue)
    def remove_ticker_inline(self, ticker, entry_id):
        headers = {}
        token = self.token_var.get().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            # Prefer removal by id; fallback to POST /watchlist/remove
            if entry_id:
                r = requests.post(f"{API_BASE}/watchlist/remove", params={"id": entry_id}, headers=headers, timeout=5)
            else:
                r = requests.post(f"{API_BASE}/watchlist/remove", params={"ticker": ticker.upper() if ticker else ''}, headers=headers, timeout=5)
            if r.status_code == 200:
                # remove from tree and meta
                if ticker in self.items_meta:
                    iid, _ = self.items_meta.pop(ticker)
                    if ticker in self.items:
                        del self.items[ticker]
                    try:
                        self.tree.delete(iid)
                    except Exception:
                        pass
                # refresh from server in background in case server canonicalized items
                try:
                    threading.Thread(target=self.fetch_watchlist_background, daemon=True).start()
                except Exception:
                    pass
            else:
                print("Remove failed:", r.status_code, r.text)
        except Exception as e:
            print("Remove request error:", e)

    def on_tree_click(self, event):
        # identify column and row; if action column clicked, perform remove
        col = self.tree.identify_column(event.x)
        row = self.tree.identify_row(event.y)
        if not row:
            return
        # user clicked in tree; handle action column without noisy debug prints
        try:
            idx = int(col.replace('#','')) - 1
        except Exception:
            return
        # action column is last column
        action_index = len(self.tree['columns']) - 1
        if idx == action_index:
            values = self.tree.item(row, 'values')
            if not values:
                return
            entry_id = values[0] if len(values) > 0 else ''
            ticker = values[1] if len(values) > 1 else ''
            # call remove handler
            self.remove_ticker_inline(ticker, entry_id)

    def fetch_watchlist_background(self):
        try:
            headers = {}
            token = self.token_var.get().strip()
            if token:
                headers['Authorization'] = f'Bearer {token}'
            r = requests.get(f"{API_BASE}/watchlist", headers=headers or None, timeout=5)
            if r.ok:
                # allow population when we successfully fetch from backend
                try:
                    self.allow_populate = True
                except Exception:
                    pass
                data = r.json()
                # schedule GUI update on main thread
                try:
                    self.root.after(0, self._apply_watchlist, data)
                except Exception:
                    pass
            else:
                # show status message for user (do on main thread)
                try:
                    msg = f'watchlist fetch failed: {r.status_code}'
                    self.root.after(0, lambda: self.status_var.set(msg))
                except Exception:
                    pass
        except Exception:
            try:
                self.root.after(0, lambda: self.status_var.set('watchlist fetch error'))
            except Exception:
                pass

    def _apply_watchlist(self, data):
        try:
            # normalize various backend shapes to a list of entries
            entries = []
            if isinstance(data, list):
                entries = data
            elif isinstance(data, dict):
                # common HAL-style embedding used by the backend
                if '_embedded' in data and isinstance(data['_embedded'], dict):
                    # pick the first list found in _embedded
                    for v in data['_embedded'].values():
                        if isinstance(v, list):
                            entries = v
                            break
                elif 'items' in data and isinstance(data['items'], list):
                    entries = data['items']
                elif 'watchlist' in data and isinstance(data['watchlist'], list):
                    entries = data['watchlist']
                else:
                    # fall back to attempting to find any list value
                    for v in data.values():
                        if isinstance(v, list):
                            entries = v
                            break

            if entries is None:
                entries = []

            # clear current tree
            for iid in list(self.tree.get_children()):
                try:
                    self.tree.delete(iid)
                except Exception:
                    pass
            self.items.clear()
            self.items_meta.clear()

            for u in entries:
                # normalize fields from backend
                ticker = (u.get('ticker') or u.get('Ticker') or u.get('symbol') or '').upper()
                price = u.get('price') or u.get('lastPrice')
                ts = u.get('timestamp') or u.get('fetchedAt') or u.get('addedAt')
                tstr = time.strftime('%H:%M:%S', time.localtime(ts/1000)) if ts else ''
                entry_id = u.get('id') or u.get('entryId') or ''
                raw = json.dumps(u)
                iid = self.tree.insert('', tk.END, values=(entry_id, ticker, price, tstr, raw, "Remove"))
                # apply alternating row tag
                try:
                    idx = len(self.tree.get_children()) - 1
                    tag = 'even' if (idx % 2 == 0) else 'odd'
                    self.tree.item(iid, tags=(tag,))
                except Exception:
                    pass
                if ticker:
                    self.items[ticker] = iid
                self.items_meta[ticker] = (iid, entry_id)
        except Exception:
            pass


def start_ws():
    ws = websocket.WebSocketApp(WS_URL,
                                on_open=on_open,
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    ws.run_forever()


if __name__ == '__main__':
    # start websocket thread
    t = threading.Thread(target=start_ws, daemon=True)
    t.start()

    # start heartbeat thread for health checks and backend POSTs
    hb_t = threading.Thread(target=_python_heartbeat_loop, daemon=True)
    hb_t.start()

    root = tk.Tk()
    gui = WatchlistGUI(root)
    # open in a square window and prevent non-square resize
    size = 700
    root.geometry(f'{size}x{size}')
    try:
        root.resizable(False, False)
    except Exception:
        pass
    # ensure silent logout on close
    try:
        root.protocol('WM_DELETE_WINDOW', gui.on_app_close)
    except Exception:
        pass
    root.mainloop()
