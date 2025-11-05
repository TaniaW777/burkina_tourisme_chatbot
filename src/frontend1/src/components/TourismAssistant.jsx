import { useState, useRef, useEffect } from 'react';
import { Send, Menu, MapPin, Info, Globe, Download, Sun } from 'lucide-react';
import { chatApi } from '../services/api';

// Container Component
export default function TourismAssistantContainer() {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Bonjour ! Je suis votre assistant touristique pour le Burkina Faso. Comment puis-je vous aider aujourd'hui ?",
            isUser: false,
            timestamp: new Date().toLocaleTimeString(),
            isGreeting: true
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    // Tourism topics data
    const tourismTopics = [
        { "id": 1, "title": "Sites Touristiques", "icon": MapPin },
        { "id": 2, "title": "Culture et Traditions", "icon": Globe },
        { "id": 3, "title": "Conseils de Voyage", "icon": Info }
    ];

    // Handle connection status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-scroll to new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const generateBotResponse = (userMessage) => {
        const greetings = ["bonjour", "salut", "hello", "coucou"];
        const thanks = ["merci", "thank you"];
        const farewells = ["au revoir", "bye", "à plus"];

        const lowerMessage = userMessage.toLowerCase();

        if (greetings.some(g => lowerMessage.includes(g))) {
            return [
                "Bonjour ! Enchanté de faire votre connaissance.",
                "Je suis votre guide virtuel pour le tourisme au Burkina Faso.",
                "Posez-moi vos questions sur nos merveilleux sites touristiques, notre culture riche ou nos traditions fascinantes !"
            ];
        } else if (thanks.some(t => lowerMessage.includes(t))) {
            return [
                "Je vous en prie ! C'est un plaisir de vous aider.",
                "N'hésitez pas si vous avez d'autres questions sur le Burkina Faso."
            ];
        } else if (farewells.some(f => lowerMessage.includes(f))) {
            return [
                "Au revoir et bon voyage !",
                "N'oubliez pas de visiter les cascades de Banfora, un joyau de notre pays !"
            ];
        } else if (lowerMessage.includes("qui es-tu") || lowerMessage.includes("c'est quoi ton nom")) {
            return [
                "Je suis un assistant touristique dédié au Burkina Faso.",
                "Mon rôle est de vous faire découvrir les trésors de notre pays :",
                "- Sites naturels comme le Pic de Nahouri",
                "- Patrimoine culturel comme les ruines de Loropéni",
                "- Événements traditionnels comme le FESPACO"
            ];
        } else if (!lowerMessage.includes("burkina") && !lowerMessage.includes("tourisme") && !lowerMessage.includes("visiter")) {
            return [
                "Je suis spécialisé sur le tourisme au Burkina Faso.",
                "Je peux vous parler de :",
                "- Nos parcs nationaux et réserves",
                "- Notre artisanat traditionnel",
                "- Nos festivals culturels",
                "Quel aspect vous intéresse particulièrement ?"
            ];
        } else {
            // Default tourism-related response
            return [
                "Le Burkina Faso offre de merveilleuses opportunités touristiques !",
                `En ce qui concerne "${userMessage}", voici ce que je peux vous dire :`,
                "Notre pays regorge de sites magnifiques comme les mosquées en terre de Bobo-Dioulasso, classées au patrimoine mondial de l'UNESCO.",
                "Je peux vous fournir plus de détails si vous le souhaitez."
            ];
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue.trim();
        const newUserMessage = {
            id: Date.now(),
            text: userText,
            isUser: true,
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, newUserMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await chatApi.sendMessage(userText);
            const botMessage = {
                id: Date.now() + 1,
                text: response.message,
                isUser: false,
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: "Désolé, une erreur est survenue. Veuillez réessayer.",
                isUser: false,
                timestamp: new Date().toLocaleTimeString(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TourismAssistant
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            isOnline={isOnline}
            isLoading={isLoading}
            tourismTopics={tourismTopics}
            handleSendMessage={handleSendMessage}
            chatEndRef={chatEndRef}
        />
    );
}

// UI Component
function TourismAssistant({
    messages,
    inputValue,
    setInputValue,
    isMenuOpen,
    setIsMenuOpen,
    isOnline,
    tourismTopics,
    handleSendMessage,
    chatEndRef,
    isLoading
}) {
    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-green-700 text-white p-4 shadow-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Menu
                            className="h-6 w-6 cursor-pointer"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        />
                        <div className="flex items-center space-x-2">
                            <Sun className="h-5 w-5 text-yellow-300" />
                            <h1 className="text-xl font-bold">Assistant Touristique BF</h1>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <span className="text-sm">{isOnline ? "En ligne" : "Hors ligne"}</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {isMenuOpen && (
                    <aside className="w-64 bg-white shadow-lg overflow-y-auto md:w-72">
                        <div className="p-4 border-b">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="bg-green-100 p-2 rounded-full">
                                    <Sun className="h-6 w-6 text-green-700" />
                                </div>
                                <div>
                                    <h2 className="font-semibold">Guide Touristique BF</h2>
                                    <p className="text-xs text-gray-500">Assistant spécialisé</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <h2 className="text-lg font-semibold mb-4">Thèmes disponibles</h2>
                            <ul className="space-y-2">
                                {tourismTopics.map(topic => (
                                    <li key={topic.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                                        <topic.icon className="h-5 w-5 text-green-600" />
                                        <span>{topic.title}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 border-t">
                            <button className="flex items-center justify-center space-x-2 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">
                                <Download className="h-5 w-5" />
                                <span>Installer l'application</span>
                            </button>
                        </div>
                    </aside>
                )}

                {/* Chat Area */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map(message => (
                            <div
                                key={message.id}
                                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-xs md:max-w-md rounded-lg p-3 ${message.isUser ? 'bg-green-600 text-white' : 'bg-white border border-gray-200'}`}>
                                    {!message.isUser && !message.isGreeting && (
                                        <div className="flex items-center space-x-1 mb-1">
                                            <Sun className="h-4 w-4 text-yellow-500" />
                                            <span className="text-xs font-semibold text-green-700">Guide BF</span>
                                        </div>
                                    )}
                                    <p>{message.text}</p>
                                    <p className="text-xs mt-1 text-right opacity-70">{message.timestamp}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-white">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Parlez à votre assistant..."
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                disabled={isLoading || !inputValue.trim()}
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}