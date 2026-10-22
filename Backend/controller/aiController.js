export const analyzeScreeningWithAgents = async (_req, res) => {
  return res.status(503).json({
    status: "unavailable",
    message:
      "Automated risk interpretation is disabled because the heuristic ensemble is not clinically validated."
  });
};
