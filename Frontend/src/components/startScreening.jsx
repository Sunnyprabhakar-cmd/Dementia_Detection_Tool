function StartScreening({ setScreeningId }) {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

    const handleStart = async () => {

        try {

            console.log("SETTER RECEIVED:", setScreeningId);

            const token = localStorage.getItem("token");

            const response = await fetch(
                `${API_BASE_URL}/api/screening/start`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log("BACKEND DATA:", data);

            if (!response.ok) {
                throw new Error(data.message);
            }

            console.log(
                "ID FROM BACKEND:",
                data.screening.id
            );

            setScreeningId(data.screening.id);

        } catch (error) {

            console.error(
                "Failed to start screening:",
                error.message
            );

        }
    };

    return (
        <div>

            <h2>Start Cognitive Screening</h2>

            <button onClick={handleStart}>
                Start Screening
            </button>

        </div>
    );
}

export default StartScreening;