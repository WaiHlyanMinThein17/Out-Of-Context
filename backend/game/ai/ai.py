import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel

class AIResponse(BaseModel):
    shared_word: str
    proxy_word: str

def get_ai_response(conversation_history: str, is_imposter: bool, shared_word: str = '') -> str:
    load_dotenv()

    client = OpenAI(
        api_key=os.getenv('AI_GATEWAY_API_KEY'),
        base_url='https://ai-gateway.vercel.sh/v1'
    )

    instructions = ''
    if is_imposter:
        with open('prompts/imposter', 'r') as f:
            instructions = f.read()
    else:
        with open('prompts/normal', 'r') as f:
            instructions = f.read()
            if not shared_word:
                raise ValueError("Shared word must be provided for non-imposter players.")
            instructions += f'Shared word: {shared_word}'

    response = client.responses.parse(
        model="gpt-4o",
        instructions=instructions,
        input=conversation_history,
        max_output_tokens=16,
        text_format=AIResponse,
    )

    output_dict = json.loads(response.output_text)
    return output_dict['proxy_word']