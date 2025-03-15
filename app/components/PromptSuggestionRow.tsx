import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionRow = ({onPromptClick}) => {
    const prompts=[
        "What are the top news?",
        "Get me the latest news",
        "What are the latest ai tech updates ?"
    ]
    return (
      <div className="prompt-suggestion-row">
        {prompts.map((prompt, index)=> 
        <PromptSuggestionButton 
        key={`suggestion-${index}`}
        text = {prompt}
        onClick = { () => onPromptClick(prompt)}
        />)}
      </div>
    )
  }
  
  export default PromptSuggestionRow