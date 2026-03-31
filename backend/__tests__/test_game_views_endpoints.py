# test_game_views_endpoints.py - includes 9 unit tests for the game views endpoints
# Unit tests are run with Django’s built-in test framework (unittest-based), via manage.py test
#  Uses types (SimpleNamespace) and unittest.mock (MagicMock, patch) to mock the supabase client and execute results
# Run just this file once in backend: docker compose exec backend python manage.py test __tests__.test_game_views_endpoints
# RUN ALL TESTS (for backend): docker compose exec backend python manage.py test __tests__

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from django.test import Client, TestCase 

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

# Class for testing the game views endpoints
# Includes 9 tests for:
# 1) health endpoint (returns 200 and "ok")
# 2) join game endpoint (creates waiting game when none exists)
# 3) join game endpoint (reuses existing waiting game when one exists)
# 4) join game endpoint (starts active game when the threshold is reached)
# 5) send message endpoint (inserts and wraps the turn)
# 6) send message endpoint (returns 400 if required fields are missing)
# 7) send message endpoint (returns 405 if the method is not POST)
# 8) join game endpoint (returns 500 if supabase fails)
# 9) send message endpoint (returns 500 if supabase fails)
class GameViewsEndpointTests(TestCase):
    # Set up the client
    def setUp(self):
        self.client = Client()

    # Test that the health endpoint returns 200 and "ok"
    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    # Test that the join game endpoint creates a waiting game when none exists
    @patch("game.views.uuid.uuid4", return_value="player-1")
    @patch("game.views.supabase")
    def test_join_game_creates_waiting_game_when_none_exists(self, mock_supabase, _mock_uuid):
        games_query = mk_table([mk_res(data=[])])
        games_insert = mk_table([mk_res(data=[{"game_id": "game-new"}])])
        players_insert = mk_table([mk_res(data=[{"ok": True}])])
        players_count = mk_table([mk_res(data=[{"user_id": "player-1"}], count=1)])
        games_final = mk_table([mk_res(data={"status": "waiting"})])

        mock_supabase.table.side_effect = [
            games_query,
            games_insert,
            players_insert,
            players_count,
            games_final,
        ]

        response = self.client.get("/join/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["game_id"], "game-new")
        self.assertEqual(payload["your_id"], "player-1")
        self.assertEqual(payload["status"], "waiting")
        players_insert.insert.assert_called_once()

    # Test that the join game endpoint reuses an existing waiting game when one exists
    @patch("game.views.uuid.uuid4", return_value="player-2")
    @patch("game.views.supabase")
    def test_join_game_reuses_existing_waiting_game(self, mock_supabase, _mock_uuid):
        games_query = mk_table([mk_res(data=[{"game_id": "game-existing"}])])
        players_insert = mk_table([mk_res(data=[{"ok": True}])])
        players_count = mk_table([mk_res(data=[{"user_id": "player-2"}], count=2)])
        games_final = mk_table([mk_res(data={"status": "waiting"})])

        mock_supabase.table.side_effect = [
            games_query,
            players_insert,
            players_count,
            games_final,
        ]

        response = self.client.get("/join/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["game_id"], "game-existing")
        self.assertEqual(payload["status"], "waiting")

    # Test that the join game endpoint starts an active game when the threshold is reached
    @patch("game.views.random.choice", return_value="Apple")
    @patch("game.views.assign_random_imposter")
    @patch("game.views.assign_random_turn_order")
    @patch("game.views.uuid.uuid4", side_effect=["human-1", "ai-1"])
    @patch("game.views.supabase")
    def test_join_game_threshold_starts_active_game(
        self,
        mock_supabase,
        _mock_uuid,
        mock_assign_turns,
        mock_assign_imposter,
        _mock_choice,
    ):
        games_query = mk_table([mk_res(data=[{"game_id": "game-active"}])])
        players_insert_human = mk_table([mk_res(data=[{"ok": True}])])
        players_count = mk_table([mk_res(data=[{"user_id": "human-1"}], count=4)])
        games_lock = mk_table([mk_res(data=[{"game_id": "game-active"}])])
        players_insert_ai = mk_table([mk_res(data=[{"ok": True}])])
        games_activate = mk_table([mk_res(data=[{"status": "active"}])])
        first_player = mk_table([mk_res(data={"Human": True, "user_id": "human-1"})])
        games_final = mk_table([mk_res(data={"status": "active"})])

        mock_supabase.table.side_effect = [
            games_query,
            players_insert_human,
            players_count,
            games_lock,
            players_insert_ai,
            games_activate,
            first_player,
            games_final,
        ]

        response = self.client.get("/join/")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "active")
        games_activate.update.assert_called_once_with(
            {"status": "active", "current_turn": 0, "current_round": 1, "word": "Apple"}
        )
        mock_assign_turns.assert_called_once_with("game-active")
        mock_assign_imposter.assert_called_once_with("game-active")

    # Test that the send message endpoint inserts and wraps the turn
    @patch("game.views.supabase")
    def test_send_message_happy_path_inserts_and_wraps_turn(self, mock_supabase):
        messages_insert = mk_table([mk_res(data=[{"ok": True}])])
        games_select = mk_table([mk_res(data={"current_turn": 4, "current_round": 1})])
        next_player = mk_table([mk_res(data={"Human": True, "user_id": "human-2"})])
        games_update = mk_table([mk_res(data=[{"ok": True}])])

        mock_supabase.table.side_effect = [
            messages_insert,
            games_select,
            next_player,
            games_update,
        ]

        response = self.client.post(
            "/send_message",
            data=json.dumps({"game_id": "g1", "player_id": "p1", "content": "hello"}),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["next_turn"], 0)
        self.assertEqual(payload["current_round"], 2)
        messages_insert.insert.assert_called_once_with(
            {"game_id": "g1", "sender_id": "p1", "content": "hello"}
        )
        games_update.update.assert_called_once_with({"current_turn": 0, "current_round": 2})

    # Test that the send message endpoint returns 400 if required fields are missing
    @patch("game.views.supabase")
    def test_send_message_missing_required_fields_returns_400(self, mock_supabase):
        invalid_payloads = [
            {"player_id": "p1", "content": "hello"},
            {"game_id": "g1", "content": "hello"},
            {"game_id": "g1", "player_id": "p1"},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/send_message",
                    data=json.dumps(payload),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)

        mock_supabase.table.assert_not_called()

    # Test that the send message endpoint returns 405 if the method is not POST
    @patch("game.views.supabase")
    def test_send_message_non_post_returns_405(self, mock_supabase):
        response = self.client.get("/send_message")
        self.assertEqual(response.status_code, 405)
        mock_supabase.table.assert_not_called()

    # Test that the join game endpoint returns 500 if supabase fails
    @patch("game.views.supabase")
    def test_join_game_supabase_failure_returns_500(self, mock_supabase):
        broken_games_query = mk_table([Exception("supabase down")])
        mock_supabase.table.side_effect = [broken_games_query]

        response = self.client.get("/join/")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"error": "Failed to join game"})

    # Test that the send message endpoint returns 500 if supabase fails
    @patch("game.views.supabase")
    def test_send_message_supabase_failure_returns_500(self, mock_supabase):
        broken_messages_insert = mk_table([Exception("supabase down")])
        mock_supabase.table.side_effect = [broken_messages_insert]

        response = self.client.post(
            "/send_message",
            data=json.dumps({"game_id": "g1", "player_id": "p1", "content": "hello"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"error": "Failed to send message"})
