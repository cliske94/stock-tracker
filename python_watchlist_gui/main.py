import json
import threading
import queue
import time
import websocket
import tkinter as tk
from tkinter import ttk
import requests

WS_URL = "ws://localhost:8080/ws-plain"
API_BASE = "http://localhost:8080"

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

        # Top frame: controls
        ctrl = ttk.Frame(root)
        ctrl.pack(fill=tk.X, padx=6, pady=6)

        # Login controls
        ttk.Label(ctrl, text="User:").pack(side=tk.LEFT)
        self.user_var = tk.StringVar()
        ttk.Entry(ctrl, textvariable=self.user_var, width=14).pack(side=tk.LEFT, padx=4)
        ttk.Label(ctrl, text="Pass:").pack(side=tk.LEFT)
        self.pass_var = tk.StringVar()
        ttk.Entry(ctrl, textvariable=self.pass_var, width=14, show='*').pack(side=tk.LEFT, padx=4)
        ttk.Button(ctrl, text="Login", command=self.login).pack(side=tk.LEFT, padx=4)
        ttk.Button(ctrl, text="Register", command=self.register).pack(side=tk.LEFT, padx=4)

        ttk.Label(ctrl, text="Auth token:").pack(side=tk.LEFT, padx=8)
        self.token_var = tk.StringVar()
        ttk.Entry(ctrl, textvariable=self.token_var, width=40).pack(side=tk.LEFT, padx=6)

        ttk.Label(ctrl, text="Ticker:").pack(side=tk.LEFT)
        self.ticker_var = tk.StringVar()
        ttk.Entry(ctrl, textvariable=self.ticker_var, width=12).pack(side=tk.LEFT, padx=6)
        ttk.Button(ctrl, text="Add", command=self.add_ticker).pack(side=tk.LEFT)
        ttk.Button(ctrl, text="Remove", command=self.remove_selected).pack(side=tk.LEFT, padx=6)

        # Tree with columns: id, ticker, price, updated, raw, action
        cols = ("id", "ticker", "price", "updated", "raw", "action")
        self.tree = ttk.Treeview(root, columns=cols, show="headings")
        self.tree.heading("id", text="ID")
        self.tree.heading("ticker", text="Ticker")
        self.tree.heading("price", text="Price")
        self.tree.heading("updated", text="Updated")
        self.tree.heading("raw", text="Raw JSON")
        self.tree.column("raw", width=300)
        self.tree.heading("action", text="Remove")
        self.tree.column("action", width=80, anchor='center')
        self.tree.pack(fill=tk.BOTH, expand=True)

        self.items = {}  # map ticker -> item id
        self.items_meta = {}  # map ticker -> (item id, entry_id)

        # bind click to handle inline action column
        self.tree.bind("<Button-1>", self.on_tree_click)

        root.after(200, self.poll_queue)

    def add_ticker(self):
        ticker = self.ticker_var.get().strip()
        if not ticker:
            return
        headers = {}
        token = self.token_var.get().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            r = requests.post(f"{API_BASE}/watchlist", params={"ticker": ticker}, headers=headers, timeout=5)
            if r.status_code == 200:
                print("Added", ticker)
                # optionally refresh watchlist entries from server
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
                    self.set_token(token)
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
                    self.set_token(token)
                    print("Logged in")
                else:
                    print("Login succeeded but no token returned")
            else:
                print("Login failed:", r.status_code, r.text)
        except Exception as e:
            print("Login error:", e)

    def set_token(self, token):
        self.token_var.set(token)
        try:
            with open('token.txt', 'w') as f:
                f.write(token)
        except Exception:
            pass

    def poll_queue(self):
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
                    iid = self.tree.insert('', tk.END, values=(entry_id, ticker, price, tstr, raw, "Remove"))
                    self.items[ticker] = iid
                    self.items_meta[ticker] = (iid, entry_id)
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

    root = tk.Tk()
    gui = WatchlistGUI(root)
    root.geometry('900x400')
    root.mainloop()
