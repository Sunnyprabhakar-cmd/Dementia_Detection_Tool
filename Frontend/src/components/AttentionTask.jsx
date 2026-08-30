import { useEffect, useState } from "react";

const TOTAL_ROUNDS = 10;
const TARGET_TIMEOUT = 2000;

function AttentionTask({ screeningId, token }) {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    const [round, setRound] = useState(1);
    const [targetVisible, setTargetVisible] = useState(false);
    const [targetTime, setTargetTime] = useState(null);

    const [correct, setCorrect] = useState(0);
    const [wrong, setWrong] = useState(0);
    const [missed, setMissed] = useState(0);

    const [reactionTimes, setReactionTimes] = useState([]);

    const [finished, setFinished] = useState(false);

    useEffect(() => {
        startRound();

        return () => {
            if (window.attentionTimer) {
                clearTimeout(window.attentionTimer);
            }

            if (window.attentionTimeout) {
                clearTimeout(window.attentionTimeout);
            }
        };
    }, []);

    const startRound = () => {

        setTargetVisible(false);
        setTargetTime(null);

        const delay = Math.random() * 2000 + 1000;

        window.attentionTimer = setTimeout(() => {

            setTargetVisible(true);
            setTargetTime(Date.now());

            window.attentionTimeout = setTimeout(() => {

                setTargetVisible(false);

                setMissed(prev => prev + 1);

                moveToNextRound();

            }, TARGET_TIMEOUT);

        }, delay);
    };

    const handleClick = () => {

        if (!targetVisible) {

            setWrong(prev => prev + 1);

            return;
        }

        const reactionTime =
            (Date.now() - targetTime) / 1000;

        setReactionTimes(prev => [
            ...prev,
            reactionTime
        ]);

        setCorrect(prev => prev + 1);

        clearTimeout(window.attentionTimeout);

        moveToNextRound();
    };

    const moveToNextRound = () => {

        setTargetVisible(false);
        setTargetTime(null);

        if (round === TOTAL_ROUNDS) {

            setFinished(true);

            return;
        }

        setRound(prev => prev + 1);

        setTimeout(() => {
            startRound();
        }, 300);
    };

    const submitResult = async () => {

        try {

            const totalAttempts =
                correct + wrong + missed;

            const accuracy =
                totalAttempts > 0
                    ? (correct / TOTAL_ROUNDS) * 100
                    : 0;

            const averageReactionTime =
                reactionTimes.length > 0
                    ? reactionTimes.reduce(
                        (sum, time) => sum + time,
                        0
                    ) / reactionTimes.length
                    : 0;

            const response = await fetch(
                `${API_BASE_URL}/api/screening/${screeningId}/response`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        taskType: "attention",

                        responseData: {
                            totalRounds: TOTAL_ROUNDS,
                            correct,
                            wrong,
                            missed,
                            accuracy,
                            reactionTimes,
                            averageReactionTime
                        },

                        reactionTime: averageReactionTime

                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            console.log("Attention saved:", data);

        } catch (error) {

            console.error(
                "Attention submission failed:",
                error.message
            );

        }
    };

    if (finished) {

        return (
            <div>

                <h2>Attention Test Complete</h2>

                <p>Correct: {correct}</p>

                <p>Wrong: {wrong}</p>

                <p>Missed: {missed}</p>

                <p>
                    Average Reaction Time: {
                        reactionTimes.length > 0
                            ? (
                                reactionTimes.reduce(
                                    (sum, time) => sum + time,
                                    0
                                ) / reactionTimes.length
                            ).toFixed(2)
                            : "0.00"
                    } seconds
                </p>

                <button onClick={submitResult}>
                    Save Attention Result
                </button>

            </div>
        );
    }

    return (
        <div>

            <h2>Attention Test</h2>

            <p>
                Round {round} / {TOTAL_ROUNDS}
            </p>

            <p>
                Click the button when the target appears.
            </p>

            <button onClick={handleClick}>
                {targetVisible ? "🎯 CLICK NOW" : "WAIT..."}
            </button>

        </div>
    );
}

export default AttentionTask;