import React from "react";
import ReactMarkdown from "react-markdown";

const Bubble = ({ message }) => {
    return (
        <div className={`bubble ${message.role === "user" ? "user" : "assistant"}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
    );
};

export default Bubble;
