import { useEffect, useState } from "react";

const WORDS = [
    "APPLE",
    "RIVER",
    "CHAIR",
    "CLOCK",
    "MANGO"
];

function MemoryTask({ screeningId, token }) {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    const [timeLeft, setTimeLeft] = useState(10);
    const [showWords, setShowWords] = useState(true);
    const [answers, setAnswers] = useState(["", "", "", "", ""]);
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {

        const timer = setInterval(() => {

            setTimeLeft(prev => {

                if (prev === 1) {
                    clearInterval(timer);
                    setShowWords(false);
                    setStartTime(Date.now());
                    return 0;
                }

                return prev - 1;
            });

        }, 1000);

        return () => clearInterval(timer);

    }, []);

    const handleChange = (index, value) => {

        const newAnswers = [...answers];

        newAnswers[index] = value;

        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {

    try {
         console.log("TOKEN:", token);
        const endTime = Date.now();

        const reactionTime =
            (endTime - startTime) / 1000;

        const response = await fetch(
            `${API_BASE_URL}/api/screening/${screeningId}/response`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    taskType: "memory",

                    responseData: {
                        wordsShown: WORDS,
                        wordsRecalled: answers
                    },

                    reactionTime
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        console.log("Saved:", data);

    } catch (error) {
        console.error("Error:", error);
    }
  };


    return (
        <div>

            {showWords ? (

                <div>
                    <h2>Remember these words</h2>

                    {WORDS.map(word => (
                        <p key={word}>{word}</p>
                    ))}

                    <h3>
                        Time remaining: {timeLeft}
                    </h3>
                </div>

            ) : (

                <div>

                    <h2>What words do you remember?</h2>

                    {answers.map((answer, index) => (
                        <input
                            key={index}
                            value={answer}
                            onChange={(e) =>
                                handleChange(index, e.target.value)
                            }
                            placeholder={`Word ${index + 1}`}
                        />
                    ))}

                    <button onClick={handleSubmit}>
                        Submit
                    </button>

                </div>
            )}

        </div>
    );
}

export default MemoryTask;