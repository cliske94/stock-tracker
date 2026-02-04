# C++ Stock UI

Simple console UI to search stock tickers and maintain a watchlist.

Requirements:
- C++17 compiler (g++)
- libcurl development headers

Build:
```bash
sudo apt-get install libcurl4-openssl-dev      # Debian/Ubuntu
cd cpp_stock_ui
make
```

Run:
```bash
./stock_ui
```

The app calls the Java backend at `http://localhost:8080`:
- Search: GET `/api/stocks/search?q=...`
- Fetch stock: GET `/api/stocks/{ticker}`

If your Java app uses different paths or port, set `JAVA_API_BASE` in the source or run the Java app accordingly.

Watchlist is persisted to `watchlist.txt` alongside the binary.
