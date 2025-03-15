"use client";
import Image from "next/image";
import NewsGPT from "./assets/NewsGPT.png";
import { useState } from "react";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionRow from "./components/PromptSuggestionRow";

const Home = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handlePrompt = (promptText) => {
        setInput(promptText);
        handleSubmit(promptText);
    };

    const handleSubmit = async (eventOrText) => {
        eventOrText?.preventDefault?.(); // Prevent default if called from form
        const userMessage = input || eventOrText; // Handle both form submit and prompt click

        if (!userMessage.trim()) return;

        const newMessages = [...messages, { role: "user", content: userMessage }];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: newMessages }),
        });

        if (!response.body) {
            setIsLoading(false);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            assistantMessage += chunk;
            setMessages((prev) => [
                ...prev.filter((m) => m.role !== "assistant"), // Remove incomplete response
                { role: "assistant", content: assistantMessage },
            ]);
        }

        setIsLoading(false);
    };

    return (
        <main>
            <Image src={NewsGPT} width="250" alt="newsGPT Logo" />
            <section className={messages.length === 0 ? "" : "populated"}>
                {messages.length === 0 ? (
                    <>
                        <p className="starter-text">The place to go for all your Tech questions!</p>
                        <br />
                        <PromptSuggestionRow onPromptClick={handlePrompt} />
                    </>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <Bubble key={index} message={message} />
                        ))}
                        {isLoading && <LoadingBubble />}
                    </>
                )}
            </section>
            <form onSubmit={handleSubmit}>
                <input
                    className="question-box"
                    onChange={(e) => setInput(e.target.value)}
                    value={input}
                    placeholder="Ask a question"
                />
                <input type="submit" />
            </form>
        </main>
    );
};

export default Home;
