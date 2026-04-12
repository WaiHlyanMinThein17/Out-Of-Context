import random
import uuid
from django.http import JsonResponse
from .supabase_client import supabase
from django.views.decorators.csrf import csrf_exempt
from game.ai.ai import get_ai_proxy_word, get_ai_discussion_message
import json
from django.utils import timezone
from datetime import timedelta
import random

AI_DISCUSSION_MAX_MESSAGES = 4
AI_COOLDOWN_SECONDS = 5
AI_FOLLOWUP_WINDOW = (15, 35)  # AI doubles down between 15-35s after its last message

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

        game_res = supabase.table("games") \
            .select("current_turn, current_round, ai_last_message_at, ai_discussion_msg_count, ai_unanswered_count, ai_followup_due_at") \
            .eq("game_id", game_id) \
            .single() \
            .execute()

        current_turn  = game_res.data['current_turn']
        current_round = game_res.data.get('current_round', 1)
        prev_round    = current_round

        next_turn = (current_turn + 1) % 5
        if next_turn == 0:
            current_round += 1
            
        if current_round == 3 and prev_round == 2:
            supabase.table("games").update({
                "discussion_started_at": timezone.now().isoformat()
            }).eq("game_id", game_id).execute()
        # ── Discussion phase AI logic ──────────────────────────────────────────
        if current_round >= 3:
            ai_res = supabase.table("players") \
                .select("user_id") \
                .eq("game_id", game_id) \
                .eq("Human", False) \
                .single() \
                .execute()
            ai_id = ai_res.data["user_id"] if ai_res.data else None

            if ai_id:
                msg_count       = game_res.data.get("ai_discussion_msg_count") or 0
                unanswered      = game_res.data.get("ai_unanswered_count") or 0
                last_msg_at     = game_res.data.get("ai_last_message_at")
                followup_due_at = game_res.data.get("ai_followup_due_at")
                now             = timezone.now()

                just_entered_discussion = (prev_round == 2 and current_round == 3)

                cooldown_passed = (
                    last_msg_at is None or
                    (now - timezone.datetime.fromisoformat(last_msg_at)).total_seconds() >= AI_COOLDOWN_SECONDS
                )

                should_respond = False
                is_followup    = False

                if msg_count < AI_DISCUSSION_MAX_MESSAGES and cooldown_passed:
                    if just_entered_discussion:
                        # Random opener: 50/50
                        should_respond = random.random() < 0.5

                    else:
                        new_unanswered = unanswered + 1

                        # Check if a scheduled follow-up is due
                        if followup_due_at:
                            due = timezone.datetime.fromisoformat(followup_due_at)
                            if now >= due:
                                should_respond = True
                                is_followup    = True

                        # Otherwise: probability scales with batched human messages
                        # 1 msg: 25%, 2 msgs: 50%, 3+ msgs: 75%
                        if not should_respond:
                            prob = min(0.25 + (new_unanswered - 1) * 0.25, 0.75)
                            should_respond = random.random() < prob

                        unanswered = new_unanswered

                if should_respond:
                    post_ai_discussion(game_id, ai_id)
                    msg_count  += 1
                    unanswered  = 0

                    # Schedule a follow-up double-down at a random time within the window
                    followup_due_at = (
                        now + timedelta(seconds=random.randint(*AI_FOLLOWUP_WINDOW))
                    ).isoformat() if msg_count < AI_DISCUSSION_MAX_MESSAGES else None
                else:
                    unanswered = unanswered + 1 if not just_entered_discussion else 0

                supabase.table("games").update({
                    "ai_discussion_msg_count": msg_count,
                    "ai_unanswered_count":     unanswered,
                    "ai_last_message_at":      now.isoformat() if should_respond else last_msg_at,
                    "ai_followup_due_at":      followup_due_at if should_respond else game_res.data.get("ai_followup_due_at"),
                }).eq("game_id", game_id).execute()

        # ── Turn-based round logic (rounds 1-2 only) ──────────────────────────
        if current_round < 3:
            next_player = supabase.table("players") \
                .select("Human, user_id") \
                .eq("game_id", game_id) \
                .eq("turn_order", next_turn) \
                .single() \
                .execute()

            if not next_player.data["Human"]:
                post_ai_response(game_id, next_player.data["user_id"])
                next_turn = (next_turn + 1) % 5
                if next_turn == 0:
                    current_round += 1

        supabase.table("games").update({
            "current_turn":  next_turn,
            "current_round": current_round
        }).eq("game_id", game_id).execute()

        return JsonResponse({
            "status":        "success",
            "next_turn":     next_turn,
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

    content = get_ai_proxy_word(conversation_history, is_imposter, shared_word)

    supabase.table("messages").insert({
        "game_id": game_id,
        "sender_id": ai_id,
        "content": content
    }).execute()

def post_ai_discussion(game_id: str, ai_id: str):
    # 1. Get messages WITH sender info this time
    messages_res = supabase.table("messages") \
        .select("content, sender_id") \
        .eq("game_id", game_id) \
        .execute()
    messages = messages_res.data or []

    # 2. Get all players to resolve sender_id -> display name
    players_res = supabase.table("players") \
        .select("user_id, turn_order") \
        .eq("game_id", game_id) \
        .execute()
    player_map = {p["user_id"]: f"Player {p['turn_order'] + 1}" for p in (players_res.data or [])}

    # Build attributed conversation history
    conversation_history = ", ".join(
        f"{player_map.get(msg['sender_id'], msg['sender_id'])}: {msg['content']}"
        for msg in messages if msg.get("content")
    )

    # 3. Check imposter status + get AI's own display name
    player_res = supabase.table("players") \
        .select("Imposter, turn_order") \
        .eq("user_id", ai_id) \
        .single() \
        .execute()
    is_imposter = player_res.data["Imposter"]
    ai_player_name = f"Player {player_res.data['turn_order'] + 1}"

    shared_word = ''
    if not is_imposter:
        game_res = supabase.table("games") \
            .select("word") \
            .eq("game_id", game_id) \
            .single() \
            .execute()
        shared_word = game_res.data["word"]

    content = get_ai_discussion_message(
        conversation_history, is_imposter, ai_player_name, shared_word
    )
    supabase.table("messages").insert({
        "game_id": game_id,
        "sender_id": ai_id,
        "content": content
    }).execute()

@csrf_exempt
def end_discussion(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    data = json.loads(request.body)
    game_id = data.get("game_id")

    # Idempotency check — only transition once
    game_res = supabase.table("games") \
        .select("status") \
        .eq("game_id", game_id) \
        .single() \
        .execute()

    if game_res.data["status"] == "voting":
        return JsonResponse({"status": "already_voting"})

    now = timezone.now().isoformat()
    supabase.table("games").update({
        "status": "voting",
        "voting_started_at": now
    }).eq("game_id", game_id).execute()

    return JsonResponse({"status": "voting", "voting_started_at": now})