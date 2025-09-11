// src/react/DBChat.tsx
import React, { useRef, useEffect, useState } from "react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  language?: string;
}

const LANGUAGES = {
  en: { name: '🇺🇸 English', placeholder: 'Ask about production, pallets, materials, statistics...' },
  es: { name: '🇪🇸 Español', placeholder: 'Pregunta sobre producción, pallets, materiales, estadísticas...' },
  fr: { name: '🇫🇷 Français', placeholder: 'Posez des questions sur la production, palettes, matériaux...' },
  pt: { name: '🇵🇹 Português', placeholder: 'Pergunte sobre produção, paletes, materiais, estatísticas...' },
  pa: { name: '🇮🇳 ਪੰਜਾਬੀ', placeholder: 'ਉਤਪਾਦਨ, ਪੈਲੇਟ, ਸਮੱਗਰੀ ਬਾਰੇ ਪੁੱਛੋ...' },
  hi: { name: '🇮🇳 हिन्दी', placeholder: 'उत्पादन, पैलेट, सामग्री के बारे में पूछें...' }
};

const INITIAL_MESSAGES = {
  en: 'Hello! I\'m your intelligent assistant for the Plixies production system. I can help you with real-time information about packets, pallets, production, raw materials and much more. What would you like to know?',
  es: '¡Hola! Soy tu asistente inteligente para el sistema de producción de Plixies. Puedo ayudarte con información en tiempo real sobre packets, pallets, producción, materia prima y mucho más. ¿Qué te gustaría saber?',
  fr: 'Bonjour! Je suis votre assistant intelligent pour le système de production Plixies. Je peux vous aider avec des informations en temps réel sur les paquets, palettes, production, matières premières et bien plus. Que souhaitez-vous savoir?',
  pt: 'Olá! Sou seu assistente inteligente para o sistema de produção da Plixies. Posso ajudá-lo com informações em tempo real sobre pacotes, paletes, produção, matéria-prima e muito mais. O que gostaria de saber?',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਪਲਿਕਸੀਜ਼ ਉਤਪਾਦਨ ਪ੍ਰਣਾਲੀ ਲਈ ਤੁਹਾਡਾ ਬੁੱਧੀਮਾਨ ਸਹਾਇਕ ਹਾਂ। ਮੈਂ ਤੁਹਾਨੂੰ ਪੈਕੇਟ, ਪੈਲੇਟ, ਉਤਪਾਦਨ, ਕੱਚੇ ਮਾਲ ਅਤੇ ਹੋਰ ਬਹੁਤ ਕੁਝ ਬਾਰੇ ਰੀਅਲ-ਟਾਈਮ ਜਾਣਕਾਰੀ ਨਾਲ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਤੁਸੀਂ ਕੀ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ?',
  hi: 'नमस्ते! मैं प्लिक्सीज़ उत्पादन प्रणाली के लिए आपका बुद्धिमान सहायक हूं। मैं आपकी पैकेट, पैलेट, उत्पादन, कच्चे माल और बहुत कुछ के बारे में रीयल-टाइम जानकारी के साथ मदद कर सकता हूं। आप क्या जानना चाहेंगे?'
};

export default function DBChat() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // Default a inglés
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: INITIAL_MESSAGES[selectedLanguage as keyof typeof INITIAL_MESSAGES],
      timestamp: new Date(),
      language: selectedLanguage
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actualizar mensaje inicial cuando cambie el idioma
  useEffect(() => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: INITIAL_MESSAGES[selectedLanguage as keyof typeof INITIAL_MESSAGES],
      timestamp: new Date(),
      language: selectedLanguage
    }]);
  }, [selectedLanguage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      language: selectedLanguage
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          language: selectedLanguage
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Leer el stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No se pudo leer la respuesta');
      }

      let assistantContent = '';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        language: selectedLanguage
      };

      // Agregar el mensaje vacío del asistente
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                // Actualizar el mensaje del asistente
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: assistantContent }
                      : msg
                  )
                );
              }
            } catch (e) {
              // Ignorar errores de parsing
            }
          }
        }
      }

    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Ocurrió un error al procesar tu consulta');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta de nuevo.',
        timestamp: new Date(),
        language: selectedLanguage
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow">
      {/* Selector de idioma */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="text-slate-100 font-medium">🤖 Production AI Assistant</h2>
        <div className="flex items-center space-x-2">
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-sm focus:border-slate-500 outline-none"
          >
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <option key={code} value={code}>{lang.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 h-[60vh] overflow-y-auto space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={
                "inline-block px-3 py-2 rounded-xl max-w-[80%] " +
                (message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-100")
              }
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.role === "assistant" && (
                <div className="text-xs text-slate-400 mt-1 opacity-60 flex items-center space-x-1">
                  <span>🤖 Real-time data response</span>
                  {message.language && (
                    <span className="px-1 py-0.5 bg-slate-700 rounded text-xs">
                      {LANGUAGES[message.language as keyof typeof LANGUAGES]?.name.split(' ')[0]}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-left">
            <div className="inline-block px-3 py-2 rounded-xl bg-slate-800 text-slate-300">
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                <span>
                  {selectedLanguage === 'en' && 'Analyzing database...'}
                  {selectedLanguage === 'es' && 'Analizando base de datos...'}
                  {selectedLanguage === 'fr' && 'Analyse de la base de données...'}
                  {selectedLanguage === 'pt' && 'Analisando banco de dados...'}
                  {selectedLanguage === 'pa' && 'ਡੇਟਾਬੇਸ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ...'}
                  {selectedLanguage === 'hi' && 'डेटाबेस का विश्लेषण...'}
                </span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-left">
            <div className="inline-block px-3 py-2 rounded-xl bg-red-900/50 text-red-200 border border-red-800/50">
              Error: {error}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl bg-slate-800 text-slate-100 outline-none border border-slate-700 focus:border-slate-500"
          placeholder={LANGUAGES[selectedLanguage as keyof typeof LANGUAGES]?.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "..." : (
            selectedLanguage === 'en' ? 'Send' :
            selectedLanguage === 'es' ? 'Enviar' :
            selectedLanguage === 'fr' ? 'Envoyer' :
            selectedLanguage === 'pt' ? 'Enviar' :
            selectedLanguage === 'pa' ? 'ਭੇਜੋ' :
            selectedLanguage === 'hi' ? 'भेजें' : 'Send'
          )}
        </button>
      </form>
      
      <div className="px-4 pb-3 text-xs text-slate-500">
        💡 {
          selectedLanguage === 'en' ? 'Ask about production, pallets, materials, statistics, problems, etc.' :
          selectedLanguage === 'es' ? 'Pregunta sobre producción, pallets, materiales, estadísticas, problemas, etc.' :
          selectedLanguage === 'fr' ? 'Posez des questions sur la production, palettes, matériaux, statistiques, problèmes, etc.' :
          selectedLanguage === 'pt' ? 'Pergunte sobre produção, paletes, materiais, estatísticas, problemas, etc.' :
          selectedLanguage === 'pa' ? 'ਉਤਪਾਦਨ, ਪੈਲੇਟ, ਸਮੱਗਰੀ, ਅੰਕੜੇ, ਸਮੱਸਿਆਵਾਂ ਆਦਿ ਬਾਰੇ ਪੁੱਛੋ।' :
          selectedLanguage === 'hi' ? 'उत्पादन, पैलेट, सामग्री, आंकड़े, समस्याओं आदि के बारे में पूछें।' :
          'Ask about production, pallets, materials, statistics, problems, etc.'
        }
      </div>
    </div>
  );
}
