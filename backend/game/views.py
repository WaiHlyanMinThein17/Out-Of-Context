import uuid
from django.http import JsonResponse
from .supabase_client import supabase

# Keep health for Docker/System checks
def health(request):
    return JsonResponse({"status": "ok"})

def join_game(request):
    # 1. Look for a game that is still "waiting"
    game_query = supabase.table("games").select("*").eq("status", "waiting").limit(1).execute()
    
    if not game_query.data:
        # No games exist? Create a brand new one.
        game_res = supabase.table("games").insert({"status": "waiting"}).execute()
        game_id = game_res.data[0]['game_id']
    else:
        # A game exists! Let's check how many players are in it.
        game_id = game_query.data[0]['game_id']
        player_count = supabase.table("players").select("user_id", count="exact").eq("game_id", game_id).execute()
        
        # If there is already 1 person, this new person makes 2 (the game is now full).
        if player_count.count >= 4:
            supabase.table("games").update({"status": "active"}).eq("game_id", game_id).execute()
        
    # 2. Add the current user to this game
    player_id = str(uuid.uuid4())
    supabase.table("players").insert({
        "user_id": player_id,
        "game_id": game_id,
    }).execute()

    return JsonResponse({
        "game_id": game_id, 
        "your_id": player_id,
        "player_number": (player_count.count + 1) if game_query.data else 1,
        "status": supabase.table("games").select("status").eq("game_id", game_id).limit(1).execute().data[0]['status']
    })

def game_start():
    pass



#const channel = supabase
#  .channel('game-messages')
 # .on('postgres_changes', { 
  #    event: 'INSERT', 
  #    schema: 'public', 
  #    table: 'messages',
  #    filter: `game_id=eq.${game_id}` 
  #}, (payload) => {
  #  console.log('New message received!', payload.new)
  #  // Update the UI with the new message
  #})
  #.subscribe()
