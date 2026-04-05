import random
import uuid
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
    game_started = False
    
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

    player_count_res = supabase.table("players") \
        .select("user_id", count="exact") \
        .eq("game_id", game_id) \
        .execute()

    player_count = player_count_res.count

    if player_count >= 4:
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

        # Check if first player is AI and trigger it
        first_player = supabase.table("players") \
            .select("Human, user_id") \
            .eq("game_id", game_id) \
            .eq("turn_order", 0) \
            .single() \
            .execute()

        if not first_player.data["Human"]:
            post_ai_response(game_id, first_player.data["user_id"])

            supabase.table("games").update({
                "current_turn": 1,
            }).eq("game_id", game_id).execute()

        game_started = True

    current_status = "active" if game_started else "waiting"

    return JsonResponse({
        "game_id": game_id, 
        "your_id": player_id,
        "player_number": player_count,
        "status": current_status,
    })


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

        # get round
        game_res = supabase.table("games") \
            .select("current_turn, current_round") \
            .eq("game_id", game_id) \
            .single() \
            .execute()

        current_turn = game_res.data['current_turn']
        current_round = game_res.data.get('current_round', 1)

        next_turn = (current_turn + 1) % 5

        # increase round when turn resets
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
            post_ai_response(game_id, next_player.data["user_id"])
            next_turn = (next_turn + 1) % 5

            # increase round when turn resets
            if next_turn == 0:
                current_round += 1

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
    # 1. Get all messages for this game
    messages_res = supabase.table("messages") \
        .select("content") \
        .eq("game_id", game_id) \
        .execute()

    messages = messages_res.data or []

    # Build comma-separated conversation history
    conversation_history = ", ".join(
        msg["content"] for msg in messages if msg.get("content")
    )

    # 2. Check if this AI is an imposter
    player_res = supabase.table("players") \
        .select("Imposter") \
        .eq("user_id", ai_id) \
        .single() \
        .execute()

    is_imposter = player_res.data["Imposter"]

    shared_word = ''

    if not is_imposter:
        # 3. Get the shared word from the game
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