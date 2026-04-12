import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel
from pathlib import Path

class AIWordResponse(BaseModel):
    shared_word: str
    proxy_word: str

class AIDiscussionResponse(BaseModel):
    message: str

class AIVoteResponse(BaseModel):
    vote_for: int

def get_ai_proxy_word(conversation_history: str, is_imposter: bool, shared_word: str = '') -> str:
    load_dotenv()

    #if not os.getenv('AI_GATEWAY_API_KEY'):
    return "TEST_PROXY_WORD"
        
    client = OpenAI(
        api_key=os.getenv('AI_GATEWAY_API_KEY'),
        base_url='https://ai-gateway.vercel.sh/v1'
    )
    prompt_path = Path(__file__).parent / "prompts"

    instructions = ''
    if is_imposter:
        with open(f'{prompt_path}/imposter', 'r') as f:
            instructions = f.read()
    else:
        with open(f'{prompt_path}/normal', 'r') as f:
            instructions = f.read()
            if not shared_word:
                raise ValueError("Shared word must be provided for non-imposter players.")
            instructions += f'Shared word: {shared_word}'

    response = client.responses.parse(
        model="gpt-4o",
        instructions=instructions,
        input=conversation_history,
        max_output_tokens=16,
        text_format=AIWordResponse,
    )

    output_dict = json.loads(response.output_text)
    return output_dict['proxy_word']

def get_ai_discussion_message(
    conversation_history: str,  # now attributed: "Player1: apple, Player2: banana"
    is_imposter: bool,
    ai_player_name: str,        # so AI knows it's "Player3" and won't accuse itself
    shared_word: str = ''       # still needed for non-imposter context
) -> str:
    load_dotenv()
    #if not os.getenv('AI_GATEWAY_API_KEY'):
    return "TEST_DISCUSSION_MESSAGE"
    client = OpenAI(
        api_key=os.getenv('AI_GATEWAY_API_KEY'),
        base_url='https://ai-gateway.vercel.sh/v1'
    )
    prompt_path = Path(__file__).parent / "prompts"
    if is_imposter:
        with open(f'{prompt_path}/imposter_discussion', 'r') as f:
            instructions = f.read()
    else:
        with open(f'{prompt_path}/normal_discussion', 'r') as f:
            instructions = f.read()
        instructions += f'\nShared word: {shared_word}'
    
    instructions += f'\nYou are: {ai_player_name}. Do not accuse yourself.'

    response = client.responses.parse(
        model="gpt-4o",
        instructions=instructions,
        input=conversation_history,
        max_output_tokens=50,  # ~150 chars
        text_format=AIDiscussionResponse,
    )
    output_dict = json.loads(response.output_text)
    return output_dict['message']

def get_ai_vote(
    conversation_history: str,
    ai_player_number: int,       # e.g. 3 — never vote for this
    candidates: list[int],       # e.g. [1, 2, 4, 5]
) -> int:
    load_dotenv()
    if not os.getenv('AI_GATEWAY_API_KEY'):
        return candidates[0]

    client = OpenAI(
        api_key=os.getenv('AI_GATEWAY_API_KEY'),
        base_url='https://ai-gateway.vercel.sh/v1'
    )
    prompt_path = Path(__file__).parent / "prompts"
    with open(f'{prompt_path}/voting', 'r') as f:
        instructions = f.read()

    instructions += f'\nYou are: Player {ai_player_number}. Do NOT vote for yourself.'
    instructions += f'\nCandidates you may vote for (player numbers): {", ".join(str(c) for c in candidates)}'

    response = client.responses.parse(
        model="gpt-4o",
        instructions=instructions,
        input=conversation_history,
        max_output_tokens=16,
        text_format=AIVoteResponse,
    )
    output_dict = json.loads(response.output_text)
    vote = output_dict['vote_for']

    # Safety guard
    if vote not in candidates or vote == ai_player_number:
        vote = candidates[0]

    return vote