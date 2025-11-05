import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function Chat() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        try {
            setIsLoading(true);
            const userMessage = inputMessage;
            setInputMessage('');

            // Ajouter le message de l'utilisateur
            setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);

            // Appeler l'API
            const response = await axios.post('http://localhost:8000/api/chat', {
                message: userMessage
            });

            // Ajouter la réponse de l'assistant
            setMessages(prev => [...prev, {
                text: response.data.message,
                sender: 'assistant'
            }]);

        } catch (error) {
            console.error('Erreur:', error);
            setMessages(prev => [...prev, {
                text: "Désolé, une erreur est survenue. Veuillez réessayer.",
                sender: 'error'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-list">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}`}>
                        {msg.text}
                        {msg.sender === 'assistant' && (
                            <div className="message-info">Assistant Touristique</div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="message assistant loading">
                        L'assistant est en train d'écrire...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-container">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Posez votre question sur le tourisme au Burkina Faso..."
                    disabled={isLoading}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                >
                    Envoyer
                </button>
            </div>
        </div>
    );
}

export default Chat;
