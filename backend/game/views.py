import random
import uuid
from django.http import JsonResponse
from .supabase_client import supabase
from django.views.decorators.csrf import csrf_exempt
import json


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

    if player_count >= 5:

        assign_random_turn_order(game_id)
        assign_random_imposter(game_id)

        supabase.table("games").update({
            "status": "active",
            "current_turn": 0,
            "current_round": 1
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