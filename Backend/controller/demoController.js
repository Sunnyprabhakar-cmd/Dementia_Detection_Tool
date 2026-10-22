import { buildSyntheticDemoReport, isDemoModeEnabled } from "../services/demoService.js";

export const getDemoReport = (req, res) => {
  if (!isDemoModeEnabled()) {
    return res.status(404).json({
      status: "unavailable",
      message: "Demo mode is disabled."
    });
  }

  return res.status(200).json({
    status: "simulated_demo",
    report: buildSyntheticDemoReport()
  });
};
