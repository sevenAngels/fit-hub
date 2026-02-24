import { readFileSync } from "node:fs";

const matrixPath = "/Users/javadreamer/Develop/Nextjs/fit-hub/.sisyphus/evidence/task-3-server-action-matrix.md";
const matrix = readFileSync(matrixPath, "utf8");

const requiredActions = [
  "signUp",
  "signIn",
  "resetPassword",
  "updatePassword",
  "saveBasicInfo",
  "saveBodyInfo",
  "saveMBTIAndComplete",
  "createMealRecord",
  "uploadMealImage",
  "getDashboardData",
  "saveWeightGoal",
  "saveCalorieGoal",
  "saveDailyMood",
  "getProfile",
  "uploadAvatar",
  "generateWeeklyReport"
];

const missing = requiredActions.filter((name) => !matrix.includes(`\`${name}\``));

if (missing.length > 0) {
  console.error("Matrix is missing required action rows:");
  missing.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

console.log("Task 3 matrix contains required MVP action rows.");
