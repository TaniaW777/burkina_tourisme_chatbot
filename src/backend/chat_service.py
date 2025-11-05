from transformers import pipeline


class ChatService:
    def __init__(self):
        self.context = """Je suis un assistant touristique spécialisé sur le Burkina Faso. 
        Je peux vous aider à découvrir les sites touristiques, la culture, la cuisine et les traditions du pays."""

        self.conversation_history = []
        self.model = pipeline('text-generation', model='gpt2')

    async def get_response(self, user_message: str) -> str:
        # Ajouter le message au contexte
        full_context = f"{self.context}\nHistorique:\n"
        # Garder les 3 derniers messages
        for msg in self.conversation_history[-3:]:
            full_context += f"{msg}\n"

        full_context += f"User: {user_message}\nAssistant:"

        # Générer la réponse
        response = self.model(full_context, max_length=150, num_return_sequences=1)[
            0]['generated_text']

        # Extraire la réponse générée
        assistant_response = response.split("Assistant:")[-1].strip()

        # Mettre à jour l'historique
        self.conversation_history.append(f"User: {user_message}")
        self.conversation_history.append(f"Assistant: {assistant_response}")

        return assistant_response
