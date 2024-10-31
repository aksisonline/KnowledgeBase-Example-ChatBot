import { useState, useEffect } from "react";
import axios from "axios";
import { Moon, Sun, Send, Loader2 } from "lucide-react";
import { QdrantClient } from "@qdrant/js-client-rest";
import * as  cheerio from "cheerio";
import * as tf from "@tensorflow/tfjs"; // Import TensorFlow.js

export default function Component() {
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState(null); // State to hold the model

  const qdrantClient = new QdrantClient({ url: "http://localhost:6333" });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Load the pre-trained mini LM model
  useEffect(() => {
    const loadModel = async () => {
      const model = await tf.loadGraphModel("URL_TO_YOUR_MODEL"); // Update with your model URL
      setModel(model);
    };
    loadModel();
  }, []);

  const vectorizeText = async (text) => {
    if (!model) return Array(1536).fill(0); // Return placeholder if model is not loaded

    // Preprocess the input text (this part will depend on your model's requirements)
    const inputTensor = tf.tensor([[text]]); // Adjust shape based on your model
    const embeddings = model.predict(inputTensor);
    const vector = embeddings.dataSync(); // Get the vector representation
    return Array.from(vector); // Convert to array
  };

  const searchGoogle = async (query) => {
    try {
      const response = await axios.get(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`
      );
      const $ = cheerio.load(response.data);
      const results = [];
      $("div.g").each((i, element) => {
        const title = $(element).find("h3.r").text();
        const snippet = $(element).find("div.s").text();
        if (title && snippet) {
          results.push({ title, snippet });
        }
      });
      return results
        .slice(0, 3)
        .map((r) => `${r.title}: ${r.snippet}`)
        .join("\n\n");
    } catch (error) {
      console.error("Error searching Google:", error);
      return "";
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage = { sender: "user", text: input };
    setChat((prevChat) => [...prevChat, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Query Qdrant for relevant information
      const vector = await vectorizeText(input); // Get the vector for input
      const qdrantResponse = await qdrantClient.search("music_chatbot", {
        vector,
        limit: 5,
      });

      const relevantInfo = qdrantResponse
        .map((point) => point.payload.content)
        .join("\n");

      // Perform Google search
      const googleResults = await searchGoogle(input);

      const response = await axios.post(
        "http://localhost:11434/v1/chat/completions",
        {
          model: "gemma2:2b",
          messages: [
            {
              role: "system",
              content: `You are a helpful music assistant. You can refer to the following information from our knowledge base: ${relevantInfo}. 
                        Additionally, here's some recent information from a web search: ${googleResults}. 
                        Answer all queries in plain text with no syntaxing, bolding or italics. If you don't have enough information, say so.`,
            },
            { role: "user", content: input },
          ],
        },
        {
          headers: {
            Authorization: `ollama`,
            "Content-Type": "application/json",
          },
        }
      );

      const botMessage = {
        sender: "bot",
        text: response.data.choices[0].message.content,
      };
      setChat((prevChat) => [...prevChat, botMessage]);

      // Store the conversation in Qdrant for future reference
      await qdrantClient.upsert("music_chatbot", {
        points: [
          {
            id: Date.now().toString(),
            vector: await vectorizeText(input + " " + botMessage.text),
            payload: { content: `User: ${input}\nBot: ${botMessage.text}` },
          },
        ],
      });
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        sender: "bot",
        text: "Sorry, I encountered an error. Please try again.",
      };
      setChat((prevChat) => [...prevChat, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col min-h-screen ${darkMode ? "dark" : ""}`}>
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <header className="py-4 px-6 bg-white dark:bg-gray-800 shadow-md">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Music RAG Chat
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full ${
                darkMode
                  ? "bg-gray-700 text-yellow-300 hover:bg-gray-600"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              } transition-colors duration-200`}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="flex-grow container mx-auto max-w-4xl px-4 py-8">
          <div className="border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            <div className="h-[calc(100vh-16rem)] overflow-y-auto p-4 space-y-4">
              {chat.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      message.sender === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    } shadow-md transition-all duration-300 ease-in-out animate-fade-in`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
                </div>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about music..."
                  className="flex-grow p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
