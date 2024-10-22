import { useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');

  // Fetch knowledge base data from backend
  useEffect(() => {
    const fetchKnowledgeBase = async () => {
      try {
        // const response = await axios.get('http://localhost:5000/fetch-data');
        setKnowledgeBase('Abhiram Kanna is a creative design advisor at Entrepreneurs Club Visakhapatnam');
      } catch (error) {
        console.error('Error fetching knowledge base:', error);
      }
    };
    fetchKnowledgeBase();
  }, []);

  // Function to handle message submission
  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    // Add user's message to chat
    const userMessage = { sender: 'user', text: input };
    setChat([...chat, userMessage]);

    // Clear input field
    setInput('');

    // Query OpenAI API for a response
    try {
      const response = await axios.post(
        'http://localhost:11434/v1/chat/completions',
        {
          model: 'gemma2:2b',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant. You can refer to the following knowledge base: ${knowledgeBase}`,
            },
            { role: 'user', content: input },
          ],
        },
        {
          headers: {
            Authorization: `ollama`,
            'Content-Type': 'application/json',
          },
        }
      );

      const botMessage = { sender: 'bot', text: response.data.choices[0].message.content };
      console.log(response.data.choices[0].message.content);
      setChat((prevChat) => [...prevChat, botMessage]);
    } catch (error) {
      console.error('Error querying OpenAI:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Testing (RAG)</h1>
      <div className="w-full max-w-2xl border rounded-lg bg-white p-4 shadow">
        <div className="h-80 overflow-y-scroll p-2 border-b mb-4">
          {chat.map((message, index) => (
            <div key={index} className={`my-2 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <strong>{message.sender === 'user' ? 'You: ' : 'Bot: '}</strong>
              <span className="block text-gray-700">{message.text}</span>
            </div>
          ))}
        </div>
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow border p-2 rounded-l-lg focus:outline-none"
          />
          <button onClick={handleSendMessage} className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
