# test_game_helpers.py - includes 1 unit test for assign_random_turn_order behavior
#  Uses types (SimpleNamespace) and unittest.mock (MagicMock, patch)
# Run just this file once in backend: docker compose exec backend python manage.py test __tests__.test_game_helpers
# RUN ALL TESTS (for backend): docker compose exec backend python manage.py test __tests__

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from django.test import TestCase
from game.views import assign_random_turn_order

# Helper function to create a mock response
def mk_res(data=None, count=None):
    return SimpleNamespace(data=data, count=count)

# Helper function to create a mock table
def mk_table(execute_results):
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.single.return_value = table
    table.execute.side_effect = execute_results
    return table

# Class for testing the game helpers
# Goal is to have unique turn orders for each player that are non-negative
class GameHelperTests(TestCase):
    # Mock the shuffle function to return None (no shuffling)
    @patch("game.views.random.shuffle", side_effect=lambda players: None) 
    @patch("game.views.supabase") # Mock the supabase client

    # Test that the assign_random_turn_order function assigns unique non-negative orders
    def test_assign_random_turn_order_assigns_unique_non_negative_orders(
        self, mock_supabase, _mock_shuffle
    ):
        # Mock the players table query, update calls, and execute results
        players = [{"user_id": "u1"}, {"user_id": "u2"}, {"user_id": "u3"}]
        players_query = mk_table([mk_res(data=players)])
        update_1 = mk_table([mk_res(data=[{"ok": True}])])
        update_2 = mk_table([mk_res(data=[{"ok": True}])])
        update_3 = mk_table([mk_res(data=[{"ok": True}])])

        # Mock the supabase table calls to return the mock responses
        mock_supabase.table.side_effect = [players_query, update_1, update_2, update_3]

        assign_random_turn_order("game-1") # Call the function to assign the orders

        assigned_orders = [
            update_1.update.call_args[0][0]["turn_order"],
            update_2.update.call_args[0][0]["turn_order"],
            update_3.update.call_args[0][0]["turn_order"],
        ]

        # Check that the assigned orders are unique and non-negative 
        self.assertEqual(len(set(assigned_orders)), 3)
        self.assertTrue(all(order >= 0 for order in assigned_orders))
        self.assertNotIn(-1, assigned_orders)
