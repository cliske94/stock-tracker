import json
import queue
from unittest import mock

import pytest
import tkinter as tk

from python_watchlist_gui import main as gui_module


@pytest.fixture
def tk_root():
    root = tk.Tk()
    root.withdraw()
    yield root
    try:
        root.destroy()
    except Exception:
        pass


def test_add_ticker_calls_post(tk_root, tmp_path):
    g = gui_module.WatchlistGUI(tk_root)
    g.ticker_var.set('can')
    g.token_var.set('secrettoken')

    with mock.patch('python_watchlist_gui.main.requests.post') as mock_post:
        mock_resp = mock.Mock()
        mock_resp.status_code = 200
        mock_resp.text = 'ok'
        mock_post.return_value = mock_resp

        g.add_ticker()

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0].endswith('/watchlist')
        assert kwargs['params'] == {'ticker': 'can'}
        assert kwargs['headers']['Authorization'] == 'Bearer secrettoken'


def test_remove_selected_by_id_calls_post_and_removes_row(tk_root):
    g = gui_module.WatchlistGUI(tk_root)
    # insert a fake row with id and ticker
    iid = g.tree.insert('', 'end', values=('42', 'CAN', '1.23', '', '{}', 'Remove'))
    g.items['CAN'] = iid
    g.items_meta['CAN'] = (iid, '42')
    g.tree.selection_set(iid)
    g.token_var.set('t')

    with mock.patch('python_watchlist_gui.main.requests.post') as mock_post:
        mock_resp = mock.Mock()
        mock_resp.status_code = 200
        mock_resp.text = 'ok'
        mock_post.return_value = mock_resp

        g.remove_selected()

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0].endswith('/watchlist/remove')
        assert kwargs['params'] == {'id': '42'}
        # ensure row removed from tree
        assert iid not in g.tree.get_children()


def test_remove_ticker_inline_falls_back_to_ticker(tk_root):
    g = gui_module.WatchlistGUI(tk_root)
    g.token_var.set('tok')

    with mock.patch('python_watchlist_gui.main.requests.post') as mock_post:
        mock_resp = mock.Mock()
        mock_resp.status_code = 200
        mock_resp.text = 'ok'
        mock_post.return_value = mock_resp

        # no id provided, should call with ticker param uppercased
        g.remove_ticker_inline('can', '')

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs['params'] == {'ticker': 'CAN'}


def test_poll_queue_updates_tree(tk_root):
    g = gui_module.WatchlistGUI(tk_root)
    # push a price update into the shared queue used by the module
    gui_module.q.put({'id': '99', 'ticker': 'XYZ', 'price': 9.99, 'timestamp': 1000})

    # call poll_queue once directly
    g.poll_queue()

    # ensure the tree now contains the ticker
    assert 'XYZ' in g.items
    iid = g.items['XYZ']
    vals = g.tree.item(iid, 'values')
    assert vals[1] == 'XYZ'
