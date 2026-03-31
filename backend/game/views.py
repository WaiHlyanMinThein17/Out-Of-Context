import random
import uuid
import threading
from django.http import JsonResponse
from .supabase_client import supabase
from django.views.decorators.csrf import csrf_exempt
from game.ai.ai import get_ai_response
import json

WORDS = [
    "Apple",
    "Triathalon",
    "Castle",
    "Pizza",
    "Tiger",
    "Rocket",
    "Pyramid",
    "Laptop",
    "Volcano",
    "Jungle"
]


def health(request):
    return JsonResponse({"status": "ok"})


def join_game(request):

    # ── 1. Find or create a waiting game ──
    game_query = supabase.table("games").select("*").eq("status", "waiting").limit(1).execute()

    if not game_query.data:
        game_res = supabase.table("games").insert({"status": "waiting"}).execute()
        game_id = game_res.data[0]['game_id']
    else:
        game_id = game_query.data[0]['game_id']

    player_id = str(uuid.uuid4())

    supabase.table("players").insert({
        "user_id": player_id,
        "game_id": game_id,
        "Human": True,
        "Imposter": False,
        "turn_order": -1
    }).execute()

    # ── 2. Re-count AFTER our insert ──
    player_count_res = supabase.table("players") \
        .select("user_id", count="exact") \
        .eq("game_id", game_id) \
        .execute()

    player_count = player_count_res.count

    # ── 3. Atomic gate: only one request can flip 'waiting' → 'starting' ──
    if player_count >= 4:
        lock_res = supabase.table("games") \
            .update({"status": "starting"}) \
            .eq("game_id", game_id) \
            .eq("status", "waiting") \
            .execute()

        if lock_res.data:
            ai_id = str(uuid.uuid4())

            supabase.table("players").insert({
                "user_id": ai_id,
                "game_id": game_id,
                "Human": False,
                "Imposter": False,
                "turn_order": -1
            }).execute()

            assign_random_turn_order(game_id)
            assign_random_imposter(game_id)
            chosen_word = random.choice(WORDS)

            supabase.table("games").update({
                "status": "active",
                "current_turn": 0,
                "current_round": 1,
                "word": chosen_word
            }).eq("game_id", game_id).execute()

            # If turn 0 belongs to AI, fire it in background
            first_player = supabase.table("players") \
                .select("Human, user_id") \
                .eq("game_id", game_id) \
                .eq("turn_order", 0) \
                .single() \
                .execute()

            if not first_player.data["Human"]:
                t = threading.Thread(
                    target=_handle_ai_turn,
                    args=(game_id, first_player.data["user_id"]),
                    daemon=True
                )
                t.start()

    # ── 4. Return immediately ──
    final_game = supabase.table("games") \
        .select("status") \
        .eq("game_id", game_id) \
        .single() \
        .execute()

    current_status = final_game.data["status"] if final_game.data else "waiting"

    return JsonResponse({
        "game_id": game_id,
        "your_id": player_id,
        "player_count": player_count,
        "status": current_status,
    })


def _handle_ai_turn(game_id: str, ai_id: str):
    """
    Background thread: post AI message, then advance to the next turn.
    Also handles chained AI turns (e.g. two AI players in a row, though
    current game only has one AI).
    """
    try:
        post_ai_response(game_id, ai_id)
    except Exception as e:
        print(f"[AI] Error generating response for {ai_id}: {e}")

    # Advance turn after AI posts
    game_res = supabase.table("games") \
        .select("current_turn, current_round") \
        .eq("game_id", game_id) \
        .single() \
        .execute()

    if not game_res.data:
        return

    current_turn = game_res.data["current_turn"]
    current_round = game_res.data.get("current_round", 1)

    next_turn = (current_turn + 1) % 5
    if next_turn == 0:
        current_round += 1

    supabase.table("games").update({
        "current_turn": next_turn,
        "current_round": current_round
    }).eq("game_id", game_id).execute()

    # If the next player is also AI (future-proof), chain the call
    next_player = supabase.table("players") \
        .select("Human, user_id") \
        .eq("game_id", game_id) \
        .eq("turn_order", next_turn) \
        .single() \
        .execute()

    if next_player.data and not next_player.data["Human"] and current_round < 3:
        _handle_ai_turn(game_id, next_player.data["user_id"])


@csrf_exempt
def send_message(request):

    if request.method == "POST":

        data = json.loads(request.body)
        game_id = data.get("game_id")
        player_id = data.get("player_id")
        content = data.get("content")

        supabase.table("messages").insert({
            "game_id": game_id,
            "sender_id": player_id,
            "content": content
        }).execute()

        game_res = supabase.table("games") \
            .select("current_turn, current_round") \
            .eq("game_id", game_id) \
            .single() \
            .execute()

        current_turn = game_res.data['current_turn']
        current_round = game_res.data.get('current_round', 1)

        next_turn = (current_turn + 1) % 5
        if next_turn == 0:
            current_round += 1

        next_player = supabase.table("players") \
            .select("Human, user_id") \
            .eq("game_id", game_id) \
            .eq("turn_order", next_turn) \
            .single() \
            .execute()

        is_human = next_player.data["Human"]

        if not is_human and current_round < 3:
            # Update turn to AI's turn first so frontend shows it
            supabase.table("games").update({
                "current_turn": next_turn,
                "current_round": current_round
            }).eq("game_id", game_id).execute()

            # Fire AI response in background - _handle_ai_turn will
            # advance the turn again once the AI message is posted
            t = threading.Thread(
                target=_handle_ai_turn,
                args=(game_id, next_player.data["user_id"]),
                daemon=True
            )
            t.start()

            return JsonResponse({
                "status": "success",
                "next_turn": next_turn,
                "current_round": current_round
            })

        supabase.table("games").update({
            "current_turn": next_turn,
            "current_round": current_round
        }).eq("game_id", game_id).execute()

        return JsonResponse({
            "status": "success",
            "next_turn": next_turn,
            "current_round": current_round
        })


def assign_random_turn_order(game_id: str) -> None:

    players_res = supabase.table("players") \
        .select("user_id") \
        .eq("game_id", game_id) \
        .execute()

    players = players_res.data
    random.shuffle(players)

    for turn_order, player in enumerate(players):
        supabase.table("players") \
            .update({"turn_order": turn_order}) \
            .eq("user_id", player["user_id"]) \
            .eq("game_id", game_id) \
            .execute()


def assign_random_imposter(game_id: str) -> None:

    players_res = supabase.table("players") \
        .select("user_id") \
        .eq("game_id", game_id) \
        .execute()

    players = players_res.data
    imposter = random.choice(players)

    supabase.table("players") \
        .update({"Imposter": True}) \
        .eq("user_id", imposter["user_id"]) \
        .eq("game_id", game_id) \
        .execute()


def post_ai_response(game_id: str, ai_id: str):

    messages_res = supabase.table("messages") \
        .select("content") \
        .eq("game_id", game_id) \
        .execute()

    messages = messages_res.data or []

    conversation_history = ", ".join(
        msg["content"] for msg in messages if msg.get("content")
    )

    player_res = supabase.table("players") \
        .select("Imposter") \
        .eq("user_id", ai_id) \
        .single() \
        .execute()

    is_imposter = player_res.data["Imposter"]
    shared_word = ''

    if not is_imposter:
        game_res = supabase.table("games") \
            .select("word") \
            .eq("game_id", game_id) \
            .single() \
            .execute()
        shared_word = game_res.data["word"]

    content = get_ai_response(conversation_history, is_imposter, shared_word)

    supabase.table("messages").insert({
        "game_id": game_id,
        "sender_id": ai_id,
        "content": content
    }).execute()