Python Watchlist GUI

This small Tkinter GUI connects to the backend plain websocket endpoint and shows dynamic price updates for watchlist tickers.

Requirements

- Python 3.8+
- Install dependencies: `pip install -r requirements.txt`

Run

```bash
python main.py
```

Notes

- The GUI connects to `ws://localhost:8080/ws-plain` by default — ensure the Spring app is running locally on port 8080.
